import { HomeRedirect } from "~/app/_components/HomeRedirect";

// `/sign-in`, a plain linkable URL for the sign-in form.
//
// Until now the only ways to reach the form were the `#get-started` section of the
// landing page and whatever gated URL you happened to deep-link (ADR 0012), so
// nothing outside the app (an email, a WhatsApp message, an organisation's own
// site) could point at "sign in" without also pointing at a marketing page and
// hoping the reader scrolled. This is that link.
//
// **In the (app) group deliberately**, unlike `/redeem` and `/join`: `AppGate`
// already renders `<SignIn/>` for an unauthenticated visitor at the URL they asked
// for, which is exactly this page's signed-out state. Nothing to build for it.
export default function SignInPage() {
  return <HomeRedirect />;
}
