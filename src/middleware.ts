import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

// Convex Auth keeps the session in sync across server/client for the App Router.
// Pass convexUrl explicitly: the auth proxy otherwise forwards `url: undefined`
// to convex/nextjs, which logs a noisy "deploymentUrl is undefined" error even
// though it falls back to NEXT_PUBLIC_CONVEX_URL. Next inlines this at build.
export default convexAuthNextjsMiddleware(undefined, {
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
});

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
