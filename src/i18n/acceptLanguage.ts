import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

// Parse an `Accept-Language` header and pick the highest-priority offered locale,
// English otherwise. Cookie-writer #3's mapping half (ticket 03 §3): the browser
// sends e.g. `es-MX,es;q=0.8,en;q=0.5`; we honour the q-weighted order and match
// on the base subtag so `es-MX` still lands on the `es` catalogue. Deliberately
// tiny — a first-touch negotiation, not a full RFC-4647 lookup.
export function matchAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const weight = q ? parseFloat(q.trim().slice(2)) : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), q: Number.isFinite(weight) ? weight : 1 };
    })
    .filter((r) => r.tag)
    .sort((a, b) => b.q - a.q);

  const offered = LOCALES as readonly string[];
  for (const { tag } of ranked) {
    const base = tag.split("-")[0]!;
    if (offered.includes(tag)) return tag as Locale;
    if (offered.includes(base)) return base as Locale;
  }
  return DEFAULT_LOCALE;
}
