# Spec: Landing Page Refresh & Conversion Improvements

Drafted 2026-09-18 with `/to-spec`, from landing page research, user interview, and the codebase as it stood that day. Readiness: ready for an agent (an unblocked build with a sharp Done when, per `docs/agents/triage-labels.md`).

## Problem Statement

The current public landing page (`src/app/_components/Landing.tsx`) markets the product conceptually ("An AI course studio", "Learn anything, grounded in your reading"), but prospective learners face several friction points that diminish conversion:

1. **Abstract Value Proposition:** The headline and subhead describe the mechanism ("seed a topic", "AI author") rather than the concrete outcome ("turn dense reading into interactive courses you actually finish").
2. **Missing Product Identity & Trust Anchor:** The `FounderQuote` section in `LandingSections.tsx` accepts a founder portrait in its `aside` slot, but in `Landing.tsx` no image is passed and `founder.quote` in `messages/en.json` is blank. In a landscape saturated with generic AI wrappers, learners need to know *who* built this and *why* (active recall vs. passive skimming; grounded in trusted sources vs. hallucinated chatbot summaries).
3. **High Signup Friction:** The primary CTA immediately jumps visitors down to the `SignIn` form. Visitors are asked to authenticate before experiencing what an interactive lesson actually feels like.
4. **Static Demonstration:** The CSS phone mocks (`PhoneMocks.tsx`) illustrate a lesson and a quiz, but are non-interactive (`aria-hidden` decoration). Visitors cannot test the active recall mechanism before signing up.
5. **No Direct Answer to the Primary Objection ("Why not ChatGPT?"):** Prospective learners intuitively ask why they shouldn't just paste a PDF into ChatGPT or Claude. The FAQ does not directly contrast structured active learning with generic chat walls of text.
6. **Unclear Input Materials:** "Seed with reading you trust" is conceptually clear to the author, but visitors wonder whether their specific material (books, company SOPs, scripture, lecture notes) works.
7. **Hero Lacks Visual Grounding Above the Fold:** On desktop screens, the hero is entirely text and buttons against the aurora gradient background, requiring scrolling past "How it works" before seeing any visual proof of the product.

## Solution

A targeted refresh across `Landing.tsx`, `PhoneMocks.tsx`, `LandingSections.tsx`, and `messages/en.json` that grounds the pitch in concrete outcomes, lowers the barrier to initial interaction, and establishes founder credibility:

1. **Refined Oneliner & Hero Copy:**
   - **Headline:** *"Turn dense books and notes into interactive courses you’ll actually finish."*
   - **Subhead:** *"Upload a handbook, textbook, or notes. My Course builds a bite-sized, interactive curriculum with built-in quizzes and inline teacher Q&A — grounded strictly in your sources."*
   - **Input Material Badges:** A subtle, clean row of pills beneath the hero CTAs highlighting supported sources: *Dense Non-Fiction · Scripture & Theology · Company SOPs & Handbooks · Lecture Notes & Syllabi · Language Learning*.
2. **Low-Friction Sample Lesson CTA:**
   - Alongside "Get started" (`#get-started`), provide a secondary action "Preview a sample lesson" pointing directly to an open guest preview / public lesson (e.g. `/share/<publicToken>` or demo route) allowing visitors to test the reading experience without an account.
3. **Interactive "Try-Before-Sign-In" Phone Mocks:**
   - Enhance the quiz card inside `PhoneMocks.tsx` to be interactive: visitors can click the quiz options, triggering the immediate green correct/incorrect state and feedback note.
   - Maintain full mobile responsiveness and accessibility (interactive buttons inside the frame retain accessible roles and keyboard focus).
4. **Founder Trust Anchor:**
   - Wire `FounderQuote` in `Landing.tsx` to pass a portrait in the `aside` slot (`/images/founder.jpg` or a styled avatar container).
   - Populate `Landing.founder.quote` and `Landing.founder.byline` in `messages/en.json` using the authentic founder template explaining the passion for active recall and grounded learning.
5. **Objection-First FAQ Update:**
   - Add a direct answer to *"Why not just paste my PDF into ChatGPT?"* highlighting structured micro-lessons, interactive quizzes, persistent cheat-sheet references, and inline Q&A.
6. **Elevated Hero Visual Peek:**
   - Adjust desktop hero spacing so the top edge of the product showcase peeks above the fold, providing immediate visual context.

## User Stories

1. As a prospective learner, I want an outcome-driven headline on the home page, so that I immediately understand how the platform solves my reading retention problems.
2. As a prospective learner, I want to see tangible examples of what materials I can upload (books, notes, handbooks), so that I know whether my materials are suitable.
3. As a prospective learner, I want to try a sample lesson with one click before creating an account, so that I can experience the learning format risk-free.
4. As a prospective learner, I want to click on the quiz inside the phone mockup, so that I can experience how active recall checks work on the platform.
5. As a prospective learner, I want to know who is behind the platform and why it was built, so that I can trust it over a faceless AI tool.
6. As a prospective learner, I want the FAQ to explain why this is better than asking ChatGPT for a summary, so that I understand why an interactive course is worth my time.
7. As a prospective learner on desktop, I want a visual peek of the product visible above the fold, so that I am drawn into exploring further.
8. As a course owner/tenant on a custom subdomain (e.g. `ywampotch`), I want tenant-specific landing pages (`YwamPotch.tsx`) to remain unaffected unless deliberately opted in, so that custom ministry copy is preserved.
9. As a screen reader user, I want interactive mock controls to be properly announced and keyboard navigable, so that accessibility standards are upheld.
10. As a user with `prefers-reduced-motion` enabled, I want all new interactive states to transition without disorienting animations, so that motion comfort is respected.
11. As a developer maintaining the codebase, I want all copy centralized in `messages/*.json` namespaces with fallbacks, so that i18n parity tests continue to pass.

## Implementation Decisions

### 1. Copy & i18n (`messages/en.json` and sister locales)
- **Hero:**
  - `Landing.hero.headline`: `"Turn dense books and notes into <em>interactive courses</em> you’ll actually finish."`
  - `Landing.hero.subhead`: `"Upload a handbook, textbook, or notes. My Course builds a bite-sized, interactive curriculum with built-in quizzes and inline teacher Q&A — grounded strictly in your sources."`
  - `Landing.hero.sampleLesson`: `"Preview a sample lesson"`
  - `Landing.hero.materialsPill`: `"Works with books, scripture, company SOPs, and lecture notes"`
- **Founder Section:**
  - `Landing.founder.quote`: `"I got tired of saving long books and dense PDFs that I'd never actually retain, and tired of generic AI chat that dumps five paragraphs of text you immediately forget. I built My Course because true learning needs active recall: reading a bite-sized piece, answering a quiz to check yourself, and having a patient tutor answer your exact questions right where you got stuck. Grounded only in the sources you actually trust."`
  - `Landing.founder.byline`: `"Jonathan Vorster — Builder of My Course"`
- **FAQ:**
  - Add `Landing.faq.chatgptQ`: `"Why not just paste my PDF into ChatGPT?"`
  - Add `Landing.faq.chatgptA`: `"ChatGPT gives you a rambling wall of text that you skim and forget within an hour. My Course breaks your reading into a structured, step-by-step curriculum with active-recall quizzes, persistent cheat-sheet references, and inline Q&A where your questions stay attached to the exact sentence that prompted them."`
  - Ensure all sister message files (`af.json`, `es.json`, `fr.json`, `hi.json`, `ur.json`) receive matching keys or fallback gracefully via `getMessageFallback`.

### 2. Interactive Mockups (`src/app/_components/PhoneMocks.tsx`)
- Currently, `PhoneMocks.tsx` renders static text inside `Phone` wrappers.
- In the Quiz phone screen:
  - Add client component state (`const [selectedOption, setSelectedOption] = useState<number | null>(null);`).
  - Render options as clickable buttons (`<button type="button" onClick={() => setSelectedOption(i)}>`).
  - When option 0 (the correct option) is clicked, apply active styles (`border-accent text-accent bg-accent/10` with a checkmark badge) and reveal `quizFeedback`.
  - When another option is clicked, show a gentle retry indicator and prompt the user to try the correct answer.
  - Reset or toggle option smoothly without page jumps.

### 3. Founder Portrait Slot (`src/app/_components/Landing.tsx` & `LandingSections.tsx`)
- In `Landing.tsx`, pass an `aside` prop to `FounderQuote`:
  ```tsx
  <FounderQuote
    quote={founderQuote}
    byline={t("founder.byline")}
    aside={
      <div className="relative mx-auto aspect-square w-full max-w-[16rem] overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <img
          src="/images/founder.jpg"
          alt={t("founder.byline")}
          className="h-full w-full object-cover"
          onError={(e) => {
            // Graceful fallback to branded emblem if image is not yet uploaded
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    }
  />
  ```
- Store initial asset or placeholder at `public/images/founder.jpg`.

### 4. Above-the-Fold Peeking Layout
- In `Landing.tsx`, adjust the hero container padding (`pb-16` on mobile, `pb-20` on desktop) and allow the mock section to sit tighter against the hero fold, or introduce an offset preview card peeking into the hero boundary using Tailwind `z-10 -mb-12`.

## Testing Decisions

1. **i18n Parity Test:**
   - Run `pnpm test messages/parity.test.ts` to ensure that adding new keys to `messages/en.json` does not break parity across the other 5 language bundles.
2. **Interactive Mockup Component Tests (`vitest`):**
   - Test `PhoneMocks`:
     - Initial render: quiz options are rendered, feedback is hidden.
     - Click option 0: option 0 receives selected/correct class, feedback text appears.
     - Click option 1: option 1 receives attempt styling, feedback guides user.
3. **Manual Browser & Device Walks:**
   - **Desktop (Chrome/Firefox/Safari):** Verify hero typography, peek alignment, interactive quiz clicks, founder quote layout with portrait aside, and smooth scroll to `#get-started`.
   - **Mobile Viewport (375px & 412px):** Verify that the founder image stacks cleanly above the quote, phone mocks remain cleanly scrollable/stacked, and touch targets meet minimum 44px height.
   - **Dark / Light Mode:** Verify text contrast on `paper`, `card`, and `accent` surfaces for both themes.

## Out of Scope

- Modifying tenant-specific bespoke landing pages (such as `YwamPotch.tsx`). Those pages maintain their bespoke ministry-specific copy.
- Full LMS backend changes or authoring pipeline modifications.
- Live video player or dynamic animated screen recordings (CSS phone mocks remain the single source of truth for maintainability without asset rot).

## Further Notes

- ADRs touched: ADR 0011 (light/dark palette tokens), ADR 0025 (i18n messages structure), ADR 0028 (soft interest capture vs. sign-in gate).
- Existing CSS animations (`.land-rise`, `.land-reveal`) are defined in `globals.css` with `@media (prefers-reduced-motion: reduce)` overrides and must be maintained.
