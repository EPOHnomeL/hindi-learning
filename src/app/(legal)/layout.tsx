import Link from "next/link";
import { Logo } from "~/app/_components/Logo";

// The legal pages (/terms, /privacy, /refunds) — public, static, outside the
// auth gate. PayFast compliance requires the site to carry terms & conditions,
// a privacy policy, and a refund & cancellation policy.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-accent">
            <Logo className="h-7 w-7" />
            <span className="font-semibold">My Course</span>
          </Link>
          <nav className="flex gap-4 text-sm text-soft">
            <Link href="/terms" className="hover:text-accent">Terms</Link>
            <Link href="/privacy" className="hover:text-accent">Privacy</Link>
            <Link href="/refunds" className="hover:text-accent">Refunds</Link>
          </nav>
        </div>
      </header>
      <article className="legal-prose mx-auto w-full max-w-3xl px-6 py-10 text-[15px] leading-relaxed [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-accent [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-accent [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1 [&_a]:text-accent2 [&_a]:underline-offset-2 hover:[&_a]:underline">
        {children}
      </article>
      <footer className="border-t border-line">
        <p className="mx-auto w-full max-w-3xl px-6 py-8 text-sm text-soft">
          Questions? Contact <a className="text-accent2 hover:underline" href="mailto:support@my-course.app">support@my-course.app</a>.
        </p>
      </footer>
    </main>
  );
}
