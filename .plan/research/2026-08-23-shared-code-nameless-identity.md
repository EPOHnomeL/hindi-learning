# Research: one shared multi-use code, and what identifies a nameless learner

**Date:** 2026-08-23 · **Prompted by:** a proposal to replace ADR 0029's N single-use
vouchers with ONE multi-use code capped at N seats, acting as a sign-in credential,
post-paid on seats consumed.

Every claim below carries a link to the source it came from. Where a source could not be
reached, that is said out loud rather than papered over. **SAYS** marks what a primary
source states; **INFER** marks reasoning built on top of it.

---

## 0. The question underneath the question

ADR 0029 caps seats with *the codes themselves*: N single-use codes, one seat each, so the
cap is enforced by the code being spent and **nothing per-person is ever stored**
([ADR 0029](../../docs/adr/0029-seller-minted-voucher-rail.md), decision 3, the Voucher
stores `redeemedAt` and no user id; `convex/schema.ts:796-802` confirms the row is
`{batchId, code, redeemedAt?}`).

A single multi-use code capped at N cannot do that. To stop the twelfth visit by the same
learner counting as a twelfth seat, the platform must be able to tell a returning learner
from a new one, which is a durable per-person identifier, held by the platform, bound to
that batch.

**INFER, and this is the load-bearing finding of the whole document:** under a shared
capped code the cap and the namelessness are in direct tension, in a way they are not under
N single-use codes. Everything in section 1 is about what that identifier costs under POPIA.

---

## 1. POPIA (Act 4 of 2013)

### Sourcing note, stated up front

The Act's own PDF could not be text-extracted in this session.
`justice.gov.za/legislation/acts/2013-004.pdf`,
`treasury.gov.za/POPIA/POPI Act 4 of 2013.pdf` and
`inforegulator.org.za/.../PROTECTION-OF-PERSONAL-INFORMATION-ACT-4-OF-2013.pdf` all
downloaded successfully but use CID-encoded embedded fonts; no text extractor was available
in this environment (no poppler, no pdfjs, npm install was blocked) and WebFetch declined to
quote from the binary. [saflii.org](https://www.saflii.org/za/legis/consol_act/popia2013380/)
returned HTTP 403.

So the statutory wording below comes from two places, and which is which is marked:

- **First-party (Information Regulator).** The Regulator's own guidance notes, whose PDFs
  *did* extract cleanly, restate the definitions and s26/s27 almost verbatim. These are the
  strongest sources actually reachable.
- **Reproduction (popia.co.za).** A third-party site reproducing the Act section by section.
  Used only for s1's `personal information`, s11, s19, s26, s31 and s72. Where it overlaps
  the Regulator's text it agrees exactly, which is why it is trusted here. It is still not
  the gazette, and a legal opinion should re-verify against the printed Act.

### s1: "personal information"

**SAYS** ([popia.co.za, s1 definitions](https://popia.co.za/section-1-definitions/)):

> "information relating to an identifiable, living, natural person, and where it is
> applicable, an identifiable, existing juristic person, including, but not limited to:
> (a) information relating to the race, gender, sex, pregnancy, marital status, national,
> ethnic or social origin, colour, sexual orientation, age, physical or mental health,
> well-being, disability, religion, conscience, belief, culture, language and birth of the
> person; (b) information relating to the education or the medical, financial, criminal or
> employment history of the person; **(c) any identifying number, symbol, e-mail address,
> physical address, telephone number, location information, online identifier or other
> particular assignment to the person**; (d) the biometric information of the person;
> (e) the personal opinions, views or preferences of the person; (f) correspondence sent by
> the person that is implicitly or explicitly of a private or confidential nature ...;
> (g) the views or opinions of another individual about the person; and **(h) the name of
> the person if it appears with other personal information relating to the person or if the
> disclosure of the name itself would reveal information about the person**"

Also from the same source, and directly on point for the token question:

> **"unique identifier"**: "any identifier that is assigned to a data subject and is used by
> a responsible party for the purposes of the operations of that responsible party and that
> uniquely identifies that data subject in relation to that responsible party"

### s1: "de-identify", "consent", "processing"

**SAYS**, first-party, [Information Regulator, *Guidance Note on Processing of Special
Personal Information*, June 2021, sections 1.1 to 1.4](https://inforegulator.org.za/wp-content/uploads/2020/07/Guidance-Note-Processing-Special-PersonalInformation-20210628-004.pdf)
(text extracted directly from the Regulator's PDF):

> **consent** "means any voluntary, specific and informed expression of will in terms of
> which permission is given for the processing of personal information"
>
> **de-identify**, "in relation to personal information of a data subject, means to delete
> any information that: identifies the data subject; can be used or manipulated by a
> reasonably foreseeable method to identify the data subject; or **can be linked by a
> reasonably foreseeable method to other information that identifies the data subject**"
>
> **processing** "means any operation or activity or any set of operations, whether or not
> by automatic means, concerning personal information, including: the collection, receipt,
> recording, organisation, collation, storage, updating or modification, retrieval,
> alteration, consultation or use; dissemination by means of transmission, distribution or
> making available in any other form; or merging, **linking**, as well as restriction,
> degradation, erasure or destruction of information"

### s26: prohibition on processing special personal information

**SAYS**, first-party, [same Guidance Note, 2.1 to 2.2](https://inforegulator.org.za/wp-content/uploads/2020/07/Guidance-Note-Processing-Special-PersonalInformation-20210628-004.pdf):

> "2.1 Section 26 of POPIA prohibits the processing of special personal information, subject
> to exceptions provided for in section 27(1).
> 2.2 In terms of section 26, a responsible party may ... not process any of the following
> special personal information of a data subject: 2.2.1 religious beliefs; 2.2.2
> philosophical beliefs; 2.2.3 race; 2.2.4 ethnic origin; 2.2.5 trade union membership;
> **2.2.6 political persuasion**; 2.2.7 health; 2.2.8 sex life; 2.2.9 biometric information;
> or 2.2.10 the criminal behaviour of a data subject ..."

The statutory phrasing itself, from the reproduction
([popia.co.za, s26](https://popia.co.za/section-26-prohibition-on-processing-of-special-personal-information/)):

> "A responsible party may, subject to section 27, not process personal information
> **concerning**: (a) the religious or philosophical beliefs, race or ethnic origin, trade
> union membership, **political persuasion**, health or sex life or biometric information of
> a data subject; or (b) the criminal behaviour of a data subject ..."

The operative word is **concerning**, not "stating". Nothing requires the record to assert
the persuasion in words.

### s27(1): the exceptions

**SAYS**, first-party, [same Guidance Note, 2.3](https://inforegulator.org.za/wp-content/uploads/2020/07/Guidance-Note-Processing-Special-PersonalInformation-20210628-004.pdf):

> "The prohibition ... does not apply if the: 2.3.1 **processing is carried out with the
> consent of a data subject**; 2.3.2 processing is necessary for the establishment, exercise
> or defence of a right or obligation in law; 2.3.3 processing is necessary to comply with an
> obligation of international public law; 2.3.4 processing is for historical, statistical or
> research purposes ...; 2.3.5 **information has deliberately been made public by the data
> subject**; or 2.3.6 provisions relating to sections 28 to 33 of POPIA are, as the case may
> be, complied with."

### s31: the political-persuasion authorisation

**SAYS**, first-party, [Information Regulator, *Guidance Note on the Processing of Personal
Information of a Voter by a Political Party*, 28 January 2019, paragraphs 7 to 9 and
19](https://inforegulator.org.za/wp-content/uploads/2020/07/InfoRegSA-GuidanceNote-PPI-PolParties-1.pdf):

> "7. Section 26 of POPIA prohibits the processing of special personal information which
> includes the political persuasion of voters. However, political parties may process the
> political persuasion of voters in accordance with section 31 of POPIA. **The political
> persuasion of a voter relates to the fact that a voter supports a specific political
> party.**
>
> 8. In terms of section 31 a political party may process the political persuasion of a voter
> for the purpose of forming a political party; participating in its activities; engaging in
> the recruitment of members; canvassing supporters or voters for an election or a referendum
> and campaigning for a political cause.
>
> 9. Section 31 is an exception to the prohibition on the processing of political persuasion.
> A political party must still comply with the conditions for the lawful processing of
> personal information ...
>
> 19. Section 31 only gives a political party the right to process [the political persuasion
> of] a voter and it must obtain consent to process other personal information."

**SAYS** (reproduction, [popia.co.za, s31](https://popia.co.za/section-31-authorisation-concerning-data-subjects-political-persuasion/)):
s31 permits processing by political institutions for their members, employees or others where
necessary to achieve institutional aims, and s31(2) provides that "no personal information may
be supplied to third parties without the consent of the data subject." The full verbatim text
of s31 could **not** be retrieved: the fetch declined to reproduce it and returned only that
one fragment. Treat s31(2)'s exact wording as unconfirmed.

**INFER:** s31 authorises **the party**, not this platform. It is the party's exception, scoped
to the party's own aims. And s31(2), if the fragment is accurate, is the precise constraint
that produced ADR 0029 in the first place: the party may not hand the platform a roster
without each member's consent.

### s11: consent, justification and objection

**SAYS** ([popia.co.za, s11](https://popia.co.za/section-11-consent-justification-and-objection/)),
returned as paraphrase rather than full quotation: s11(1) permits processing where one of six
grounds is met, the first being the data subject's consent; s11(2) puts the burden of proving
consent on the responsible party and allows withdrawal "at any time", without affecting the
lawfulness of processing already done; s11(3) gives a right to object; s11(4) states that where
a data subject has objected, "the responsible party may no longer process the personal
information." Verbatim text of s11(1)(a) to (f) was **not** retrievable and is not reproduced
here.

### s19: security safeguards

**SAYS** ([popia.co.za, s19](https://popia.co.za/section-19-security-measures-on-integrity-and-confidentiality-of-personal-information/)):

> "A responsible party must secure the integrity and confidentiality of personal information in
> its possession or under its control by taking appropriate, reasonable technical and
> organisational measures to prevent:" loss, damage or unauthorised destruction, and unlawful
> access to or processing of personal information.

s19(2) requires identifying reasonably foreseeable internal and external risks, establishing
and maintaining safeguards, regularly verifying that they are effectively implemented, and
continually updating them. s19(3): "The responsible party must have due regard to generally
accepted information security practices and procedures ..."

**INFER:** s19 is what makes "store less" a compliance strategy rather than merely a taste.
Data never recorded needs no safeguard, cannot be breached, and cannot be subpoenaed.

### s72: cross-border transfer

**SAYS** ([popia.co.za, s72](https://popia.co.za/section-72-transfers-of-personal-information-outside-republic/)):
transfer of personal information about a data subject to a third party in a foreign country is
barred unless one of (a) to (e) applies. (a) the recipient is "subject to a law, binding
corporate rules or binding agreement which provide an adequate level of protection" that
"effectively upholds principles for reasonable processing ... substantially similar to the
conditions for the lawful processing of personal information" and includes substantially
similar onward-transfer provisions; (b) "the data subject consents to the transfer";
(c) "the transfer is necessary for the performance of a contract between the data subject and
the responsible party, or for the implementation of pre-contractual measures taken in response
to the data subject's request"; (d) necessary for a contract concluded in the data subject's
interest between the responsible party and a third party; (e) for the benefit of the data
subject where obtaining consent is impracticable.

**Not verified:** where Convex Cloud actually stores this deployment's data.
[docs.convex.dev/production/hosting](https://docs.convex.dev/production/hosting/) covers
frontend hosting only and says nothing about database region or data residency. No first-party
Convex statement on region was located in this session.

**INFER:** if the data sits outside South Africa, which is the working assumption but is **not
verified here**, s72 already bites on every user record the platform holds today, not only on
voucher seats. The practical hook would be (a) through Convex's terms or (b)/(c) through the
learner's own sign-up. This is not a new problem created by the shared-code proposal, and it
should not be used as an argument either for or against it.

### The two questions, answered

**Q1. Does a stored list of NAMES of people enrolled via a political party's access code
constitute processing of "political persuasion" special personal information?**

**INFER: yes, on the ordinary reading, with one genuine factual caveat.**

The chain is short. A name stored beside "enrolled through Party X's batch" is personal
information under s1(h), a name appearing "with other personal information relating to the
person". The Regulator's own gloss is that "the political persuasion of a voter relates to the
fact that a voter supports a specific political party"
([Guidance Note, paragraph 7](https://inforegulator.org.za/wp-content/uploads/2020/07/InfoRegSA-GuidanceNote-PPI-PolParties-1.pdf)).
s26 bars processing personal information *concerning* political persuasion, not information
*asserting* it. A row saying "this named person took a seat the party bought and distributed
to its members" is information concerning the fact that this person is one of the party's
people. Storing it is "processing": the definition expressly includes storage, collation and
**linking**.

The caveat is factual, not legal. The inference only lands if the batch is in fact distributed
to members and supporters. A party buying a literacy course for a whole community is not
distributing a badge of persuasion. **But the platform cannot know which it is**, and a
responsible party that guesses wrong has already processed the data by the time the guess is
tested. Assume it bites.

s27(1)(a) makes this curable rather than fatal: with the learner's own voluntary, specific and
informed consent, the prohibition does not apply, and s31 is not needed because s31 is the
party's exception, not the platform's. **This matters as evidence:** ADR 0029 chose "never
recorded"; POPIA would also have permitted "recorded with the learner's consent". The ADR's
promise is stronger than the law requires, and it was made deliberately.
[ADR 0029, "Considered and rejected"](../../docs/adr/0029-seller-minted-voucher-rail.md)
records that storing `redeemedBy` operator-only was recommended during design and rejected by
the operator, precisely so the promise reads "it was never recorded" rather than "the
organisation cannot see it".

**Q2. Does a random opaque per-person token linked to that party's batch also constitute it,
i.e. is a pseudonymous identifier still personal information under POPIA?**

**INFER: yes, twice over, and this is less arguable than Q1.**

*Still personal information.* s1(c) sweeps in "any identifying number, symbol, e-mail address,
physical address, telephone number, location information, online identifier **or other
particular assignment to the person**". A randomly minted token issued to one learner and
reused by them across sessions is exactly an "other particular assignment to the person".
POPIA then defines **unique identifier** separately, as "any identifier that is assigned to a
data subject and is used by a responsible party for the purposes of the operations of that
responsible party and that uniquely identifies that data subject in relation to that
responsible party", which describes the proposed token almost word for word. The mirror test
confirms it: `de-identify` requires deleting anything that "can be linked by a reasonably
foreseeable method to other information that identifies the data subject", and a token
carrying course progress, a certificate name and a device is plainly linkable. The token is
pseudonymous, not de-identified, and POPIA draws no line that lets pseudonymous data out.

*Still special.* If the token is bound to the party's batch, and under a capped shared code it
must be or the cap cannot be counted, then the record concerning that identifiable person
concerns their membership of the party's cohort. Same s26 chain as Q1, minus the name.

**The corollary, which is the point:** what is *not* personal information is a **counter**.
"43 of 100 seats consumed" relates to no identifiable person. That is exactly what ADR 0029
stores, and it is why the current design is clean without needing s27 at all. A shared capped
code cannot reduce to a counter unless it is willing to miscount returning learners as new
ones.

---

## 2. Anonymous auth and account linking in Convex Auth

Read against `node_modules/@convex-dev/auth` **v0.0.80**, the version installed in this repo,
and `convex/auth.ts` as they stand on 2026-08-23.

### The Anonymous provider

`node_modules/@convex-dev/auth/dist/providers/Anonymous.js` is fourteen lines of substance. It
wraps `ConvexCredentials` with `id: "anonymous"` and an `authorize` that calls `createAccount`
with `account: { id: crypto.randomUUID() }` and a profile defaulting to `{ isAnonymous: true }`.
No email, no phone, no user input of any kind.

Official docs, [labs.convex.dev/auth/config/anonymous](https://labs.convex.dev/auth/config/anonymous):

> "If the client is currently authenticated as an anonymous user, and then signs in with
> another authentication method, the anonymous user can be converted to a normal user. **To
> support this flow, you must provide a custom account linking implementation.**"

and, as a caveat:

> "Enabling anonymous users allows any client to write data into your database without
> authentication, which could be abused by malicious actors."

### How `existingUserId` is actually populated

`dist/server/implementation/users.js`, `defaultCreateOrUpdateUser`, first substantive line:

```js
const existingUserId = existingAccount?.userId ?? null;
```

`existingAccount` reaches it only from a lookup on the `providerAndAccountId` index,
`q.eq("provider", provider.id).eq("providerAccountId", account.id)`, in
`mutations/createAccountFromCredentials.js` and `mutations/userOAuth.js`. So `existingUserId`
is non-null **only** when an `authAccounts` row already exists for that exact provider and that
exact provider-side account id. Nothing else feeds it.

When a custom callback is configured the library hands over completely:

```js
if (config.callbacks?.createOrUpdateUser !== undefined) {
    return await config.callbacks.createOrUpdateUser(ctx, { existingUserId, ...args });
}
```

Everything below that line, the verified-email linking, the verified-phone linking and the
insert, becomes dead code. Confirmed by the docs
([labs.convex.dev/auth/advanced](https://labs.convex.dev/auth/advanced)): "When you provide
this callback, the library delegates all user creation and updating responsibilities to you,
requiring you to implement the necessary logic for every provider you configure."

### Trap 1, "every guest merges into one account": STILL HOLDS, verbatim

`convex/auth.ts:57-105` is unchanged in the respect that matters. The callback computes

```ts
const email = String(profile.email ?? "").trim().toLowerCase();
```

before any provider branch, and then unconditionally runs

```ts
const existing = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).unique();
```

The Anonymous provider supplies no email, so `email` is `""`. Guest one is inserted with
`email: ""`. Guest two's index read finds that row and the callback returns it, so guest two
signs in as guest one and inherits their Entitlement, progress and certificates. Guest three
makes `.unique()` throw. The remedy the ticket names is still the right one: branch on the
anonymous provider **first**, insert a fresh row with `isAnonymous: true` and no `email` field
at all, and skip `claimPendingShares`.

### Trap 2, "attaching an account later orphans the seat": STILL HOLDS, and it is worse than the ticket says

The mechanism the ticket describes is confirmed. A signed-in guest clicking Google arrives with
`existingUserId: null`, because there is no `authAccounts` row for provider `google` yet, so
`convex/auth.ts` falls through to `ctx.db.insert("users", {...})` and mints a brand-new row on
the Google address. The anonymous row keeps the Entitlement.

The refinement below is **new, found in this session, and it undercuts the remedy the ticket
proposes.**

The ticket suggests the callback should "notice a currently-signed-in anonymous caller (via
`getAuthUserId(ctx)`) and adopt THAT row". `getAuthUserId` and `getAuthSessionId` read
`ctx.auth.getUserIdentity()` (`dist/server/implementation/sessions.js`). That works only where
the mutation runs under the client's identity.

- **Password / credentials path.** `signIn` is an `actionGeneric` called by the authenticated
  client, and `auth:store` is invoked with `ctx.runMutation` from inside it, so the identity
  propagates. `ctx.auth` should be populated. **The ticket's remedy works here.**
- **Google (OIDC) path.** It does not. The OAuth callback is an `httpActionGeneric` mounted at
  `pathPrefix: "/api/auth/callback/"` (`dist/server/implementation/index.js:179-233`). It is hit
  by *Google's browser redirect*, which carries no Convex auth token, and `callUserOAuth` runs
  `auth:store` from that request. `ctx.auth.getUserIdentity()` there is `null`, so
  `getAuthUserId(ctx)` inside `createOrUpdateUser` returns nothing and the guest row is
  invisible.

The library knows about this and solves it a different way, which the callback cannot reach.
`dist/server/implementation/signIn.js`, `handleOAuthProvider`, carries this comment:

> "We have this action because: 1. **We remember the current sessionId if any, so we can link
> accounts** ..."

`verifierImpl` stores `sessionId: (await getAuthSessionId(ctx)) ?? undefined` on the
`authVerifiers` row at the *start* of the OAuth dance, while the anonymous client is still the
caller. `userOAuthImpl` reads it back and threads it into
`upsertUserAndAccount(ctx, verifier.sessionId ?? null, ...)`. But `defaultCreateOrUpdateUser`
then takes it as `existingSessionId` and **never uses it except in a debug log**, and,
decisively, it is **not forwarded to the custom callback**, which receives only
`{ existingUserId, ...args }`. The one piece of state that would let a custom callback link a
Google sign-in to a live anonymous session exists in the database and is unreachable from where
the linking decision is made.

**INFER, remedies.** Either (a) do the merge outside the auth callback: record the anonymous
`userId` client-side before starting the Google flow, then call an explicit `mergeGuestInto`
mutation once sign-in completes, which is ugly but works for both providers; or (b) offer only
the Password provider on the "save your seat" path, where `ctx.auth` is live; or (c) read the
`authVerifiers` row from inside the callback, which is **not possible** in 0.0.80 because the
callback is given neither the verifier signature nor the session id. The ticket's own
instruction to verify against a running dev deployment still stands, since observing `ctx.auth`
in both paths is cheaper than arguing about it, but the asymmetry between the two paths is now
a prediction with a mechanism behind it rather than a hunch.

### Also worth recording

`@convex-dev/auth@0.0.80` ships providers for `Anonymous`, `ConvexCredentials`, `Email`,
`Password` and `Phone` only. **There is no passkey or WebAuthn provider.** Grepping the
installed `dist/providers/` and `dist/server/types.d.ts` for "passkey" or "webauthn" returns
nothing. Any passkey option in section 4 is a build, not a config change.

---

## 3. Prior art: nameless and rosterless bulk access

Researched against each vendor's own documentation. Several vendor help centres refused the
fetcher outright, and that is recorded rather than filled in from memory.

**Reachability, stated first.** Direct fetches succeeded for Moodle (both pages), Google
Classroom (two pages), Microsoft Teams (one page) and the Canvas API reference. Direct fetches
**failed** for: `support.kahoot.com` (HTTP 403 on every article tried),
`help.quizlet.com` (HTTP 403), `community.canvaslms.com` and `community.instructure.com`
article bodies (redirect then JS shell, text never arrived), `docs.moodle.org/en/Using_self_enrolment`
and `docs.moodle.org/en/Group_enrolment_keys` (404, those page titles do not exist),
`schools.duolingo.com` / `www.duolingo.com/classroom` / `www.duolingo.com/privacy` (JS-only,
returned a bare heading), the official Duolingo "adding students" PDF (downloaded, but scanned
images with no text layer and no renderer available), and
`support.google.com/edu/classroom/answer/7582704` (404). Where only a Google-indexed snippet
*of the official page* was available, that is marked "snippet only".

### Moodle enrolment key, the closest analogue

Fetched: [docs.moodle.org/en/Self_enrolment](https://docs.moodle.org/en/Self_enrolment),
[docs.moodle.org/en/Enrolment_key](https://docs.moodle.org/en/Enrolment_key).

**SAYS.** The key is multi-use, though the docs never use that word. The Enrolment key page
calls it "one method of restricting Self enrolment to a smaller group" and says "one or more
people will supply the course key to authorized people". The clinching line is "Changing or
placing a key does not impact currently enrolled students, nor does it impact students who may
also be enrolled by an enrolment plugin", which only makes sense if the key is a standing gate
that many people pass through and that stops mattering once you are through it.

**SAYS.** Capping exists, but as a *separate setting on the enrolment method*, not on the key.
Max enrolled users: "Adding a number here will specify the maximum number of users who can
self-enrol into new courses. Teachers in the course can change this. If it is left at 0, there
will be no maximum."

**SAYS.** Group enrolment keys let one course carry many keys: "If you wish your users to enrol
themselves directly into a group in the course then you can set a group enrolment key which you
then tell them to use instead of the course enrolment key you will have also set", and "Users
in groups do not need to know the master course enrolment key, only their own group enrolment
key." Keys must be unique across groups.

**SAYS.** Identity is a full Moodle account. Self enrolment requires that you "first need to
enable Email-based self registration so they can create accounts". The key gets you into a
*course*; it does not get you an *identity*. Recovery is by logging in, and the key is never
asked for again. Two independent decay settings exist: Enrolment duration ("Set the amount of
time a user enrolment is valid, starting with the moment the user enrols themselves. If
disabled, the enrolment duration will be unlimited.") and Unenrol inactive after.

**SAYS.** Moodle treats the key as a weak shared secret it expects to leak: there is a site
setting under Site Administration > Plugins > Enrolments > Self enrolment to force keys to obey
the site password policy, described as ensuring "that teachers use secure keys". For *guest
access* specifically the key must be supplied on every entry, which is the one place Moodle
uses a key as an ongoing credential rather than a one-time gate.

**INFER, and this is the transferable structural point:** Moodle separates "who may pass" (the
key) from "how many may pass" (Max enrolled users), and puts both on the enrolment method
rather than on a code object. It also cannot cap *per group key*, so "this organisation's code
is good for 100 seats" is not expressible in stock Moodle. That gap is exactly the thing a
purpose-built design would have to close.

### Google Classroom class codes

Fetched: [support.google.com/edu/classroom/answer/6020282](https://support.google.com/edu/classroom/answer/6020282),
[.../6020297](https://support.google.com/edu/classroom/answer/6020297).

**SAYS.** Multi-use, one per class. "To join a class, you just need to enter the class code
once. After you join, you don't need to enter the code again." Format: "Class codes are 6 to 8
characters long, and use letters and numbers. They can't have spaces or special symbols." No
expiry documented. No per-code seat allowance; there is a hard class ceiling of 1,000 members
(teachers and students) for Workspace for Education accounts. Identity is a Google Account,
mandatory: "To join a class, you must sign in to Classroom with the correct account." Recovery
is by Google sign-in; the code plays no part after the first use. Teachers can reset invite
codes, after which "previous codes won't work", and can disable them so new students cannot
join.

**INFER.** The reset-and-old-codes-die behaviour is the clearest statement in the survey that a
class code is a *pointer with a valve on it*, disposable and replaceable, never the learner's
identity.

### Canvas self-enrolment

Fetched: [canvas.instructure.com/doc/api/courses.html](https://canvas.instructure.com/doc/api/courses.html),
which exposes `course[self_enrollment]` ("Set to true if the course is self enrollment") and
`course[open_enrollment]`. The API reference as fetched did **not** surface a
`self_enrollment_code` field description, so the code's shape is not confirmed from a
first-party page.

**Snippet only**, from indexed text of the official Instructure guides whose bodies were
unreachable: "Self-enrollment allows a student to sign up for a course using a secret URL or
code"; there are two artefacts, a secret URL of the form
`https://canvas.instructure.com/enroll/E*****A` and, where Canvas authentication is enabled, a
join code used at `/register`; "When users sign up as a student, a join code is required to
access the course. Self enrollment creates the join code"; "Instructors are not notified when a
student self-enrolls"; and "The SIS ID field must be empty for the self-enrollment option to be
available", meaning self-enrolment is mutually exclusive with the course being roster-managed
from the SIS. Sign-up creates a Canvas account with name, email and a password of at least
eight characters. No seat cap was found in anything reachable.

### Microsoft Teams for Education join codes

Fetched: [support.microsoft.com, "Invite students or educators to join with a link or
code"](https://support.microsoft.com/en-us/topic/invite-students-or-educators-to-join-with-a-link-or-code-acb1bd4d-813c-4592-9aa0-ca95528960d9).

**SAYS**, and this is the single clearest multi-use statement in the survey: "Join codes can be
used as many times as you want." A code lets someone "join your team right away. They won't
have to submit a request to join", in contrast to a join link, which routes through a request.
Only a team owner can generate a code. The page says **nothing** about expiry, seat caps or team
size, which is an explicit gap rather than an inference, and it does not state account
requirements. Snippet-level material from the same support family says guests cannot join a team
by link or code, which strongly implies a tenant account, but that is implication, not
statement.

### Kahoot

**All `support.kahoot.com` articles returned HTTP 403.** Everything here is snippet only, from
Google's index of those official pages. `kahoot.com/schools/how-it-works/` fetched cleanly but
says nothing about PINs or accounts.

**Snippet only.** A game PIN is "a temporary number created when a host starts a live game or
assigns one", 6 to 10 digits, multi-use *within one session* and dead afterwards. The cap is a
property of the **host's licence**, not of the code: roughly 10 to 40 participants on free and
basic tiers, 3 players for a free Business user's self-made game, 15 on 360 Express, 2,000 on
360 Pro Max, 5,000 on 360 Pro Ultra, and 10 players in Classic mode for young students under
Kahoot! Go. Identity by default is **nothing**: a nickname, no account, no email. Recovery is
none and none is intended.

**Snippet only, and the most interesting finding in the section.** Kahoot's "Player identifier"
is an organisation-side setting under which "players will be asked to enter their emails or real
names before entering a nickname" so the host can "match player scores to emails, names, or
other parameters", with what is collected fixed by licence type (first name plus last initial
for EDU school/district, email for EDU higher-ed or Business 360 Pro) and identifiers showing
"only ... in reports". **INFER:** Kahoot ships roster-free by default and sells the roster back
as an enterprise feature. The existence of a "2-step Join" article, title readable and body 403,
is Kahoot conceding that a bare PIN is guessable and is not a security boundary.

### Quizlet

**All `help.quizlet.com` articles returned HTTP 403.** Snippet only.

Class join links are multi-use and standing, one per class, with a parallel code path at
`quizlet.com/join`. No joiner cap was found; what is capped is the *creator* (a free account can
create up to eight classes). An account is required for class membership: "To join a class,
you'll need to create an account or log in to your existing account." Invitation by "email
addresses or usernames" shows invitees as pending until accepted, which is a roster in the
plainest sense. One snippet, worth flagging but unverified, says "students can join assignments
with just a link or passcode, without needing to log in", which if accurate is the same two-tier
split Kahoot draws: anonymous for a single activity, account for durable membership.

### Duolingo for Schools

**Every Duolingo surface was unreachable as text** (see the reachability list). The one page that
fetched, [blog.duolingo.com/using-duolingo-in-the-classroom](https://blog.duolingo.com/using-duolingo-in-the-classroom/),
says only "Teachers: make sure to add your students to a classroom at schools.duolingo.com" and
nothing about codes, email or age handling.

**Snippet only**, from `www.duolingo.com/privacy` (official, body unreachable): "Child Users can
create a Duolingo account without using an email address", registering instead "using a username
that is not tied to their real name"; "Duolingo does not collect the child's name, email address,
phone number, or any other personal information"; "The first time Child Users log out, they will
be asked to provide their parent's email address."

**INFER.** Multi-use, capping and recovery for Duolingo for Schools could not be verified and
should not be treated as established. What the privacy snippets do establish, and it is the most
transferable finding in the section, is that Duolingo ships a real **identity-lite account tier**:
username plus password, no email, deliberately not tied to a real name, with an email demanded
only at first logout and demanded from the *parent*. The recovery burden is deferred, not
eliminated, and it is deferred onto a different person.

### Comparison

| Product | Code multi-use? | Capped at N? | Identity the learner ends up with | Recovery |
|---|---|---|---|---|
| Moodle enrolment key | Multi-use, standing gate | Yes, by a **separate** "Max enrolled users" setting on the enrolment method, never by the key, and never per group key | Full Moodle account, email required via self-registration | Log in. Key never re-asked. Optional enrolment expiry and unenrol-inactive decay |
| Google Classroom code | Multi-use, one per class, entered once | No per-code cap. Hard ceiling of 1,000 members per class (Workspace for Education) | Google Account, mandatory | Google sign-in. Teacher can reset (old codes die) or disable |
| Canvas join code / secret URL | Multi-use (snippet only) | None documented in anything reachable | Canvas account created at sign-up: name, email, password | Canvas login (not verified) |
| Teams for Education join code | "Join codes can be used as many times as you want" | Nothing documented. Explicit gap | Tenant account implied (guests excluded), not stated | Microsoft sign-in (inference) |
| Kahoot game PIN | Multi-use within one session, then dead | Yes, by **host licence tier**, never by the code (snippet only) | **Nothing**: a nickname. Player identifier is an org-side upgrade that adds name or email | None. Session-scoped by design |
| Quizlet class link / code | Multi-use, standing link per class | No joiner cap found. Free tier caps the *teacher* at 8 classes | Quizlet account required for class membership | Quizlet login |
| Duolingo for Schools | Not verifiable | Not verifiable | Username-only account, no email required for Child Users, no real name; parent email at first logout | Not verifiable |

**INFER, what the survey actually shows.** Only Kahoot genuinely holds no roster, and it does so
by giving up persistence entirely: a nickname on a session-scoped PIN means there is no roster
because there is no learner, and the moment an organisation wants to know who did what, Kahoot
sells them Player identifier and the roster reappears. Every other product **moves** the roster
rather than removing it. Google, Canvas, Teams and Quizlet all end the join flow with a
platform-held account carrying a real email, so the code was only ever a pointer that saved a
teacher from typing addresses. Moodle is the same, with the honest addition that its key and its
seat cap are two separate settings rather than one code object.

Two ideas are reusable, and they solve different halves. Moodle's is that the cap and the code
should be separate concerns, with "who may pass" as a shared secret and "how many may pass" as an
integer beside it. Duolingo's is that an identity-lite tier is shippable at scale. **No vendor in
this survey ships the combination the proposal needs**, which is an organisation-scoped multi-use
code carrying its own decrementing seat count, redeeming into an account the platform can never
map back to a person. That is not proof it cannot be built. It is evidence that it is not a
well-trodden path, and that the products closest to it either hold the roster (Moodle, Google,
Canvas, Teams, Quizlet) or hold nothing and therefore cannot count returning learners (Kahoot).

---

## 4. Recovery secrets without accounts

### Passkeys: what a Relying Party actually stores

**SAYS**, [W3C Web Authentication Level 3, section 4 Terminology, "Credential Record"](https://www.w3.org/TR/webauthn-3/):
the required items a Relying Party stores per credential are `type`, `id` (the **Credential
ID**), `publicKey`, `signCount`, `transports`, `uvInitialized`, `backupEligible` and
`backupState`. Optional items include the attestation object, the attestation clientDataJSON and
`rpId`.

**SAYS**, [section 4, "Discoverable Credential"](https://www.w3.org/TR/webauthn-3/):

> "A Client-side discoverable Public Key Credential Source, or Discoverable Credential for
> short, is a public key credential source that is discoverable and usable in authentication
> ceremonies where the Relying Party does not provide any credential IDs"

That is the property that matters here: with a discoverable credential the learner signs in
**without typing any identifier at all**, no email, no username, no code. The authenticator
offers the credential and the RP looks it up by credential ID.

**SAYS**, [section 14.6.1, User Handle Contents](https://www.w3.org/TR/webauthn-3/#sctn-user-handle-privacy):

> "User handle values are used to help authenticators determine which public key credential
> source to use, and SHOULD NOT contain personally identifying information."

The fetch also reported a stronger phrasing near the `PublicKeyCredentialUserEntity` dictionary
("the user handle MUST NOT contain personally identifying information"). The two phrasings sit
in different parts of the spec and the normative strength of the second was **not**
independently confirmed in this session. Treat the "SHOULD NOT" of 14.6.1, quoted above, as the
verified one.

**SAYS**, [section 14.6.3, Privacy leak via credential IDs](https://www.w3.org/TR/webauthn-3/#sctn-user-handle-privacy):
credential IDs function as identifiers, and easily guessable credential IDs let an attacker
enumerate valid IDs and mount targeted attacks, so they should be randomised.

**SAYS**, [section 5.4.3, PublicKeyCredentialUserEntity](https://www.w3.org/TR/webauthn-3/#dictionary-user-credential-params):
`id` is a byte sequence of at most 64 bytes identifying the user account, and the RP "SHOULD use
the same id value when the user re-registers an existing account". `name` and `displayName` are
inherited from `PublicKeyCredentialEntity` and are described as a human-readable account
identifier (typically an email address or username) and a user-friendly display name.

**SAYS**, [passkeys.dev, Terminology](https://passkeys.dev/docs/reference/terms/): a passkey is
"The high level, end-user centric term for a FIDO2/WebAuthn Discoverable Credential"; a
device-bound passkey is "A WebAuthn Discoverable Credential that is bound to a single
authenticator"; synced passkeys reach a new device by cloud sync, by backup restoration when a
user sets up a new device, or by Cross-Device Authentication using one device's passkey to sign
in on another.

**Can a passkey give cross-device recovery with NO stored identifier?**

**INFER: no, for two independent reasons.**

1. **Something is always stored server-side, and it is personal information.** The RP *must*
   store the credential record: credential ID and public key at minimum. Section 14.6.3 says
   credential IDs "function as identifiers". Under POPIA s1(c), "any identifying number, symbol
   ... or other particular assignment to the person", and under the `unique identifier`
   definition, a credential ID is personal information as squarely as any other opaque token.
   What a passkey buys is that the identifier need carry **no semantics**: the user handle can be
   64 random bytes, and the spec actively tells you to keep identifying information out of it. A
   passkey seat is therefore *pseudonymous with unusually good hygiene*, not *anonymous*. It
   lands in exactly the same POPIA box as the opaque token in section 1, Q2.
2. **Cross-device recovery is not the platform's to give.** Sync happens in the *credential
   provider*, iCloud Keychain, Google Password Manager, a password manager, not on the platform.
   The learner recovers only if they already hold an account with that provider. For the target
   population that is a real assumption, and it is an identity the platform does not hold but the
   learner must nonetheless have. A device-bound passkey has the same loss mode as an anonymous
   guest account: clear the device, lose the seat.

Two secondary frictions. The spec expects `name` and `displayName` to be populated at
registration (they live in the authenticator's UI and need not be stored by the RP, but something
must be supplied), and `@convex-dev/auth@0.0.80` has no passkey provider (section 2), so this is
a from-scratch WebAuthn integration.

### Signal: PIN and Secure Value Recovery

[support.signal.org's Signal PIN article returned HTTP 403](https://support.signal.org/hc/en-us/articles/360007059792-Signal-PIN)
and could not be read. The engineering post could.

**SAYS**, [Signal blog, "Technology preview for secure value recovery"](https://signal.org/blog/secure-value-recovery/):
the user's passphrase or PIN is stretched with Argon2,
`stretched_key = Argon2(passphrase=user_passphrase, output_length=32)`, and from it an auth token
and a master key are derived. The server holds `(auth_key, c2)` pairs inside an SGX enclave:

> "If we put pairs of (auth_key, c2) inside an enclave and only allow retrieval of the value from
> the enclave by presenting the correct auth_key to the enclave over an encrypted channel, then
> the enclave could enforce a maximum failed guess count."
>
> "if we set the maximum failed guess count to 5, then an attacker who obtained access to the
> service (or the service operator) would only get 5 password guesses rather than an unlimited
> number."

The post does not state what happens when a user forgets the PIN.

**INFER.** The design's whole point is that the operator cannot recover it either: the enclave and
the guess limit exist to make the operator as powerless as an attacker. That is the architectural
shape of a genuine "we cannot know" promise, and it is heavy machinery. A hardware enclave is the
price of a low-entropy human secret that the operator must not be able to brute-force. Note the
cost is only worth paying when the secret protects *content*. Here a secret would protect *a
seat*, and the platform can already see the seat, so the threat model that justifies SGX does not
transfer.

### Bitwarden emergency access

**SAYS**, [bitwarden.com/help/emergency-access](https://bitwarden.com/help/emergency-access/):
a user appoints trusted emergency contacts who can request access; the invitation is valid for
five days; "View" grants read-only access to login items' passwords and attachments; "Takeover"
gives read/write but requires the grantee to set a new master password, which "will replace your
previous master password and remove any two-step login methods that were previously set up";
requests are subject to a grantor-specified wait time and can be rejected; and "anyone with a free
or premium Bitwarden account on the same Bitwarden server can be designated as a trusted emergency
contact."

**INFER.** This is *social* recovery, and it works by requiring a **second identified account**.
It is the opposite of what is wanted here: it recovers you by knowing somebody who knows you.

### BIP-39 mnemonics

**SAYS**, [bitcoin/bips, BIP-0039](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki):
the proposal describes "a mnemonic code or mnemonic sentence, a group of easy to remember words",
and holds that "a mnemonic code or sentence is superior for human interaction compared to the
handling of raw binary or hexadecimal representations of a wallet seed." Entropy is 128 to 256
bits in 32-bit steps; the checksum is "the first ENT / 32 bits of its SHA256 hash", appended
before splitting into 11-bit groups indexed into a wordlist (128 bits gives 12 words, 256 bits
gives 24). Wordlists should use words distinguishable by their first four letters, avoid similar
pairs, and be sorted.

The BIP does **not** state that the mnemonic is the sole means of recovery, and says nothing about
server-side storage. That is a property of wallets, not of this spec, and is said plainly here so
the document is not read as claiming otherwise.

**INFER.** BIP-39's transferable lesson is the human-factors one, not the cryptographic one. If a
learner is handed a personal recovery secret, a short phrase drawn from a curated wordlist is
measurably easier to write down and retype than a random alphanumeric string, and 128 bits is far
more than a course seat needs. The existing voucher code format, `MYC-XXXX-XXXX` with roughly
1.1e12 of entropy per [the vouchers map](../maps/vouchers/map.md), is already in this family.

---

## 5. Post-paid and metered billing

The platform has no invoicing at all today: manual EFT with an operator logging the bank
reference by hand, plus PayFast for cards
([ADR 0026](../../docs/adr/0026-manual-eft-payment-rail.md)).

### Stripe usage-based billing

**SAYS**, [docs.stripe.com/billing/subscriptions/usage-based](https://docs.stripe.com/billing/subscriptions/usage-based),
which opens by steering new work away from itself:

> "Stripe offers two approaches to usage-based billing. Metronome is Stripe's primary
> usage-based billing platform, recommended for all new integrations. Basic usage-based
> billing, built on the Billing Meters API, is a lower-level primitive that remains fully
> supported for existing integrations."
>
> "Unless you're maintaining an existing Billing Meters integration, use Metronome. This
> includes: Starting a new usage-based billing integration from scratch..."

The [implementation guide](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide)
carries a "Not Recommended" banner saying the same thing.

**SAYS.** On the Billing Meters path the minimum is five objects: a Meter
(`POST /v1/billing/meters`), a Product and Price with `recurring[usage_type]=metered` and
`recurring[meter]`, a Customer, a **Subscription**, and meter events
(`POST /v1/billing/meter_events`). The meter event payload "must contain the fields
corresponding to a meter's `customer_mapping.event_payload_key` (default is
`stripe_customer_id`)" ([meter-event/create](https://docs.stripe.com/api/billing/meter-event/create)),
whose prerequisites block requires `createCustomer` with `name` and `email` first. A meter
event's timestamp "Must be within the past 35 calendar days or up to 5 minutes in the
future."

**SAYS.** Stripe does not enforce a hard cap.
[Monitoring docs](https://docs.stripe.com/billing/subscriptions/usage-based/monitor) frame
deprovisioning as the merchant's own workflow reacting to an alert, and warn that "Invoiced
amounts or usage might be slightly higher than the specified thresholds because invoices
aren't issued at the exact moment a specified threshold is reached."

**SAYS.** Credit grants, the obvious fit for "N prepaid seats", do not apply here
([billing-credits](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits)):
"You can only apply credit grants to subscription items that use metered prices and report
usage through Meters", and "You can't apply credit grants to: One-off invoices that weren't
created by a subscription". Also: "You can't offer billing credits as stored value to your
customers."

### Stripe Invoicing, standalone

**SAYS**, [invoicing quickstart](https://docs.stripe.com/invoicing/integration/quickstart):
a one-off invoice with no subscription and no usage plumbing is four calls, `customers.create`
with `email` and `description`, `invoices.create` with `collection_method: 'send_invoice'` and
`days_until_due`, `invoiceItems.create`, `invoices.sendInvoice`. "The `Customer` object
represents the customer purchasing your product. It's required for creating an invoice." And
"When you send an invoice, Stripe emails the invoice to the customer with payment
instructions."

**SAYS.** Finalisation is one-way: "As soon as you send an invoice, Stripe finalizes it. Many
jurisdictions consider finalized invoices a legal document making certain fields unalterable."

**SAYS**, [hosted invoice page](https://docs.stripe.com/invoicing/hosted-invoice-page):
customers can "Download PDF copies of the invoice and receipt", surfaced on the API object as
`hosted_invoice_url` and `invoice_pdf`, with no extra implementation code. But "Invoice URLs
expire 30 days after the due date ... In all cases, the expiration window is never longer than
120 days."

**SAYS**, [invoices/pay](https://docs.stripe.com/api/invoices/pay): `paid_out_of_band` is a
"Boolean representing whether an invoice is paid outside of Stripe. This will result in no
charge being made." That is precisely the shape of EFT-into-a-bank-account reconciliation.

### Stripe availability in South Africa

**SAYS.** `docs.stripe.com/global` returns HTTP 404; the live page is
[stripe.com/global](https://stripe.com/global). On it South Africa appears under **"Extended
network"** alongside Cote d'Ivoire, Ghana, Kenya and Nigeria, whose links go to **Paystack**
pricing and signup pages rather than Stripe signup. **The page gives no definition of
"Extended network" anywhere.** That is a gap in the source, not an inference.

**SAYS**, [Stripe Tax, South Africa](https://docs.stripe.com/tax/supported-countries/africa/south-africa):
"Your business location: Not supported. Your customer location: Supported." Tax type VAT,
registration threshold R200,000 per rolling 12 months, and "You must appoint a tax
representative in South Africa to register for your business."

**Not found:** any doc page stating whether a South African entity can open a Stripe account
under some other arrangement, and no ZAR settlement-currency statement.

### PayFast

`developers.payfast.co.za` is a JavaScript single-page app and a plain fetch returns only the
shell. The documentation content was read out of the site's own application bundle
(`developers.payfast.co.za/js/app.ff4556af.js`), which carries the doc sections as inline data.
Quotes below are verbatim strings from that bundle, which is a first-party artefact but not a
rendered page.

**SAYS.** There is **no invoicing product in the API**. A case-insensitive grep for "invoice"
over the entire developer-docs bundle returns zero hits. The documented sections are Recurring
Billing, Transaction history, Credit card transaction query, Split Payments, PCI Compliance,
Testing and Tools.

**SAYS.** The only post-paid primitive is **tokenization**: "A recurring charge where the
future dates and amounts of payments may be unknown. Payfast will only charge the customer's
card when instructed to do so via the API." It can be set up at R0.00, in which case "the
customer will be redirected to Payfast, where they will input their credit card details and go
through 3D Secure, but no money will be deducted."

**SAYS**, [payfast.io/solutions/invoicing](https://payfast.io/solutions/invoicing/), PayFast
delegates invoicing outright: "We integrate with prominent billing and invoicing platforms such
as Xero, WP Invoice and Invoice Ninja so that you can request and manage payments
effortlessly." The nearest in-house feature,
[Payment Request](https://payfast.io/features/payment-request/), is Dashboard-only and manual:
log in, choose "Send Payment Request", enter buyer email and amount, click Send. No API is
described and it is not presented as an invoice.

**SAYS.** Payment method codes in the bundle include `ef` EFT, `nd` Nedbank Direct EFT, `cc`,
`dc`, `cp` Capitec Pay, `pf` Payflex and others. **No VAT or tax fields of any kind appear in
the developer docs.** PayFast is a payment collector, not a tax-document issuer.

### South African tax invoice minimum

**SAYS**, first-party, [SARS, Tax Invoices](https://www.sars.gov.za/businesses-and-employers/government/tax-invoices/).
A full tax invoice must contain: the words "Tax Invoice", "VAT Invoice" or "Invoice"; the name,
address and VAT registration number of the supplier; the name, address and, where the recipient
is a vendor, the recipient's VAT registration number; a serial number and date of issue; an
accurate description of the goods or services; the quantity or volume supplied; and the value
of the supply, the amount of tax charged and the consideration for the supply. Thresholds and
timing, quoted: "A business is required to issue a full tax invoice when the price is more than
R5 000"; a vendor "may issue an abridged tax invoice when the consideration for the supply is
R 5 000 or less"; "If the consideration for the supply is R50 or less, a tax invoice is not
required"; and "a tax invoice must be issued (i.e. 21 days from the time the supply was made)".

Two caveats stated rather than glossed. The underlying law is s20 of the VAT Act 89 of 1991 and
the SARS **guidance page** was read, not the Act; a statutory-grade citation should confirm
against s20 directly. And the SARS "Checklist: Value-Added Tax (VAT) Invoices" PDF downloaded
but could not be parsed in this environment, so the abridged field list is not reproduced.

**INFER:** a tax invoice can only be issued by a registered vendor. If the platform is not
VAT-registered it issues an *invoice*, not a *tax invoice*, and must carry neither a VAT number
nor a VAT line.

### The minimum viable mechanism

**INFER, stated as evidence rather than as a recommendation.** Every element a post-paid bulk
deal needs already exists in the platform or is a few lines of application code:

1. **A counter.** A redemption count per code. Stripe's meter is a sum aggregation over events
   keyed by a customer id; this is a count over rows keyed by an org id. The platform has to
   record redemptions to enforce the cap at all, so the meter is free.
2. **A cap and a stop switch.** `capacity: N` plus an `active` boolean flipped when the
   agreement ends. Note that Stripe explicitly does **not** supply this: its usage alerts leave
   "Deprovision access" to the merchant's own workflow and warn that thresholds overshoot. The
   enforcement lives in the app whatever vendor is chosen.
3. **A document.** SARS's list is seven fields plus a serial number and a date, issued within
   21 days of supply. That is a template and a monotonic counter, not a product.
4. **Email plus the existing manual EFT reconciliation.** The invoice names the account and a
   reference; the operator matches the bank reference exactly as they do today. No new payment
   rail.

The only genuinely new capability is (3). What each vendor would add in obligation:

- **Stripe Billing Meters:** a Customer or v2 Account per billable party before any usage can be
  recorded (new personal information crossing a border, see s72); a mandatory Subscription even
  though the deal is not one; a 35-day backfill ceiling that a longer agreement cannot be
  reconciled inside; and Stripe's own docs telling you not to build it, pointing instead at
  Metronome, which is a *second* platform.
- **Stripe Invoicing:** materially lighter, and its `paid_out_of_band` story matches the existing
  reconciliation exactly. It adds a Customer object per organisation, irreversible finalisation,
  hosted URLs that expire (so PDFs must be archived locally anyway), and a serial series outside
  the platform's control. **It is gated on the account-country question**, which the primary
  sources indicate is currently unresolved for a South African entity.
- **PayFast:** adds nothing toward invoicing. Its only post-paid primitive requires the
  organisation to enter a card and pass 3D Secure at the *start* of the agreement, which is a
  materially different commercial ask from "we invoice you at the end", and a card rail rather
  than EFT.

**INFER.** Post-paid is the cheapest part of this proposal, and it is nearly independent of the
identity question. A counter, a boolean and a template do it. Nothing in section 5 argues for or
against a shared code; it argues that billing should not be the reason the decision goes either
way.

---

## What this means for the decision

Four identity shapes were researched. Set against the POPIA finding (section 1) and the ADR
0029 promise, they come out like this. This is evidence, not a recommendation to adopt any of
them.

### The constraint that binds all four

A shared code capped at N seats **requires** a durable per-person identifier bound to the batch,
or the cap cannot be counted (section 0). Under POPIA that identifier is personal information
whatever form it takes: s1(c) covers "any identifying number, symbol ... or other particular
assignment to the person", the separate `unique identifier` definition describes it almost word
for word, and `de-identify` fails because the identifier is linkable by a reasonably foreseeable
method to progress, certificates and a device. If the batch is a political party's, that record
is then within s26 (section 1, Q2).

**So the choice below is not between "identified" and "anonymous". All four options are
pseudonymous.** They differ in how much semantics the identifier carries, how the learner gets
back to it, and how visible the tradeoff is to the person making it.

The prior art says the same thing from the other side (section 3): every product that gives a
learner a durable seat holds an identity for them, and the one product that holds nothing
(Kahoot) cannot count returning learners, because its PIN dies with the session.

### The four options

**1. Nameless device-bound guest (an anonymous Convex Auth account).**
POPIA position: a `users` row with no email, plus an Entitlement. Personal information, but the
identifier carries no semantics and there is nothing to disclose to anybody. Under a *shared
capped* code the row must reference the batch to count the seat, which is the s26 link; under
ADR 0029's single-use codes it does not, which is why the current design is clean.
Recovery: none. Clear the browser, lose the seat, and nobody can restore it. Ticket 11 already
names this and requires the page to say so out loud.
Build cost: two verified traps in `convex/auth.ts` (section 2), the second of which does not
have the fix the ticket proposes on the Google path.

**2. Personal recovery code, shown once (BIP-39-shaped or `MYC-XXXX-XXXX`-shaped).**
POPIA position: identical to (1). A hash server-side is still an identifier assigned to the
person.
Recovery: works across devices, and requires nothing of the learner but keeping a slip of paper.
BIP-39 (section 4) argues the human-factors case for a short wordlist phrase over a random
string; the entropy needed here is trivial next to 128 bits.
The catch, and ADR 0029 already ruled on a version of it: a forwardable secret drains paid-for
seats to non-members, which is exactly why "One code with N uses" sits in that ADR's
"Considered and rejected", with the note that "There is no refund rail to make the buyer whole".
A *personal* recovery code is not the same as a shared code, but it is one forward away from
being one.

**3. Passkey (WebAuthn discoverable credential).**
POPIA position: the best hygiene of the four. The spec tells you to keep identifying information
out of the user handle (14.6.1) and to randomise credential IDs (14.6.3), so the stored
identifier can be 64 random bytes with no semantics whatever. It is still personal information:
14.6.3 itself says credential IDs "function as identifiers", which lands them in s1(c).
Recovery: real, and not the platform's to give. Sync happens in iCloud Keychain, Google Password
Manager or a password manager, so the learner recovers only if they already hold an account with
that provider. A device-bound passkey has exactly the loss mode of option (1).
Build cost: highest of the four. `@convex-dev/auth@0.0.80` ships no passkey provider (section 2),
so this is a from-scratch WebAuthn integration on top of a library that would then be doing
account linking for it.

**4. Name plus PIN.**
POPIA position: the worst of the four, and the only one that is worse for a *legal* reason rather
than an engineering one. A stored name beside a party's batch is s1(h) plus s26 directly, which
is question Q1 of section 1 answered in the affirmative. It is also the only option whose
identifier is *meaningful to a human reading the database*, which is what "the operator has the
database" (ticket 11) means in practice.
Recovery: works across devices and needs no paper, which is the reason it keeps getting proposed.
But a PIN's entropy is low enough that the name is doing the identifying work, and a name is what
POPIA is about.

### Against the ADR 0029 promise

ADR 0029's promise is "a redemption records that it happened, and nothing about who", and the
operator chose it over the weaker "the organisation cannot see it" deliberately. Three findings
bear on whether a shared code can keep that promise:

- **POPIA did not require it.** s27(1)(a) permits processing special personal information with
  the data subject's own voluntary, specific and informed consent, and s31 is the party's
  exception rather than the platform's. "Recorded with the learner's consent" was legally
  available and was not chosen. That makes the promise a product commitment, which means changing
  it is a product decision needing a superseding ADR, not a compliance question.
- **A shared capped code cannot keep the promise as literally written.** The counter needs to know
  who has already been counted. Options (1) to (4) all record something about who, in the sense
  the ADR means. The one thing that is genuinely not personal information is an aggregate count,
  and an aggregate count cannot distinguish a returning learner from a new one.
- **Ticket 11's threat model already forecloses the obvious dodge.** Storing progress *on the
  code* was ruled out because the Seller holds the code list and could then map codes to people,
  and because "the threat model in ADR 0029 includes the operator, and the operator has the
  database". A shared code makes that worse, not better: one code that the Seller distributed is
  one code the Seller knows the recipients of.

### What is not in tension

Post-paid billing (section 5) does not depend on any of this. A counter, a stop switch, a
template and the existing manual EFT reconciliation do it, and every vendor option surveyed adds
obligation rather than removing work, with Stripe additionally gated on an unresolved
account-country question for a South African entity.
