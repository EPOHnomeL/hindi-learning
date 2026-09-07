import { Inter, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { DEFAULT_LOCALE, offeredLocale } from "~/i18n/config";
import { PosterPage } from "~/app/_components/Poster";
import "./poster.css";

// The poster's Latin faces (course-poster spec), loaded through the same font
// loader as the app's own so nothing is fetched from a third-party stylesheet at
// runtime. Scoped to this route: the class names ride down to the sheet, so the
// rest of the app never pays for them. Devanagari and Arabic-script Editions reuse
// the Noto faces the root layout already carries.
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-newsreader" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// The poster's chrome (eyebrow, call to action, price suffix, language line) is
// in the Edition's language when the app ships that chrome, else English, so no
// sheet mixes scripts by accident. The Edition language is the cheapest read in
// the Guest seam; a failed read falls back to English rather than failing the
// page. Only the `Poster` namespace rides down: the sheet needs nothing else.
export default async function PosterRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let lang: string | null = null;
  try {
    lang = await fetchQuery(api.public.publicEditionLang, { token });
  } catch {
    lang = null;
  }
  const locale = offeredLocale(lang) ?? DEFAULT_LOCALE;
  const messages = (await import(`../../../../messages/${locale}.json`)) as {
    default: { Poster: Record<string, string> };
  };
  return (
    <NextIntlClientProvider locale={locale} messages={{ Poster: messages.default.Poster }}>
      <PosterPage token={token} fontClass={`${newsreader.variable} ${inter.variable}`} />
    </NextIntlClientProvider>
  );
}
