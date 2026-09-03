import { Logo } from "./Logo";

// The launch screen an installed app draws for itself (2026-09-03).
//
// The OS splash is not ours: Chrome composes it from the manifest's icon,
// short_name and background_color, and iOS from a startup image, and neither has
// any hook for extra text. So the "my-course.app" line a whitelabel launch is
// meant to carry has to be drawn by the page. This overlay is server-rendered,
// so it is part of the FIRST paint and continues the OS splash rather than
// following it: same paper background, tenant's own mark, platform attribution
// at the foot. An inline script takes it away a beat after load.
//
// Two deliberate non-choices:
//   - Not a client component. A splash that waits for React to hydrate is a
//     splash that arrives after the thing it was supposed to cover.
//   - Not gated in JS. `display: none` unless `(display-mode: standalone)`
//     (see globals.css) means a browser tab never renders it for a frame; only
//     an installed app does.
export function PwaSplash({ displayName, logoUrl }: { displayName: string; logoUrl: string | null }) {
  return (
    <>
      <div id="pwa-splash" aria-hidden="true">
        <div id="pwa-splash-mark">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" />
          ) : (
            <>
              <Logo className="h-16 w-16 text-accent" />
              <span>{displayName}</span>
            </>
          )}
        </div>
        <span id="pwa-splash-by">my-course.app</span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: DISMISS }} />
    </>
  );
}

// Fade out shortly after the document finishes loading, then remove the node so
// it can never intercept a tap. The 5s ceiling is the guarantee: a stalled
// subresource must not leave a learner staring at the splash forever.
const DISMISS = `try{var s=document.getElementById('pwa-splash');if(s){var go=function(){if(!s)return;s.classList.add('is-gone');setTimeout(function(){s.remove();},400);};var soon=function(){setTimeout(go,300);};if(document.readyState==='complete')soon();else window.addEventListener('load',soon);setTimeout(go,5000);}}catch(_e){}`;
