// Period selector for the admin Sales report (.scratch/admin-sales).

export type SalesPreset = "7d" | "30d" | "month" | "all" | "custom";

// The {from?, to?} ms window for a chosen period, given the current time `now`
// (passed in rather than read here, so this stays pure and testable). `to` is
// exclusive — the query treats it so — hence the +1 day on a custom end date to
// include the whole chosen day.
//
// CRUCIAL: the rolling presets anchor to the START OF `now`'s day, not to `now`
// itself. `useQuery` keys on the VALUE of these args, so a `from` that drifted
// every render (as a raw `Date.now() - N*day` does — the ms tick between
// renders) makes the query resubscribe on every render and never resolve: an
// endless loading state. Flooring to the day makes `from` identical across all
// renders within a day, so the subscription settles.
export function salesRange(
  preset: SalesPreset,
  from: string,
  to: string,
  now: number,
): { from?: number; to?: number } {
  const day = 86_400_000;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const t0 = startOfDay.getTime();
  if (preset === "7d") return { from: t0 - 6 * day }; // today + the previous 6 days
  if (preset === "30d") return { from: t0 - 29 * day }; // today + the previous 29 days
  if (preset === "month") {
    const d = new Date(now);
    return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
  }
  if (preset === "custom") {
    return {
      from: from ? new Date(`${from}T00:00:00`).getTime() : undefined,
      to: to ? new Date(`${to}T00:00:00`).getTime() + day : undefined,
    };
  }
  return {}; // all time
}
