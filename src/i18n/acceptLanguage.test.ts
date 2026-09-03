import { describe, expect, it } from "vitest";
import { matchAcceptLanguage } from "./acceptLanguage";

// Cookie-writer #3 (ticket 03 §3): on a first visit with nothing stored, sniff
// the browser's Accept-Language ONCE, map it to an offered locale (else English),
// and persist to the cookie so it never re-runs. This is the pure mapping half.
describe("matchAcceptLanguage", () => {
  it("matches an offered locale by exact tag", () => {
    expect(matchAcceptLanguage("es")).toBe("es");
    expect(matchAcceptLanguage("fr-FR,fr;q=0.9")).toBe("fr");
  });

  it("matches on the base subtag (es-MX → es)", () => {
    expect(matchAcceptLanguage("es-MX,es;q=0.8")).toBe("es");
    expect(matchAcceptLanguage("af-ZA")).toBe("af");
  });

  it("honours q-weight order, taking the first offered match", () => {
    // Portuguese isn't offered; Spanish is next and wins over the lower-q English.
    expect(matchAcceptLanguage("pt-BR,pt;q=0.9,es;q=0.8,en;q=0.5")).toBe("es");
  });

  it("falls back to English when no part is offered", () => {
    expect(matchAcceptLanguage("de,ja;q=0.5")).toBe("en");
    expect(matchAcceptLanguage("")).toBe("en");
    expect(matchAcceptLanguage(null)).toBe("en");
    expect(matchAcceptLanguage(undefined)).toBe("en");
  });

  it("maps Hindi (the Devanagari case)", () => {
    expect(matchAcceptLanguage("hi-IN,hi;q=0.9,en;q=0.8")).toBe("hi");
  });

  // Urdu joined the offer-set on 2026-09-03, and this sniff reads LOCALES, so an
  // Urdu browser stopped falling through to English the moment messages/ur.json
  // landed. Pinned because it is the first RTL locale: the whole chrome flips on
  // the strength of this mapping.
  it("maps Urdu (the first RTL case)", () => {
    expect(matchAcceptLanguage("ur")).toBe("ur");
    expect(matchAcceptLanguage("ur-PK,ur;q=0.9,en;q=0.8")).toBe("ur");
  });
});
