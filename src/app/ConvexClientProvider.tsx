"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { type ReactNode } from "react";
import { ThemeProvider } from "./_components/ThemeContext";

// Next inlines NEXT_PUBLIC_* at build; `npx convex dev` writes it to .env.local.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <ThemeProvider>{children}</ThemeProvider>
    </ConvexAuthNextjsProvider>
  );
}
