"use client";

// **The shared day-bucketed stacked column chart**, its own module since
// 2026-09-08 (ticket 34). It called itself "the shared chart" in its own comment
// and already had two real adapters, which is what makes it a seam rather than a
// component that happens to be used twice, and it sat inside a 2660-line file
// whose only export was the panel.
//
// The interface is three things and nothing else: the `columns`, the `empty`
// caption and the `zero` tooltip line. It knows no series names, no colours and
// no date range. The caller owns the palette mapping (language rank for Sales,
// fixed slots for Generation) and the day bucketing.
import { axisTicks, labelIndices, niceMax } from "./dayChart";

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
export type DaySegment = { key: string; label: string; value: number; color: string };
export type DayColumn = { dayMs: number; segments: DaySegment[] };

const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "UTC" });

export function DayStackChart({ columns, empty, zero }: { columns: DayColumn[]; empty: string; zero: string }) {
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
export function VizLegend({ series }: { series: { key: string; label: string; color: string }[] }) {
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
