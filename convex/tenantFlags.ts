import type { Infer } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { tenantFlagsValidator } from "./schema";

// Whitelabel feature flags (issue 04 / 17). (Plain module — no Convex functions
// registered here.) Split out of `lib.ts` by architecture-deepening/02: flag
// gating is unrelated to the Edition access stack that file exists for.

// One of a tenant's five feature flags (schema `tenantFlagsValidator`).
export type TenantFlag = keyof Infer<typeof tenantFlagsValidator>;

// The server-side flag gate: throws when `flag` is off for `tenantSlug`. Called
// inline in the five create-side mutations so a disabled feature is enforced at
// the API boundary, not merely hidden in the UI (issue 17). `tenantSlug`
// undefined = default site / not-yet-tenanted content, where every flag is
// implicitly on — matching today's always-on behaviour exactly (no regression).
// Read paths never call this: only the CREATE path is gated, so anything already
// granted keeps resolving after a flag flips off (flag-off is frozen, not
// revoked, ADR/issue 04). A slug with no `tenants` row is denied (fail-closed).
// The `by_slug` read hits the bounded, indexed tenants table.
export async function assertTenantFlag(
  ctx: QueryCtx,
  tenantSlug: string | undefined,
  flag: TenantFlag,
): Promise<void> {
  if (tenantSlug === undefined) return;
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
    .unique();
  if (!tenant?.flags[flag]) throw new Error("This feature isn't available on this site.");
}
