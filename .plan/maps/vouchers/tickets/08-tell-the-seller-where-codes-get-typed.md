---
type: task
blocked_by: [05, 06]
---
# Tell the Seller where the codes get typed

## Question

A Seller mints a batch, downloads a CSV of codes, hands it to the organisation, and the platform
never once says the word `/redeem`. The route exists on every host (ticket 06) and nothing in the
product points at it. So the URL reaches the organisation only if the Seller happens to think of
it, and the failure mode is the worst one this rail has: a member holding a perfectly valid code
and no idea where to type it, on a platform that has their organisation's billing address and none
of theirs. Nobody can rescue them but the Seller.

Two distribution shapes, and they want different things:

- **Mail merge.** The organisation has the CSV and a list of its own people. It wants one link per
  person that already carries the code, so the member clicks rather than types.
- **A printed card.** Somebody is setting type on a card that says "go here, type this". They want
  the bare URL, short enough to read off paper, separate from the code.

What should the platform say, and where? This is a copy decision rather than a feature: the answer
is a column and a sentence, and the work is deciding what they say.

## Done when

- The CSV names where a code is redeemed, per row, with the code already in the link.
- The bare redeem URL is visible to the Seller beside the download, so a printed card can quote it.
- The URL is the host the Seller is actually on, so a whitelabel Seller hands out their own domain
  rather than the platform's.
- The new copy exists in all five `messages/*.json` and `messages/parity.test.ts` is green.

## Answer

**Done 2026-08-18. Verified by reading the code, a green suite and a green `pnpm build`**; the
batch row and its download were not clicked in a browser (see the map's operator walkthrough item).

The CSV gained a fourth column, `redeem at`, carrying `<origin>/redeem?code=<code>` on every row.
That is the mail-merge shape: the organisation sends one line per person and the member clicks once
rather than transcribing `MYC-XXXX-XXXX` off a screen. The three existing headers are English
literals and the new one follows them, because the CSV is a data file the organisation processes,
not a page anybody reads in their own language.

Beside the download button the batch row now states the bare URL in a sentence
(`Editions.batchRedeemHint`, five locales), for the Seller printing a card rather than mail
merging. It says both things: where members redeem, and that the CSV already carries a link per
code, so a Seller who is about to hand-write instructions finds out they do not have to.

**The origin is read from the browser after mount**, not from config: `/redeem` is served on every
host with no tenant flag (ticket 06), so the Seller working on their own whitelabel domain hands
their organisation that domain. Reading `window.location.origin` during render would be a
hydration mismatch, so it is mount-gated the way `RedeemPanel` mount-gates the code it recovers
from the URL.

What this deliberately did **not** do: send anything to anybody. The platform still has no member
addresses and mails no codes. Everything added here is text the Seller carries to the organisation
by hand, which is the same shape as the rest of the rail.
