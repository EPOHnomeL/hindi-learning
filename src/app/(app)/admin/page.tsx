import { AdminPanel } from "~/app/_components/AdminPanel";

// `/admin` — the Allowlist portal for the single workspace Admin (issue 02).
// Inside the (app) group, so it's behind the auth gate; the Admin check itself
// is in AdminPanel (and enforced server-side by the whitelist mutations).
export default function AdminPage() {
  return <AdminPanel />;
}
