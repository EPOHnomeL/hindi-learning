import type { ReactNode } from "react";

// One inline-SVG icon set for the app chrome (UI redesign). Every glyph is a 2px
// stroke, round-capped path on a 24-viewBox — matching the app's existing
// hamburger + chevron — so icons theme with `currentColor` and render identically
// across platforms (unlike the emoji they replace: 🎓 ✦ ✓ ↻ 🔗). Path data is
// lifted verbatim from the redesign prototype's ICONS object.
//
// Add a glyph by dropping its inner markup into `PATHS`; the `IconName` union then
// forces every call site to use a known name.

export type IconName =
  | "edit"
  | "settings"
  | "kebab"
  | "award"
  | "globe"
  | "check"
  | "refresh"
  | "plus"
  | "link"
  | "trash"
  | "x"
  | "upload"
  | "ext"
  | "sun"
  | "moon"
  | "book"
  | "lock"
  | "chevron"
  | "users";

const PATHS: Record<IconName, ReactNode> = {
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  kebab: (
    <>
      <circle cx="12" cy="5" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="12" cy="19" r="1.4" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M8.2 12.5 7 22l5-3 5 3-1.2-9.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </>
  ),
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  upload: (
    <>
      <path d="M4 17v3h16v-3" />
      <path d="M12 3v13M7 8l5-5 5 5" />
    </>
  ),
  ext: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 13v6H5V6h6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  users: (
    <>
      <path d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-6A3.5 3.5 0 0 0 4 18.5V20" />
      <circle cx="10.5" cy="8" r="3.5" />
      <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
      <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
    </>
  ),
};

// An inline icon. Decorative by default (`aria-hidden`) — the surrounding
// control carries the label. Size + colour come from `className` (defaults to
// 20px, `currentColor`), so an icon inherits its button's text colour and states.
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
