import { AppGate } from "~/app/_components/AppGate";
import { InstallSheet } from "~/app/_components/InstallSheet";

// Every route in this group is behind the auth gate (ADR 0012). The ungated
// public share route (issue 07) will live OUTSIDE this group.
//
// `InstallSheet armed` renders NOTHING unless a one-shot flag was left in
// localStorage, which today happens only when somebody takes a place with an
// Organisation Voucher (2026-08-25). That member lands straight in the reader and
// never passes through "/", where the sheet normally lives, so the platform's best
// install candidate was the one person who could not be asked: they arrived from a
// WhatsApp link on a phone and hold no email and no password, so a home-screen icon
// is the only bookmark that survives them closing the tab. Armed is a permission to
// ask on one screen, not a bypass: the standalone check and the 30-day dismissal
// still gate it.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate>
      {children}
      <InstallSheet armed />
    </AppGate>
  );
}
