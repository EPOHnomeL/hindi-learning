import Link from "next/link";
import { Brand } from "~/app/_components/Brand";
import { JoinPanel } from "~/app/_components/JoinPanel";
import { SiteFooter } from "~/app/_components/SiteFooter";
import { normaliseAccessCode } from "../../../convex/accessCodeFormat";

// `/join` - where a member of an organisation turns one shared Organisation Voucher
// code into a place on a course (ADR 0031, shared-access-codes ticket 05).
//
// **Outside the (app) group deliberately**, exactly as `/redeem` is. Inside it,
// `AppGate` would show a bare sign-in wall to somebody who arrived holding a code
// with no idea what this site is, and this rail exists precisely because that wall
// was too much ceremony for this audience. Here the form is the first thing they see,
// and the form IS the sign-up: there is no account to make first and no email to
// give.
//
// **On every host, with no tenant flag.** The code names the Edition and that binding
// is what authorises access, so the hostname is irrelevant. Gating this per tenant
// would tell a member holding a perfectly valid code that it is invalid because they
// followed the wrong link, which is the worst available error for this audience and
// the one thing they cannot fix themselves.
//
// **The code is read HERE, on the server, and passed down as a prop.** It was read in
// the client first (`window.location.search`, then `useSearchParams`) and reported as
// not arriving both times. Rather than keep guessing at the client-side mechanism,
// this takes Next's own `searchParams`: there is no hydration timing, no Suspense
// boundary subtlety, and no dependency on when `<Unauthenticated>` decides to mount
// its children. If the code is in the URL the server has it, full stop.
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const raw = (await searchParams).code;
  // A repeated `?code=a&code=b` arrives as an array. Take the first rather than
  // rendering "a,b" into the box, which would look to a member like their code was
  // mangled by us.
  const code = normaliseAccessCode(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""));

  return (
    <main className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Branding and a way into the site. Without them, a bare code box on an
          unfamiliar domain reads as a phishing page to somebody who was handed a
          link in a group chat - and this audience was handed it in a group chat. */}
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Brand />
          </Link>
        </div>
      </header>

      <div className="flex-1">
        <JoinPanel linkedCode={code} />
      </div>

      <SiteFooter />
    </main>
  );
}
