"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Icon } from "../icons";
import { type Edition } from "./shared";

// The Users peer of the manage route. Ticket 17 moved the access roster off the
// per-Edition sharing panel onto this course-scoped surface; ticket 22 builds
// the real one (language as a row attribute, one merged list, Editor assignable
// only to someone already shared with).
//
// ponytail: until 22 lands this relocates the existing per-Edition rosters
// unchanged, one section per edition, so the owner keeps the role toggle and
// revoke without any new backend. `listEditionAccess` stays the only query.
export function UsersTab({ topicSlug, editions }: { topicSlug: string; editions: Edition[] }) {
  const t = useTranslations("Editions");
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-soft">{t("usersIntro")}</p>
      {editions.map((ed) => (
        <section key={ed.lang} className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-soft">{ed.name}</h3>
          <AccessRoster topicSlug={topicSlug} lang={ed.lang} />
        </section>
      ))}
    </div>
  );
}

// The access roster for one Edition (ADR 0020): everyone the owner has granted
// access to, accepted people and pending invites, each with a Can view / Can
// edit toggle and a revoke control. Owner-only, reactive. "Can edit" grants
// exactly the owner's in-place prose editing on this one Edition.
function AccessRoster({ topicSlug, lang }: { topicSlug: string; lang: string }) {
  const t = useTranslations("Editions");
  const roster = useQuery(api.shares.listEditionAccess, { topicSlug, lang });
  if (roster === undefined) return <p className="text-xs text-soft">{t("loadingAccess")}</p>;
  if (roster.length === 0) return <p className="text-xs text-soft">{t("noAccess")}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {roster.map((entry) => (
        <AccessRow key={`${entry.status}:${entry.email}`} topicSlug={topicSlug} lang={lang} entry={entry} />
      ))}
    </ul>
  );
}

// One roster row: the person's email (with a "pending" marker when they have no
// account yet), a Can view / Can edit segmented toggle (setShareRole), and a
// revoke control (revokeShare). Controls are identical for accepted and pending
// entries; the role rides through claim-on-signup.
function AccessRow({
  topicSlug,
  lang,
  entry,
}: {
  topicSlug: string;
  lang: string;
  entry: { email: string; role: "viewer" | "editor"; status: "accepted" | "pending" };
}) {
  const t = useTranslations("Editions");
  const setShareRole = useMutation(api.shares.setShareRole);
  const revokeShare = useMutation(api.shares.revokeShare);
  const [busy, setBusy] = useState(false);

  const setRole = (role: "viewer" | "editor") => {
    if (role === entry.role) return;
    setBusy(true);
    void setShareRole({ topicSlug, email: entry.email, lang, role }).finally(() => setBusy(false));
  };

  return (
    <li className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-ink" title={entry.email}>
          {entry.email}
        </span>
        {entry.status === "pending" && <span className="text-[11px] text-soft">{t("pendingJoins")}</span>}
      </div>
      <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-line text-[12px]">
        {(["viewer", "editor"] as const).map((role) => (
          <button
            key={role}
            type="button"
            disabled={busy}
            aria-pressed={entry.role === role}
            onClick={() => setRole(role)}
            className={`px-2.5 py-1 font-medium transition-colors disabled:opacity-60 ${
              entry.role === role ? "bg-accent text-white" : "bg-card text-soft hover:bg-hi"
            }`}
          >
            {role === "viewer" ? t("canView") : t("canEdit")}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        aria-label={t("revokeAccessFor", { email: entry.email })}
        title={t("revokeAccess")}
        onClick={() => {
          setBusy(true);
          void revokeShare({ topicSlug, email: entry.email, lang }).finally(() => setBusy(false));
        }}
        className="shrink-0 rounded-lg p-1.5 text-soft transition-colors hover:bg-hi hover:text-danger disabled:opacity-60"
      >
        <Icon name="trash" className="h-3.75 w-3.75" />
      </button>
    </li>
  );
}
