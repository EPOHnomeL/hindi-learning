import { HomeRedirect } from "~/app/_components/HomeRedirect";

// `/sign-up`, the same form as `/sign-in` but opened on "Create account".
//
// The split is the path, not a prop: `SignIn` reads `usePathname()` and picks its
// opening flow from it, the way `/checkout/*` and `/redeem` already do. So this
// page is `/sign-in` with a different URL, and the in-form toggle still reaches
// either side without navigating.
export default function SignUpPage() {
  return <HomeRedirect />;
}
