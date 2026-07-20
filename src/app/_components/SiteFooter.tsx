import { useTranslations } from "next-intl";
import Link from "next/link";
import { LocalePicker } from "./LocalePicker";
import { Logo } from "./Logo";

// The site-wide footer: brand mark, origin note, and the PayFast-compliance legal
// links (terms, privacy, refunds) that must appear site-wide. Shared by the public
// Landing and the signed-in Dashboard so the legal links live in exactly one place.
export function SiteFooter() {
  const t = useTranslations("Footer");
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-6 py-10 text-center text-sm text-soft">
        <span className="flex items-center gap-2 text-accent">
          <Logo className="h-6 w-6" />
          <span className="font-semibold">My Course</span>
        </span>
        <p>{t.rich("origin", { deva: (c) => <span className="font-deva">{c}</span> })}</p>
        {/* PayFast compliance: terms, privacy, and the refund policy linked site-wide. */}
        <nav className="mt-1 flex gap-4">
          <Link href="/terms" className="hover:text-accent">{t("termsAndConditions")}</Link>
          <Link href="/privacy" className="hover:text-accent">{t("privacyPolicy")}</Link>
          <Link href="/refunds" className="hover:text-accent">{t("refundsAndCancellation")}</Link>
        </nav>
        {/* The app-language picker (ticket 03 §4): site-wide chrome, so it's the
            guest-reachable home for the setting — the landing/legal pages all
            render this footer, pre-login. */}
        <div className="mt-2">
          <LocalePicker />
        </div>
      </div>
    </footer>
  );
}
