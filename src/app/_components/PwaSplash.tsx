import { Logo } from "./Logo";

// The launch screen an installed app draws for itself (2026-09-03).
//
// The OS splash is not ours: Chrome composes it from the manifest's icon,
// short_name and background_color, and iOS from a startup image, and neither has
// any hook for extra text. So the platform attribution a whitelabel launch is
// meant to carry has to be drawn by the page. This overlay is server-rendered,
// so it is part of the FIRST paint and continues the OS splash rather than
// following it: same paper background, tenant's own mark, "a my-course.app app"
// at the foot, linking back to the platform.
//
// Three deliberate non-choices:
//   - Not a client component. A splash that waits for React to hydrate is a
//     splash that arrives after the thing it was supposed to cover.
//   - Not gated in JS. `display: none` unless `(display-mode: standalone)`
//     (see globals.css) means a browser tab never renders it for a frame; only
//     an installed app does.
//   - **Nothing touches this node after it is rendered.** The dismissal is a
//     pure CSS animation, no script, because the first cut ran an inline
//     `s.remove()` and detaching a node React owns broke the app on 2026-09-03:
//     the splash reappeared on every client navigation, and React's next
//     `insertBefore` against the detached reference node threw into the error
//     boundary ("Something went wrong"). Fade it, hide it, leave it in the DOM.
export function PwaSplash({
  displayName,
  logoUrl,
  faviconUrl,
}: {
  displayName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}) {
  // Logo, then favicon, then the shipped book mark: the same fallback order the
  // /app-icon route uses, so the mark on the launch screen is the mark on the
  // icon the learner just tapped. A tenant that uploaded only an emblem showed
  // OUR book mark here before that second step existed.
  const mark = logoUrl ?? faviconUrl;
  return (
    <div id="pwa-splash">
      <div id="pwa-splash-mark">
        {mark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mark} alt="" />
        ) : (
          <>
            <Logo className="h-16 w-16 text-accent" />
            <span>{displayName}</span>
          </>
        )}
      </div>
      <a id="pwa-splash-by" href="https://my-course.app" rel="noreferrer">
        a <b>my-course.app</b> app
      </a>
    </div>
  );
}
