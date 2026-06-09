import { useEffect } from "react";

export interface VariantInfo {
  key: string;
  name: string;
}

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: VariantInfo[];
  current: string;
  onChange: (key: string) => void;
}) {
  const index = Math.max(0, variants.findIndex((v) => v.key === current));
  const cycle = (delta: number) => {
    const next = (index + delta + variants.length) % variants.length;
    onChange(variants[next]!.key);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const currentName = variants[index]?.name ?? "";

  return (
    <div className="proto-switcher">
      <button className="proto-arrow" onClick={() => cycle(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className="proto-label">
        <strong>{current}</strong> — {currentName}
        <span className="proto-hint">· ← / → to flip</span>
      </span>
      <button className="proto-arrow" onClick={() => cycle(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
}
