import { HomeRedirect } from "~/app/_components/HomeRedirect";

// `/sign-up`, which since 2026-09-18 is `/sign-in` under a second name and nothing
// more. The form has one door: it tries `signIn`, falls back to `signUp`, and so
// has no opening state for a path to choose. The URL is kept because outside links
// (an email, an organisation's own site) point at it and a dead "sign up" link is
// worse than a duplicate one.
export default function SignUpPage() {
  return <HomeRedirect />;
}
