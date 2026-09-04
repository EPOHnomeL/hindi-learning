import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Brand } from "~/app/_components/Brand";
import { DonateSection } from "~/app/_components/DonateSection";
import { SiteFooter } from "~/app/_components/SiteFooter";
import { getTenantSlug } from "~/lib/tenant-server";

// `/donate` — the donation rail's own page (marketplace/10, spec-donate-route.md).
// Lives OUTSIDE the (app) group so it is ungated, exactly like (legal): the donor
// is a Guest (ADR 0027) and must never meet an auth wall on the way to giving.
//
// **Why this route exists at all.** The rail shipped reachable only as
// `<tenant>.my-course.app#donations`, and that link was broken in both auth
// states: <DonateSection/> renders null until its queries resolve, so the browser
// found no anchor to scroll to; and signed in, `/` is the Dashboard, which has no
// donation section. A page whose whole body IS the widget cannot have either
// problem — there is no anchor to miss and no auth-conditional swap.
//
// The landing section stays exactly where marketplace/08 put it. This is an
// ADDITIONAL surface (the linkable one), not a replacement for the passive ask.

export default async function DonatePage() {
  const slug = await getTenantSlug();
  // The default site has no tenant, so it has no donation rail to ask for.
  if (!slug) notFound();

  // **Deliberately NOT `getTenantView()`.** That helper swallows Convex errors and
  // returns null on purpose — "a theme read is best-effort branding, never access
  // control" — which is right for a palette and wrong here: reusing it would turn
  // a transient Convex blip into a 404 on a working donation page. Let the fetch
  // throw (a 500 the operator can see) and 404 only on a genuine flag-off.
  const tenant = await fetchQuery(api.tenantTheme.getTheme, { slug });

  // Fail closed by absence, the same posture the flag has everywhere else. On a
  // site that doesn't take donations this page genuinely does not exist — which
  // is also why it isn't a friendly "not accepting donations" message: that would
  // advertise the feature to tenants who haven't enabled it.
  //
  // The flag is the whole gate here; live payee readiness needs a QueryCtx and is
  // re-checked by `donations.checkoutFields` at the click. That is safe because
  // the flag cannot be switched on without a ready payee (ADR 0027) — so a payee
  // revoked afterwards yields a page that errors on Donate, never a silent 404.
  if (!tenant?.flags.donations) notFound();

  return (
    <main className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Branding and a way back into the site. Without them a bare payment form
          on an unfamiliar subdomain reads as a phishing page. */}
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Brand />
          </Link>
        </div>
      </header>

      <div className="flex-1">
        <DonateSection />
      </div>

      <SiteFooter />
    </main>
  );
}
