---
type: grilling
blocked_by: [15]
---
# Which controls belong to sharing, which to course settings, which to the account

> `/wayfinder .plan/maps/ui-overhaul/tickets/17-control-boundary.md`

## Question

Four controls sit in the wrong dialog, and the code comments admit it. Teacher Q&A is
per Topic but renders inside a per-language panel, so its hint has to spend two lines
explaining that it governs the whole course. Seller onboarding and the payout bank
form are per user, yet they live inside one edition's price card. The access roster is
per edition, but the depth an owner wants from it belongs to the topic-sharing map.
Meanwhile Course settings holds title, mission, the certificate emblem, the completion
lifecycle and a delete-a-lesson list, which is authoring rather than settings.

Decide where each of these lives once the sharing panel is reorganised:

- Teacher Q&A. Course settings is my prior, since it is a course-wide switch.
- Seller grant and payout bank details. Account settings at `/settings` would stop
  every edition repeating a one-time setup.
- The access roster. Placement is this ticket's call. Its edge cases and the learner
  insights view stay with topic-sharing tickets 06, 08 and 09.
- Lesson deletion and the completion lifecycle. Settings, or the authoring surface.
- Whether an Editor, who today sees Details only, sees anything else after the move.

Every control here is owner-only server-side. Moving one must not widen who can call
it, and `convex:convex-authz` is the check on that.

## Done when

The Answer is a table of control to destination surface, each with a one-line reason,
covering every control now rendered by `Editions.tsx` and `CourseSettings.tsx`. Any
control that moves to `/settings` names the section it lands in. The Editor's view is
stated explicitly.

## Answer

Grilled 2026-08-27. **Three controls move, not four.** The fourth was a contradiction on
the map rather than a misplaced control, and it resolved in favour of leaving it alone.

Nothing moves to `/settings`. The one candidate for it, the payout bank form, stays put
(see the seller row below), so the account surface is untouched by this ticket and no
`/settings` section needs naming.

### Editions.tsx

| Control | Destination | Why |
| --- | --- | --- |
| Publish toggle | Sharing, *Who can find it* | Per Edition, and the only member of group one. |
| Public link toggle | Sharing, *Who you hand it to* | Per Edition; the rail 19 Topics actually use. |
| Invite by email | Sharing, *Who you hand it to* | Per Edition; the form that produces the roster. |
| Access roster, with its role toggle and revoke | **Users**, a new course-scoped surface | Moves. See below. |
| Teacher Q&A toggle | **Course settings** | Moves. Per Topic and pedagogical. |
| Price control | Sharing, *What it costs* | Per Edition; each language is priced on its own. |
| Seller grant status | Sharing, inside *What it costs* | Stays. Ticket 15 wins over this ticket's prior. |
| Payout bank details form | Sharing, inside *What it costs* | Stays, same call. |
| Voucher control | Sharing, *What it costs* | Stays, as the single merged card ticket 15 specified. |
| Edition picker, badges, Add language | Sharing shell | Per Edition by definition; where the picker sits is ticket 16's. |
| Translation engine toggle | Sharing, with Add language and Re-translate | Per Edition, and only ever a field of those two forms. |
| Retry translation | Sharing, the failed-Edition state | Per Edition, and reachable only from that state. |
| Regenerate link, Re-translate, Remove Edition | Sharing, the Edition danger menu | Per Edition and destructive; the menu is the pattern Course settings should copy. |
| Four bespoke confirm dialogs | `ConfirmDialog` in `ui.tsx` | Not a placement question; ticket 19 already owns the collapse. |

### CourseSettings.tsx

| Control | Destination | Why |
| --- | --- | --- |
| Details, English source | Course settings | Already right. Visible to an Editor. |
| Details, translated Edition | Course settings | Already right. Visible to that Edition's Editor. |
| Certificate emblem | Course settings | Per Topic; the mark of the subject, not of a language. |
| Lesson deletion | Course settings | Stays. There is nowhere else. |
| Completion lifecycle | Course settings | Stays, same reason. |

### The three moves, in full

**Teacher Q&A goes to Course settings.** `topics.teacherQa` is per Topic, and the
schema comment gives the reason directly: whether a course invites questions is a
pedagogy choice about the course, not about one language. The move deletes two things
that only exist to apologise for the current placement, the `edition.source &&` guard
that hides the toggle on every translated tab and the third hint line telling the owner
it governs the whole course in every language. In a course-scoped dialog there is
nothing to disclaim.

**The access roster becomes a Users surface, course-scoped.** `listEditionAccess`
returns invites only, accepted `shares` plus unclaimed `pendingShares`, filtered to one
language. It lists neither public-link readers nor paying buyers. Today it renders once
per Edition tab, so an owner with three languages reads three partial lists and can
never answer "how many people have access to this course". It becomes its own surface,
scoped to the whole course, with **language as a row attribute rather than the
container**. What it owes: the count of people, who the course was shared with, and
Editor assignable **only** to someone already shared with. That last constraint is what
makes it a destination rather than a list, and it is what lets the surface later carry
who translates which language and who was invited to which, which is the shape the
owner asked for. The depth beyond that, the edge cases and the learner insights view,
stays out of scope with [topic-sharing](../../topic-sharing/map.md) 06, 08 and 09.

**The Editor's Details door returns in the reader.** The ticket asked what an Editor
sees "after the move" on the premise that they see Details today. They see nothing.
Commit `e228ba5` (2026-08-23) trimmed the reader drawer to lessons, references and
resources, and its own message records the cost: *a translated Edition Editor loses the
Details door*. The `owner={false}` branch in `CourseSettingsDialog` has been dead code
since, because `Dashboard.tsx` is now the only caller and never passes the prop. Decided:
give the door back **in the reader**, Details only, for a viewer with `canEdit` on the
Edition being read. That is a deliberate partial reversal of a four-day-old decision,
taken because assigning someone Editor on the new Users surface is meaningless if they
have nowhere to edit. Where in the reader it hangs, drawer or header, is ticket 18's to
prototype.

### The one that did not move

Ticket 15 put the seller grant status and the payout bank form inside the collapsed
*What it costs* row; this ticket's Question sent them to `/settings`. **Ticket 15 wins.**
The row is collapsed for anyone who is not a ready Seller, so it costs the common owner
nothing, and an owner setting a price for the first time discovers why they cannot in
the same place they are trying to. Both are per user, and the file comment already
apologises for it, but one place beats a correct boundary that sends the owner away
mid-task. The `payments-unconfigured` and `not-granted` states stay read-only text: the
owner can act on neither, so neither earns a control.

### What this ticket did not decide

The container, and where the edition picker sits, are **ticket 16's** and were left
there on purpose. 16 is deliberately **not** blocked on this ticket. The stated risk: 16
prototypes a picker-headed single stack, and a course-scoped Users surface is a peer that
shape does not obviously hold.

The mitigation is a line in the map's Notes rather than one in 16's body, because **16 was
already claimed** by a live session (`sonnet5-ui-overhaul-16`, claimed 2026-08-27) when
this ticket resolved. Editing a ticket another session is working is how two sessions
clobber each other, so the input was routed to the map instead. Whoever resolves 16 needs
one fact from here: the container must host at least three peers at two different scopes,
sharing being per Edition, Users and Course settings being course-wide, so the 20-Edition
picker governs one peer rather than the shell.

The arrangement of lesson deletion and the completion lifecycle **inside** Course
settings, which is where both stay, is ticket 18's. The recommendation on offer was one
collapsed Danger section at the bottom mirroring `EditionDangerMenu`; the call was
deferred to the prototype.

### Authorisation

No move widens who can call anything. `setTeacherQa`, `setShareRole`, `revokeShare` and
`listEditionAccess` are owner-only server-side today and keep their handlers untouched;
the Users surface must call those same queries rather than grow its own. The Editor's
reader door reads the per-Edition `canEdit` that `courseHeader` already computes server
side (ADR 0020). `convex:convex-authz` runs over all of it in 19, 20 and 22.

**Decided, NOT built.** The builds are ticket 19 (sharing), ticket 20 (Course settings,
now including the Editor's reader door) and ticket 22 (the Users surface).
