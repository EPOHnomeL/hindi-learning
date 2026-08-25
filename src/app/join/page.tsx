import Link from "next/link";
import { Brand } from "~/app/_components/Brand";
import { JoinPanel } from "~/app/_components/JoinPanel";
import { SiteFooter } from "~/app/_components/SiteFooter";

// `/join` - where a member of an organisation turns one shared Access Code into a
// Seat on a course (ADR 0031, shared-access-codes ticket 05).
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
export default function JoinPage() {
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
        <JoinPanel />
      </div>

      <SiteFooter />
    </main>
  );
}
