import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

// Convex Auth keeps the session in sync across server/client for the App Router.
export default convexAuthNextjsMiddleware();

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
