import { SettingsPage } from "~/app/_components/SettingsPage";

// Settings is a route, not a modal (mobile bottom nav, 2026-08-23): the URL is
// linkable, the browser back button works, and the Settings tab in the app tab
// bar is a destination like Home. Auth-gated by the (app) group layout.
export default function Page() {
  return <SettingsPage />;
}
