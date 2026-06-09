import { useState } from "react";
import { usePrototypeApp } from "./store";
import { PrototypeSwitcher, type VariantInfo } from "./PrototypeSwitcher";
import { name as nameA, VariantA } from "./variants/VariantA";
import { name as nameB, VariantB } from "./variants/VariantB";
import { name as nameC, VariantC } from "./variants/VariantC";

const VARIANTS: VariantInfo[] = [
  { key: "A", name: nameA },
  { key: "B", name: nameB },
  { key: "C", name: nameC },
];

function readVariant(): string {
  const v = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
  return VARIANTS.some((x) => x.key === v) ? v! : "A";
}

export function App() {
  const [variant, setVariantState] = useState(readVariant);
  const app = usePrototypeApp();

  const setVariant = (key: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", key);
    window.history.replaceState({}, "", url);
    setVariantState(key);
  };

  return (
    <>
      <div className="proto-banner">
        ⚠ THROWAWAY PROTOTYPE — mock data, no backend. Reader design exploration for the Served Teach App.
      </div>

      {variant === "A" && <VariantA app={app} />}
      {variant === "B" && <VariantB app={app} />}
      {variant === "C" && <VariantC app={app} />}

      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={setVariant} />
    </>
  );
}
