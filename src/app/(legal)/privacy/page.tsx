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
      <p className="text-soft">Last updated: 23 August 2026</p>

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

      {/* The Seat, described because POPIA expects what we hold to be disclosed where
          a data subject looks for it (ADR 0031, shared-access-codes ticket 09). It is
          its own heading rather than a bullet in the list above, because it is the one
          account type on the platform with NO email address, and burying that in a
          list of things we collect would understate the point of it. The claims here
          have to stay true against `convex/schema.ts`: a nickname, a hashed PIN, and
          progress. Nothing else. */}
      <h2>If you joined with a shared code from an organisation</h2>
      <p>
        Some organisations buy course places for their people and hand out one shared code. If you joined that way,
        at <b>/join</b>, what we hold about you is different and deliberately smaller:
      </p>
      <ul>
        <li>
          <b>A nickname you chose.</b> It does not have to be your real name, and we ask you not to use one. We never
          ask for your email address, your phone number or your name.
        </li>
        <li>
          <b>A PIN you chose,</b> stored only as a secure hash, so nobody here can read it. It is the only thing that
          proves a place is yours, which is why <b>nobody can recover it for you if you forget it</b> and there is no
          reset. You can change it in Settings while you are signed in.
        </li>
        <li>
          <b>Which lessons you have opened and completed,</b> so that you can carry on where you left off when you come
          back on another device.
        </li>
      </ul>
      <p>
        <b>Our legal basis is your consent</b> under section 27(1)(a) of POPIA. We ask for it in plain words before you
        type anything, and we store which wording you agreed to and when, so that we can show what you were told.
      </p>
      <p>
        <b>Who sees what.</b> The organisation that paid for your place, and the course owner, are shown only{" "}
        <b>how many people joined</b>. No report, page or query we have can tell them, or anybody else, which nickname
        belongs to which person.
      </p>
      <p>
        <b>Withdrawing.</b> You can delete your nickname and your PIN at any time from Settings, or by emailing{" "}
        <a href="mailto:support@my-course.app">support@my-course.app</a>. That removes everything linking you to the
        organisation that paid for your place. Two honest consequences: the count of places used stays as it was,
        because that is what the organisation was billed for and it says nothing about who you are; and because your
        nickname and PIN are the only way back in, deleting them means you cannot sign in again on another device.
      </p>

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
