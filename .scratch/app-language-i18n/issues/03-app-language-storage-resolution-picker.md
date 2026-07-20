# app-language-i18n/03: App-language storage, resolution order, and picker

**Status:** done
**Claimed:** session 03 (2026-07-20)
**Labels:** wayfinder:grilling
**Parent:** [00 — Chrome i18n map](00-app-language-i18n-map.md)

## Question

Decide the **settings-model half** of chrome-i18n — orthogonal to the rendering layer (04), so this
sits on the frontier. Resolve:

- **Where a signed-in user's app-language lives.** A new locale field on the `users` table, or a
  small separate `userPrefs` row? (Note: course-publishing ticket 07 deliberately did *not* add a
  `users` locale field — this ticket revisits that with chrome-i18n as the actual consumer.)
- **Where a guest's app-language lives.** `localStorage` (chrome is not access-controlled — only
  content is — so a guest may pick any of the 5 freely).
- **The resolution order** for the active locale on first load and thereafter, e.g.:
  explicit user choice → stored preference (users field / localStorage) → browser `Accept-Language`
  (mapped to one of the 5, else English) → English. Confirm whether `Accept-Language` sniffing is
  wanted at all, or whether unset simply means English.
- **The picker.** Where it lives (app header? dashboard? account settings?) and the **shared ISO-639
  list** (code + English name + native name) reused with the content-translation Edition picker —
  is there an existing list to reuse (`convex/translate.ts` / the reader's language switcher)?

**Constraints from the map:** personal-only (no tenant default), preference-resolved (no URL
segment), 5 languages now with a cheap path to add more. Keep it ponytail — the smallest storage +
resolution that works.

---

## Resolution (grilled with the user, 2026-07-20)

The one load-bearing fact from ticket 04 that reshaped every answer below: **the active locale is a
cookie that `next-intl` reads server-side in `getRequestConfig`.** So the *render source of truth is
the cookie, and only the cookie* — everything else here exists to keep that cookie correct without a
Convex read on the hot render path.

### 1. Signed-in storage — a new `userPrefs` table (not a `users` field)

A small **`userPrefs`** table, typed, one row per user:

```ts
userPrefs: defineTable({
  userId: v.id("users"),
  locale: v.optional(v.string()), // BCP-47 chrome-language code, e.g. "es"; absent = never picked
}).index("by_user", ["userId"]),
```

- Row is minted (or patched) on the user's first pick. `by_user` is the single lookup.
- New preferences later become **new typed optional fields** on this row (same growth model as `users`),
  *not* a key/value bag — type-safe, migration-friendly, matches the codebase's schema style.
- **Why a table over a `users.locale` field** (the user's call; overrides the ponytail default I
  recommended): keeps chrome-preference data off the auth/identity `users` row and gives future personal
  prefs a natural home. Ticket 07's decision *not* to add a `users` locale field stands — 03 does not
  reopen it; it puts the preference in its own table instead.
- This is the **durable, cross-device account truth.** It is *not* read by `getRequestConfig` (that stays
  a pure cookie read); instead it is **synced into the cookie** (see §3).

### 2. Guest storage — the cookie itself (no `localStorage`)

The map's "guest → `localStorage`" is **superseded** — it predated 04's cookie lock. A guest's pick writes
a **long-lived persistent cookie**, which *is already* the SSR source of truth. Consequences:

- **No `localStorage`, no sync effect, no flash-of-English.** SSR reads the cookie on the request and
  renders the right locale on first paint (localStorage is invisible server-side and would force a
  post-hydration re-render).
- One render path for everyone. The only difference guest↔signed-in is what *else* gets written on a pick
  (signed-in also writes `userPrefs`) and what seeds the cookie at login (§3).

### 3. Resolution order — cookie is the render read; three writers keep it correct

**Render path (every request):** `getRequestConfig` reads **the cookie only**. No Convex call. If the
cookie is absent → English. That is the entire hot path.

**The cookie is (re)written by exactly three events:**

1. **Explicit pick** (highest precedence). Writes the cookie; if signed-in, also writes `userPrefs.locale`.
2. **Login / session start.** If the user has `userPrefs.locale`, **sync it into the cookie** (account
   truth wins over a stale/absent per-device cookie — this is what makes a new device Just Work). If they
   have no `userPrefs.locale`, leave whatever the cookie already resolved to.
3. **First visit, nothing stored** (no cookie, no `userPrefs`). **Sniff `Accept-Language` once**, map it to
   an offered locale (`en/af/es/fr/hi`), else English; **write the result to the cookie** so it's a
   one-time negotiation, never re-run. (User confirmed the sniff *is* wanted — it's the feature's
   first-touch payoff: a Spanish browser lands in Spanish chrome unprompted. The picker always overrides.)

Effective precedence, therefore: **explicit pick → stored pref (`userPrefs` synced at login for signed-in;
persisted cookie for guest) → one-time `Accept-Language` sniff → English.**

### 4. The picker — account settings (canonical) + a guest-reachable header fallback

- **Canonical home: account settings**, alongside other personal prefs — where a durable account-level
  setting belongs.
- **Guest fallback: a lightweight always-visible control in the app chrome** (header/footer menu), because
  guests have no settings page and the picker must be reachable pre-login (auth/checkout are in-scope
  surfaces). Signed-in users may use either; both write the cookie, and for signed-in users both also write
  `userPrefs`.
- **Offer-set is locked by 04: only locales that have a `messages/<code>.json` file** — `en, af, es, fr,
  hi`. **Not** the ~130-entry content menu in `convex/languages.ts`.
- **Labels reuse `convex/languages.ts`** (`LanguageInfo`: `code` + English `name` + `native` endonym) via
  its `langInfo(code)` lookup — the same metadata the content-Edition picker (`src/app/_components/
  Editions.tsx`) uses. Reuse the *names*, not the *menu*: iterate the offered codes, look each up for its
  label. Mirror `Editions.tsx` for the UI pattern.

### Boundary notes (left to owning tickets)

- The **build-time key-parity check** ("every `messages/*.json` carries `en.json`'s keys") stays with
  ticket 05 (owns the source key set) — not folded in here.
- The **mixed-language UX marker** (chrome ≠ content-Edition language) remains map-level fog; storage (03)
  + architecture (04) are now settled, so it can graduate when someone picks it up.

### Add-a-6th-language cost (constraint check)

One `messages/<code>.json` file + (if a new script) a font, per 04. This ticket adds **nothing** to that
cost: the picker derives its offer-set from the files that exist, storage is a free-form BCP-47 string, and
resolution maps against whatever locales are offered. No code change scattered across components. ✅
