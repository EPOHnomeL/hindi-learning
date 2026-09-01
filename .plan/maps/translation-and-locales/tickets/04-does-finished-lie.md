---
type: grilling
blocked_by: []
---
# Does "Finished" lie about the five machine Editions?

## Question

**Finished** is derived as `publishedEditions.published === true` or a `listings` row
existing. Both are owner acts, which is what makes them a decent proxy for "the human
pass is done": you would not publish or price a language until the translator had
finished with it.

Except five Editions of `prophetic-school` were translated **by machine** and are
recorded ready (`af`, `es`, `fr`, `mg`, `ur`), plus `st` and `st-ZA` are live on prod,
`st-ZA` derived from `st` by a rewrite script with no English-to-Sesotho run at all
([course-translation ticket 06](../../course-translation/tickets/06-sesotho-za-from-lesotho-clone.md)).
Every roster row is a human who has not started.

So if any of those is already published or priced, the very first report shows
**Finished** for a language no human has touched. The default agreed in the charting
grill is that Finished **renders literally**; this ticket is where that gets checked
against reality and either confirmed or qualified.

First, establish the facts. Nobody has read prod for this: `.mcp.json` is empty (the
prod-PII grant was removed as
[`docs/translation.md`](../../../docs/translation.md) instructs), so this needs a
scripted read or a temporary grant that is **removed again afterwards**.

- Which languages have an Edition, and what is each `translationJobs.status`?
- Which have a `publishedEditions` row, and is `published` true?
- Which have a `listings` row, and at what price?

Then the decision. Options worth putting to the user:

- **Render literally.** Finished means published or priced, full stop. Simple, and
  wrong on day one if any of those five is live.
- **Qualify it.** Finished, plus a marker when no translator ever reached Busy on that
  language: "published, machine translation, unreviewed". Honest, and it makes the five
  a visible backlog rather than a false finish line.
- **Require a human.** Finished needs published-or-priced *and* a translator who
  reached Busy. Cleanest semantics, but it renders the currently-live Editions as
  unfinished, which is arguably also true.

## Done when

- The prod facts above are written into the Answer as a table, with the date read, and
  any temporary prod access removed.
- The user has ruled on which reading ships, and the Answer states it plainly enough for
  04 to implement without re-deciding.
- If the ruling changes the ladder, the map's Notes are corrected in the same edit,
  since Notes is where the settled model lives.

<!-- Moved 2026-09-01 from translator-status-report/08 during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because blocked_by is map-local; the old number stays that ticket's identity in the donor
     map's history.  -->
