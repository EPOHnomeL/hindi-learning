import "~/styles/globals.css";

import { type Metadata } from "next";
import { Spectral, Noto_Serif_Devanagari } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";

export const metadata: Metadata = {
  title: "Hindi — Served Teach",
  description: "Your Hindi lessons, grounded in reading the Bible (BSI OV).",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
});
const notoDeva = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600"],
  variable: "--font-noto-deva",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${spectral.variable} ${notoDeva.variable}`}>
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
