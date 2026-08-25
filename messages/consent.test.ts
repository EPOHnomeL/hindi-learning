/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import en from "./en.json";
import { CONSENT_VERSION, CONSENT_VERSIONS } from "../convex/joinConsent";
import { LOCALES } from "../src/i18n/config";

// The consent wording exists in **one** place and this is the gate that keeps it
// that way (ADR 0031, shared-access-codes tickets 03 and 09).
//
// The canonical record is `convex/joinConsent.ts`: append only, one language, and
// what `seats.consentVersion` resolves against, because a year from now the question
// will be which wording a particular member agreed to and s11(2) puts the burden of
// proving it on us. `/join` renders `messages/<locale>.json` instead, because consent
// has to be *informed* and a member reading Afrikaans cannot be informed by English.
//
// Those are two copies of one legal undertaking, which is exactly the arrangement
// that drifts. So the English copy is asserted **identical**, sentence for sentence,
// and every other locale is asserted to have the same number of sentences. An editor
// tidying the page's copy has to change the record too, and the record is versioned,
// so the change becomes a new version rather than a silent rewrite of what already
// joined members agreed to.
const lines = CONSENT_VERSIONS[CONSENT_VERSION];

// Eager glob, the same way `parity.test.ts` loads the catalogues. A templated
// `import()` would work but vite warns that a variable import cannot read its own
// directory, and a warning nobody can act on is a warning everybody learns to skip.
const files = import.meta.glob("./*.json", { eager: true }) as Record<
  string,
  { default: { Join: { consentLines: string[] } } }
>;

describe("the join consent wording", () => {
  it("has a canonical record for the version the app is issuing", () => {
    expect(lines, `no wording recorded for ${CONSENT_VERSION}`).toBeDefined();
    expect(lines!.length).toBeGreaterThan(0);
  });

  it("English on the page is the canonical record, word for word", () => {
    expect(en.Join.consentLines).toEqual([...lines!]);
  });

  for (const code of LOCALES) {
    if (code === "en") continue;
    it(`${code} states the same number of things`, () => {
      // Not a translation check, which no test can do. It catches the failure that
      // actually happens: a locale that quietly drops the sentence about the PIN
      // being unrecoverable, or the one about the nickname not needing to be a real
      // name. Both are compliance controls, and a member who never read them did not
      // give informed consent.
      expect(files[`./${code}.json`]!.default.Join.consentLines).toHaveLength(lines!.length);
    });
  }
});
