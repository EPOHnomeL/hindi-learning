"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { env } from "../../env.js";

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
