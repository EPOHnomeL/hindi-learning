// `/poster/[token]`: the anonymous course poster (course-poster spec). Outside
// the `(app)` group, so no auth gate; the Edition's Public link token is the only
// credential and the page shows nothing the `/share/[token]` reader does not.
// Same posture as the certificate and share pages: `no-referrer` keeps the token
// out of the Referer header, `robots` keeps the sheet out of search indexes.
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default function PosterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
