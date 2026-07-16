import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Refund & Cancellation Policy — My Course" };

// Refund & cancellation policy (PayFast compliance). Honest to the rail: digital
// content, delivered instantly, once-off — all sales final; support owns problems.
export default function RefundsPage() {
  return (
    <>
      <h1>Refund &amp; Cancellation Policy</h1>
      <p className="text-soft">Last updated: 13 July 2026</p>

      <h2>Purchases are final</h2>
      <p>
        Buying a course edition is a <b>once-off payment for immediate, lifetime digital access</b>. Because the full
        content is delivered to your account the moment payment is confirmed, <b>all sales are final and purchases
        are not refundable</b>, except where a refund is required by applicable South African law.
      </p>

      <h2>Before you buy</h2>
      <p>
        Every paid course offers its first lesson free — read it, and check the course title, language edition, and
        price shown in the purchase dialog before continuing to PayFast. A purchase attaches to the account you are
        signed into when you buy.
      </p>

      <h2>Cancellation</h2>
      <p>
        There is nothing to cancel: My Course has no subscriptions, trials, or recurring charges. A purchase is a
        single payment and nothing is billed afterwards. You may stop using the service, or ask for your account to
        be deleted, at any time.
      </p>

      <h2>Something went wrong?</h2>
      <p>
        If you paid and your course did not unlock, bought the wrong language edition by mistake, or see a charge you
        don&rsquo;t recognise, contact <a href="mailto:support@my-course.app">support@my-course.app</a> with the
        email you paid with and (if you have it) the PayFast payment reference. Access problems are ours to fix, and
        genuine mistakes are handled case by case.
      </p>

      <p className="text-soft">
        See also the <Link href="/terms">Terms &amp; Conditions</Link> and the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </>
  );
}
