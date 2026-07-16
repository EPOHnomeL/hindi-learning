import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — My Course" };

// Privacy policy (PayFast compliance / POPIA). Describes what the app actually
// stores and which processors touch it — keep it truthful as the product moves.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-soft">Last updated: 13 July 2026</p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <b>Account:</b> your email address and a password (stored as a secure hash — we never see the password
          itself).
        </li>
        <li>
          <b>Learning activity:</b> which lessons you open and complete, your quiz answers, and questions you ask
          inside a course — this is what makes the teaching loop work.
        </li>
        <li>
          <b>Course content:</b> the titles, goals, and resources a course owner provides to have a course generated.
        </li>
        <li>
          <b>Purchases:</b> what was bought, the price, and PayFast&rsquo;s payment reference.{" "}
          <b>We never receive or store card numbers</b> — payment happens on PayFast&rsquo;s hosted page.
        </li>
        <li>
          <b>Sellers only:</b> the bank account details you save for payouts, visible only to the platform operator
          for making payments.
        </li>
      </ul>

      <h2>What we use it for</h2>
      <p>
        To run the service: signing you in, generating and serving course material, tracking your own progress,
        granting access you bought or were invited to, sending invite and account emails, and paying sellers out. We
        do not sell personal information and we do not run advertising or ad tracking.
      </p>

      <h2>Who processes it</h2>
      <ul>
        <li><b>Convex</b> — database and backend hosting.</li>
        <li><b>Vercel</b> — web hosting.</li>
        <li><b>PayFast (Network International)</b> — payment processing.</li>
        <li><b>Resend</b> — transactional email (invites and account messages).</li>
        <li>
          <b>AI providers</b> (e.g. Anthropic, OpenRouter) — course owners&rsquo; inputs, course material, and
          learner questions are processed by AI models to author lessons, translations, and replies.
        </li>
      </ul>

      <h2>Cookies and local storage</h2>
      <p>
        We use them only to keep you signed in and to remember device preferences (theme, reading language, reading
        position). No third-party advertising cookies.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the Protection of Personal Information Act (POPIA) you may ask what personal information we hold about
        you, ask for corrections, or ask for your account and its data to be deleted. Email{" "}
        <a href="mailto:support@my-course.app">support@my-course.app</a> and we will action it within a reasonable
        time.
      </p>
    </>
  );
}
