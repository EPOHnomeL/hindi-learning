# 04 — Certificate + EmblemSection → next-intl

Wire `src/app/_components/Certificate.tsx`. New namespace `Certificate`.

Cover: card copy (Certificate of Completion, This certifies that, has completed
the course, Issued by, Date issued) both card variants; lesson-count with ICU
plural `{count, plural, ...}`; claim/view controls; CertificateLinkActions (share,
Copy/Copied, open-public); CertificateBody (name placeholder, hint, Create/Creating);
CertificateDialog (titles, Close); CompletionCelebration; EmblemSection (heading,
body, Glyph label+placeholder, Save, upload copy, Choose image, updated note);
error fallbacks; share text with `{courseTitle}`/`{courseUrl}`.

Keep "My Course" brand fallback as-is (proper noun).

Done when: certificate surfaces render in the active locale; keys in en.json; tsc clean.
