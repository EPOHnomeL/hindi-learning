// `/certificate/[token]` — the anonymous Certificate page (ADR 0015). Outside the
// `(app)` group, so no auth gate; the token is the only credential. `no-referrer`
// keeps the token out of the Referer header on outbound clicks, and `robots`
// keeps the link out of search indexes — the same posture as `/share/[token]`.
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default function CertificateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
