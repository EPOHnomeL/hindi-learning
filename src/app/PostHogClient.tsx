"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { env } from "../../env.js";
import { dropFramelessNetworkRejection } from "../lib/posthogBeforeSend";

let isInitialized = false;

export function initializePostHog() {
  if (isInitialized) {
    return true;
  }

  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!projectToken || !host) {
    if (process.env.NODE_ENV === "development") {
      const missingVariable = projectToken
        ? "NEXT_PUBLIC_POSTHOG_HOST"
        : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";
      throw new Error(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
      );
    }
    return false;
  }

  posthog.init(projectToken, {
    api_host: host,
    // NEXT_PUBLIC_POSTHOG_HOST is the managed reverse proxy (t.my-course.app),
    // not a posthog.com host, so posthog-js cannot infer where the UI lives: its
    // fallback rewrites `.i.posthog.com` to `.posthog.com` and otherwise reuses
    // api_host verbatim, which would point the toolbar and every "view in
    // PostHog" link at the proxy. Name the EU app host explicitly. Hardcoded
    // because the region is a property of project 264778, not of the deploy.
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    // Core Web Vitals from the field (perceived-performance ticket 01). Until
    // 2026-09-09 the only performance numbers this project had came from local
    // production builds on a developer connection, which says nothing about a
    // mid-range Android phone on South African mobile data. That is the
    // population every perceived-performance ticket is actually for, so every
    // one of them would otherwise resolve on "it should be faster" rather than
    // "it is".
    //
    // `web_vitals` ONLY, and `network_timing` deliberately left off. Web vitals
    // are page-level timings (LCP, INP, CLS) and carry no request contents;
    // network_timing captures per-request resource timing, which is both a
    // bigger payload and a different privacy question than the one `/privacy`
    // answers today. If it is ever wanted, it needs its own line on that page.
    //
    // This adds NO person property. The identity commitment in
    // `ConvexClientProvider.tsx` still holds: the Convex user document ID and
    // nothing else, no email and no name.
    capture_performance: { web_vitals: true },
    // Drop frameless unhandled network rejections before they reach error
    // tracking: they arrive with no stack, so they are untriageable and recur
    // on every flaky connection.
    before_send: dropFramelessNetworkRejection,
    debug: process.env.NODE_ENV === "development",
  });
  isInitialized = true;
  return true;
}

export function isPostHogInitialized() {
  return isInitialized;
}

export function PostHogClient() {
  useEffect(() => {
    initializePostHog();
  }, []);
  return null;
}
