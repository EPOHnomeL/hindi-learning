import { AppGate } from "~/app/_components/AppGate";

// Every route in this group is behind the auth gate (ADR 0012). The ungated
// public share route (issue 07) will live OUTSIDE this group.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppGate>{children}</AppGate>;
}
