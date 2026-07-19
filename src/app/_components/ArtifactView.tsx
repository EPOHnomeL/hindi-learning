"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CertificateControl } from "./Certificate";
import { LockedPane, Paygate } from "./Paygate";
import { useBuyMarker, useEditionLang, withLang } from "./editionUrl";
import { buildEditDoc, buildSrcDoc, replaceBodyInner, themeMessage, type Theme } from "./lessonSrcDoc";
import { Markdown } from "./MarkdownView";
import { MarkdownResourceDialog } from "./ResourceItem";
import { resolveArtifactClick, resourceOpenMode } from "./readerDerive";
import { ReaderSkeleton } from "./ui";
import { useTheme } from "./ThemeContext";
import { useTenant } from "./TenantContext";
import { useHideOnScroll } from "./useHideOnScroll";

// Mirror of the server's stale threshold (convex/routine.ts STALE_MS): a run
// stuck "generating" past this is treated as crashed and offered for retry.
const STALE_MS = 10 * 60 * 1000;

// Mirror of routine.ts DAY_MS: the on-demand cap is one manual fire per user per
// day. This mirror is per-Topic (the viewed course's own fire), a proactive hint
// for the common single-course case; the authoritative per-user cap (across all a
// learner's courses) is enforced server-side and reflected reactively via the
// fire result below. The Admin is exempt (mirrors the server-side bypass) —
// otherwise the button stays hidden behind "Generated today" even though a manual
// fire would be accepted.
const MANUAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function ArtifactView({
  kind,
  artifactKey,
  topicSlug,
  isFrontier,
  readOnly,
  canEdit,
  courseCompleted = false,
  nextLessonKey,
  dir,
  contentLang,
}: {
  kind: "lesson" | "reference";
  artifactKey: string;
  topicSlug: string;
  isFrontier: boolean;
  // True for a shared Viewer: hide the owner-only controls (quiz-response
  // recording, asking Questions, next-lesson authoring). Progress is NOT gated by
  // this — a Viewer tracks their own (see setProgress). Reads stay live.
  readOnly: boolean;
  // Server-computed per-Edition edit capability (ADR 0020): owner, or an Editor
  // of the served language. Gates ONLY the hover-pencil — an Editor is otherwise
  // a Viewer (readOnly stays true for them), so no other control is affected.
  canEdit: boolean;
  // True once the Topic is `completed` (ADR 0015): authoring has stopped, so the
  // reader never offers "Generate next lesson" even on the completed Frontier.
  courseCompleted?: boolean;
  // The next lesson's key in seq order (null on the last lesson). A read-only
  // Viewer gets a "Next lesson →" link in place of the owner's controls.
  nextLessonKey?: string | null;
  // The served Edition's direction + language (course-translation), baked onto
  // the artifact iframe so a translated Edition renders RTL/localised.
  dir?: "ltr" | "rtl";
  contentLang?: string;
}) {
  if (kind === "reference")
    return <ReferenceView refKey={artifactKey} topicSlug={topicSlug} canEdit={canEdit} dir={dir} contentLang={contentLang} />;
  return (
    <LessonView
      lessonKey={artifactKey}
      topicSlug={topicSlug}
      isFrontier={isFrontier}
      readOnly={readOnly}
      canEdit={canEdit}
      courseCompleted={courseCompleted}
      nextLessonKey={nextLessonKey ?? null}
      dir={dir}
      contentLang={contentLang}
    />
  );
}

// Fills its flex parent; min height keeps it usable when the column is short
// (e.g. stacked on mobile). `theme`, when given, app-themes the artifact: the
// initial theme is baked into srcDoc and later changes are pushed live via
// postMessage so a toggle re-skins without reloading (ADR 0011). `themeCss`
// injects the dark palette too — set for references, which don't ship their own.
// Resolve a read seam's content body to the HTML string to render. An inline
// `html` body (transition rows) is returned as-is; a `contentUrl` (content blob,
// .scratch/html-blob-storage) is fetched — `fetch` honours the HTTP cache, so a
// re-open/refresh of an already-read body is served from disk with no network.
// Returns `undefined` while the query is loading OR a blob fetch is in flight
// (caller shows a loading state), `null` when the query found nothing or the
// fetch failed, and the HTML string once ready.
export function useContentHtml(
  body: { html?: string; contentUrl?: string } | null | undefined,
): string | null | undefined {
  const url = body?.contentUrl;
  // Key the fetched value to the URL it belongs to. On navigation `url` changes
  // and this render happens BEFORE the effect re-runs, so a bare `fetched` would
  // briefly return the previous item's body. Gating on `fetched.url === url`
  // makes a mismatch read as "loading" until the new fetch lands.
  const [fetched, setFetched] = useState<{ url: string; html: string | null }>();
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((html) => live && setFetched({ url, html }))
      .catch(() => {
        if (live) setFetched({ url, html: null });
      });
    return () => {
      live = false;
    };
  }, [url]);
  if (body == null) return body; // undefined: query loading · null: not found
  if (url) return fetched?.url === url ? fetched.html : undefined; // undefined: fetching/stale · string: ready · null: error
  return body.html ?? ""; // translation still stored inline
}

// The Topic's Resources, in the shape both reader shells already hold (authed
// `listResources`, Guest `publicEdition`). Threaded in so a Resource link inside a
// lesson resolves to a fresh signed `url` at click time (rich-media/11).
export type ResourceLink = { id: string; filename: string; kind: "file" | "url"; url: string | null };

export function Frame({
  html,
  withBridge,
  theme,
  themeCss,
  dir,
  lang,
  resources,
}: {
  html: string;
  withBridge: boolean;
  theme?: Theme;
  themeCss?: boolean;
  // The served Edition's text direction + language, baked onto <html> so a
  // translated lesson renders RTL/localised (course-translation).
  dir?: "ltr" | "rtl";
  lang?: string;
  // The reader's in-bundle Resource list, so a `/courses/<slug>/resources/<id>`
  // link opens the Resource with sidebar parity (rich-media/11). Absent → Resource
  // links are inert (graceful no-op), which is also what a withheld id resolves to.
  resources?: ResourceLink[];
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  // An uploaded Markdown Resource clicked from a lesson opens in the same in-app
  // dialog the sidebar uses (resourceOpenMode → "dialog").
  const [mdResource, setMdResource] = useState<{ title: string; url: string } | null>(null);
  // Read theme via a ref so changing it does NOT rebuild srcDoc (which would
  // reload the iframe, losing scroll + answered-quiz state). The bake only needs
  // the value at build time; the effect below handles live changes.
  const themeRef = useRef(theme);
  themeRef.current = theme;
  // The tenant palette (issue 13) is baked into srcDoc, unlike the light/dark theme
  // (pushed live via postMessage). It's flash-tolerant per decision 03 #6: the
  // iframe only renders once `html` has loaded, by which point this client query has
  // resolved too — and a tenant's palette never changes mid-session. `null`/default
  // site → undefined → no override. Convex returns a stable ref so the memo is quiet.
  const tenantPalette = useTenant()?.theme;
  const srcDoc = useMemo(
    () => buildSrcDoc(html, { quiz: withBridge, theme: themeRef.current, themeCss, dir, lang, tenantPalette }),
    [html, withBridge, themeCss, dir, lang, tenantPalette],
  );

  // Push theme changes into the already-loaded iframe (no reload). Also fires
  // when srcDoc changes (lesson switch) so a freshly loaded frame is in sync.
  useEffect(() => {
    if (!theme) return;
    iframeRef.current?.contentWindow?.postMessage(themeMessage(theme), "*");
  }, [theme, srcDoc]);

  // On mobile the iframe is sized to its content so the whole page scrolls as one
  // surface; on desktop it fills its column and scrolls internally. The measured
  // height is ignored above md (the style is only applied while `mobile`).
  const [mobile, setMobile] = useState(false);
  const [contentH, setContentH] = useState<number | null>(null);
  useEffect(() => setContentH(null), [srcDoc]);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data as { __lesson?: boolean; type?: string; height?: unknown };
      if (d?.__lesson && d.type === "height" && typeof d.height === "number") setContentH(d.height);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Links inside the sandboxed artifact can't navigate the app themselves (no
  // allow-top-navigation), so the nav bridge forwards each click here. Internal
  // links route through the app (SPA nav, no full reload); everything else opens
  // in a new tab so the lesson stays put. Only messages from THIS iframe count.
  useEffect(() => {
    function onNav(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { __lesson?: boolean; type?: string; href?: unknown; newTab?: unknown };
      if (!(d?.__lesson && d.type === "navigate" && typeof d.href === "string")) return;
      let url: URL;
      try {
        url = new URL(d.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      const internal = url.origin === window.location.origin;
      if (internal) {
        const action = resolveArtifactClick(url.pathname, window.location.pathname);
        if (action.kind === "resource") {
          // Resolve the id against the reader's in-bundle Resources → a fresh signed
          // url. A withheld (paid Preview) or deleted Resource isn't in the list, so
          // this is a graceful no-op (rich-media/11).
          const res = resources?.find((r) => r.id === action.id);
          if (!res?.url) return;
          if (resourceOpenMode(res.filename, res.kind) === "dialog") setMdResource({ title: res.filename, url: res.url });
          else window.open(res.url, "_blank", "noopener,noreferrer");
          return;
        }
        const path = action.path + url.search + url.hash;
        if (d.newTab) window.open(path, "_blank", "noopener,noreferrer");
        else router.push(path);
      } else {
        window.open(d.href, "_blank", "noopener,noreferrer");
      }
    }
    window.addEventListener("message", onNav);
    return () => window.removeEventListener("message", onNav);
  }, [router, resources]);

  // Full-bleed on mobile (edge-to-edge, no side border/rounding); a bordered card
  // that fills and scrolls internally on desktop.
  return (
    <>
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={mobile && contentH ? { height: contentH } : undefined}
        className={`w-full border-y border-line bg-card md:min-h-[60vh] md:flex-1 md:rounded-xl md:border ${contentH ? "" : "min-h-[60vh]"}`}
      />
      {mdResource && (
        <MarkdownResourceDialog title={mdResource.title} url={mdResource.url} onClose={() => setMdResource(null)} />
      )}
    </>
  );
}

function LessonView({
  lessonKey,
  topicSlug,
  isFrontier,
  readOnly,
  canEdit,
  courseCompleted,
  nextLessonKey,
  dir,
  contentLang,
}: {
  lessonKey: string;
  topicSlug: string;
  isFrontier: boolean;
  readOnly: boolean;
  canEdit: boolean;
  courseCompleted: boolean;
  nextLessonKey: string | null;
  dir?: "ltr" | "rtl";
  contentLang?: string;
}) {
  const { theme } = useTheme();
  const lang = useEditionLang();
  const buyMarker = useBuyMarker();
  const navHidden = useHideOnScroll();
  const lesson = useQuery(api.content.getLesson, { topicSlug, key: lessonKey, lang: lang ?? undefined });
  // The Topic's Resources, so a Resource link in the lesson opens with sidebar
  // parity (rich-media/11). Same query the sidebar holds — deduped by Convex.
  const resources = useQuery(api.resources.listResources, { topicSlug });
  // Same subscription CourseShell holds (deduped by Convex), for the caller's
  // access level + the Edition's price. A `preview` caller (paid marketplace, ADR
  // 0016) holds no access: locked Lessons show the paygate, and they track no
  // Progress — so the open/complete writes below are gated off for them.
  const header = useQuery(api.content.courseHeader, { topicSlug, lang: lang ?? undefined });
  const preview = header?.role === "preview";
  const html = useContentHtml(lesson);
  const progress = useQuery(api.capture.myProgress, { topicSlug });
  const recordResponse = useMutation(api.capture.recordResponse);
  const setProgress = useMutation(api.capture.setProgress);
  const editLesson = useAction(api.content.editLesson);
  const editTranslatedLesson = useAction(api.content.editTranslatedLesson);
  const [editing, setEditing] = useState(false);

  // The caller's own completion — an owner's, or a Viewer's own on a shared course.
  const completed = (progress ?? []).some((p) => p.lessonKey === lessonKey && p.status === "completed");

  // In-place prose edit (course-content-editing / ADR 0020). Editing the source
  // (English) edition patches the Lesson blob (`editLesson`); editing a translated
  // Edition patches that Edition's `translations` row (`editTranslatedLesson`),
  // leaving the source untouched. Both guard the quiz structure server-side — the
  // real control; `canEdit` (server, per-Edition) only hides the affordance from
  // those who can't edit this Edition (Viewers, Guests, an Editor of another lang).
  const isSource = lang == null || lang === "en";

  useEffect(() => {
    // Owner or Viewer: opening a lesson marks it opened in the caller's own
    // Progress. A `preview` caller holds no Progress (the write would be refused),
    // so skip it — gated once the header resolves the role.
    if (lesson && header && header.role !== "preview") void setProgress({ topicSlug, lessonKey, status: "opened" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.key, header?.role]);

  useEffect(() => {
    if (readOnly) return; // Viewers' quiz attempts aren't recorded against the owner.
    function onMessage(e: MessageEvent) {
      const d = e.data as { __lesson?: boolean; type?: string; quizId?: string; answer?: unknown; correct?: unknown };
      if (d?.__lesson && d.type === "response" && d.quizId) {
        void recordResponse({ topicSlug, lessonKey, quizId: d.quizId, answer: String(d.answer ?? ""), correct: Boolean(d.correct) });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [topicSlug, lessonKey, recordResponse, readOnly]);

  if (lesson === undefined || html === undefined) return <ReaderSkeleton />;
  if (lesson === null) return <p className="text-soft">Lesson not found.</p>;
  if (html === null) return <p className="text-soft">Couldn’t load this lesson. Try refreshing.</p>;

  // Paid marketplace: a locked Lesson (past the free Preview on a paid Edition the
  // caller doesn't hold) shows the paygate in place of the content — never a blank
  // pane. The title still renders so the reader knows what they'd unlock.
  if (lesson.locked) {
    return (
      <LockedPane title={lesson.title}>
        <Paygate
          kind="lesson"
          paywall={header?.paywall ?? null}
          courseTitle={header?.title}
          topicSlug={topicSlug}
          lang={lang ?? "en"}
          autoOpenBuy={buyMarker}
        />
      </LockedPane>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:h-full md:flex-row">
      {/* Lesson column — fills the available height on desktop; grows with content on mobile. */}
      <div className="flex min-h-0 flex-1 flex-col gap-0 md:gap-3">
        {/* Title + actions: a sticky bar under the mobile header; inline on desktop.
            Rises to the top edge in step with the header as it hides on scroll. */}
        <div
          className={`sticky z-20 flex items-center justify-between gap-3 border-b border-line bg-paper px-3 py-2 transition-[top] duration-300 md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 ${
            navHidden ? "top-0" : "top-12"
          }`}
        >
          <h2 className="min-w-0 truncate text-lg font-semibold">{lesson.title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {/* Authoring is owner-only and stops once the course is completed
                (ADR 0015): no "Generate next lesson" on a finished course. */}
            {!readOnly && !courseCompleted && isFrontier && completed && (
              <NextLessonButton topicSlug={topicSlug} frontierKey={lessonKey} />
            )}
            {/* On a completed course, offer the Certificate (claim / view) in its
                place — for owner and Viewer alike. Self-hides until eligible. */}
            {courseCompleted && <CertificateControl topicSlug={topicSlug} />}
            {/* Mark complete writes the caller's own Progress — owner or Viewer.
                A `preview` caller holds no Progress, so it's hidden for them. */}
            {!preview && (
              <button
                onClick={() => void setProgress({ topicSlug, lessonKey, status: "completed" })}
                disabled={completed}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  completed
                    ? "cursor-default border-accent2 bg-accent2 text-white"
                    : "border-accent text-accent hover:bg-hi"
                }`}
              >
                {completed ? "✓ Completed" : "Mark complete"}
              </button>
            )}
            {/* A Viewer also gets plain navigation to the next lesson. */}
            {readOnly && nextLessonKey && (
              <Link
                href={withLang(`/courses/${topicSlug}/lessons/${nextLessonKey}`, lang)}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent/90"
              >
                Next lesson →
              </Link>
            )}
          </div>
        </div>
        {/* The pencil rides over the lesson on hover (owner + source edition). The
            iframe is a descendant, so hovering the lesson body counts as hovering
            the group and reveals it; focus reveals it for keyboard users. */}
        <div className="group relative flex min-h-0 flex-1 flex-col">
          <Frame html={html} withBridge theme={theme} dir={dir} lang={contentLang} resources={resources} />
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit this lesson"
              title="Edit this lesson"
              className="absolute right-3 top-3 z-10 rounded-lg border border-line bg-card/90 px-2.5 py-1.5 text-sm text-accent opacity-100 shadow-sm backdrop-blur transition-opacity hover:bg-hi focus:opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              ✎ Edit
            </button>
          )}
        </div>
        {canEdit && editing && (
          <ContentEditor
            topicSlug={topicSlug}
            html={html}
            theme={theme}
            dir={dir}
            lang={contentLang}
            label="lesson"
            onClose={() => setEditing(false)}
            commit={(storageId) =>
              isSource
                ? editLesson({ topicSlug, key: lessonKey, storageId })
                : editTranslatedLesson({ topicSlug, key: lessonKey, lang: lang!, storageId })
            }
          />
        )}
        {/* Mobile: ask + answers inline right under the lesson — reliably reached by
            scrolling, no slide-up trigger. Desktop uses the side column instead.
            Hidden for a `preview` caller: Q&A is past the paygate. */}
        {!preview && (
          <div className="p-3 md:hidden">
            <QuestionBox topicSlug={topicSlug} lessonKey={lessonKey} variant="inline" readOnly={readOnly} />
          </div>
        )}
      </div>
      {/* Desktop: persistent ask column on the right (past the paygate for preview). */}
      {!preview && (
        <aside className="hidden shrink-0 md:block md:w-80 md:overflow-y-auto">
          <QuestionBox topicSlug={topicSlug} lessonKey={lessonKey} readOnly={readOnly} />
        </aside>
      )}
    </div>
  );
}

// The owner's in-place prose editor (course-content-editing). A modal holding an
// edit iframe that renders the item with its authored CSS/layout — the same
// visual surface the reader shows, minus the reader's bridge scripts. The iframe
// is `sandbox="allow-same-origin"` (no allow-scripts), so the item's own scripts
// stay inert and the DOM matches the authored source; the parent turns on
// `designMode` to make it editable and reads `body.innerHTML` back on save. The
// edited body is spliced into the authored document (`replaceBodyInner`), uploaded
// as a new content blob, and handed to `commit` — the owner-guarded write path for
// the item's kind (a Lesson's rejects a quiz-structure change; a Reference's has
// no guard). Any rejection message is surfaced inline. Shared by Lessons and
// References; the caller supplies the kind-specific `commit`.
function ContentEditor({
  topicSlug,
  html,
  theme,
  themeCss,
  dir,
  lang,
  label,
  onClose,
  commit,
}: {
  topicSlug: string;
  html: string;
  theme: Theme;
  // Inject the dark palette for items that don't ship their own (References) —
  // display-only, mirrors the reader Frame's `themeCss`.
  themeCss?: boolean;
  // The served Edition's direction/language, for editing a translated Lesson with
  // the right RTL/localised presentation (display-only, mirrors the reader Frame).
  dir?: "ltr" | "rtl";
  lang?: string;
  label: string;
  onClose: () => void;
  commit: (storageId: Id<"_storage">) => Promise<unknown>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const generateUploadUrl = useMutation(api.content.generateEditUploadUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bake theme/dir/lang for display only; the read-back takes body content, not
  // the <html> tag, so none of it reaches the saved HTML.
  const srcDoc = useMemo(() => buildEditDoc(html, { theme, themeCss, dir, lang }), [html, theme, themeCss, dir, lang]);

  useEffect(() => dialogRef.current?.showModal(), []);

  async function save() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    setSaving(true);
    setError(null);
    try {
      const edited = replaceBodyInner(html, doc.body.innerHTML);
      const url = await generateUploadUrl({ topicSlug });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/html" }, body: edited });
      if (!res.ok) throw new Error("Upload failed — please try again.");
      const { storageId } = (await res.json()) as { storageId: string };
      // The write path may reject (e.g. a Lesson's quiz-structure guard) — show it.
      await commit(storageId as Id<"_storage">);
      onClose(); // live for every reader on the next reactive tick — no publish step.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto flex h-[90vh] w-[96vw] max-w-4xl flex-col rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="min-w-0 truncate text-base font-semibold text-ink">Edit {label}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {/* allow-same-origin (no allow-scripts): editable via designMode, lesson
          scripts inert, contentDocument readable back by the same-origin parent. */}
      <iframe
        ref={iframeRef}
        sandbox="allow-same-origin"
        srcDoc={srcDoc}
        onLoad={() => {
          const doc = iframeRef.current?.contentDocument;
          if (doc) doc.designMode = "on";
        }}
        className="min-h-0 flex-1 bg-card"
      />
      {error && (
        <p className="border-t border-line px-5 py-3 text-sm text-danger">{error}</p>
      )}
    </dialog>
  );
}

// Fires the next-lesson Routine on demand (ADR 0008). Only rendered on the
// completed Frontier. It reflects the lock so a press can't double-fire and a
// crashed run eventually offers a retry; the new lesson arrives live (Convex
// subscription), at which point this lesson is no longer the Frontier and the
// button unmounts.
function NextLessonButton({ topicSlug, frontierKey }: { topicSlug: string; frontierKey: string }) {
  const gen = useQuery(api.routine.generationStatus, { topicSlug });
  const amAdmin = useQuery(api.whitelist.amIAdmin);
  const requestNext = useAction(api.routine.requestNextLesson);
  const [pending, setPending] = useState(false);
  // Set when a fire comes back rate-limited — i.e. the per-user daily cap was hit
  // on another course, which the per-Topic mirror below can't see ahead of time.
  const [capped, setCapped] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const status = gen?.status ?? "idle";
  const generating = status === "generating";

  // Tick while generating so a crashed run crosses the stale threshold in the UI.
  useEffect(() => {
    if (!generating) return;
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, [generating]);

  const stale = generating && gen?.startedAt != null && now - gen.startedAt > STALE_MS;
  const caughtUp = status === "caughtUp" && gen?.frontierKey === frontierKey;
  // The Admin bypasses the cooldown (mirrors tryAcquireGeneration). While amAdmin
  // is still loading (undefined) we treat the caller as non-Admin, so the gate
  // only relaxes once we've confirmed they're the Admin.
  const rateLimited =
    amAdmin !== true && gen?.lastManualFireAt != null && now - gen.lastManualFireAt < MANUAL_COOLDOWN_MS;

  async function fire() {
    setPending(true);
    try {
      const res = await requestNext({ topicSlug });
      // A fire blocked by the per-user daily cap comes back rate-limited (it never
      // throws), so reflect it — the learner has already used today's on-demand
      // lesson, possibly on a different course.
      if (res && !res.fired && res.reason === "rate-limited") setCapped(true);
    } finally {
      setPending(false);
    }
  }

  if (generating && !stale) {
    return <span className="animate-pulse text-sm text-soft">Generating next lesson…</span>;
  }
  if (caughtUp) {
    return (
      <span className="text-sm text-accent2" title="Your teacher has nothing new queued yet.">
        ✨ All caught up
      </span>
    );
  }
  if ((rateLimited || capped) && status !== "failed") {
    return (
      <span className="text-sm text-soft" title="The daily schedule will continue authoring — this caps on-demand runs to one per day.">
        ✓ Generated today
      </span>
    );
  }

  const label = status === "failed" ? "Retry" : stale ? "Still working — retry" : "Generate next lesson →";
  return (
    <div className="flex items-center gap-2">
      {status === "failed" && gen?.error && (
        <span title={gen.error} className="text-xs text-soft">
          generation failed
        </span>
      )}
      <button
        onClick={() => void fire()}
        disabled={pending}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Starting…" : label}
      </button>
    </div>
  );
}

function ReferenceView({
  refKey,
  topicSlug,
  canEdit,
  dir,
  contentLang,
}: {
  refKey: string;
  topicSlug: string;
  // Server per-Edition edit capability (ADR 0020). References are English-source
  // only, so the pencil is further gated to the source Edition below.
  canEdit: boolean;
  dir?: "ltr" | "rtl";
  contentLang?: string;
}) {
  const { theme } = useTheme();
  const lang = useEditionLang();
  const buyMarker = useBuyMarker();
  const navHidden = useHideOnScroll();
  const ref = useQuery(api.content.getReference, { topicSlug, key: refKey, lang: lang ?? undefined });
  const header = useQuery(api.content.courseHeader, { topicSlug, lang: lang ?? undefined });
  const html = useContentHtml(ref);
  // Resource links work inside a Reference body too (rich-media/11).
  const resources = useQuery(api.resources.listResources, { topicSlug });
  const editReference = useMutation(api.content.editReference);
  const [editing, setEditing] = useState(false);
  // Editable by the owner or an English-edition Editor (server `canEdit`), and
  // only on the source (English) edition — `editReference` patches the source
  // Reference (translated-Reference editing is out of scope). References are
  // mutable (ADR 0003), so the save takes the write path with no quiz guard.
  const canEditRef = canEdit && (lang == null || lang === "en");
  if (ref === undefined || html === undefined) return <ReaderSkeleton aside={false} />;
  if (ref === null) return <p className="text-soft">Reference not found.</p>;
  if (html === null) return <p className="text-soft">Couldn’t load this reference. Try refreshing.</p>;
  // Paid marketplace: References sit entirely past the free Preview, so a `preview`
  // caller gets the paygate here (the reader returns `locked` on a paid Edition).
  // A locked body is served as html:"" so the guards above pass to here.
  if (ref.locked) {
    return (
      <LockedPane title={ref.title}>
        <Paygate
          kind="reference"
          paywall={header?.paywall ?? null}
          courseTitle={header?.title}
          topicSlug={topicSlug}
          lang={lang ?? "en"}
          autoOpenBuy={buyMarker}
        />
      </LockedPane>
    );
  }
  return (
    <div className="flex flex-col gap-0 md:h-full md:gap-3">
      <h2
        className={`sticky z-20 truncate border-b border-line bg-paper px-3 py-2 text-lg font-semibold transition-[top] duration-300 md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 ${
          navHidden ? "top-0" : "top-12"
        }`}
      >
        {ref.title}
      </h2>
      {/* References carry no dark CSS of their own, so themeCss injects the dark
          palette (ADR 0011) — the theme then flips them with the rest of the app.
          The pencil rides over the body on hover for the owner (source edition). */}
      <div className="group relative flex min-h-0 flex-1 flex-col">
        <Frame html={html} withBridge={false} theme={theme} themeCss dir={dir} lang={contentLang} resources={resources} />
        {canEditRef && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit this reference"
            title="Edit this reference"
            className="absolute right-3 top-3 z-10 rounded-lg border border-line bg-card/90 px-2.5 py-1.5 text-sm text-accent opacity-100 shadow-sm backdrop-blur transition-opacity hover:bg-hi focus:opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            ✎ Edit
          </button>
        )}
      </div>
      {canEditRef && editing && (
        <ContentEditor
          topicSlug={topicSlug}
          html={html}
          theme={theme}
          themeCss
          label="reference"
          onClose={() => setEditing(false)}
          commit={(storageId) => editReference({ topicSlug, key: refKey, storageId })}
        />
      )}
    </div>
  );
}

// Ask the teacher a question and see the reply once answered (live). For a
// read-only Viewer the ask form is gone, but the owner's existing Questions and
// Replies stay visible (PRD story 21).
// `panel` is the desktop side column; `inline` sits at the end of the lesson on mobile.
function QuestionBox({
  topicSlug,
  lessonKey,
  variant = "panel",
  readOnly,
}: {
  topicSlug: string;
  lessonKey: string;
  variant?: "panel" | "inline";
  readOnly: boolean;
}) {
  const lang = useEditionLang();
  const questions = useQuery(api.capture.myQuestions, { topicSlug, lang: lang ?? undefined });
  const askQuestion = useMutation(api.capture.askQuestion);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState<{ text: string; reply: string } | null>(null);
  const mine = questions?.filter((q) => q.lessonKey === lessonKey) ?? [];

  return (
    <div
      className={
        variant === "inline"
          ? "rounded-xl border border-line bg-card p-4"
          : "flex h-full flex-col rounded-xl border border-line bg-card p-4"
      }
    >
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent2">
        {readOnly ? "Questions & replies" : "Ask about this lesson"}
      </h3>
      {!readOnly && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const t = text.trim();
            if (!t) return;
            setText("");
            await askQuestion({ topicSlug, lessonKey, text: t });
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Your question…" className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          <button type="submit" className="rounded-lg bg-accent2 px-3 py-2 text-sm text-white hover:bg-accent2/90">Ask</button>
        </form>
      )}
      {readOnly && mine.length === 0 && <p className="text-sm text-soft">No questions on this lesson yet.</p>}
      <ul className={`mt-3 flex flex-col gap-3 ${variant === "inline" ? "" : "min-h-0 flex-1 overflow-y-auto"}`}>
        {mine.map((q) => (
          <li key={q.id} className="text-sm">
            <p className="font-medium text-ink">{q.text}</p>
            {q.reply ? (
              <div className="mt-1.5 rounded-lg border-l-2 border-accent2 bg-hi px-3 py-2">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent2">Teacher</p>
                  {variant === "panel" && (
                    <button
                      type="button"
                      onClick={() => setExpanded({ text: q.text, reply: q.reply! })}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-soft transition-colors hover:bg-card hover:text-accent"
                    >
                      ⤢ View
                    </button>
                  )}
                </div>
                <Markdown source={q.reply} className="flex flex-col gap-2 text-sm leading-relaxed text-ink" />
              </div>
            ) : (
              <p className="mt-1 text-xs text-soft">Waiting for your teacher — your question will be answered once the next lesson is generated.</p>
            )}
          </li>
        ))}
      </ul>
      {expanded && <QaDialog question={expanded.text} reply={expanded.reply} onClose={() => setExpanded(null)} />}
    </div>
  );
}

// One Q&A opened in a comfortable reading width — the desktop ask column is only
// md:w-80, too narrow for long replies. ponytail: a near-twin of Dashboard's
// MissionDialog (native <dialog> → free Esc/backdrop/focus-trap); extract to a
// shared module if a third use appears.
function QaDialog({ question, reply, onClose }: { question: string; reply: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // click outside the content = backdrop
      }}
      className="m-auto w-[92vw] max-w-2xl rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="min-w-0 text-base font-semibold text-ink">{question}</h2>
        <button onClick={() => ref.current?.close()} aria-label="Close" className="shrink-0 rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
          ✕
        </button>
      </div>
      <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent2">Teacher</p>
        <Markdown source={reply} className="flex flex-col gap-3 text-base leading-relaxed text-ink" />
      </div>
    </dialog>
  );
}
