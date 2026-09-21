"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// The Admin portal's building blocks (2026-09-21 revamp). Before this the portal
// was one narrow column of hand-styled cards per tab, each tab spelling its own
// list, its own empty state and its own loading rows. These are the six shapes
// every tab is now made of: the shell with its tab strip, a page header, a stat
// tile, a titled panel, a data table and a badge. Presentation only: no query,
// no mutation, no state lives here.

// ---- form and button class strings -------------------------------------------
// Exported as strings rather than components so a form can stay a plain <form>
// with plain <input>s (the theme editor has forty of them).
export const inputCls =
  "min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-soft/60 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-60";
export const btnPrimary =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60";
export const btnGhost =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-sm font-medium text-soft transition-colors hover:border-transparent hover:bg-hi hover:text-accent disabled:cursor-not-allowed disabled:opacity-60";
export const btnDanger =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-card px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card disabled:hover:text-danger";
// A small field label above an input.
export const labelCls = "text-[11px] font-bold uppercase tracking-wider text-soft";

// ---- the shell ------------------------------------------------------------------

export type AdminTab<K extends string> = { key: K; label: string; icon: IconName; badge?: number };

// The portal frame: a top band with the identity block on the left and the way
// back to Courses on the right, the tab strip underneath it, then the page. The
// tab strip is the manage route's underline strip so the two admin surfaces read
// as one family. It scrolls sideways on a phone instead of wrapping into two
// rows, which is what the old pill group did at 360px.
export function AdminShell<K extends string>({
  eyebrow,
  title,
  tabs,
  active,
  onTab,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  tabs?: readonly AdminTab<K>[];
  active?: K;
  onTab?: (key: K) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <div className="border-b border-line bg-card/70">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-white shadow-sm">
                <Icon name="sliders" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent2">{eyebrow}</p>
                <h1 className="truncate text-lg font-semibold leading-heading tracking-heading text-accent">{title}</h1>
              </div>
            </div>
            <Link href="/" className={`press ${btnGhost}`}>
              <Icon name="arrow" className="h-4 w-4 rotate-180" />
              <span>Courses</span>
            </Link>
          </div>
          {tabs && (
            <nav role="tablist" aria-label="Admin sections" className="-mb-px flex gap-1 overflow-x-auto">
              {tabs.map((t) => {
                const on = t.key === active;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => onTab?.(t.key)}
                    className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                      on ? "border-accent text-accent" : "border-transparent text-soft hover:text-ink"
                    }`}
                  >
                    <Icon name={t.icon} className="h-4 w-4 shrink-0" />
                    {t.label}
                    {t.badge !== undefined && t.badge > 0 && (
                      <span className="ml-0.5 rounded-full bg-gold/15 px-1.5 py-px text-[10.5px] font-bold tabular-nums text-gold">
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">{children}</main>
    </div>
  );
}

// A tab's heading: what this page is, one line on why, and its controls at the
// right (the Sales period picker, for instance).
export function PageHeader({ title, hint, actions }: { title: string; hint: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold leading-heading tracking-heading text-accent md:text-3xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-soft">{hint}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---- stat tiles -----------------------------------------------------------------

// One figure with its label above and a one-line reading below. `value` is the
// point of the tile, so it carries the weight. Pass `undefined` while the query
// is in flight and the tile draws a placeholder in the figure's place, so the
// row never jumps.
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "soft",
}: {
  label: string;
  value: string | undefined;
  hint?: string;
  icon: IconName;
  tone?: "soft" | "gold" | "accent2" | "danger";
}) {
  const bubble = {
    soft: "bg-hi text-accent",
    gold: "bg-gold/15 text-gold",
    accent2: "bg-accent2/15 text-accent2",
    danger: "bg-danger/10 text-danger",
  }[tone];
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 shadow-sm">
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${bubble}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={labelCls}>{label}</p>
        {value === undefined ? (
          <div className="mt-1.5 h-6 w-24 animate-pulse rounded bg-soft/20" aria-busy />
        ) : (
          <p className="mt-0.5 truncate text-xl font-semibold tabular-nums text-ink">{value}</p>
        )}
        {hint && <p className="mt-0.5 truncate text-xs text-soft">{hint}</p>}
      </div>
    </div>
  );
}

// ---- panels ---------------------------------------------------------------------

// A titled card. `actions` sits in the header (an inline add form, a period
// picker); `flush` drops the body padding so a table can run edge to edge.
// `tone="gold"` marks the panels with money waiting on the operator, the way
// the old queue cards wore a gold border.
export function Panel({
  title,
  hint,
  actions,
  tone = "line",
  flush = false,
  children,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  tone?: "line" | "gold" | "danger";
  flush?: boolean;
  children: ReactNode;
}) {
  const border = { line: "border-line", gold: "border-gold/40", danger: "border-danger/30" }[tone];
  return (
    <section className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${border}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-heading text-ink">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-soft">{hint}</p>}
        </div>
        {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={flush ? "" : "px-5 py-4"}>{children}</div>
    </section>
  );
}

// ---- data table -----------------------------------------------------------------

export type Column<T> = {
  key: string;
  header: ReactNode;
  // Numbers and money sit at the end of their cell so the digits line up.
  align?: "start" | "end";
  className?: string;
  cell: (row: T) => ReactNode;
};

// A real <table>, in a panel: uppercase column heads, hairline row rules, a
// hover tint. It scrolls sideways inside its panel when the viewport is narrower
// than its columns, which beats a card per row that has to reinvent alignment.
// `expanded` returns the row's drawer (the Sales course's editions) or null, and
// the caller owns which rows are open.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  expanded,
  rowClassName,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  empty: ReactNode;
  expanded?: (row: T) => ReactNode | null;
  rowClassName?: (row: T) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-soft ${
                  c.align === "end" ? "text-end" : "text-start"
                } ${c.className ?? ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows === undefined ? (
            [0, 1, 2].map((i) => (
              <tr key={i} className="border-t border-line" aria-busy>
                {columns.map((c) => (
                  <td key={c.key} className="px-5 py-3.5">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-soft/20" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr className="border-t border-line">
              <td colSpan={columns.length} className="px-5 py-10 text-center text-sm text-soft">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const drawer = expanded?.(row) ?? null;
              return (
                <RowGroup key={rowKey(row)}>
                  <tr className={`border-t border-line transition-colors hover:bg-hi/30 ${rowClassName?.(row) ?? ""}`}>
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-5 py-3 align-middle ${c.align === "end" ? "text-end" : "text-start"} ${
                          c.className ?? ""
                        }`}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                  {drawer && (
                    <tr className="border-t border-line/60 bg-paper/60">
                      <td colSpan={columns.length} className="px-5 py-3">
                        {drawer}
                      </td>
                    </tr>
                  )}
                </RowGroup>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// A row and its drawer need one key between them; a fragment carries it.
function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// ---- small marks ----------------------------------------------------------------

export function Badge({
  tone = "soft",
  children,
}: {
  tone?: "soft" | "accent" | "accent2" | "gold" | "danger";
  children: ReactNode;
}) {
  const cls = {
    soft: "bg-hi text-soft",
    accent: "bg-hi text-accent",
    accent2: "bg-accent2/15 text-accent2",
    gold: "bg-gold/15 text-gold",
    danger: "bg-danger/10 text-danger",
  }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

// A two-line cell: the thing, then a muted line about it.
export function Cell({ primary, secondary, mono }: { primary: ReactNode; secondary?: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`truncate font-medium text-ink ${mono ? "font-mono text-[13px] tracking-wider" : ""}`}>{primary}</div>
      {secondary && <div className="mt-0.5 truncate text-xs text-soft">{secondary}</div>}
    </div>
  );
}

// A money figure, bold and end-aligned by its column.
export function Amount({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "gold" }) {
  return (
    <span className={`font-semibold tabular-nums ${tone === "gold" ? "text-gold" : "text-ink"}`}>{children}</span>
  );
}

// A thin proportion bar with its label, for a share-of-total column.
export function Meter({ fraction, label }: { fraction: number; label?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-24 shrink-0 overflow-hidden rounded-[4px]"
        style={{ background: "color-mix(in srgb, var(--color-accent) 14%, transparent)" }}
        aria-hidden
      >
        <span className="block h-full rounded-r-[4px] bg-accent" style={{ width: `${pct}%` }} />
      </span>
      {label !== undefined && <span className="text-xs tabular-nums text-soft">{label}</span>}
    </div>
  );
}

// A segmented control: the Sales period picker, the theme editor's light/dark.
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-card p-0.5">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              on ? "bg-accent text-white shadow-sm" : "text-soft hover:bg-hi hover:text-accent"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// The lift-off-paper placeholder every list here used, kept for the few lists
// that are not tables (Generating now, the tenant picker).
export function ListSkeleton({ rows = 2, height = "h-14" }: { rows?: number; height?: string }) {
  return (
    <ul className="flex flex-col gap-2" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className={`${height} animate-pulse rounded-xl border border-line bg-soft/10`} />
      ))}
    </ul>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-soft">{children}</p>;
}
