import "~/styles/globals.css";

import { type Metadata } from "next";
import { Spectral, Noto_Serif_Devanagari } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";

export const metadata: Metadata = {
  title: "My Course",
  description: "Your courses — lessons grounded in reading.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
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
        <head>
          {/* Apply the saved theme before paint so a dark-mode user never flashes
              the light "paper" palette on load. Mirrors hindi:theme / data-theme
              written by ThemeContext (ADR 0011). */}
          <script
            dangerouslySetInnerHTML={{
              __html: `try{var t=localStorage.getItem('hindi:theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
            }}
          />
        </head>
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
