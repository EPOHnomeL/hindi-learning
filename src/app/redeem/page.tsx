import Link from "next/link";
import { Brand } from "~/app/_components/Brand";
import { RedeemPanel } from "~/app/_components/RedeemPanel";
import { SiteFooter } from "~/app/_components/SiteFooter";

// `/redeem` - where a member of a buying organisation turns a voucher code into
// permanent access (vouchers ticket 06, ADR 0029).
//
// **Outside the (app) group deliberately.** Inside it, `AppGate` would show a
// bare sign-in wall to somebody who arrived holding a code with no idea what this
// site is; here the form is the first thing they see, and signing up happens
// inside the flow, with the code kept.
//
// **On every host, with no tenant flag.** The code names the Edition and that
// binding is what authorises access, so the hostname is irrelevant. Gating this
// per tenant would tell a member holding a perfectly valid code that it is
// invalid because they followed the wrong link - the worst available error for
// this audience, and the one thing they cannot fix themselves.
export default function RedeemPage() {
  return (
    <main className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Branding and a way into the site. Without them, a bare code box on an
          unfamiliar domain reads as a phishing page to somebody who was handed a
          link in a group chat. */}
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Brand />
          </Link>
        </div>
      </header>

      <div className="flex-1">
        <RedeemPanel />
      </div>

      <SiteFooter />
    </main>
  );
}
