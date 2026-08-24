"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Brand } from "./Brand";
import { useTenant } from "./TenantContext";
import { INSTALL_DISMISSED_KEY } from "./accountLocalState";
import { installDismissed, isIosBrowser } from "./installPromptDerive";
import { Icon } from "./icons";

// Chrome's install event; not in TS's DOM lib because only Chromium ships it.
type BeforeInstallPromptEvent = Event & { prompt(): Promise<unknown> };

// The branded install prompt (installable-app ticket 03, ADR 0030 §1): a
// dismissible bottom sheet on "/" only, in both auth states, never a blocking
// interstitial. Android-only in effect: it renders solely after
// beforeinstallprompt has fired, which is also the browser confirming the app is
// installable and not already installed, so the Install button replays the kept
// event and opens the REAL OS install dialog. iOS never fires it and is a
// separate feature (ticket 04).
//
// Appears ~3s after mount so first paint is the tenant's landing content, and
// never when already running standalone. "Not now" writes
// hindi:install-dismissed (in the sign-out sweep's KEEP set) and the sheet stays
// away for 30 days; tenants are separate origins, so dismissing one leaves the
// others untouched for free.
export function InstallSheet() {
  const t = useTranslations("Install");
  const tenant = useTenant();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // The iOS half (ticket 04): no beforeinstallprompt exists there and never
  // will, so an Install button would be a lie; iOS gets Share -> Add to Home
  // Screen instructions on the same sheet, same trigger, same dismissal key.
  // Kept deletable without touching the Android path.
  const [ios, setIos] = useState(false);
  const [pastDelay, setPastDelay] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = installDismissed(window.localStorage.getItem(INSTALL_DISMISSED_KEY), Date.now());
    } catch {
      /* storage unavailable: worst case is one extra ask */
    }
    if (standalone || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setIos(isIosBrowser(navigator.userAgent, navigator.maxTouchPoints));
    const timer = setTimeout(() => setPastDelay(true), 3000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(timer);
    };
  }, []);

  if ((!promptEvent && !ios) || !pastDelay || closed) return null;

  const install = () => {
    setClosed(true);
    void promptEvent?.prompt();
  };
  const dismiss = () => {
    try {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      /* storage unavailable: it just asks again next visit */
    }
    setClosed(true);
  };

  return (
    // Above the AppTabs bar (z-50): a sheet is transient and deliberately covers
    // chrome while it is up.
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg">
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <Brand />
        <p className="text-sm text-soft">{t("lead", { name: tenant?.displayName ?? "My Course" })}</p>
        {/* The captured event wins when both could apply: a real one-tap install
            beats instructions. On iOS it never fires, so iOS always gets the
            instructions. */}
        {!promptEvent && ios && (
          <ol className="flex flex-col gap-1.5 text-sm text-ink">
            <li className="flex items-center gap-2">
              <span className="text-soft">1.</span>
              <Icon name="upload" className="h-4 w-4 text-accent" />
              {t("iosStep1")}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-soft">2.</span>
              <Icon name="plus" className="h-4 w-4 text-accent" />
              {t("iosStep2")}
            </li>
          </ol>
        )}
        <div className="flex gap-2">
          {promptEvent && (
            <button
              onClick={install}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 font-semibold text-paper"
            >
              {t("install")}
            </button>
          )}
          <button onClick={dismiss} className="flex-1 rounded-lg border border-line px-4 py-2.5 text-soft">
            {t("notNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
