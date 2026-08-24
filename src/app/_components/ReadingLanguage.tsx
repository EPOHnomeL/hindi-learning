"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { LANG_KEY, withLang } from "./editionUrl";
import { Icon } from "./icons";

// The reading language of the course being read: a globe and a native <select>,
// at the TOP of the reader's lesson drawer.
//
// This restores the Edition switcher the bottom-nav change deleted on
// 2026-08-23, which rehomed it as a globe on the owner's Home card. That left
// two holes a user reported from Ivory Coast the next morning: inside a course
// there was no control at all, and the replacement globe was on the OWNED-course
// card only, so a learner holding a shared or purchased course could change
// reading language solely by hand-editing `?lang=` (filed as
// mobile-reader-todos/06). One control at the top of the drawer closes both,
// which is why the card-globe-for-viewers fix that ticket recommended is not the
// shape built.
//
// Top of the list, not the bottom: the drawer is `fixed bottom-0` under a 4.75rem
// tab bar, so its tail is the least reachable place on the screen, which is how
// the old bottom-pinned switcher came to be invisible on a phone in the first
// place.
//
// Chosen over chips and a custom sheet (prototype variants B and A) for the
// laziest thing that works: a native select is one tap on Android, needs no
// popover state, and grows to twenty Editions without wrapping into a wall. It
// mirrors LocalePicker, the same control for the APP language in the site
// footer, so the two languages look like siblings rather than two systems.
//
// `editions` is already scoped server-side to the languages the caller holds
// (`switcherEditions`), so this never offers an Edition they cannot read. Only
// mounted with more than one: a single Edition is not a choice.
export function ReadingLanguage({
  editions,
  current,
}: {
  editions: { lang: string; name: string; native: string; rtl: boolean }[];
  current: string;
}) {
  const t = useTranslations("Reader");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="mb-1 flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-sm transition-colors focus-within:border-gold">
      <Icon name="globe" className="h-4 w-4 shrink-0 text-soft" />
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        value={current}
        onChange={(e) => {
          const code = e.target.value;
          // Remember the pick per device so reopening the course lands back in
          // this language (the behaviour of the deleted switcher, kept).
          try {
            localStorage.setItem(LANG_KEY, code);
          } catch {
            /* storage disabled: the switch still applies for this session */
          }
          // An explicit pick pins the Edition, "en" included (editionUrl.ts).
          router.push(withLang(pathname, code));
        }}
        className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent text-sm font-medium text-ink focus:outline-none"
      >
        {editions.map((ed) => (
          <option key={ed.lang} value={ed.lang} dir={ed.rtl ? "rtl" : "ltr"}>
            {ed.native}
          </option>
        ))}
      </select>
    </label>
  );
}
