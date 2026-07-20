import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveLocale } from "./config";

// next-intl "without i18n routing" (ticket 04): the active locale is resolved
// per-request from the `hindi:locale` cookie — NEVER a URL segment — with an
// English fallback. This is the entire hot render path (ticket 03 §3): a pure
// cookie read, no Convex call. The three cookie writers (explicit pick, login
// sync, one-time Accept-Language sniff) keep the cookie correct out-of-band.
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);
  return {
    locale,
    // Statically bundled per-locale catalogues (ticket 04): no runtime fetch.
    // English is always safe to import — resolveLocale guarantees an offered code.
    messages: (
      (await import(`../../messages/${locale}.json`)) as { default: Record<string, unknown> }
    ).default,
    // A missing/rejected locale is deliberately English, never a hard error.
    onError() {},
    getMessageFallback({ key }) {
      return key;
    },
    defaultLocale: DEFAULT_LOCALE,
  };
});
