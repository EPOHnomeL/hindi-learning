// Convex Auth identity provider config. CONVEX_SITE_URL is set automatically in
// the Convex deployment; `npx @convex-dev/auth` also sets JWT keys as env vars.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
