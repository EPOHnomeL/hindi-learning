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
  faviconUrl,
}: {
  displayName: string;
  faviconUrl: string | null;
}) {
  // The FAVICON, not the header logo (operator's call, 2026-09-03). A launch
  // screen wants the square emblem a tenant chose to be identified by at icon
  // size, which is the same asset behind the installed app icon; the header
  // logo is a wide lockup and reads as the wrong picture here. Falls back to
  // the shipped book mark plus the display name when a tenant has no favicon.
  const mark = faviconUrl;
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
