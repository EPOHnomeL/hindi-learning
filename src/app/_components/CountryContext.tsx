"use client";

import { createContext, useContext, type ReactNode } from "react";

// The buyer's country, resolved ONCE server-side (root layout, from
// `x-vercel-ip-country`) and handed to the client — the same one-resolution-point
// shape as the tenant slug beside it in `TenantContext`.
//
// It rides a context rather than a prop chain because the two surfaces that need
// it sit at different depths of two different trees: the `Paygate` card renders
// inside both readers (authed and Guest), and the checkout page is its own route.
// Threading a country prop through the reader to reach one price line would touch
// every component in between for nothing.
//
// **Display only.** The charge is derived server-side inside Convex from the
// `country` argument the mutations take; nothing here is trusted with money, and
// no amount ever travels the other way (ticket 11 §7).
const Ctx = createContext<string | null>(null);

export function CountryProvider({ country, children }: { country: string | null; children: ReactNode }) {
  return <Ctx.Provider value={country}>{children}</Ctx.Provider>;
}

// `null` on localhost and anywhere the header is absent, which `regionForCountry`
// reads as the base price region.
export function useCountry(): string | null {
  return useContext(Ctx);
}
