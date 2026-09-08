import { isDevanagari, isRtl } from "../../convex/languages";
import { DEFAULT_LOCALE, offeredLocale, type Locale } from "../i18n/config";

// The course poster's model (course-poster spec): the pure seam between the three
// reads (the Guest course, the tenant theme, the owner's render-local edits) and
// the slots of the sheet. The page component only paints what this returns, so
// every decision about what the poster SAYS is testable without a DOM: which
// eyebrow, which points in which order, how the price reads, how many languages,
// which chrome locale. DOM-free on purpose (vitest runs in edge-runtime).

// The slice of `public.publicCourse` the poster reads.
export type PosterCourse = {
  title: string;
  mission: string | null;
  lang: string;
  lessons: { key: string }[];
  paywall?: { amount: number; currency: string; previewKey: string | null } | undefined;
  languages: { lang: string; native: string }[];
};

// The slice of `tenantTheme.getTheme` the poster reads; null on the default site.
export type PosterTenant = {
  displayName: string;
  motto: string | null;
  theme: { light: Record<string, string> };
  logoUrl: string | null;
  flags: { certificates: boolean };
} | null;

// What the owner typed for this render. Never persisted, never translated.
export type PosterEdits = {
  highlights: string[];
  // A run of the title to italicise, as character offsets into `title`.
  emphasis: { start: number; end: number } | null;
  tagline: string | null;
};

// The chrome copy, injected so the model stays a pure function: the page hands
// in next-intl's `t` for the `Poster` namespace, the tests hand in a stub.
export type PosterChrome = (key: string, values?: Record<string, string | number>) => string;

export type PosterScript = "latn" | "deva" | "arab";
export type PosterTitleLen = "" | "long" | "xlong";

export type PosterModel = {
  locale: Locale;
  lang: string;
  dir: "ltr" | "rtl";
  script: PosterScript;
  // The sheet's palette, from the tenant's tokens (mapping in poster.css).
  palette: { cream: string; cream2: string; navy: string; navy2: string; gold: string; slate: string; card: string };
  logoUrl: string | null;
  tenantName: string;
  tenantMotto: string | null;
  eyebrow: string;
  title: { before: string; em: string; after: string };
  titleLen: PosterTitleLen;
  tagline: string | null;
  points: string[];
  cta: { kicker: string; title: string; or: string };
  shareUrl: string;
  host: string;
  price: { label: string; suffix: string } | null;
  // The footer's language line: how many live Editions, the first two named
  // natively, and how many more. Null when nothing is live.
  langs: { count: number; named: string[]; more: number } | null;
};

// The default site's palette: the light `--color-*` tokens in globals.css (the
// same mirror src/lib/pwa.ts keeps), so a default-site course gets the app's own
// skin rather than a tenant's.
const DEFAULT_PALETTE: Record<string, string> = {
  paper: "#fbf7f0", card: "#fffdf9", soft: "#6b6258", accent: "#9c5b34", accent2: "#3f6f5e", gold: "#b88a2e", hi: "#fbeecb",
};

const DEFAULT_SITE_NAME = "My Course";
const DEFAULT_SITE_MARK = "/icon.svg";

// A title over 34 characters shrinks one step, over 52 two steps, so every
// course fits the fixed 1080 x 1350 canvas (spec story 26).
export function titleLen(title: string): PosterTitleLen {
  const n = [...title.trim()].length;
  return n > 52 ? "xlong" : n > 34 ? "long" : "";
}

export function posterScript(lang: string): PosterScript {
  return isDevanagari(lang) ? "deva" : isRtl(lang) ? "arab" : "latn";
}

// The price as the poster prints it: the Edition's own currency, its narrow
// symbol, whole units unless the amount has cents (R 100, not R 100,00), in the
// poster's locale. Falls back to a plain "100 ZAR" for a currency Intl rejects.
export function priceLabel(amount: number, currency: string, locale: string): string {
  const major = amount / 100;
  const fraction = amount % 100 === 0 ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(major);
  } catch {
    return `${major.toFixed(fraction)} ${currency.toUpperCase()}`;
  }
}

// The mission as a tagline, or null. A course's mission can be a whole brief
// (prophetic-school's is a Markdown document with headings and bullets, seen on
// 2026-09-07) and a wall gets one sentence, so only a short plain line qualifies:
// no line breaks, no Markdown markers, at most 160 characters. Anything else
// leaves the slot empty for the owner to fill for this render.
export function missionTagline(mission: string | null): string | null {
  const line = mission?.trim() ?? "";
  if (!line || line.length > 160) return null;
  if (/[\r\n]/.test(line) || /[#*_`>[\]]/.test(line) || /^-\s/.test(line)) return null;
  return line;
}

function splitTitle(title: string, emphasis: PosterEdits["emphasis"]): PosterModel["title"] {
  if (!emphasis) return { before: title, em: "", after: "" };
  const start = Math.max(0, Math.min(emphasis.start, title.length));
  const end = Math.max(start, Math.min(emphasis.end, title.length));
  if (end === start) return { before: title, em: "", after: "" };
  return { before: title.slice(0, start), em: title.slice(start, end), after: title.slice(end) };
}

export function posterModel(
  { course, tenant, edits, shareUrl }: { course: PosterCourse; tenant: PosterTenant; edits: PosterEdits; shareUrl: string },
  t: PosterChrome,
): PosterModel {
  // The poster's chrome is in the Edition's language when the app ships that
  // chrome, else English, so no sheet mixes scripts by accident (story 4). Same
  // rule the Public link uses to adopt a locale.
  const locale = offeredLocale(course.lang) ?? DEFAULT_LOCALE;
  const tokens = tenant?.theme.light ?? DEFAULT_PALETTE;
  const tok = (name: string) => tokens[name] ?? DEFAULT_PALETTE[name]!;

  const paid = !!course.paywall;
  const highlights = edits.highlights.map((h) => h.trim()).filter(Boolean).slice(0, 2);
  const facts: string[] = [];
  if (course.lessons.length > 0) facts.push(t("lessons", { n: course.lessons.length }));
  // The default site has no flags to refuse with; a tenant's flag gates the claim.
  if (tenant?.flags.certificates ?? true) facts.push(t("certificate"));
  facts.push(t("offline"));
  const points = [...highlights, ...facts].slice(0, 3);

  // Language line: this Edition first, then English, then the rest by code as
  // the read returns them.
  const ordered = [
    ...course.languages.filter((l) => l.lang === course.lang),
    ...course.languages.filter((l) => l.lang !== course.lang && l.lang === "en"),
    ...course.languages.filter((l) => l.lang !== course.lang && l.lang !== "en"),
  ];
  const named = ordered.slice(0, 2).map((l) => l.native);
  const langs = ordered.length ? { count: ordered.length, named, more: ordered.length - named.length } : null;

  const tagline = edits.tagline?.trim() ? edits.tagline.trim() : missionTagline(course.mission);

  return {
    locale,
    lang: course.lang,
    dir: isRtl(course.lang) ? "rtl" : "ltr",
    script: posterScript(course.lang),
    palette: {
      cream: tok("paper"),
      cream2: tok("hi"),
      navy: tok("accent"),
      navy2: tok("accent2"),
      gold: tok("gold"),
      slate: tok("soft"),
      card: tok("card"),
    },
    logoUrl: tenant ? tenant.logoUrl : DEFAULT_SITE_MARK,
    tenantName: tenant?.displayName ?? DEFAULT_SITE_NAME,
    tenantMotto: tenant?.motto ?? null,
    eyebrow: paid ? t("eyebrowPaid") : t("eyebrowFree"),
    title: splitTitle(course.title, edits.emphasis),
    titleLen: titleLen(course.title),
    tagline,
    points,
    cta: { kicker: t("ctaKicker"), title: t("ctaTitle"), or: t("ctaOr") },
    shareUrl,
    host: new URL(shareUrl).host,
    price: course.paywall
      ? { label: priceLabel(course.paywall.amount, course.paywall.currency, locale), suffix: t("priceSuffix") }
      : null,
    langs,
  };
}
