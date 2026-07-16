import Link from "next/link";
import { Logo } from "./Logo";

// The site-wide footer: brand mark, origin note, and the PayFast-compliance legal
// links (terms, privacy, refunds) that must appear site-wide. Shared by the public
// Landing and the signed-in Dashboard so the legal links live in exactly one place.
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-6 py-10 text-center text-sm text-soft">
        <span className="flex items-center gap-2 text-accent">
          <Logo className="h-6 w-6" />
          <span className="font-semibold">My Course</span>
        </span>
        <p>
          Born teaching Hindi — <span className="font-deva">नमस्ते</span> — built to teach anything.
        </p>
        {/* PayFast compliance: terms, privacy, and the refund policy linked site-wide. */}
        <nav className="mt-1 flex gap-4">
          <Link href="/terms" className="hover:text-accent">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="hover:text-accent">Privacy Policy</Link>
          <Link href="/refunds" className="hover:text-accent">Refunds &amp; Cancellation</Link>
        </nav>
      </div>
    </footer>
  );
}
