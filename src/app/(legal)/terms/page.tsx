import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms & Conditions — My Course" };

// Terms & conditions (PayFast compliance). Plain-language and honest to how the
// product actually works; the refund and privacy policies are separate pages.
export default function TermsPage() {
  return (
    <>
      <h1>Terms &amp; Conditions</h1>
      <p className="text-soft">Last updated: 2 August 2026</p>

      <h2>1. Who we are</h2>
      <p>
        My Course (<a href="https://my-course.app">my-course.app</a>) is a learning platform operated from South
        Africa. It generates personal courses with AI assistance, lets course owners share them, and lets approved
        sellers offer paid access to finished courses. By creating an account or buying a course you agree to these
        terms.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Anyone may create an account with an email address and password. You are responsible for keeping your
        credentials safe and for activity on your account. We may suspend or close accounts used to abuse the
        service, attempt to defraud, or break the law.
      </p>

      <h2>3. Courses and content</h2>
      <ul>
        <li>
          Course material is generated with AI assistance from the course owner&rsquo;s inputs. It is provided for
          personal learning, without warranty of accuracy or fitness for a particular purpose — verify anything you
          rely on.
        </li>
        <li>Course owners keep ownership of the material they create and the resources they upload.</li>
        <li>
          Purchased or shared courses are for your personal use. You may not resell, redistribute, or republish
          course content that isn&rsquo;t yours.
        </li>
      </ul>

      <h2>4. Purchases</h2>
      <ul>
        <li>
          A purchase buys a single edition of a course (one language) — a <b>once-off payment for lifetime access</b>
          , attached to the account you are signed into when you buy. There are no subscriptions and no recurring
          charges.
        </li>
        <li>Prices are in South African Rand (ZAR). Payments are processed by PayFast; we never see or store your card details.</li>
        <li>
          All sales are final — see the <Link href="/refunds">Refund &amp; Cancellation Policy</Link>.
        </li>
      </ul>

      {/* The donation rail (ADR 0027). This clause is where the widget's
          disclosures live: the donate section on a site's landing page is
          deliberately bare — chips and a button — and everything it used to say
          in small print is stated here instead. Keep the two in step: if the
          rate, the operator's cut or the receipt position changes, it changes
          here. */}
      <h2>5. Donations</h2>
      <ul>
        <li>
          Some course sites invite donations. A donation is a gift: it buys nothing, grants no access to any course,
          and creates no account. Donations are once-off — there is no recurring giving.
        </li>
        <li>
          Donation amounts are shown in US dollars but <b>charged in South African Rand (ZAR)</b>, converted at a rate
          set by the platform operator. The exact rand amount is shown on PayFast&rsquo;s payment page before you
          confirm, and your card issuer applies its own exchange rate and may add its own fees.
        </li>
        <li>
          The platform operator is the merchant of record for donations and retains 10% of the net amount received,
          paying the remainder to the payee nominated for that site.
        </li>
        <li>
          Because the operator — not the site you donated to — receives the payment, a donation is{" "}
          <b>not tax-deductible</b> and no Section 18A receipt is issued. PayFast&rsquo;s payment confirmation email
          is your record of the transaction.
        </li>
        <li>
          Donations are final and not refundable — see the <Link href="/refunds">Refund &amp; Cancellation Policy</Link>.
        </li>
      </ul>

      <h2>6. Selling</h2>
      <p>
        Selling is limited to sellers approved by the platform operator. Sellers price their own finished courses and
        are paid out their share of each sale by EFT, as agreed with the operator. The platform operator is the
        merchant of record for all sales.
      </p>

      {/* The full undertaking behind `/join`'s three-line consent step, which links
          here (ADR 0031, shared-access-codes ticket 09). The consent step was shortened
          because six long sentences on a phone is a wall people scroll past, and consent
          nobody read is not "informed"; this is where "specific" is kept for anybody who
          wants the whole thing. **Keep it true against `convex/schema.ts`** - a
          nickname, a hashed PIN, and progress, and nothing else. */}
      <h2>7. Organisation Vouchers and Bulk Vouchers</h2>
      <p>
        An organisation can buy course places for its people in two ways, and what we hold about you differs between
        them.
      </p>
      <ul>
        <li>
          <b>Bulk Vouchers</b> are single-use codes. You redeem one onto an ordinary account that you create yourself,
          with your own email address, and the code is then spent. We never learn which person used which code.
        </li>
        <li>
          <b>An Organisation Voucher</b> is one shared code with a limited number of places on it. You take a place at{" "}
          <b>/join</b> by choosing a nickname and a PIN, and <b>we never ask for an email address, a phone number or a
          name</b>. That nickname and PIN are your account: there is nothing else to sign in with.
        </li>
      </ul>
      <p>
        <b>What we hold for an Organisation Voucher place</b>, and nothing beyond it: the nickname you chose, your PIN
        stored only as a secure hash that nobody here can read, and which lessons you have opened and completed. Our
        legal basis is <b>your consent</b> under section 27(1)(a) of POPIA, asked for in plain words before you type
        anything, and we record which wording you agreed to and when.
      </p>
      <p>
        <b>Your nickname does not have to be your real name, and we would rather it was not.</b> Nothing in the product
        asks you for one, and choosing a handle rather than your name is what keeps your place on a course from saying
        anything about you.
      </p>
      <p>
        <b>A forgotten PIN cannot be recovered by anybody, including us.</b> There is no reset and no recovery, because
        a reset would need a second way to reach you and the whole point of this route is that we do not have one.
        Write your PIN down. You can change it at any time in Settings while you are signed in.
      </p>
      <p>
        <b>What the organisation and the course owner see</b> is how many places have been taken. They are never shown
        your nickname, and no report or page we have can connect a nickname to a person.
      </p>
      <p>
        <b>Deleting what we hold.</b> You can delete your nickname and PIN at any time in Settings, or by emailing{" "}
        <a href="mailto:support@my-course.app">support@my-course.app</a>. Two consequences you should know before you
        do: the number of places the organisation was billed for does not change, because you did take a place and that
        number says nothing about who you are; and because your nickname and PIN are the only way back in, you will not
        be able to sign in again on another device afterwards. You keep the course on the device you are signed in on.
      </p>
      <p>
        <b>The organisation is billed for places actually taken</b>, after the seller stops the code, and stopping it
        never removes a place somebody already has. Places do not expire.
      </p>

      <h2>8. Liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, we are not liable for
        indirect or consequential loss arising from use of the service. Nothing in these terms limits rights you have
        under the Consumer Protection Act or other applicable South African law.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms; the date above reflects the current version. Continued use after a change means
        you accept the updated terms.
      </p>

      <h2>10. Law and contact</h2>
      <p>
        These terms are governed by the law of the Republic of South Africa. Questions:{" "}
        <a href="mailto:support@my-course.app">support@my-course.app</a>.
      </p>
    </>
  );
}
