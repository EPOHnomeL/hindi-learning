// The brand mark: an open book, echoing that every lesson is grounded in
// reading (see layout description). Drawn with `currentColor` so it inherits
// whatever text color it sits in — `text-accent` in the header flips from
// terracotta to warm amber in dark mode (globals.css) for free.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="My Course"
    >
      {/* left page */}
      <path d="M16 9 C 12.5 7, 8 7, 4.5 8 L 4.5 22 C 8 21, 12.5 21, 16 23" />
      {/* right page */}
      <path d="M16 9 C 19.5 7, 24 7, 27.5 8 L 27.5 22 C 24 21, 19.5 21, 16 23" />
      {/* spine */}
      <path d="M16 9 L 16 23" />
    </svg>
  );
}
