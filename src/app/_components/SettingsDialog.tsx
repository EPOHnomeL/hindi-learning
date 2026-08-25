"use client";

import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { langInfo } from "../../../convex/languages";
import { LOCALES } from "~/i18n/config";
import { useSetLocale } from "~/i18n/locale-client";
import { Icon } from "./icons";
import { SeatSettings } from "./SeatSettings";
import { useTheme } from "./ThemeContext";
import { Dialog } from "./ui";

// The account settings popup (the gear in the dashboard header). Bundles the
// three preferences a learner tweaks in one place: display name (their account
// name, which is also what prints on certificates), app language, and theme —
// replacing the header's separate globe picker + theme toggle. Guest-only
// surfaces (the footer) keep the standalone LocalePicker: a guest has no account,
// so there's no display name and nothing here to open.
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Settings");
  const tc = useTranslations("Common");
  const me = useQuery(api.users.me);
  const setName = useMutation(api.users.setName);
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { theme, setTheme } = useTheme();

  const [name, setNameInput] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Seed the field from the account once it first loads — never clobber typing.
  useEffect(() => {
    if (!seeded && me !== undefined) {
      setNameInput(me?.name ?? "");
      setSeeded(true);
    }
  }, [seeded, me]);

  const dirty = seeded && name.trim() !== (me?.name ?? "");

  async function save() {
    setStatus("saving");
    await setName({ name });
    setStatus("saved");
  }

  return (
    <Dialog title={t("title")} onClose={onClose}>
      <div className="flex flex-col gap-6">
        {/* A Seat on a shared Access Code, if the caller holds one: their nickname,
            their PIN change and their withdrawal. Renders nothing for everybody else,
            by server answer rather than by this dialog's judgement. */}
        <SeatSettings />
        {/* Display name — the account name, which prints on certificates. */}
        <section className="flex flex-col gap-2">
          <label htmlFor="settings-name" className="text-xs font-medium uppercase tracking-wide text-soft">
            {t("displayName")}
          </label>
          <div className="flex gap-2">
            <input
              id="settings-name"
              value={name}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (status !== "idle") setStatus("idle");
              }}
              className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || status === "saving"}
              className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm text-ink transition-colors hover:bg-hi hover:text-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink"
            >
              {status === "saving" ? t("saving") : !dirty && status === "saved" ? t("saved") : t("save")}
            </button>
          </div>
          <p className="text-xs text-soft">{t("displayNameHint")}</p>
        </section>

        {/* App language — every option shows its native name + English name. */}
        <section className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-soft">{tc("language")}</span>
          <div className="flex flex-col gap-0.5">
            {LOCALES.map((code) => {
              const info = langInfo(code);
              const active = code === locale;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    active ? "bg-hi" : "hover:bg-hi"
                  }`}
                >
                  <span className="flex flex-col">
                    <span className="text-sm text-ink" dir={info.rtl ? "rtl" : "ltr"}>
                      {info.native}
                    </span>
                    {info.name !== info.native && <span className="text-xs text-soft">{info.name}</span>}
                  </span>
                  {active && <Icon name="check" className="h-4 w-4 shrink-0 text-gold" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* Theme — a light/dark segmented control. */}
        <section className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-soft">{t("theme")}</span>
          <div className="inline-flex w-fit rounded-lg border border-line p-0.5">
            {(["light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  theme === mode ? "bg-hi text-accent" : "text-soft hover:text-accent"
                }`}
              >
                <Icon name={mode === "light" ? "sun" : "moon"} className="h-4 w-4" /> {t(mode)}
              </button>
            ))}
          </div>
        </section>
      </div>
    </Dialog>
  );
}
