import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — My Course" };

// Privacy policy (PayFast compliance / POPIA). Describes what the app actually
// stores and the categories of processors that touch it — keep it truthful as
// the product moves. We describe processors by function rather than naming each
// vendor (POPIA s18 permits categories of recipients); keep it that way.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-soft">Last updated: 16 July 2026</p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <b>Account:</b> your email address and a password (stored as a secure hash — we never see the password
          itself).
        </li>
        <li>
          <b>Learning activity:</b> which lessons you open and complete, your quiz answers, and questions you ask
          inside a course. We use this to deliver and personalise the learning experience.
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

      <h2>Who we share it with</h2>
      <p>
        We rely on a small number of third-party service providers to operate the service. They may process personal
        information only as needed to provide their service to us, and only on our instructions:
      </p>
      <ul>
        <li>
          <b>Cloud hosting and infrastructure providers</b> — host our website, application, and database.
        </li>
        <li>
          <b>PayFast (Network International)</b> — our payment processor. Card details are entered on PayFast&rsquo;s
          own secure, hosted checkout; <b>we never receive or store card numbers</b>.
        </li>
        <li>
          <b>An email delivery provider</b> — sends transactional email such as invitations and account notices.
        </li>
        <li>
          <b>AI/LLM providers</b> — course owners&rsquo; inputs, course material, and learner questions are processed
          by AI models to generate lessons, translations, and replies.
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
        <a href="mailto:support@my-course.app">support@my-course.app</a> and we will respond within a reasonable
        timeframe.
      </p>
    </>
  );
}
