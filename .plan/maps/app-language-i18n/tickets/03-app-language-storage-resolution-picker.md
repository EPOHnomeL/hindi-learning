---
type: grilling
blocked_by: []
---

# App-language storage, resolution order, and picker

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

## Done when

Storage location (signed-in + guest), the active-locale resolution order, and the picker's home +
its shared label source are all decided, and the decision adds nothing to the add-a-language cost.

## Answer

Resolved by grilling with the user, 2026-07-20. The one load-bearing fact from ticket 04 that
reshaped every answer: **the active locale is a cookie that `next-intl` reads server-side in
`getRequestConfig`.** So the *render source of truth is the cookie, and only the cookie* — everything
else exists to keep that cookie correct without a Convex read on the hot render path.

**1. Signed-in storage — a new `userPrefs` table (not a `users` field).** A small typed table, one
row per user:

```ts
userPrefs: defineTable({
  userId: v.id("users"),
  locale: v.optional(v.string()), // BCP-47 chrome-language code, e.g. "es"; absent = never picked
}).index("by_user", ["userId"]),
```

Row minted/patched on first pick; `by_user` is the single lookup. Future prefs become new typed
optional fields (not a key/value bag). **A table over `users.locale` is the user's call** (overriding
the ponytail default recommended): keeps chrome-preference off the auth/identity row and gives future
personal prefs a home. Ticket 07's "no `users` locale field" stands. This is the durable cross-device
account truth; it is *not* read by `getRequestConfig`, it is synced into the cookie (§3).

**2. Guest storage — the cookie itself (no `localStorage`).** The map's "guest → `localStorage`" is
superseded (it predated 04's cookie lock). A guest's pick writes a long-lived persistent cookie, which
already *is* the SSR source of truth: no `localStorage`, no sync effect, no flash-of-English. One
render path for everyone.

**3. Resolution order — cookie is the render read; three writers keep it correct.** Render path (every
request): `getRequestConfig` reads the cookie only, no Convex call; absent cookie → English. The cookie
is (re)written by exactly three events: (1) **explicit pick** (highest precedence) — writes the cookie
and, if signed-in, `userPrefs.locale`; (2) **login / session start** — if `userPrefs.locale` exists,
sync it into the cookie (account truth wins over a stale/absent per-device cookie, making a new device
Just Work); (3) **first visit, nothing stored** — sniff `Accept-Language` once, map to an offered locale
(`en/af/es/fr/hi`) else English, write the result to the cookie (one-time, never re-run). The user
confirmed the sniff *is* wanted (a Spanish browser lands in Spanish chrome unprompted; the picker always
overrides). Effective precedence: **explicit pick → stored pref (`userPrefs` synced at login for
signed-in; persisted cookie for guest) → one-time `Accept-Language` sniff → English.**

**4. The picker — account settings (canonical) + a guest-reachable header fallback.** Canonical home is
account settings; a lightweight always-visible control in the app chrome (header/footer) serves guests
(who have no settings page and must reach it pre-login on auth/checkout). Both controls write the cookie;
for signed-in users both also write `userPrefs`. **Offer-set locked by 04: only locales with a
`messages/<code>.json` file** (`en, af, es, fr, hi`), **not** the ~130-entry content menu in
`convex/languages.ts`. **Labels reuse `convex/languages.ts`** (`LanguageInfo`: `code` + English `name` +
`native` endonym) via `langInfo(code)` — the same metadata `src/app/_components/Editions.tsx` uses.
Reuse the names, not the menu: iterate the offered codes and look each up. Mirror `Editions.tsx` for UI.

**Boundary notes:** the build-time key-parity check stays with ticket 05 (owns the source key set); the
mixed-language UX marker remains map-level fog and can graduate now that storage (03) + architecture (04)
are settled. **Add-a-6th-language cost check:** one `messages/<code>.json` (+ a font if a new script, per
04); this ticket adds nothing — the picker derives its offer-set from the files that exist, storage is a
free-form BCP-47 string, resolution maps against whatever is offered. ✅
