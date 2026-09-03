import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — My Course" };

// Privacy policy (PayFast compliance / POPIA). Describes what the app actually
// stores and the categories of processors that touch it — keep it truthful as
// the product moves. We describe processors by function rather than naming each
// vendor (POPIA s18 permits categories of recipients); keep it that way.
// The analytics claims have to stay true against `PostHogClient.tsx` and
// `ConvexClientProvider.tsx`, which identifies a person by the Convex user
// document ID and sends NO person properties: no email, no name. The bullet
// below promises exactly that, so the two files move together or not at all.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-soft">Last updated: 3 September 2026</p>

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
          <b>How you use the site:</b> which pages you open, what you click, and the ordinary things your browser
          sends with every visit, like the kind of device and browser you are on and a rough idea of which country
          you are in. This is how we tell which parts of a course people actually use.
        </li>
        <li>
          <b>When something breaks:</b> a record of what the page was doing at the time, so that we can see the
          problem ourselves instead of guessing from a description of it. Anything you typed is hidden before it
          leaves your device, your password and your PIN included, and your name and email are never attached.
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
        <b>What this means for a shared-code place.</b> Exactly what it means for everybody else. We send an
        account number and nothing that names you. Your nickname never goes anywhere, and a shared-code account has
        no email address and no name for us to send even if we wanted to.
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
        also look at how the site is used, and at what breaks, to fix what is broken and to decide what to improve
        next. We do not sell personal information and we do not run advertising or ad tracking.
      </p>

      <h2>Who we share it with</h2>
      <p>
        We rely on a small number of third-party service providers to operate the service. They may process personal
        information only as needed to provide their service to us, and only on our instructions. Some of them
        operate outside South Africa, so your information may be processed in other countries:
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
          by AI models to generate lessons, translations, and replies. AI also reads the usage and breakage
          information described above, to point out problems in the product that we ought to look at.
        </li>
        <li>
          <b>A product analytics and error-monitoring provider</b> stores the usage and breakage information
          described above and turns it into the reports we read. We do not send them your name or your email
          address. Their servers are in Europe, and the information reaches them through an address on this site
          rather than one of their own.
        </li>
      </ul>

      <h2>Cookies and local storage</h2>
      <p>
        We use them to keep you signed in, to remember how you like the site set up (theme, reading language, where
        you had got to in a lesson), and to recognise your browser as one that has been here before, so that our
        visitor counts are not nonsense. That last one is set by this site, not by an outside advertising network,
        and there are no advertising cookies here at all.
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
