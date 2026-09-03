"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { isPostHogInitialized } from "../PostHogClient";
import { clearAccountLocalStateOnSignOut } from "./accountLocalState";
import { Icon } from "./icons";
import { LocalePicker } from "./LocalePicker";
import { SeatSettings } from "./SeatSettings";
import { useTheme } from "./ThemeContext";

// The Settings PAGE (mobile bottom nav, 2026-08-23). A route, not a modal: no
// close button, no scrim, normal document flow, so the URL is linkable and the
// browser back button works. It absorbs everything SettingsDialog offers, the
// display name above all: removing the Home gear from the mobile header left
// this page as the display name's only door on a phone, and that name prints on
// certificates. The gear (and its dialog) survives on desktop.
//
// Two languages, kept apart on purpose: the APP language (chrome locale) is an
// account-level preference and lives here; the READING language (a course's
// Edition, ?lang=) is per-course and lives in the reader drawer, at the top of
// the lesson list (ReadingLanguage.tsx, 2026-08-24), plus the owner's Home card
// globe.
export function SettingsPage() {
  const t = useTranslations("Settings");
  const tc = useTranslations("Common");
  const tf = useTranslations("Footer");
  const me = useQuery(api.users.me);
  // `undefined` while it loads, so neither the account section nor the seat section
  // flashes before the answer arrives.
  const seat = useQuery(api.accessCodes.mySeat);
  const { theme, toggle } = useTheme();
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-8">
      <header className="flex h-16 items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-accent">{t("title")}</h1>
      </header>
      <div>
        {/* An ordinary account has an email and a display name. A **Seat** on a
            shared Access Code has neither, deliberately (ADR 0031), so the two are
            mutually exclusive rather than stacked: showing "Signed in as" with a
            blank beside it, and a name field that only prints on certificates a Seat
            cannot earn, would be the app asking for an email in all but name. The
            promise has to be visible in the product and not only in the policy. */}
        {seat === null && (
          <Section title={t("account")}>
            <div className="flex items-center justify-between gap-3 px-3 py-3.5 text-sm">
              <span className="text-ink">{t("signedInAs")}</span>
              <span className="min-w-0 truncate text-soft">{me?.email ?? ""}</span>
            </div>
            <DisplayNameRow />
          </Section>
        )}
        <SeatSettings />

        <Section title={t("appearance")}>
          <button
            onClick={toggle}
            className="flex w-full items-center justify-between px-3 py-3.5 text-sm text-ink"
          >
            <span>{t("theme")}</span>
            <span className="flex items-center gap-2 text-soft">
              {theme === "dark" ? t("dark") : t("light")}
              <Icon name={theme === "dark" ? "moon" : "sun"} className="h-4 w-4" />
            </span>
          </button>
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <span className="text-sm text-ink">{t("appLanguage")}</span>
            <LocalePicker />
          </div>
        </Section>

        {/* The PayFast-compliance legal pages, same trio the site footer links. */}
        <Section title={t("support")}>
          <SupportLink href="/terms">{tf("termsAndConditions")}</SupportLink>
          <SupportLink href="/privacy">{tf("privacyPolicy")}</SupportLink>
          <SupportLink href="/refunds">{tf("refundsAndCancellation")}</SupportLink>
        </Section>

        <button
          onClick={() => {
            if (isPostHogInitialized()) posthog.reset();
            clearAccountLocalStateOnSignOut();
            void signOut().then(() => router.replace("/"));
          }}
          className="mt-4 w-full rounded-2xl border border-line px-3 py-3.5 text-start text-sm text-danger active:bg-hi"
        >
          {tc("signOut")}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <p className="px-1 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">{title}</p>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">{children}</div>
    </>
  );
}

function SupportLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between px-3 py-3.5 text-sm text-ink hover:bg-hi">
      <span>{children}</span>
      <Icon name="chevron" className="h-4 w-4 text-soft" />
    </Link>
  );
}

// The display name, the setting that lost its only mobile door when the Home
// gear came off. Same mutation SettingsDialog uses; a rename here changes what
// FUTURE certificates print (earned ones froze their name at claim time).
function DisplayNameRow() {
  const t = useTranslations("Settings");
  const me = useQuery(api.users.me);
  const setName = useMutation(api.users.setName);
  const [name, setNameInput] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed from the account once it lands, and never clobber typing.
  useEffect(() => {
    if (!seeded && me !== undefined) {
      setNameInput(me?.name ?? "");
      setSeeded(true);
    }
  }, [seeded, me]);

  const dirty = seeded && name.trim() !== (me?.name ?? "");

  return (
    <div className="flex flex-col gap-2 px-3 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="settings-display-name" className="shrink-0 text-sm text-ink">
          {t("displayName")}
        </label>
        <button
          onClick={() => {
            setSaving(true);
            void setName({ name }).finally(() => setSaving(false));
          }}
          disabled={!dirty || saving}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-ink disabled:opacity-40"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
      <input
        id="settings-display-name"
        value={name}
        onChange={(e) => setNameInput(e.target.value)}
        placeholder={t("notSet")}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
      />
      <p className="text-xs text-soft">{t("displayNameHint")}</p>
    </div>
  );
}
