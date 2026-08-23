---
# Decided 2026-08-23 from a /grilling session. NOT built - the build is the
# installable-app map's tickets 01-05, which render unstarted until each lands an
# ## Answer. An ADR is never rewritten to correct it; a stale one gets a superseding
# ADR.
status: accepted
---

# Every tenant is its own installable app, and offline means the list, not the lessons

Decided 2026-08-23.

## Context

The app has never been installable. `public/` held a favicon, an `icon.svg` and two demo HTML
files - no manifest, no service worker, no `apple-touch-icon`, no `viewport`/`themeColor` export.
An earlier `pwa` map asserted the groundwork had shipped; it had not, and the
[reader-experience](../../.plan/maps/reader-experience/map.md) map corrected that premise on
2026-08-01.

Two things make the question interesting here rather than routine.

**Tenancy is host-based.** `resolveTenantSlug` derives the tenant from the `Host` header
([ADR 0022](0022-tenant-subdomain-model.md)), and the session cookie is host-only
([ADR 0025](0025-per-tenant-session-isolation.md)). So each tenant subdomain is already its own
origin, with its own storage, its own service-worker registration and its own sign-in. An
installed app per tenant is not a new axis of separation - it is the axis the app already has.

**Lesson content is not actually protected by an Entitlement.** `GET /content?id=<storageId>`
(`convex/http.ts`) serves a Lesson body with **no authentication**, `Access-Control-Allow-Origin: *`
and `Cache-Control: public, max-age=31536000, immutable`. The paygate is enforced at the *query
that hands out the storage id*, never at the content. `convex/lib.ts` says so plainly: *"The
storageId is an unguessable bearer capability; callers only reach this after the query has
authorized them."* Unguessable-id-as-capability is a defensible design, but its consequence is
that any learner who has legitimately opened a Lesson holds a URL that reads that Lesson forever,
from any origin, with no session, immune to revocation.

That fact reframes the offline question. The standing objection to offline content was that it
would put *"a copy of paid content on a device an Entitlement revocation cannot reach"*. That
describes the **current** state. Offline caching would not introduce the exposure; it would only
make it convenient.

## Decision

### 1. Each tenant is an installable app, prompted for by us and not by the browser

A per-tenant web app manifest is served from a **route handler** at `/manifest.webmanifest`, not
Next's `app/manifest.ts` convention - that convention is statically generated at build time and so
cannot vary by `Host`. It reads the existing `getTenantView()` rail and takes `name`/`short_name`
from `displayName` and `theme_color`/`background_color` from the tenant's own palette tokens. The
default site gets one too, or the apex becomes the single host where install silently fails.

The prompt is **ours**: a dismissible, tenant-branded bottom sheet on `/`, in both auth states,
about three seconds after load. Not a blocking interstitial - `/` is also the public marketing
page (a bespoke one per tenant, via `landingFor`) and sits one click from checkout, so gating it
taxes acquisition to buy installs from people who have not yet decided to trust the brand.

Both platforms are served, and they are **not the same feature**. Android/Chrome fires
`beforeinstallprompt`, which we capture and replay, so the sheet's button opens the real OS install
dialog. **iOS has never shipped `beforeinstallprompt` and never will**, so an "Install" button
there would be a lie; iOS gets an instruction sheet pointing at Share -> Add to Home Screen. The
iOS half ships as its own commit so it can be removed without unpicking the Android path.

### 2. The App Icon is derived, never uploaded

Platforms demand an opaque square (192, 512, a maskable variant, and a 180 `apple-touch-icon`;
iOS renders transparency as solid black). Tenant Logos cannot be that: they are raster, size-capped
and wildly non-square - yknot ~2.6:1, YWAM ~7:1, Almighty Warriors ~1:1.

The icon is therefore **composited at request time** from the tenant's Logo, contained with
padding, onto an opaque square of the tenant's own palette. `ImageResponse` from `next/og` renders
it, so this needs **no new dependency** and no image-processing library.

The rejected alternative was a fourth uploaded brand asset (`setTenantAsset` already takes
`"logo" | "favicon"`, so the union was one word from admitting `"appIcon"`). It was rejected
because it makes four design chores and a validator change a **precondition for shipping
anything**, leaves every future tenant looking uninstallable until someone remembers, and still
requires the derived fallback to be built for the missing-asset case. Deriving it means every
tenant, present and future, gets a decent icon with zero operator work. The accepted cost is that
a wide banner reads as a logo floating in a coloured square rather than as a tight glyph.

An uploaded `appIcon` remains a small additive change if a tenant ever wants a bespoke mark.

### 3. Offline covers the Offline Catalogue and deliberately not Lesson bodies

What is cached is the **course lists** - the tenant's public catalogue, and the signed-in learner's
own dashboard list - held as last-known-good under the `hindi:` prefix, so the existing sign-out
sweep clears them. They are rendered whenever the live query has not resolved, which offline is
**always**: Convex is a WebSocket, so offline it never connects and `useQuery` sits at `undefined`
rather than erroring.

The **service worker caches the app shell**, which is what makes the cached list reachable at all -
without it, launching offline shows the browser's error page and the cached list is data nothing
ever loads to read. Three rules, and the rules are the design:

- `/_next/static/*` -> **cache-first, indefinitely**. Safe because those names are content-hashed.
- navigations -> **network-first, falling back to a cached `/`**. Online always gets fresh HTML,
  so a deploy can never serve a stale document referencing deleted chunks.
- everything else, including `?_rsc=` payloads and Convex -> **network only**.

**Lesson bodies are not cached.** Not because caching them would newly expose paid content - per
the Context, `/content` already does that permanently - but because the feature that would make
offline reading *work* is not the cache. It is a **time-boxed lease** (the download expires unless
the device reaches Convex to renew, so a revoked Entitlement simply fails to renew) plus an
**offline queue for Responses and Progress**. The quiz bridge `postMessage`s a learner's answer to
the parent, which writes it to Convex, and first-answer-only is enforced server-side - so replaying
a queued answer has ordering consequences that are their own design problem.

**Encryption of an offline cache is explicitly rejected as a substitute for either.** WebCrypto
makes it trivial, and it would achieve nothing: the key must reach the device, the plaintext must
render in a browser the learner controls, and the key sits in their IndexedDB. It would be
strictly weaker than the `/content` URL the learner can already save. Encryption without a lease
delivers **zero** revocation; a lease without encryption delivers revocation within one lease
period. The lease is the whole mechanism.

## Consequences

- A learner who installs on iOS **must sign in once inside the app** - an installed iOS home-screen
  app has its own cookie jar, separate from Safari. With a 365-day cookie and a 60-day rolling
  window (`src/lib/sessionLifetime.ts`) this is a one-time cost, and it is the same shape as the
  per-subdomain sign-in of [ADR 0025](0025-per-tenant-session-isolation.md).
- **Google OAuth from a standalone iOS app is unverified and may not work.** `signIn("google", ...)`
  navigates to `accounts.google.com`, necessarily outside manifest scope; depending on iOS version
  the return either lands in the app or completes in Safari, leaving the learner signed in there
  and still signed out in the app, with no error. This is not pre-emptively worked around - the
  password path is unaffected either way, and permanently degrading the preferred sign-in to defend
  against an unconfirmed bug is the worse trade. It is instead a **release gate**: the work is not
  done until a Google sign-in has been completed inside the installed app on a real iPhone.
- The install sheet is a **new UI surface built before the design foundation that would govern
  it** - [ui-overhaul](../../.plan/maps/ui-overhaul/map.md) ticket 03 is unresolved. Expect to
  restyle one component when it lands. Accepted knowingly; the bill is one file.
- **Nobody can measure whether this works.** PostHog is not wired (ui-overhaul tickets 07-11), so
  there is no install-rate, no funnel and no replay. Any later claim about whether the sheet earns
  its place is opinion until that instrumentation ships.
- Offline reading of Lessons remains **unbuilt and now specified as three problems, not one**:
  the lease, the Response/Progress queue, and the `/content` exposure. Tracked as tickets on
  [reader-experience](../../.plan/maps/reader-experience/map.md) and
  [marketplace](../../.plan/maps/marketplace/map.md).
