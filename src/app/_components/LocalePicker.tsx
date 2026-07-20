"use client";

import { useLocale, useTranslations } from "next-intl";
import { langInfo } from "../../../convex/languages";
import { LOCALES } from "~/i18n/config";
import { useSetLocale } from "~/i18n/locale-client";
import { Icon } from "./icons";

// The app-language picker (app-language-i18n ticket 03 §4). A compact,
// always-visible chrome control: a globe + a native-name dropdown. Guest-reachable
// (it writes the cookie directly — a guest's only store) and, when signed-in,
// useSetLocale also persists to the account. Picking refreshes so Server
// Components re-render in the new locale with no full reload.
//
// The offer-set is LOCALES — the locales that HAVE a `messages/<code>.json` file
// (ticket 04), NOT the ~130-entry content picker in convex/languages.ts. langInfo
// supplies each offered code's native endonym for the label (reuse the names, not
// the menu). Mirrors the reader's Edition-switcher select pattern (Editions.tsx).
export function LocalePicker({ className }: { className?: string }) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const setLocale = useSetLocale();

  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-sm text-soft transition-colors focus-within:border-gold hover:text-accent ${className ?? ""}`}
    >
      <Icon name="globe" className="h-4 w-4 shrink-0" />
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="cursor-pointer border-0 bg-transparent pr-1 text-sm text-ink focus:outline-none"
      >
        {LOCALES.map((code) => {
          const info = langInfo(code);
          return (
            <option key={code} value={code} dir={info.rtl ? "rtl" : "ltr"}>
              {info.native}
            </option>
          );
        })}
      </select>
    </label>
  );
}
