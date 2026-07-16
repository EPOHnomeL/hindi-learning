import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms & Conditions — My Course" };

// Terms & conditions (PayFast compliance). Plain-language and honest to how the
// product actually works; the refund and privacy policies are separate pages.
export default function TermsPage() {
  return (
    <>
      <h1>Terms &amp; Conditions</h1>
      <p className="text-soft">Last updated: 13 July 2026</p>

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

      <h2>5. Selling</h2>
      <p>
        Selling is limited to sellers approved by the platform operator. Sellers price their own finished courses and
        are paid out their share of each sale by EFT, as agreed with the operator. The platform operator is the
        merchant of record for all sales.
      </p>

      <h2>6. Liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, we are not liable for
        indirect or consequential loss arising from use of the service. Nothing in these terms limits rights you have
        under the Consumer Protection Act or other applicable South African law.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update these terms; the date above reflects the current version. Continued use after a change means
        you accept the updated terms.
      </p>

      <h2>8. Law and contact</h2>
      <p>
        These terms are governed by the law of the Republic of South Africa. Questions:{" "}
        <a href="mailto:support@my-course.app">support@my-course.app</a>.
      </p>
    </>
  );
}
