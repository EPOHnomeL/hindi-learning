"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { type ReactNode } from "react";
import { api } from "../../../../convex/_generated/api";
import { Icon, type IconName } from "../icons";
import { formatPrice } from "../Paygate";
import { barPercent, priceSummary } from "./dashboardDerive";
import { EmptyPanel, type Edition } from "./shared";

// The Dashboard peer of the manage route (ui-overhaul 23): the owner's read-only
// view of their own course. Five stats at the head, then the two people-shaped
// panels, all from ONE course-wide query (api.dashboard.courseStats) plus the
// editions list the shell already holds.
//
// READ-ONLY by decision. No control lives here; a stat that has an owning tab is
// a button that switches to it, which is the whole of this tab's interactivity.
//
// Two siblings land beside these panels and are NOT built here:
//   - ticket 25, the course's payout, goes between the stats and Reach (money
//     reads first, and it is its own owner-gated money query).
//   - ticket 26, the editor-by-language table, goes at the foot, below Progress.
// The section order below is the slot; neither is stubbed, because an empty
// placeholder card is a thing the operator has to look at for no reason.

type ManageTab = "sharing" | "users";

export function DashboardTab({
  topicSlug,
  editions,
  onGoTo,
}: {
  topicSlug: string;
  editions: Edition[];
  onGoTo: (tab: ManageTab) => void;
}) {
  const t = useTranslations("ManageDashboard");
  const stats = useQuery(api.dashboard.courseStats, { topicSlug });

  if (stats === undefined) return <DashboardSkeleton />;
  // The shell has already resolved the owner; a null here means the course went
  // away underneath us.
  if (stats === null) return <EmptyPanel icon="x" tone="bad" message={t("loadError")} />;

  const published = editions.filter((e) => e.published).length;
  const price = priceSummary(stats.prices);
  const name = (lang: string) => editions.find((e) => e.lang === lang)?.name ?? lang;

  return (
    <div className="flex flex-col gap-7">
      <p className="text-xs text-soft">{t("intro")}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          label={t("statPublished")}
          value={t("publishedOf", { published, total: editions.length })}
          icon="globe"
          onGoTo={() => onGoTo("sharing")}
          goToLabel={t("goToSharing")}
        />
        <Stat
          label={t("statPeople")}
          value={String(stats.people)}
          icon="users"
          onGoTo={() => onGoTo("users")}
          goToLabel={t("goToUsers")}
        />
        <Stat
          label={t("statEditors")}
          value={String(stats.editors)}
          icon="users"
          onGoTo={() => onGoTo("users")}
          goToLabel={t("goToUsers")}
        />
        <Stat
          label={t("statLanguages")}
          value={String(editions.length)}
          icon="book"
          onGoTo={() => onGoTo("sharing")}
          goToLabel={t("goToSharing")}
        />
        <Stat
          className="col-span-2 sm:col-span-1"
          label={t("statPrice")}
          value={
            price.kind === "free"
              ? t("priceFree")
              : price.kind === "one"
                ? formatPrice(price.amount, price.currency)
                : t("priceRange", {
                    min: formatPrice(price.min, price.currency),
                    max: formatPrice(price.max, price.currency),
                  })
          }
          icon="chart"
          onGoTo={() => onGoTo("sharing")}
          goToLabel={t("goToSharing")}
        />
      </div>

      {/* ticket 25's payout panel lands here. */}

      <Panel title={t("reachTitle")} hint={t("reachHint")}>
        {stats.perLanguage.length === 0 ? (
          <p className="text-xs text-soft">{t("noPeopleYet")}</p>
        ) : (
          <BarList
            rows={stats.perLanguage.map((r) => ({ key: r.lang, label: name(r.lang), count: r.people }))}
          />
        )}
      </Panel>

      <Panel
        title={t("progressTitle")}
        hint={t("progressHint", { learners: stats.learners, lessons: stats.lessonCount })}
      >
        {stats.truncated ? (
          <p className="text-xs text-soft">{t("progressTooLarge")}</p>
        ) : stats.learners === 0 ? (
          <p className="text-xs text-soft">{t("noLearnersYet")}</p>
        ) : (
          <BarList rows={stats.buckets.map((b) => ({ key: b.key, label: t(`buckets.${b.key}`), count: b.count }))} />
        )}
      </Panel>

      {/* ticket 26's editor-by-language table lands here. */}
    </div>
  );
}

// One stat tile: a label, its figure, and (when the stat has an owning tab) a
// press that switches to it. The figure is the tile's point, so it carries the
// weight and the label sits above it small.
function Stat({
  label,
  value,
  icon,
  onGoTo,
  goToLabel,
  className = "",
}: {
  label: string;
  value: string;
  icon: IconName;
  onGoTo: () => void;
  goToLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onGoTo}
      title={goToLabel}
      className={`flex flex-col gap-1 rounded-xl border border-line bg-card px-3 py-2.5 text-left transition-colors hover:bg-hi ${className}`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-soft">
        <Icon name={icon} className="h-3.25 w-3.25 shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </span>
      <span className="truncate text-[17px] font-semibold text-ink">{value}</span>
    </button>
  );
}

function Panel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-soft">{title}</h3>
        <p className="text-xs text-soft">{hint}</p>
      </div>
      {children}
    </section>
  );
}

// The one chart shape this tab uses, for both panels: a labelled horizontal bar
// per row, every bar direct-labelled with its own count.
//
// Per the dataviz skill this is a SEQUENTIAL, one-hue form, not a categorical
// one. Both panels plot a single measure (how many people) and the identity of a
// row is carried by its written label, so painting fourteen languages in
// fourteen hues would spend the categorical palette on a distinction the reader
// already has in words, and bury the one long bar that is the actual point. The
// hue is `--color-accent`, which is part of the app's 14-token contract and so
// follows a whitelabel tenant's brand; it clears 3:1 against both the light and
// the dark card surface. The track is a light step of the same hue, never a grey.
//
// No tooltip layer, deliberately: every mark already carries its exact value
// beside it, so a hover would only restate the label, and the manage route is
// phone first, where there is no hover at all.
function BarList({ rows }: { rows: { key: string; label: string; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 0);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2.5">
          <span className="w-[38%] shrink-0 truncate text-[12.5px] text-ink" title={row.label}>
            {row.label}
          </span>
          <span
            className="h-2.5 min-w-0 flex-1 rounded-[4px]"
            style={{ background: "color-mix(in srgb, var(--color-accent) 14%, transparent)" }}
            aria-hidden
          >
            <span
              className="block h-full rounded-r-[4px] bg-accent"
              style={{ width: `${barPercent(row.count, max)}%` }}
            />
          </span>
          <span className="w-7 shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-ink">
            {row.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[62px] rounded-xl border border-line bg-soft/10" />
        ))}
      </div>
      <div className="h-28 rounded-xl border border-line bg-soft/10" />
      <div className="h-40 rounded-xl border border-line bg-soft/10" />
    </div>
  );
}
