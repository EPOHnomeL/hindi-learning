"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { SellerStatus } from "../../../convex/sellerStatus";
import type { TenantFlag } from "../../../convex/tenantFlags";
import { TENANT_THEME_TOKENS, type Token } from "../../design/tokens";
import { salesRange, type SalesPreset } from "./salesRange";
import { colorVar, rankLanguages, VIZ_SLOTS } from "./salesChart";
import { axisTicks, labelIndices, niceMax } from "./dayChart";
import { ConvexError } from "convex/values";

// The message to show the operator when a mutation refuses.
//
// **A production Convex deployment redacts a plain `Error`'s message** before it
// reaches the client — `e.message` is then the useless "[CONVEX M(...)] Server
// Error" string, which is exactly what the donation-flag precondition looked
// like the first time it fired in prod. Only `ConvexError`'s `data` survives the
// trip, so that is what we read first; a server that threw a plain Error gets
// the caller's own fallback rather than Convex's internal one.
function mutationError(e: unknown, fallback: string): string {
  if (e instanceof ConvexError && typeof e.data === "string") return e.data;
  return fallback;
}

// The Admin portal (/admin, ADR 0011 + issue 02, whitelabel issue 19): the
// dashboard is now scope-aware (ADR 0022). A **sys admin** manages the Allowlist,
// Sellers/Payouts, and every tenant via a tab switcher + tenant picker; a
// **tenant admin** is locked to their own tenant's panel (no Allowlist, no
// picker). Client-guarded by `myAdminScope` (UX only; the mutations are the real
// security boundary). Lists are live Convex queries, so edits reflect immediately.
export function AdminPanel() {
  const scope = useQuery(api.whitelist.myAdminScope);

  if (scope === undefined) {
    return <div className="grid min-h-dvh place-items-center text-soft">Checking access…</div>;
  }
  if (scope.role === "none") {
    return (
      <div className="mx-auto grid min-h-dvh max-w-2xl place-items-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-accent">Not authorised</h1>
          <p className="mt-2 text-sm text-soft">This page is for the workspace admin.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-accent2 underline-offset-2 hover:underline">
            ← Back to your courses
          </Link>
        </div>
      </div>
    );
  }
  // A tenant admin sees only their own tenant's panel, directly — no tabs, no
  // sidebar picker, no create action (issue 19).
  if (scope.role === "tenant") {
    return (
      <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 md:py-12">
        <header className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Tenant</h1>
          <Link href="/" className="shrink-0 rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
            ← Courses
          </Link>
        </header>
        <TenantDetail slug={scope.tenantSlug!} role="tenant" />
      </div>
    );
  }
  return <SysAdminDashboard />;
}

// The sys-admin dashboard: a tab switcher between the platform Allowlist and the
// per-tenant Tenants panel. Payouts is the default tab (2026-08-25): it is the one
// screen with money waiting on an action, so it is what the admin opens for.
function SysAdminDashboard() {
  const [tab, setTab] = useState<"allowlist" | "sales" | "payouts" | "tenants" | "generation">("payouts");
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
          <TabButton active={tab === "allowlist"} onClick={() => setTab("allowlist")}>
            Allowlist
          </TabButton>
          <TabButton active={tab === "sales"} onClick={() => setTab("sales")}>
            Sales
          </TabButton>
          <TabButton active={tab === "payouts"} onClick={() => setTab("payouts")}>
            Payouts
          </TabButton>
          <TabButton active={tab === "tenants"} onClick={() => setTab("tenants")}>
            Tenants
          </TabButton>
          <TabButton active={tab === "generation"} onClick={() => setTab("generation")}>
            Generation
          </TabButton>
        </div>
        <Link href="/" className="shrink-0 rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
          ← Courses
        </Link>
      </header>
      {tab === "allowlist" ? (
        <AllowlistManager />
      ) : tab === "sales" ? (
        <SalesManager />
      ) : tab === "payouts" ? (
        <PayoutsManager />
      ) : tab === "tenants" ? (
        <TenantsManager />
      ) : (
        <GenerationManager />
      )}
    </div>
  );
}

// The Generation tab (generation-observability, issue 04): what the Routine is
// authoring right now over a history of past Generation Runs. Both are live Convex
// queries (sys-admin-gated server-side), so they update on their own while open.
function GenerationManager() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Generation</h1>
        <p className="mt-0.5 text-sm text-soft">What the routine is building, and what it has built</p>
      </div>
      <GenerationUsageChart />
      <GeneratingNow />
      <RunHistory />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The shared day-bucketed stacked column chart (dataviz skill) behind both admin
// graphs: the Generation activity chart and the Sales-by-day chart. One column
// per day on a single count axis, stacked by series, with hairline gridlines at
// round tick values, a capped-width mark, 2px surface gaps between the stacked
// fills, and a hover tooltip per day. The tooltip is CSS-only (it lives inside
// the column it describes, revealed by group-hover), so the chart holds no
// state and re-renders only when its data does.
// ---------------------------------------------------------------------------

// One series' contribution to one day. `segments` are given bottom-to-top and
// carry their own colour, so the caller owns the palette mapping (language rank
// for Sales, fixed slots for Generation).
type DaySegment = { key: string; label: string; value: number; color: string };
type DayColumn = { dayMs: number; segments: DaySegment[] };

const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "UTC" });

function DayStackChart({ columns, empty, zero }: { columns: DayColumn[]; empty: string; zero: string }) {
  const H = 160; // px plot height
  const totals = columns.map((c) => c.segments.reduce((sum, s) => sum + s.value, 0));
  const peak = Math.max(...totals, 0);
  if (columns.length === 0 || peak === 0) return <p className="py-12 text-center text-sm text-soft">{empty}</p>;

  const top = niceMax(peak);
  const ticks = axisTicks(top);
  const labelled = new Set(labelIndices(columns.length));
  // A nonzero count always draws at least 3px, so a single sale on a busy axis
  // stays visible instead of rounding away to nothing.
  const px = (n: number) => (n > 0 ? Math.max((n / top) * H, 3) : 0);

  return (
    <div className="flex">
      <div className="relative w-7 shrink-0" style={{ height: H }} aria-hidden>
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute right-1.5 translate-y-1/2 text-[10px] tabular-nums text-soft"
            style={{ bottom: `${(t / top) * 100}%` }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: H }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="pointer-events-none absolute inset-x-0 border-t border-line"
              style={{ bottom: `${(t / top) * 100}%` }}
              aria-hidden
            />
          ))}
          <div className="relative flex h-full items-end gap-[2px]">
            {columns.map((c, i) => (
              <div key={c.dayMs} className="group relative flex h-full min-w-0 flex-1 justify-center">
                <div className="pointer-events-none absolute inset-x-0 inset-y-0 hidden rounded-[3px] bg-hi/50 group-hover:block" />
                <div className="relative flex h-full w-full max-w-6 flex-col justify-end gap-[2px]">
                  {[...c.segments].reverse().map((s, j, all) => {
                    const h = px(s.value);
                    if (h === 0) return null;
                    const topMost = all.slice(0, j).every((o) => o.value === 0);
                    return (
                      <div
                        key={s.key}
                        className={`w-full ${topMost ? "rounded-t-[4px]" : ""}`}
                        style={{ height: `${h}px`, background: s.color }}
                      />
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-left whitespace-nowrap shadow-lg group-hover:block">
                  <div className="text-[11px] font-semibold text-ink">{dayLabel(c.dayMs)}</div>
                  {totals[i] === 0 ? (
                    <div className="mt-0.5 text-[11px] text-soft">{zero}</div>
                  ) : (
                    c.segments
                      .filter((s) => s.value > 0)
                      .map((s) => (
                        <div key={s.key} className="mt-0.5 flex items-center gap-1.5 text-[11px] text-soft">
                          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: s.color }} aria-hidden />
                          <span>{s.label}</span>
                          <span className="ml-auto pl-2 font-medium tabular-nums text-ink">{s.value}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-[2px]">
          {columns.map((c, i) => (
            <div key={c.dayMs} className="min-w-0 flex-1">
              {labelled.has(i) && (
                <span
                  className={`block text-[10px] tabular-nums whitespace-nowrap text-soft ${
                    i === 0 ? "text-left" : i === columns.length - 1 ? "text-right" : "text-center"
                  }`}
                >
                  {dayLabel(c.dayMs)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// A chart legend row — one swatch + name per series. Two or more series always
// carry one; a single series doesn't (the caption already names it).
function VizLegend({ series }: { series: { key: string; label: string; color: string }[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-xs text-soft">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

// The Generation-tab activity graph: daily generation + translation usage over
// the last 30 days as stacked columns (generation on the bottom, translation on
// top), on one shared count axis. Colours are the shared viz palette (slot 1 /
// slot 2). The 30-day window is floored to the UTC day so the query args stay
// stable across renders (a raw Date.now() would resubscribe forever — see
// salesRange).
function GenerationUsageChart() {
  const day = 86_400_000;
  const to = Math.floor(Date.now() / day) * day + day; // start of tomorrow, UTC
  const from = to - 30 * day;
  const rows = useQuery(api.routine.usageByDay, { from, to });
  const total = rows?.reduce((sum, r) => sum + r.generation + r.translation, 0) ?? 0;
  return (
    <figure className="viz-chart mb-12 rounded-xl border border-line bg-card p-4">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-medium tracking-wide text-soft uppercase">
          Activity · last 30 days
          {total > 0 && <span className="ml-2 tabular-nums normal-case">{total} in total</span>}
        </span>
        <VizLegend
          series={[
            { key: "generation", label: "Generation", color: "var(--viz-1)" },
            { key: "translation", label: "Translation", color: "var(--viz-2)" },
          ]}
        />
      </figcaption>
      {rows === undefined ? (
        <div className="h-40 animate-pulse rounded-lg bg-hi/40" aria-busy />
      ) : (
        <DayStackChart
          columns={rows.map((r) => ({
            dayMs: r.dayMs,
            segments: [
              { key: "generation", label: "Generation", value: r.generation, color: "var(--viz-1)" },
              { key: "translation", label: "Translation", value: r.translation, color: "var(--viz-2)" },
            ],
          }))}
          empty="No generation or translation in the last 30 days."
          zero="Nothing built"
        />
      )}
    </figure>
  );
}

// A short "time ago" for a past timestamp (ms). Coarse buckets — this is a
// monitoring glance, not a precise clock.
function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// The live "what's busy now" section — reads the generation lock via generatingNow.
function GeneratingNow() {
  const rows = useQuery(api.routine.generatingNow);
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-accent">Generating now</h2>
        <p className="mt-0.5 text-sm text-soft">Courses the routine is authoring this moment</p>
      </div>
      {rows === undefined ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {[0, 1].map((i) => (
            <li key={i} className="h-14 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="text-sm text-soft">Nothing generating right now.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.topicSlug}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent2/60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent2" />
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-ink">
                  {r.topicTitle}
                  {r.owner && <span className="ml-2 font-normal text-soft">· {r.owner}</span>}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.stale && (
                  <span className="rounded-full bg-hi px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-soft">
                    Stale — will retry
                  </span>
                )}
                {r.startedAt !== null && <span className="text-xs tabular-nums text-soft">{timeAgo(r.startedAt)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// One outcome's badge styling: published (accent2), nothing (muted), failed (danger).
const OUTCOME_BADGE: Record<"published" | "nothing" | "failed", { label: string; className: string }> = {
  published: { label: "Published", className: "bg-accent2/15 text-accent2" },
  nothing: { label: "Caught up", className: "bg-hi text-soft" },
  failed: { label: "Failed", className: "bg-danger/15 text-danger" },
};

// The past-runs history — reads generationRuns via runHistory, newest first.
function RunHistory() {
  const rows = useQuery(api.routine.runHistory);
  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-accent">History</h2>
        <p className="mt-0.5 text-sm text-soft">Recent runs, newest first</p>
      </div>
      {rows === undefined ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="text-sm text-soft">No runs recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const badge = OUTCOME_BADGE[r.outcome];
            return (
              <li key={i} className="rounded-xl border border-line bg-card px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-ink">{r.topicTitle}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-soft">{timeAgo(r.endedAt)}</span>
                </div>
                {r.owner && <p className="mt-0.5 truncate text-xs text-soft">by {r.owner}</p>}
                {r.outcome === "published" && r.producedLessonTitle && (
                  <p className="mt-1 truncate text-xs text-soft">Lesson: {r.producedLessonTitle}</p>
                )}
                {r.outcome === "failed" && r.error && (
                  <p className="mt-1 break-words text-xs text-danger">{r.error}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent text-white" : "text-soft hover:bg-hi hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

// The Allowlist tab body (sys-admin only, so `whitelist.list` — which rejects
// non-admins server-side — is never queried by anyone else). Centred at the
// original width inside the wider dashboard shell.
function AllowlistManager() {
  const rows = useQuery(api.whitelist.list);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Allowlist</h1>
        <p className="mt-0.5 text-sm text-soft">Who can create courses</p>
      </div>

      <AddEmailForm />

      {rows === undefined ? (
        <ul className="mt-6 flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-12 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {rows
            .slice()
            .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.email.localeCompare(b.email))
            .map((row) => (
              <EmailRow key={row.email} email={row.email} isAdmin={row.isAdmin} />
            ))}
        </ul>
      )}

      <SellersManager />
    </div>
  );
}

// The Sales tab (.scratch/admin-sales): which courses and which editions sold
// how much over a chosen period. Courses are the rows (title, sale count, gross);
// each expands to its editions. The period is chosen with quick presets or a
// custom date range — both feed `sales.report` as ms bounds. Sys-admin gated
// server-side, so the query is never answered for anyone else.
const SALES_PRESETS: { key: SalesPreset; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

function SalesManager() {
  const [preset, setPreset] = useState<SalesPreset>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // `salesRange` floors `now` to the day, so these args are stable across
  // renders — a raw `Date.now()` here would make useQuery loop forever.
  const range = salesRange(preset, from, to, Date.now());
  const report = useQuery(api.sales.report, range);
  const totalGross = report?.reduce((sum, c) => sum + c.gross, 0) ?? 0;
  const totalCount = report?.reduce((sum, c) => sum + c.count, 0) ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Sales</h1>
        <p className="mt-0.5 text-sm text-soft">What each course and edition sold in a period</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
        {SALES_PRESETS.map((p) => (
          <TabButton key={p.key} active={preset === p.key} onClick={() => setPreset(p.key)}>
            {p.label}
          </TabButton>
        ))}
      </div>
      {preset === "custom" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-soft">
          <label className="flex items-center gap-1.5">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      )}

      {report === undefined ? (
        <ul className="mt-6 flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-14 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : report.length === 0 ? (
        <p className="mt-6 text-sm text-soft">No sales in this period.</p>
      ) : (
        <>
          <div className="mt-6 mb-3 flex items-center justify-between text-sm">
            <span className="text-soft">
              {totalCount} sale{totalCount === 1 ? "" : "s"} across {report.length} course
              {report.length === 1 ? "" : "s"}
            </span>
            <span className="font-semibold tabular-nums text-ink">{formatRand(totalGross)}</span>
          </div>
          <SalesDayChart range={range} ranked={rankLanguages(report)} />
          <ul className="flex flex-col gap-2">
            {report.map((c) => (
              <SalesCourseRow key={c.topicId} course={c} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// The sales-by-day chart (dataviz skill): one column per day of the chosen
// period, height = that day's sale count on one shared axis, stacked into
// per-edition segments coloured by language. The language→colour mapping comes
// from the whole period's ranking (`rankLanguages`), so a language keeps its
// colour on every day and in the breakdown below — the eye can follow "AF" down
// the timeline. The course dimension lives in the expandable list underneath;
// with one course a bar-per-course chart was a one-bar chart, and it never
// showed *when* anything sold.
function SalesDayChart({ range, ranked }: { range: { from?: number; to?: number }; ranked: readonly string[] }) {
  const days = useQuery(api.sales.byDay, range);
  const order = (lang: string) => {
    const i = ranked.indexOf(lang);
    return i < 0 ? ranked.length : i;
  };
  return (
    <figure className="viz-chart mb-4 rounded-xl border border-line bg-card p-4">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-medium tracking-wide text-soft uppercase">Sales by day and edition</span>
        <VizLegend
          series={ranked.slice(0, VIZ_SLOTS).map((lang) => ({
            key: lang,
            label: lang.toUpperCase(),
            color: colorVar(lang, ranked),
          }))}
        />
      </figcaption>
      {days === undefined ? (
        <div className="h-40 animate-pulse rounded-lg bg-hi/40" aria-busy />
      ) : (
        <DayStackChart
          columns={days.map((d) => ({
            dayMs: d.dayMs,
            // Sorted by the period-wide rank — top seller on the baseline — so
            // the stack order is identical on every column instead of following
            // each day's own top seller.
            segments: [...d.editions]
              .sort((a, b) => order(a.lang) - order(b.lang))
              .map((e) => ({
                key: e.lang,
                label: `${e.lang.toUpperCase()} · ${formatRand(e.gross)}`,
                value: e.count,
                color: colorVar(e.lang, ranked),
              })),
          }))}
          empty="No sales in this period."
          zero="No sales"
        />
      )}
    </figure>
  );
}

// One course in the sales report — a click expands its per-edition breakdown.
function SalesCourseRow({ course }: { course: FunctionReturnType<typeof api.sales.report>[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={`shrink-0 text-soft transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
            ▸
          </span>
          <span className="truncate text-sm font-medium text-ink">{course.courseTitle}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3 text-sm tabular-nums">
          <span className="text-soft">
            {course.count} sale{course.count === 1 ? "" : "s"}
          </span>
          <span className="font-semibold text-ink">{formatRand(course.gross)}</span>
        </span>
      </button>
      {open && (
        <ul className="border-t border-line px-4 py-1.5">
          {course.editions.map((e) => (
            <li key={e.lang} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-soft">{e.title}</span>
                <span className="shrink-0 rounded bg-hi px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-soft">
                  {e.lang}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3 tabular-nums text-soft">
                <span>
                  {e.count} sale{e.count === 1 ? "" : "s"}
                </span>
                <span className="font-medium text-ink">{formatRand(e.gross)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// What the operator owes each Seller (.scratch/payfast-payments, ticket 06):
// the `owed` Ledger rows summed per Seller, with the bank details to EFT to.
// "Mark paid" flips the listed sales to `paid` with the typed EFT reference —
// server-enforced Admin-only, never double-counted. Its own tab (admin-sales).
function PayoutsManager() {
  const owed = useQuery(api.ledger.owedPayouts);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Payouts</h1>
        <p className="mt-0.5 text-sm text-soft">What you owe each payee — course sales and donations</p>
      </div>
      {owed === undefined ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {[0, 1].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : owed.length === 0 ? (
        <p className="text-sm text-soft">Nothing owed — all sales are paid out.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {owed.map((o) => (
            <PayoutRow key={o.email} owed={o} />
          ))}
        </ul>
      )}

      <EftQueue />
      <BatchQueue />
      <AccessCodeQueue />
      <OperatorBankForm />
    </div>
  );
}

// The pending bank transfers (manual EFT rail, ywampotch-launch ticket 04): the
// operator reads their bank statement, finds the reference, and clicks. Confirm
// mints the Entitlement AND the Ledger row in one server transaction, so the sale
// lands in Sales and as `owed` above like any card sale. Dismiss is for a transfer
// that never came — stale intents are litter, not errors, and a queue that silts
// up stops being read, which is how a real payment eventually gets missed.
function EftQueue() {
  const pending = useQuery(api.eft.pendingEftIntents);
  if (pending !== undefined && pending.length === 0) return null;
  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-accent">Awaiting EFT</h2>
        <p className="mt-0.5 text-sm text-soft">Match the reference on your bank statement, then confirm</p>
      </div>
      {pending === undefined ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {[0, 1].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((p) => (
            <EftQueueRow key={p.ref} intent={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EftQueueRow({ intent }: { intent: FunctionReturnType<typeof api.eft.pendingEftIntents>[number] }) {
  const confirm = useMutation(api.eft.confirmEftPayment);
  const dismiss = useMutation(api.eft.dismissEftIntent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Confirming grants paid access and writes money — a misread statement line is
  // not a thing to undo, so the destructive-ish half asks once.
  const run = async (action: (args: { ref: string }) => Promise<null>) => {
    setBusy(true);
    setError(false);
    try {
      await action({ ref: intent.ref });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-gold/40 bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <b className="block font-mono text-sm font-bold tracking-wider text-ink">{intent.ref}</b>
          <span className="text-xs text-soft">
            {intent.email} · {intent.courseTitle} · {intent.lang}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-sm font-bold tabular-nums text-gold">
          {formatRand(intent.amount)}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm_(`Confirm ${formatRand(intent.amount)} received for ${intent.ref}? This grants access.`)) {
              void run(confirm);
            }
          }}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Working…" : "Confirm payment"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(dismiss)}
          className="rounded-lg border border-line px-3.5 py-1.5 text-sm font-medium text-soft transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
        >
          Dismiss
        </button>
        {error && <span className="text-xs text-danger">Failed — retry</span>}
      </div>
    </li>
  );
}

// The voucher batches whose transfer has not been logged yet (vouchers ticket 04,
// ADR 0029). Beside the EFT queue deliberately: to the operator this is the same
// job - money on a bank statement that has to be matched to something in the app -
// and a queue that looks like a stranger is a queue that gets missed.
//
// Two things this is NOT. It is not an approval: the batch's codes have been
// working since the Seller minted them, so logging the reference changes nothing
// for the organisation and only makes the Seller's 50% payable. And it never shows
// a code - `pendingBatches` cannot return one, so the boundary between the money
// role and the selling role is server-side, not this component's restraint.
function BatchQueue() {
  const pending = useQuery(api.vouchers.pendingBatches);
  if (pending !== undefined && pending.length === 0) return null;
  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-accent">Bulk Vouchers awaiting payment</h2>
        <p className="mt-0.5 text-sm text-soft">
          Check the total against what landed, then log the reference - that makes the seller&apos;s share payable
        </p>
      </div>
      {pending === undefined ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {[0, 1].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((b) => (
            <BatchQueueRow key={b.batchId} batch={b} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BatchQueueRow({ batch }: { batch: FunctionReturnType<typeof api.vouchers.pendingBatches>[number] }) {
  const log = useMutation(api.vouchers.logBatchPayment);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-xl border border-gold/40 bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <b className="block truncate text-sm font-semibold text-ink">{batch.orgName}</b>
          {/* Take-up beside the size, because "0 of 200 redeemed" after a month is a
              distribution problem to raise with the Seller and "195 of 200" is a
              payment to chase, and the line could not tell them apart before. A
              NUMBER only: a redemption records nothing about who (ADR 0029). */}
          <span className="text-xs text-soft">
            {batch.redeemed} of {batch.seats} seats taken · {batch.courseTitle} · {batch.lang} ·{" "}
            {batch.sellerEmail}
          </span>
          <span className="block text-xs text-soft">{batch.orgContact}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Voided batches stay on this queue: voiding stops codes, never money,
              so cash for a collapsed deal can still land and still has to be
              matched. Marked, so the sysadmin knows which conversation they are
              in before they chase the transfer. */}
          {batch.voided && (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-danger">
              Voided
            </span>
          )}
          <span className="rounded-full bg-gold/15 px-2.5 py-1 text-sm font-bold tabular-nums text-gold">
            {formatRand(batch.total)}
          </span>
        </div>
      </div>
      <form
        className="mt-2.5 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!reference.trim()) return;
          setBusy(true);
          setError(null);
          try {
            await log({ batchId: batch.batchId, reference });
          } catch (err) {
            setError(mutationError(err, "Failed - retry"));
            setBusy(false);
          }
        }}
      >
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Bank reference / transaction id"
          className="min-w-0 flex-1 rounded-lg border border-line bg-hi px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !reference.trim()}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Working…" : "Log payment"}
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </form>
    </li>
  );
}

// The stopped Access Codes whose transfer has not been logged yet (ADR 0031,
// shared-access-codes ticket 07). Beside the EFT queue and the batch queue
// deliberately: to the operator all three are the same job, money on a bank
// statement that has to be matched to something in the app, and a queue that looks
// like a stranger is a queue that gets missed.
//
// **The line carries everything needed to raise the invoice, because the platform
// does not raise it.** SARS wants seven fields plus a serial and a date within 21
// days of supply, and a serial series is a thing to own forever and never duplicate,
// so the operator raises the invoice in whatever they already use and this is the
// line they read it off. Organisation, billing contact, seats, per-seat price, total.
//
// Two things this is NOT. It is not an approval: the seats were granted while the
// code was live and have been used and finished with by the time it stops, so logging
// the reference changes nothing for the organisation and only makes the Seller's half
// payable. And it never shows a code or a nickname, because `pendingAccessCodes`
// cannot return either. The boundary between the money role and the selling role is
// server-side, not this component's restraint.
function AccessCodeQueue() {
  const pending = useQuery(api.accessCodes.pendingAccessCodes);
  if (pending !== undefined && pending.length === 0) return null;
  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-accent">Organisation Vouchers</h2>
        <p className="mt-0.5 text-sm text-soft">
          Running deals and the ones ready to invoice. A stopped voucher takes a reference; a running one owes nothing
          yet
        </p>
      </div>
      {pending === undefined ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {[0, 1].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((c) => (
            <AccessCodeQueueRow key={c.accessCodeId} code={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AccessCodeQueueRow({ code }: { code: FunctionReturnType<typeof api.accessCodes.pendingAccessCodes>[number] }) {
  const log = useMutation(api.accessCodes.logAccessCodePayment);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-xl border border-gold/40 bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <b className="block truncate text-sm font-semibold text-ink">{code.orgName}</b>
          {/* The arithmetic spelled out rather than just its answer: the operator is
              about to put these numbers on an invoice, and "42 x R150.00" is what they
              have to be able to justify to the organisation. */}
          <span className="text-xs text-soft">
            {code.seats} seats x {formatRand(code.pricePerSeat)} · {code.courseTitle} · {code.lang} ·{" "}
            {code.sellerEmail}
          </span>
          <span className="block text-xs text-soft">{code.orgContact}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Running vs ready-to-invoice, because the total means different things:
              on a live voucher it is what the deal has run up SO FAR and will keep
              moving, on a stopped one it is final and invoiceable. */}
          {code.stoppedAt === null && (
            <span className="rounded-full bg-hi px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-soft">
              Running
            </span>
          )}
          <span className="rounded-full bg-gold/15 px-2.5 py-1 text-sm font-bold tabular-nums text-gold">
            {formatRand(code.total)}
          </span>
        </div>
      </div>
      {/* Nothing to log on a live voucher, so no box to type into. Saying why beats a
          disabled field the operator has to work out the reason for. */}
      {code.stoppedAt === null ? (
        <p className="mt-1.5 text-xs text-soft">
          Still running, so nothing is due yet. The seller stops it when the agreement ends and it moves up this list
          ready to invoice.
        </p>
      ) : (
      <form
        className="mt-2.5 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!reference.trim()) return;
          setBusy(true);
          setError(null);
          try {
            await log({ accessCodeId: code.accessCodeId, reference });
          } catch (err) {
            setError(mutationError(err, "Failed - retry"));
            setBusy(false);
          }
        }}
      >
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Bank reference / transaction id"
          className="min-w-0 flex-1 rounded-lg border border-line bg-hi px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !reference.trim()}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Working…" : "Log payment"}
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </form>
      )}
    </li>
  );
}

// ponytail: the browser's own confirm dialog for the one irreversible click, not a
// modal component. Wrapped so the lint rule about bare `confirm` has one site.
function confirm_(message: string): boolean {
  return window.confirm(message);
}

// The operator's **collection** account (manual EFT rail, ywampotch-launch ticket
// 02): where buyers EFT the purchase price IN — the mirror of the payouts above,
// which is money going OUT, hence the same tab rather than a sixth one. Editable
// here so the operator can correct it on prod without a deploy; sys-admin-only
// server-side (`eft.saveOperatorBank`), so a tenant admin can never move where the
// platform's money is collected. The `enabled` toggle IS the rail's on/off switch:
// off, and no buyer is offered "Pay by EFT".
function OperatorBankForm() {
  const saved = useQuery(api.eft.operatorBank);
  const save = useMutation(api.eft.saveOperatorBank);
  const [form, setForm] = useState<{
    accountHolder: string;
    bank: string;
    accountNumber: string;
    branchCode: string;
    enabled: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Seed the form from the saved record once it arrives (and never again, so
  // typing isn't clobbered by the live query re-firing after a save).
  const blank = { accountHolder: "", bank: "", accountNumber: "", branchCode: "", enabled: false };
  const values = form ?? (saved === undefined ? null : (saved ?? blank));
  const set = (patch: Partial<NonNullable<typeof values>>) => {
    setForm({ ...(values ?? blank), ...patch });
    setError(null);
    setDone(false);
  };

  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-accent">EFT collection account</h2>
        <p className="mt-0.5 text-sm text-soft">Where buyers pay you directly, instead of by card</p>
      </div>

      {values === null ? (
        <div className="h-56 animate-pulse rounded-2xl border border-line bg-card" aria-busy />
      ) : (
        <form
          className="flex flex-col gap-3 rounded-2xl border border-gold/50 bg-card p-5 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await save(values);
              setDone(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't save those details.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {(
            [
              ["accountHolder", "Account name", "YWAM Potch"],
              ["bank", "Bank", "FNB"],
              ["accountNumber", "Account number", "62000000001"],
              ["branchCode", "Branch code", "250655"],
            ] as const
          ).map(([field, label, placeholder]) => (
            <label key={field} className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent2">{label}</span>
              <input
                value={values[field]}
                onChange={(e) => set({ [field]: e.target.value })}
                placeholder={placeholder}
                className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
              />
            </label>
          ))}

          <label className="mt-1 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={values.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
              className="size-4 accent-accent"
            />
            Offer &ldquo;Pay by EFT&rdquo; to buyers
          </label>

          <div className="mt-1 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {error && <span className="text-xs text-danger">{error}</span>}
            {done && !error && <span className="text-xs text-soft">Saved.</span>}
          </div>
        </form>
      )}
    </section>
  );
}

// Rand formatting for ledger amounts (cents → "R 1 234.56").
function formatRand(cents: number): string {
  return `R ${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PayoutRow({ owed }: { owed: FunctionReturnType<typeof api.ledger.owedPayouts>[number] }) {
  const markPaid = useMutation(api.ledger.markPaid);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  return (
    <li className="rounded-xl border border-gold/40 bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <b className="block truncate text-sm font-semibold text-ink">{owed.email}</b>
          <span className="text-xs text-soft">
            {owed.payout
              ? `${owed.payout.accountHolder} · ${owed.payout.bank} · ${owed.payout.accountNumber} · branch ${owed.payout.branchCode}`
              : "No bank details on file — ask the seller before paying out"}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-sm font-bold tabular-nums text-gold">
          {formatRand(owed.totalOwed)}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-soft">
        {owed.sales.length} item{owed.sales.length === 1 ? "" : "s"} ·{" "}
        {/* A donation has no Edition, so the query hands back a null `lang` and
            the kind to label it with (ADR 0027) — donations settle through this
            same tab, alongside the payee's sales. A voucher batch DOES have an
            Edition, so it needs the kind too or it reads as an ordinary sale of
            that language at a bulk price (ADR 0029). */}
        {owed.sales
          .map((s) => {
            const what = s.kind === "donation" ? "donation" : s.kind === "batch" ? `${s.lang} batch` : s.lang;
            return `${what} ${formatRand(s.sellerShare)}`;
          })
          .join(", ")}
      </p>
      <form
        className="mt-2.5 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(false);
          try {
            await markPaid({ ids: owed.sales.map((s) => s.id), reference });
            setReference("");
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="EFT reference"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-1.5 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !reference.trim()}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Recording…" : "Mark paid"}
        </button>
        {error && <span className="text-xs text-danger">Failed — retry</span>}
      </form>
    </li>
  );
}

// Who may sell (paid marketplace, ADR 0016 / PayFast rail). The Admin grants a
// User the **can-sell** capability here; the Seller then saves their payout bank
// details on their own (the status column reflects how far they've got).
// Revoking stops new pricing but leaves already-sold access intact.
function SellersManager() {
  const sellers = useQuery(api.sellers.listSellers);
  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-accent">Sellers</h2>
        <p className="mt-0.5 text-sm text-soft">Who may list paid courses</p>
      </div>

      <GrantSellerForm />

      {sellers === undefined ? (
        <ul className="mt-6 flex flex-col gap-2" aria-busy>
          {[0, 1].map((i) => (
            <li key={i} className="h-12 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : sellers.length === 0 ? (
        <p className="mt-6 text-sm text-soft">No sellers yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {sellers.map((s) => (
            <SellerRow key={s.email} email={s.email} status={s.status} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Grant can-sell to an existing account by email. The mutation refuses an email
// with no account (you grant a User, not an address); the live list re-renders.
function GrantSellerForm() {
  const grant = useMutation(api.sellers.grantCanSell);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const addr = email.trim();
        if (!addr) return;
        setBusy(true);
        setError(null);
        try {
          await grant({ email: addr });
          setEmail("");
        } catch {
          setError("Couldn't grant — the person must have an account first.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Enable selling for</label>
      <p className="text-sm text-soft">They can then set up payouts and price their finished courses.</p>
      <div className="mt-1 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="seller@example.com"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60">
          {busy ? "Granting…" : "Grant"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// One Seller row: email + readiness status + revoke. Revoke stops new pricing
// (server-enforced) but does not touch courses they've already sold.
function SellerRow({
  email,
  status,
}: {
  email: string;
  status: SellerStatus;
}) {
  const revoke = useMutation(api.sellers.revokeCanSell);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const label = status === "ready" ? "Ready" : "No payout details";

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm text-ink">{email}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            status === "ready" ? "bg-accent2/15 text-accent2" : "bg-hi text-soft"
          }`}
        >
          {label}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {error && <span className="text-xs text-danger">Failed — retry</span>}
        <button
          onClick={async () => {
            setBusy(true);
            setError(false);
            try {
              await revoke({ email });
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
          aria-label={`Revoke selling for ${email}`}
        >
          {busy ? "Revoking…" : "Revoke"}
        </button>
      </div>
    </li>
  );
}

// The Tenants tab (sys admin): a sidebar list of every tenant + a "+ New tenant"
// action on the left, the selected tenant's stacked panel on the right. The list
// is a live `listTenants` query (sys-admin-gated server-side). Selecting a tenant
// — or creating one — opens its panel; nothing is selected on first load.
function TenantsManager() {
  const tenants = useQuery(api.tenants.listTenants);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-4">
        <NewTenantForm onCreated={setSelected} />
        {tenants === undefined ? (
          <ul className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-10 animate-pulse rounded-lg border border-line bg-card" />
            ))}
          </ul>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-soft">No tenants yet — create one above.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tenants.map((t) => (
              <li key={t.slug}>
                <button
                  onClick={() => setSelected(t.slug)}
                  aria-current={selected === t.slug ? "true" : undefined}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selected === t.slug ? "bg-hi text-accent" : "text-ink hover:bg-hi"
                  }`}
                >
                  <span className="block truncate font-medium">{t.displayName}</span>
                  <span className="block truncate text-xs text-soft">{t.slug}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {selected === null ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-line py-24 text-sm text-soft">
          Select a tenant to manage its branding, flags, courses, and members.
        </div>
      ) : (
        <TenantDetail slug={selected} role="sys" onRemoved={() => setSelected(null)} />
      )}
    </div>
  );
}

// Create a tenant: slug + display name → `createTenant` (sys-admin-gated). On
// success the new tenant's panel opens. Slug validity/dupes are enforced
// server-side; the surfaced error is whatever the mutation threw.
function NewTenantForm({ onCreated }: { onCreated: (slug: string) => void }) {
  const create = useMutation(api.tenants.createTenant);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-4 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const { slug: created } = await create({ slug, displayName });
          setSlug("");
          setDisplayName("");
          onCreated(created);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't create the tenant.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">New tenant</label>
      <input
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
          setError(null);
        }}
        placeholder="Display name"
        className="min-w-0 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      <input
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setError(null);
        }}
        placeholder="subdomain-slug"
        className="min-w-0 rounded-lg border border-line bg-card px-3 py-2 text-sm lowercase focus:border-gold focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !slug.trim() || !displayName.trim()}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {busy ? "Creating…" : "+ New tenant"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// The selected tenant's panel: the stacked-scroll layout the prototype settled on
// (issue 06 / 19) — Theme, Flags, Courses, Members, Remove tenant as sections on
// one scrolling page, no sub-navigation. This issue builds the shell + section
// scaffolding; tickets 20–22 fill in each section's real content and mutations.
// `displayName` comes from the public `getTheme` read (also serves both admin
// tiers, so a tenant admin needs no extra query).
//
// `role` is which tier is looking. The panel shipped as "the sys-admin panel, minus
// tabs" — the same sections for both tiers — which handed a tenant admin the
// *provisioning* surface (flags, the global course pool, member allocation, delete
// the tenant). A tenant admin manages what the sys admin allocated to them, so they
// get Theme (their brand) and Courses read-only (what they were given); Flags,
// Members, and Remove tenant are the allocator's and aren't rendered for them. The
// mutations behind each are sys-admin-only server-side — this only stops drawing
// controls that would refuse.
//
// That leaves a deliberately thin tenant panel for now: the reads a tenant admin
// actually wants — their member roster and their payouts — are separate builds
// (prior review items 5 and 6), each blocked on its own open decision.
function TenantDetail({ slug, role, onRemoved }: { slug: string; role: "sys" | "tenant"; onRemoved?: () => void }) {
  const view = useQuery(api.tenantTheme.getTheme, { slug });
  const displayName = view?.displayName ?? slug;
  const isSys = role === "sys";

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-accent md:text-2xl">{displayName}</h2>
        <p className="mt-0.5 text-sm text-soft">{slug}.my-course.app</p>
      </div>

      <TenantSection title="Theme" hint="Brand palette, logo, favicon, and motto.">
        {view === undefined ? (
          <span>Loading…</span>
        ) : view === null ? (
          <span>This tenant has no theme yet.</span>
        ) : (
          <ThemeEditor key={slug} slug={slug} view={view} />
        )}
      </TenantSection>
      {isSys && (
        <TenantSection title="Flags" hint="Which features are on for this tenant.">
          {view === undefined ? (
            <span>Loading…</span>
          ) : view === null ? (
            <span>This tenant has no flags yet.</span>
          ) : (
            <FlagToggles key={slug} slug={slug} flags={view.flags} />
          )}
        </TenantSection>
      )}
      {isSys && (
        <TenantSection
          title="Donations"
          hint="Who this tenant's donation income is owed to. Set this before switching the Donations flag on."
        >
          <DonationPayee key={slug} slug={slug} />
        </TenantSection>
      )}
      <TenantSection
        title="Courses"
        hint={isSys ? "Which courses belong to this tenant." : "The courses allocated to this tenant."}
      >
        <TenantCourses slug={slug} canAllocate={isSys} />
      </TenantSection>
      {isSys && (
        <TenantSection title="Members" hint="Who belongs to this tenant, and its admins.">
          <TenantMembers slug={slug} />
        </TenantSection>
      )}
      {isSys && (
        <TenantSection title="Remove tenant" hint="Delete this tenant. Blocked while any course or member still references it.">
          <TenantRemoval slug={slug} displayName={displayName} onRemoved={onRemoved} />
        </TenantSection>
      )}
    </div>
  );
}

// One stacked section of the tenant panel: a titled, bordered block. The body is
// placeholder scaffolding until 20–22 land — the headings + scroll structure are
// what issue 19 delivers.
function TenantSection({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-lg font-semibold tracking-tight text-accent">{title}</h3>
      <p className="mt-0.5 text-sm text-soft">{hint}</p>
      <div className="mt-3 rounded-xl border border-dashed border-line bg-card px-4 py-6 text-sm text-soft">
        {children}
      </div>
    </section>
  );
}

// The Courses section (ticket 22): this tenant's assigned courses (each removable
// back to the default site) plus a search-and-add picker over the assignable pool
// (default-only courses). Assigning sets `topics.tenantSlug`; the live
// `courseAssignment` query re-renders both lists on every write. Tenant-centric —
// the same course is managed here, never on CourseSettings.
//
// `canAllocate` is the sys admin. Allocation is theirs both ways, so a tenant admin
// gets the assigned list read-only — no add picker, no Remove. The server agrees
// independently: `courseAssignment` returns them an empty `available` (the pool's
// titles are never sent), and assign/unassignCourse refuse them outright.
function TenantCourses({ slug, canAllocate }: { slug: string; canAllocate: boolean }) {
  const data = useQuery(api.tenantAssignment.courseAssignment, { tenantSlug: slug });
  const assign = useMutation(api.tenantAssignment.assignCourse);
  const unassign = useMutation(api.tenantAssignment.unassignCourse);

  if (data === undefined) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        {[0, 1].map((i) => (
          <li key={i} className="h-10 animate-pulse rounded-lg border border-line bg-card" />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {canAllocate && (
        <SearchAddPicker
          placeholder="Search a course by title…"
          empty="No unassigned courses left to add."
          options={data.available.map((c) => ({ id: c.topicId, label: c.title }))}
          onAdd={(topicId) => assign({ tenantSlug: slug, topicId: topicId as Id<"topics"> })}
        />
      )}
      {data.assigned.length === 0 ? (
        <p className="text-sm text-soft">
          {canAllocate ? "No courses assigned yet." : "No courses have been allocated to this tenant yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.assigned.map((c) => (
            <AssignedRow
              key={c.topicId}
              label={c.title}
              onRemove={
                canAllocate
                  ? () => unassign({ tenantSlug: slug, topicId: c.topicId as Id<"topics"> })
                  : undefined
              }
              removeAria={`Unassign ${c.title}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// The Members section (ticket 22): this tenant's Allowlist members (plain members
// removable back to the default site; a tenant admin is badged and only removable
// via the Allowlist, since clearing their slug would promote them to a sys admin)
// plus a search-and-add picker over the assignable pool (unassigned, non-admin
// Allowlist emails). Assigning sets `whitelist.tenantSlug`.
//
// **Sys-admin only** — member allocation is provisioning, so `TenantDetail` doesn't
// render this section for a tenant admin and `memberAssignment` refuses them anyway
// (its pool is platform-wide personal data). That makes every control here
// unconditionally the sys admin's: the old per-row `myAdminScope` re-check that hid
// grant/revoke from a tenant admin is gone with the tier that needed it.
function TenantMembers({ slug }: { slug: string }) {
  const data = useQuery(api.tenantAssignment.memberAssignment, { tenantSlug: slug });
  const assign = useMutation(api.tenantAssignment.assignMember);
  const unassign = useMutation(api.tenantAssignment.unassignMember);
  const setAdmin = useMutation(api.tenantAssignment.setTenantAdmin);

  if (data === undefined) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        {[0, 1].map((i) => (
          <li key={i} className="h-10 animate-pulse rounded-lg border border-line bg-card" />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchAddPicker
        placeholder="Search an admitted email…"
        empty="No unassigned emails to add — admit one on the Allowlist first."
        options={data.available.map((m) => ({ id: m.email, label: m.email }))}
        onAdd={(email) => assign({ tenantSlug: slug, email })}
      />
      {data.assigned.length === 0 ? (
        <p className="text-sm text-soft">No members assigned yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.assigned.map((m) => (
            <AssignedRow
              key={m.email}
              label={m.email}
              badge={m.isAdmin ? "Admin" : undefined}
              // An admin can't be unassigned directly — demote first (revoke admin),
              // then the normal picker Remove applies (mirrors the DB-privilege lock).
              onRemove={m.isAdmin ? undefined : () => unassign({ tenantSlug: slug, email: m.email })}
              removeAria={`Unassign ${m.email}`}
              action={
                m.isAdmin
                  ? { label: "Revoke admin", busyLabel: "Revoking…", aria: `Revoke admin for ${m.email}`, run: () => setAdmin({ tenantSlug: slug, email: m.email, makeAdmin: false }) }
                  : { label: "Make admin", busyLabel: "Granting…", aria: `Make ${m.email} an admin`, run: () => setAdmin({ tenantSlug: slug, email: m.email, makeAdmin: true }) }
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// The Remove tenant section (ticket 22): destructive, and **blocked outright**
// (disabled + explanation, not merely a confirm) while any course, member, or
// user account still references the slug — the counts come from
// `tenantReferenceCounts` and `removeTenant` re-checks them server-side. Only an
// empty tenant is removable, behind a plain confirm. No cascade delete (mirrors
// ADR 0011's refuse-to-remove-the-one-Admin guard).
function TenantRemoval({ slug, displayName, onRemoved }: { slug: string; displayName: string; onRemoved?: () => void }) {
  const counts = useQuery(api.tenants.tenantReferenceCounts, { tenantSlug: slug });
  const remove = useMutation(api.tenants.removeTenant);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (counts === undefined) {
    return <div className="h-10 animate-pulse rounded-lg border border-line bg-card" aria-busy />;
  }

  const blockers: string[] = [];
  if (counts.courses > 0) blockers.push(`${counts.courses} course${counts.courses === 1 ? "" : "s"}`);
  if (counts.members > 0) blockers.push(`${counts.members} member${counts.members === 1 ? "" : "s"}`);
  if (counts.users > 0) blockers.push(`${counts.users} user account${counts.users === 1 ? "" : "s"}`);
  const removable = blockers.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {removable ? (
        <p className="text-sm text-soft">This tenant has nothing assigned — it can be removed.</p>
      ) : (
        <p className="text-sm text-soft">
          Still assigned: {blockers.join(", ")}. Clear them above before this tenant can be removed.
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!removable || busy}
          onClick={async () => {
            if (!window.confirm(`Remove the “${displayName}” tenant? This can't be undone.`)) return;
            setBusy(true);
            setError(null);
            try {
              await remove({ tenantSlug: slug });
              onRemoved?.();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't remove the tenant.");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg border border-danger/50 px-3.5 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-danger"
        >
          {busy ? "Removing…" : "Remove tenant"}
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}

// A search-and-add picker shared by the Courses and Members sections: type to
// filter the assignable options by label, click one to add it. Bounded to the
// first handful of matches so a long pool never floods the panel. `onAdd` is the
// assign mutation; the live query re-renders the lists once it resolves.
function SearchAddPicker({
  placeholder,
  empty,
  options,
  onAdd,
}: {
  placeholder: string;
  empty: string;
  options: { id: string; label: string }[];
  onAdd: (id: string) => Promise<unknown>;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, 8);

  return (
    <div className="flex flex-col gap-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      {options.length === 0 ? (
        <p className="text-xs text-soft">{empty}</p>
      ) : matches.length === 0 ? (
        <p className="text-xs text-soft">No matches.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={async () => {
                  setBusyId(o.id);
                  setError(false);
                  try {
                    await onAdd(o.id);
                    setQuery("");
                  } catch {
                    setError(true);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="rounded-full border border-line bg-card px-3 py-1 text-sm text-ink transition-colors hover:border-accent hover:bg-hi hover:text-accent disabled:opacity-60"
              >
                {busyId === o.id ? "Adding…" : `+ ${o.label}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="text-xs text-danger">Couldn't add — retry.</span>}
    </div>
  );
}

// One assigned-item row: a label, an optional badge (e.g. a tenant admin), and a
// Remove control when the row is removable here. Omitting `onRemove` makes the row
// read-only — a tenant admin's allocated-courses list, or a tenant-admin member row
// (demote them first; clearing an admin's slug would promote them to a sys admin).
function AssignedRow({
  label,
  badge,
  onRemove,
  removeAria,
  action,
}: {
  label: string;
  badge?: string;
  onRemove?: () => Promise<unknown>;
  removeAria?: string;
  // An optional secondary control (e.g. "Make admin" / "Revoke admin"), rendered
  // before the remove control. Manages its own busy/error, independent of remove.
  action?: { label: string; busyLabel: string; run: () => Promise<unknown>; aria?: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm text-ink">{label}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-hi px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">{badge}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action && <RowActionButton {...action} />}
        {onRemove && (
          <>
            {error && <span className="text-xs text-danger">Failed — retry</span>}
            <button
              onClick={async () => {
                setBusy(true);
                setError(false);
                try {
                  await onRemove();
                } catch {
                  setError(true);
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              aria-label={removeAria}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
            >
              {busy ? "Removing…" : "Remove"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// A secondary row action with its own busy/error state (e.g. grant/revoke admin).
function RowActionButton({ label, busyLabel, run, aria }: { label: string; busyLabel: string; run: () => Promise<unknown>; aria?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      {error && <span className="text-xs text-danger">Failed</span>}
      <button
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            await run();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        aria-label={aria}
        className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
      >
        {busy ? busyLabel : label}
      </button>
    </>
  );
}

// The tenant's donation payee (ADR 0027) — the user the operator owes this
// tenant's donation income to, settled through the existing Payouts tab. **Sys
// admin only**, mirroring the server gate: a money destination is not a
// subdomain administrator's call. The server refuses a payee who isn't an
// approved seller with payout bank details on file, and clearing the payee also
// switches the Donations flag off, so the two can never disagree.
function DonationPayee({ slug }: { slug: string }) {
  const current = useQuery(api.tenantDonations.donationPayeeEmail, { tenantSlug: slug });
  // The only accounts the server would accept — a picker rather than a text
  // field, so the two rejections below ("no account", "not a ready seller")
  // become unreachable by construction instead of something the operator
  // discovers by typing an email and being told no.
  const candidates = useQuery(api.sellers.readySellerEmails);
  const setPayee = useMutation(api.tenantDonations.setDonationPayee);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | undefined) {
    setError(null);
    setBusy(true);
    try {
      await setPayee({ tenantSlug: slug, email: next });
      setEmail("");
    } catch (e) {
      setError(mutationError(e, "Couldn't set that payee."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-soft">
        {current === undefined
          ? "Loading…"
          : current === null
            ? "No payee set — donations cannot be switched on."
            : `Donations are owed to ${current}.`}
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save(email);
        }}
      >
        <select
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || !candidates?.length}
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-1.5 text-sm focus:border-accent focus:outline-none disabled:opacity-60"
        >
          <option value="">
            {candidates === undefined
              ? "Loading…"
              : candidates.length === 0
                ? "No approved sellers with payout details yet"
                : "Choose a payee…"}
          </option>
          {candidates?.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Set payee"}
        </button>
        {current && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(undefined)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
          >
            Clear
          </button>
        )}
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// The six feature flags in display order, with human labels (issue 21). The keys
// mirror the schema's tenantFlagsValidator (issue 04); enforced server-side by
// assertTenantFlag (issue 17), this is only the operator's on/off surface.
const FLAG_META: { key: TenantFlag; label: string; hint: string }[] = [
  { key: "certificates", label: "Certificates", hint: "Learners can claim a completion certificate." },
  { key: "translations", label: "Translations", hint: "Owners can translate a completed course into other languages." },
  { key: "publicLinks", label: "Public links", hint: "Owners can publish a shareable public link to a course." },
  { key: "qa", label: "Questions", hint: "Learners can ask questions on a lesson." },
  { key: "seeding", label: "Course creation", hint: "Members can seed new courses on this tenant." },
  // The one flag with a precondition (ADR 0027): the server refuses to switch it
  // on until a donation payee is set and is a ready seller, and says so.
  { key: "donations", label: "Donations", hint: "Show the donation section on this tenant's landing page." },
];

// The Flags section (ticket 21): one plain switch per feature flag over the
// scope-gated setTenantFlags patch. Flag-off is frozen-not-revoked (issue 04), so
// there's no confirm dialog — a toggle only changes what the server permits going
// forward, granting and deleting nothing. The live getTheme query drives `flags`,
// so a toggle reflects immediately (Convex reactivity); a per-key busy flag guards
// against a double-click mid-write. Keyed by slug at the call site so switching
// tenants remounts with fresh state.
function FlagToggles({ slug, flags }: { slug: string; flags: Partial<Record<TenantFlag, boolean>> }) {
  const setFlags = useMutation(api.tenants.setTenantFlags);
  const [busy, setBusy] = useState<TenantFlag | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: TenantFlag, next: boolean) {
    setError(null);
    setBusy(key);
    try {
      await setFlags({ tenantSlug: slug, flags: { [key]: next } });
    } catch (e) {
      setError(mutationError(e, "Couldn't update that flag."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1 text-ink">
      {FLAG_META.map(({ key, label, hint }) => {
        // `donations` is optional in the schema — absence means off (ADR 0027),
        // which is why it needed no backfill over every tenant row.
        const on = flags[key] ?? false;
        return (
          <div key={key} className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <b className="block text-[13.5px] font-semibold text-ink">{label}</b>
              <span className="text-[11.5px] text-soft">{hint}</span>
            </div>
            <label className="relative inline-flex shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={on}
                disabled={busy !== null}
                onChange={(e) => toggle(key, e.target.checked)}
                className="peer sr-only"
              />
              <span className="relative h-6 w-10.5 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-accent2 peer-checked:after:translate-x-4.5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-disabled:opacity-60" />
            </label>
          </div>
        );
      })}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// The tenant view getTheme resolves (issue 11) — a non-null tenant's resolved
// palette + brand asset urls, which the editor seeds from.
type TenantThemeView = NonNullable<FunctionReturnType<typeof api.tenantTheme.getTheme>>;
type Palette = Record<string, string>;

// Short human labels for the structured token fields — the semantic role of each
// token (mirrors the contract in src/design/tokens.ts). The token name is shown
// alongside so a JSON paste and a structured field are obviously the same key.
const TOKEN_LABELS: Record<Token, string> = {
  paper: "Page background",
  card: "Raised surface",
  ink: "Primary text",
  soft: "Muted text",
  line: "Hairline borders",
  accent: "Primary brand",
  accent2: "Secondary brand",
  gold: "Highlight / ornament",
  hi: "Highlight-mark bg",
  danger: "Error / destructive",
  good: "Correct-answer surface",
  "good-b": "Correct-answer accent",
  bad: "Wrong-answer surface",
  "bad-b": "Wrong-answer accent",
};

// Validate a pasted palette into a { light?, dark? } update (ticket 20's import
// mode). Accepts either the `{ light, dark }` envelope a Claude/Figma handoff
// arrives in, or a bare 14-token map (treated as a complete light palette). Light,
// when present, must be complete and use only known tokens; dark may be a partial
// subset. Throws a human-readable message the UI surfaces. Mirrors the server's
// assertThemeTokens so a bad paste fails before the round-trip — the server is
// still the boundary.
function coerceImportedTheme(parsed: unknown): { light?: Palette; dark?: Palette } {
  if (!parsed || typeof parsed !== "object") throw new Error("Expected a JSON object.");
  const obj = parsed as Record<string, unknown>;
  const hasEnvelope = "light" in obj || "dark" in obj;
  const result: { light?: Palette; dark?: Palette } = {};
  const rawLight = hasEnvelope ? obj.light : obj;
  if (rawLight !== undefined) result.light = validatePalette(rawLight, "light", true);
  if (hasEnvelope && obj.dark !== undefined) result.dark = validatePalette(obj.dark, "dark", false);
  if (result.light === undefined && result.dark === undefined) {
    throw new Error('Expected "light" and/or "dark" token maps.');
  }
  return result;
}

function validatePalette(raw: unknown, name: string, complete: boolean): Palette {
  if (!raw || typeof raw !== "object") throw new Error(`${name} must be an object of token → colour.`);
  const known = new Set<string>(TENANT_THEME_TOKENS);
  const entries = Object.entries(raw as Record<string, unknown>);
  const unknown = entries.map(([k]) => k).filter((k) => !known.has(k));
  if (unknown.length) throw new Error(`${name} has unknown token(s): ${unknown.join(", ")}`);
  const palette: Palette = {};
  for (const [k, val] of entries) {
    if (typeof val !== "string") throw new Error(`${name} token "${k}" must be a colour string.`);
    palette[k] = val;
  }
  if (complete) {
    const missing = TENANT_THEME_TOKENS.filter((tok) => !(tok in palette));
    if (missing.length) throw new Error(`${name} is missing required token(s): ${missing.join(", ")}`);
  }
  return palette;
}

// The Theme section's editor (ticket 20): JSON import + structured per-token
// fields (light/dark tabs) + a live preview, over the identity-guarded
// updateTenantTheme. Edit-is-live (03) — Save patches `tenants.theme` and the
// tenant's subdomain reflects it on the next SSR render (11), no draft state.
// Keyed by slug at the call site so switching tenants remounts with fresh state,
// so local edits never bleed across tenants and the live getTheme never clobbers
// an in-progress edit.
function ThemeEditor({ slug, view }: { slug: string; view: TenantThemeView }) {
  const save = useMutation(api.tenantTheme.updateTenantTheme);

  // Editable palettes seeded from the tenant's current theme: light is complete
  // (all 14); dark is a partial override map (only the tokens the tenant set).
  const [light, setLight] = useState<Palette>(() => ({ ...view.theme.light }));
  const [dark, setDark] = useState<Palette>(() => ({ ...(view.theme.dark ?? {}) }));
  const [tab, setTab] = useState<"light" | "dark">("light");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setToken(mode: "light" | "dark", tok: string, value: string) {
    setSaved(false);
    (mode === "light" ? setLight : setDark)((prev) => ({ ...prev, [tok]: value }));
  }
  function clearDarkToken(tok: string) {
    setSaved(false);
    setDark((prev) => {
      const next = { ...prev };
      delete next[tok];
      return next;
    });
  }

  function applyImport() {
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError("That isn't valid JSON.");
      return;
    }
    try {
      const next = coerceImportedTheme(parsed);
      if (next.light) setLight(next.light);
      if (next.dark !== undefined) setDark(next.dark);
      setImportText("");
      setSaved(false);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Couldn't read that palette.");
    }
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    const missing = TENANT_THEME_TOKENS.filter((tok) => !light[tok]?.trim());
    if (missing.length) {
      setError(`Light palette is missing: ${missing.join(", ")}`);
      setTab("light");
      return;
    }
    setBusy(true);
    try {
      const theme: { light: Palette; dark?: Palette } = {
        // Every light token is present (the missing-check above guarantees it).
        light: Object.fromEntries(TENANT_THEME_TOKENS.map((tok) => [tok, light[tok]!])),
      };
      const darkEntries = Object.fromEntries(
        TENANT_THEME_TOKENS.filter((tok) => dark[tok]?.trim()).map((tok) => [tok, dark[tok]!]),
      );
      if (Object.keys(darkEntries).length) theme.dark = darkEntries;
      await save({ tenantSlug: slug, theme });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the theme.");
    } finally {
      setBusy(false);
    }
  }

  // Preview the active tab. Dark shows its overrides on the light base for the
  // tokens it doesn't set (a representative approximation — the real fallback is
  // the default dark palette, which the client doesn't carry).
  const activePalette = tab === "light" ? light : { ...light, ...dark };
  const previewStyle = Object.fromEntries(
    TENANT_THEME_TOKENS.filter((tok) => activePalette[tok]).map((tok) => [`--color-${tok}`, activePalette[tok]]),
  ) as CSSProperties;

  return (
    <div className="flex flex-col gap-6 text-ink">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Import palette (JSON)</label>
        <p className="mt-0.5 text-xs text-soft">
          Paste a full 14-token set as <code>{`{ "light": { … }, "dark": { … } }`}</code> (dark optional). Applying
          fills the fields below — nothing saves until you press Save.
        </p>
        <textarea
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setImportError(null);
          }}
          rows={4}
          placeholder='{ "light": { "paper": "#fbf7f0", … } }'
          className="mt-2 w-full rounded-lg border border-line bg-card px-3 py-2 font-mono text-xs focus:border-gold focus:outline-none"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyImport}
            disabled={!importText.trim()}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
          >
            Apply to fields
          </button>
          {importError && <span className="text-xs text-danger">{importError}</span>}
        </div>
      </div>

      <div className="flex gap-1 self-start rounded-lg border border-line bg-card p-1">
        <ModeButton active={tab === "light"} onClick={() => setTab("light")}>
          Light
        </ModeButton>
        <ModeButton active={tab === "dark"} onClick={() => setTab("dark")}>
          Dark
        </ModeButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          {tab === "dark" && (
            <p className="text-xs text-soft">
              Dark is optional and partial — set only the tokens to override; the rest fall back to the default dark
              palette.
            </p>
          )}
          {TENANT_THEME_TOKENS.map((tok) => (
            <TokenField
              key={tok}
              token={tok}
              label={TOKEN_LABELS[tok]}
              value={tab === "light" ? (light[tok] ?? "") : (dark[tok] ?? "")}
              overridden={tab === "light" || Boolean(dark[tok])}
              mode={tab}
              onChange={(v) => setToken(tab, tok, v)}
              onClear={tab === "dark" ? () => clearDarkToken(tok) : undefined}
            />
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent2">Preview ({tab})</p>
          <div style={previewStyle} className="rounded-xl border border-line bg-paper p-4">
            <p className="text-sm font-semibold text-accent">Sample heading</p>
            <div className="mt-3 rounded-lg border border-line bg-card p-3">
              <p className="text-sm text-ink">A card surface with primary text.</p>
              <p className="mt-1 text-xs text-soft">Muted secondary text.</p>
              <a className="mt-2 inline-block text-xs text-accent underline underline-offset-2">A link</a>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-good-b bg-good px-2 py-0.5 text-[11px] text-good-b">Correct</span>
                <span className="rounded-md border border-bad-b bg-bad px-2 py-0.5 text-[11px] text-bad-b">Wrong</span>
                <span className="rounded-md bg-hi px-2 py-0.5 text-[11px] text-ink">Highlight</span>
                <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] text-white">Gold</span>
              </div>
              <button className="mt-3 rounded-md bg-accent px-3 py-1 text-xs font-medium text-white">Primary action</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save theme"}
        </button>
        {saved && <span className="text-xs text-accent2">Saved — live on the subdomain now.</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>

      <AssetUploads slug={slug} logoUrl={view.logoUrl} faviconUrl={view.faviconUrl} />
      <MottoEditor slug={slug} motto={view.motto} />
    </div>
  );
}

// A light/dark toggle within the theme editor (kept local to avoid coupling to the
// page-level TabButton, which styles a different context).
function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
        active ? "bg-accent text-white" : "text-soft hover:bg-hi hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

// One structured token field: a native colour picker paired with the exact hex
// text. The picker only understands 6-digit hex, so it seeds from a normalised
// value while the text field keeps the authored string verbatim (#fff, rgb(), a
// var). On the dark tab an empty field means "not overridden" and the × clears it.
function TokenField({
  token,
  label,
  value,
  overridden,
  mode,
  onChange,
  onClear,
}: {
  token: string;
  label: string;
  value: string;
  overridden: boolean;
  mode: "light" | "dark";
  onChange: (v: string) => void;
  onClear?: () => void;
}) {
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label} colour picker`}
        value={swatch}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-line bg-card p-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-ink">{label}</span>
          <code className="shrink-0 text-[10px] text-soft">{token}</code>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={mode === "dark" ? "(default dark)" : "#…"}
          className="mt-0.5 w-full rounded border border-line bg-card px-2 py-1 font-mono text-xs focus:border-gold focus:outline-none"
        />
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={!overridden}
          aria-label={`Clear ${label} dark override`}
          className="shrink-0 rounded px-1.5 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-40"
        >
          ×
        </button>
      )}
    </div>
  );
}

// The motto shown under the tenant's logo on sign-in and the dashboard, in
// place of the default site's fixed "Your learning workspace" tagline. A
// single text input + save, mirroring the theme editor's own save button
// rather than autosaving on change.
function MottoEditor({ slug, motto }: { slug: string; motto: string | null }) {
  const save = useMutation(api.tenantTheme.updateTenantMotto);
  const [value, setValue] = useState(motto ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await save({ tenantSlug: slug, motto: value });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the motto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent2">Motto</p>
      <p className="mt-0.5 text-xs text-soft">The subtitle under the logo on sign-in and the dashboard.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Your learning workspace"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save motto"}
        </button>
        {saved && <span className="text-xs text-accent2">Saved.</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}

// Logo + favicon upload slots (issue 12), wired to the identity-guarded
// setTenantAsset via the shared generateUploadUrl → POST → record rail. The file
// uploads as-is (raster only; the server refuses SVG and caps size at 256 KB) so a
// logo keeps its aspect ratio. The live getTheme query re-resolves the new url, so
// the slot's thumbnail and the header logo update on their own after a save.
function AssetUploads({ slug, logoUrl, faviconUrl }: { slug: string; logoUrl: string | null; faviconUrl: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent2">Brand assets</p>
      <p className="mt-0.5 text-xs text-soft">PNG, JPEG, or WebP up to 256&nbsp;KB. Uploads are live immediately.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <AssetSlot slug={slug} asset="logo" label="Logo" currentUrl={logoUrl} />
        <AssetSlot slug={slug} asset="favicon" label="Favicon" currentUrl={faviconUrl} />
      </div>
    </div>
  );
}

function AssetSlot({
  slug,
  asset,
  label,
  currentUrl,
}: {
  slug: string;
  asset: "logo" | "favicon";
  label: string;
  currentUrl: string | null;
}) {
  const generateUploadUrl = useMutation(api.resources.generateUploadUrl);
  const setAsset = useMutation(api.tenantTheme.setTenantAsset);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.type === "image/svg+xml") {
      setError("SVG isn't allowed — use a PNG, JPEG, or WebP.");
      return;
    }
    setBusy(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(`upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setAsset({ tenantSlug: slug, asset, storageId, contentType: file.type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-paper">
          {currentUrl ? (
            <img src={currentUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-soft">none</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{label}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="mt-1 rounded-lg border border-line px-2.5 py-1 text-xs text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
          >
            {busy ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

// Add an email to the Allowlist. The mutation normalises + validates; on success
// the live list above re-renders with the new row, so there's nothing to do here
// but clear the field.
function AddEmailForm() {
  const addEmail = useMutation(api.whitelist.addEmail);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const addr = email.trim();
        if (!addr) return;
        setBusy(true);
        setError(null);
        try {
          await addEmail({ email: addr });
          setEmail("");
        } catch {
          setError("Couldn't add — check it's a valid email address.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Admit an email</label>
      <p className="text-sm text-soft">They can then create courses with their account.</p>
      <div className="mt-1 flex gap-2">
        {/* No autoFocus: the Allowlist is a list you come to read, and focusing
            the field on mount scrolled the roster out of view on a phone. */}
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="name@example.com"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60">
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// One Allowlist row. The Admin's own row is marked and has no remove control —
// the non-removable-Admin guard (also enforced server-side in removeEmail).
function EmailRow({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const removeEmail = useMutation(api.whitelist.removeEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm text-ink">{email}</span>
        {isAdmin && (
          <span className="shrink-0 rounded-full bg-hi px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">Admin</span>
        )}
      </div>
      {isAdmin ? (
        <span className="shrink-0 text-xs text-soft">Can't be removed</span>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          {error && <span className="text-xs text-danger">Failed — retry</span>}
          <button
            onClick={async () => {
              setBusy(true);
              setError(false);
              try {
                await removeEmail({ email });
              } catch {
                setError(true);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
            aria-label={`Remove ${email}`}
          >
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      )}
    </li>
  );
}
