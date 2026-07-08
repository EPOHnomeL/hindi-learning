import Link from "next/link";
import type React from "react";
import { Icon } from "./icons";

// A sidebar navigation item, shared by the authed reader (CourseShell) and the
// Guest reader (PublicReader) so the two sidebars never drift. `notify` (the
// teacher-reply dot) is only used by the authed reader; the Guest omits it.
//
// Paid marketplace: `locked` marks content past the free Preview (a lock icon,
// muted label); `free` flags the Preview lesson itself. Both stay navigable —
// opening a locked item shows the paygate, not a dead end.
export function NavItem({
  href,
  active,
  done = false,
  notify = false,
  locked = false,
  free = false,
  children,
}: {
  href: string;
  active: boolean;
  done?: boolean;
  notify?: boolean;
  locked?: boolean;
  free?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors md:py-1.5 ${
        active ? "bg-accent text-white" : locked ? "text-soft hover:bg-hi" : "text-ink hover:bg-hi"
      }`}
    >
      <span className="min-w-0">{children}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {free && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              active ? "bg-white/20 text-white" : "bg-accent2/15 text-accent2"
            }`}
          >
            Free
          </span>
        )}
        {notify && (
          <span
            aria-label="New reply from your teacher"
            title="Your teacher answered a question here"
            className={`h-2 w-2 rounded-full ${active ? "bg-white" : "bg-gold"}`}
          />
        )}
        {done && (
          <span aria-label="completed" title="Completed" className={`text-xs ${active ? "text-white" : "text-accent2"}`}>
            ✓
          </span>
        )}
        {locked && <Icon name="lock" className={`h-3.5 w-3.5 ${active ? "text-white" : "text-soft"}`} />}
      </span>
    </Link>
  );
}
