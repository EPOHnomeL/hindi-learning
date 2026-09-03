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
