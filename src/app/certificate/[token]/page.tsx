import { PublicCertificatePage } from "~/app/_components/Certificate";

// `/certificate/[token]` — render the earned Certificate from the token-only
// public read seam. Anonymous; the token is the sole credential.
export default async function CertificatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicCertificatePage token={token} />;
}
