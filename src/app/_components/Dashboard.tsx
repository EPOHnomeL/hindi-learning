"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { langInfo } from "../../../convex/languages";
import { clearAccountLocalStateOnSignOut } from "./accountLocalState";
import { CourseCertMenu } from "./Certificate";
import { CourseSettingsDialog } from "./CourseSettings";
import { EditionsDialog } from "./Editions";
import { withLang } from "./editionUrl";
import { Icon } from "./icons";
import { formatPrice } from "./Paygate";
import { Logo } from "./Logo";
import { Markdown } from "./MarkdownView";
import { missionPreview } from "./markdown";
import { SettingsDialog } from "./SettingsDialog";
import { SiteFooter } from "./SiteFooter";
import { Dialog, IconButton, Menu, MenuItem } from "./ui";
import { useResourceUpload } from "./useResourceUpload";

type Course = {
  slug: string;
  title: string;
  status: "seeded" | "active" | "completed";
  mission: string | null;
  publicToken: string | null;
  lessonCount: number;
  completedCount: number;
  // The soft "~N lessons" estimate of the course's eventual size (owner-only;
  // null while seeded/completed or before the teacher has forecast one).
  estimatedLessons: number | null;
  // Ready translation Editions (language codes), shown as chips (course-translation).
  editions: string[];
};

// One Edition chip: the language + how to display it (shared by the shared- and
// purchased-course cards, whose `langs` arrays are identical in shape).
type EditionChip = { lang: string; name: string; native: string; rtl: boolean };

type SharedCourse = {
  slug: string;
  title: string;
  ownerEmail: string | null;
  mission: string | null;
  lessonCount: number;
  completedCount: number;
  // The Edition languages this Viewer holds — chips + which one to open in.
  langs: EditionChip[];
};

// A purchased course (paid marketplace, ADR 0016) — the paid twin of a shared
// one: the same shape minus the owner attribution (a buyer reads it like a Viewer).
type PurchasedCourse = Omit<SharedCourse, "ownerEmail">;

// The home dashboard (`/`): the course grid (create / edit / open) plus the
// "Shared with me" section. Opening a course is a real navigation to
// /courses/[slug] (ADR 0012), not a local view toggle.
export function Dashboard() {
  const courses = useQuery(api.content.dashboard);
  const amAdmin = useQuery(api.whitelist.amIAdmin);
  // Course creation is Allowlist-gated (ADR 0021): non-members get a clean
  // library with no "New course" card (UX only — seedTopic enforces server-side).
  const amAllowlisted = useQuery(api.whitelist.amIAllowlisted);
  // Shared / purchased are queried here (not only inside their sections) so we can
  // tell a truly-empty library from one that merely lacks *owned* courses. Convex
  // dedupes the subscription with SharedSection/PurchasedSection, so it's free.
  const shared = useQuery(api.shares.listSharedTopics);
  const purchased = useQuery(api.market.myPurchases);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const tc = useTranslations("Common");
  const ts = useTranslations("Settings");
  const [prefsOpen, setPrefsOpen] = useState(false);

  // A learner with nothing to their name who also can't author (open sign-up
  // admits everyone; the Allowlist gates creation, not existence — ADR 0021).
  // They get a friendly "marketplace coming soon" note instead of a bare grid;
  // allowlisted members get the "New course" card as their empty state instead.
  const emptyLibrary =
    courses !== undefined &&
    courses.length === 0 &&
    shared !== undefined &&
    shared.length === 0 &&
    purchased !== undefined &&
    purchased.length === 0 &&
    amAllowlisted === false;

  return (
    <>
      <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 md:py-12">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-9 shrink-0 text-accent md:h-10 md:w-10" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">My Course</h1>
              <p className="mt-0.5 text-sm text-soft">{tc("tagline")}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setPrefsOpen(true)}
              aria-label={ts("title")}
              title={ts("title")}
              className="rounded-lg p-1.5 text-soft transition-colors hover:bg-hi hover:text-accent"
            >
              <Icon name="settings" className="h-4 w-4" />
            </button>
            {amAdmin && (
              <Link href="/admin" className="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
                Admin
              </Link>
            )}
            <button
              onClick={() => {
                clearAccountLocalStateOnSignOut();
                void signOut().then(() => router.replace("/"));
              }}
              className="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
            >
              {tc("signOut")}
            </button>
          </div>
        </header>

        {courses === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-card" />
            ))}
          </div>
        ) : emptyLibrary ? (
          <EmptyLibrary />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.slug} course={c} />
            ))}
            {amAllowlisted && <NewCourseCard />}
          </div>
        )}

        <SharedSection />
        <PurchasedSection />
      </div>
      <SiteFooter />
      {prefsOpen && <SettingsDialog onClose={() => setPrefsOpen(false)} />}
    </>
  );
}

// A course's Edition languages, as small pills (course-translation). Shows up to
// three endonyms; a "+N" chip stands in for the rest. RTL endonyms render
// right-to-left. Shown on owner cards (their translations) and Viewer shared
// cards (the Editions they hold).
function LangChips({ langs }: { langs: { lang: string; native: string; rtl: boolean }[] }) {
  if (langs.length === 0) return null;
  const shown = langs.slice(0, 3);
  const extra = langs.length - shown.length;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {shown.map((l) => (
        <span
          key={l.lang}
          dir={l.rtl ? "rtl" : undefined}
          className="rounded-full bg-hi px-2 py-0.5 text-[11px] font-medium text-accent2"
        >
          {l.native}
        </span>
      ))}
      {extra > 0 && <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-soft">+{extra}</span>}
    </div>
  );
}

// The single status pill on an owner card. One badge only, by priority:
// Complete (the course is concluded) → Public (a link is live) → Setting up.
function StatusPill({ course }: { course: Course }) {
  const t = useTranslations("Dashboard");
  if (course.status === "completed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-gold">
        <Icon name="award" className="h-3 w-3" /> {t("complete")}
      </span>
    );
  }
  if (course.publicToken) {
    return (
      <span
        title={t("publicLinkLive")}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent2/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent2"
      >
        <Icon name="globe" className="h-3 w-3" /> {t("public")}
      </span>
    );
  }
  if (course.status === "seeded") {
    return (
      <span className="shrink-0 rounded-full bg-hi px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent">
        {t("settingUp")}
      </span>
    );
  }
  return null;
}

// A course's paid Editions, as a single gold pill (paid marketplace, ADR 0016).
// Shown on the owner card in place of the status pill: a marketplace listing is
// the most salient state, and only a completed course can be priced. "from" when
// several Editions are priced (they may differ in price/currency).
function PaidPill({ pricing }: { pricing: { amount: number; currency: string }[] }) {
  const t = useTranslations("Dashboard");
  const min = pricing.reduce((a, b) => (b.amount < a.amount ? b : a));
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-gold">
      <Icon name="tag" className="h-3 w-3" />
      {pricing.length > 1 ? t("from") : ""}
      {formatPrice(min.amount, min.currency)}
    </span>
  );
}

function CourseCard({ course }: { course: Course }) {
  const t = useTranslations("Dashboard");
  const [showMission, setShowMission] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editionsOpen, setEditionsOpen] = useState(false);
  const requestSetup = useAction(api.routine.requestSetup);
  const [setup, setSetup] = useState<"idle" | "starting" | "started" | "error">("idle");

  const pct = course.lessonCount > 0 ? Math.round((course.completedCount / course.lessonCount) * 100) : 0;
  const complete = course.status === "completed";
  const seeded = course.status === "seeded";
  // Only a completed course can carry a listing, so only then is a price lookup
  // worthwhile. A priced course shows the gold "Paid" pill instead of "Complete".
  const pricing = useQuery(api.market.editionPricing, complete ? { topicSlug: course.slug } : "skip");
  const priced = pricing && pricing.length > 0 ? pricing : null;

  const editions = course.editions.map((code) => {
    const i = langInfo(code);
    return { lang: i.code, native: i.native, rtl: !!i.rtl };
  });

  const startSetup = async () => {
    setSetup("starting");
    try {
      await requestSetup({ topicSlug: course.slug });
      setSetup("started");
    } catch {
      setSetup("error");
    }
  };

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${
        complete ? "border-gold/55" : "border-line"
      }`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2.5">
        <h2 className="min-w-0 text-lg font-semibold leading-snug tracking-tight text-ink">{course.title}</h2>
        {priced ? <PaidPill pricing={priced} /> : <StatusPill course={course} />}
      </div>

      {course.mission ? (
        <button
          onClick={() => setShowMission(true)}
          title={t("viewMission")}
          className="line-clamp-2 min-h-[38px] text-left text-[13.5px] leading-snug text-soft transition-colors hover:text-accent"
        >
          {missionPreview(course.mission)}
        </button>
      ) : (
        <p className="min-h-[38px] text-[13.5px] text-soft">
          {seeded ? t("preparingMission") : t("noMission")}
        </p>
      )}

      {/* Ready translation Editions (course-translation). Managed under Editions. */}
      <LangChips langs={editions} />

      {/* Progress */}
      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-soft">
          <span>
            {course.lessonCount === 0 ? (
              t("noLessonsYet")
            ) : (
              <>
                <span className="tabular-nums font-medium text-ink">{course.completedCount}</span> / {course.lessonCount}{" "}
                {t("lessons", { count: course.lessonCount })}
              </>
            )}
            {/* Soft estimate of the eventual total (owner-only; server-gated). */}
            {course.estimatedLessons != null && (
              <span title="Your teacher's estimate of the course's eventual size — a rough guide, not a promise.">
                {t("estimatedTotal", { count: course.estimatedLessons })}
              </span>
            )}
          </span>
          {course.lessonCount > 0 && <span className={complete ? "font-semibold text-gold" : ""}>{pct}%</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${complete ? "bg-gradient-to-r from-accent2 to-gold" : "bg-accent2"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="min-h-[14px] flex-1" />

      {/* Actions. A seeded course only offers "Set up now"; otherwise: Open
          (primary) + Edit (settings) + Editions (globe), plus a ⋯ overflow that
          holds the certificate once the course is complete. */}
      <div className="flex items-center gap-2">
        {seeded ? (
          <button
            onClick={() => void startSetup()}
            disabled={setup === "starting" || setup === "started"}
            className="flex-1 rounded-lg bg-gold/20 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-gold/30 disabled:opacity-70"
          >
            {setup === "starting"
              ? t("startingSetup")
              : setup === "started"
                ? t("setupStarted")
                : setup === "error"
                  ? t("setupError")
                  : t("setUpNow")}
          </button>
        ) : (
          <>
            <Link
              href={`/courses/${course.slug}`}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              {t("openCourse")}
            </Link>
            <IconButton icon="edit" label={t("editCourse", { title: course.title })} title={t("edit")} onClick={() => setSettingsOpen(true)} />
            <IconButton
              icon="globe"
              label={t("editionsSharingFor", { title: course.title })}
              title={t("editions")}
              onClick={() => setEditionsOpen(true)}
            />
            {complete && <CourseCertMenu topicSlug={course.slug} />}
          </>
        )}
        {/* Admin "fire and pray": generate the whole remaining curriculum in one
            go, without waiting for the learner to finish each lesson. Hidden for
            everyone but the Admin (self-gated), and never on a completed course. */}
        {!complete && <AdminCourseMenu slug={course.slug} title={course.title} />}
      </div>

      {showMission && course.mission && (
        <MissionDialog title={course.title} mission={course.mission} onClose={() => setShowMission(false)} />
      )}
      {settingsOpen && (
        <CourseSettingsDialog topicSlug={course.slug} status={course.status} onClose={() => setSettingsOpen(false)} />
      )}
      {editionsOpen && (
        <EditionsDialog topicSlug={course.slug} title={course.title} onClose={() => setEditionsOpen(false)} />
      )}
    </article>
  );
}

// The Admin-only ⋯ on a course card (fire and pray). Self-hides for non-admins,
// so a plain learner never sees a ⋯ on their own cards. "Finish generating" kicks
// off the back-to-back authoring loop; while it runs, the live generation status
// relabels the item ("Generating…") and flags a failed run with a dot on the ⋯.
function AdminCourseMenu({ slug, title }: { slug: string; title: string }) {
  const amAdmin = useQuery(api.whitelist.amIAdmin);
  const status = useQuery(api.routine.generationStatus, { topicSlug: slug });
  const finish = useAction(api.routine.finishGenerating);
  const cancel = useAction(api.routine.cancelFinishGenerating);
  const [busy, setBusy] = useState(false);
  if (!amAdmin) return null;

  const generating = busy || status?.status === "generating";
  const cancelling = status?.cancelRequested === true;
  const failed = status?.status === "failed";

  return (
    <Menu triggerLabel={`Admin actions for ${title}`} dot={failed}>
      {(close) =>
        generating ? (
          // A run is in flight — offer to stop it (fire-and-pray can loop).
          <MenuItem
            icon="x"
            onClick={() => {
              close();
              if (cancelling) return;
              void cancel({ topicSlug: slug });
            }}
          >
            {cancelling ? "Cancelling…" : "Cancel generation"}
          </MenuItem>
        ) : (
          <MenuItem
            icon="refresh"
            onClick={() => {
              close();
              setBusy(true);
              void finish({ topicSlug: slug }).finally(() => setBusy(false));
            }}
          >
            {failed ? "Finish generating — retry" : "Finish generating course"}
          </MenuItem>
        )
      }
    </Menu>
  );
}

// Courses other learners have shared with me — read-only. Hidden when none.
function SharedSection() {
  const t = useTranslations("Dashboard");
  const shared = useQuery(api.shares.listSharedTopics);
  if (!shared || shared.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-1 text-lg font-semibold tracking-tight text-accent">{t("sharedWithMe")}</h2>
      <p className="mb-4 text-sm text-soft">{t("sharedSubtitle")}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shared.map((c) => (
          <SharedCourseCard key={c.slug} course={c} />
        ))}
      </div>
    </section>
  );
}

// A shared course (Viewer): attributed to its owner, read-only — Open course is
// the only action (no Edit, no Editions/sharing). Once the Viewer finishes it, a
// ⋯ appears with their own certificate. They read the single edition shared to
// them (viewer-cannot-switch-edition); the chips are informational.
function SharedCourseCard({ course }: { course: SharedCourse }) {
  const t = useTranslations("Dashboard");
  const [showMission, setShowMission] = useState(false);
  const pct = course.lessonCount > 0 ? Math.round((course.completedCount / course.lessonCount) * 100) : 0;
  const allDone = course.lessonCount > 0 && course.completedCount === course.lessonCount;
  // Open in the Edition the card's title is shown in — English if the Viewer holds
  // it, else their first Edition (mirrors listSharedTopics' `preferred`).
  const openLang = course.langs.some((l) => l.lang === "en") ? "en" : course.langs[0]?.lang;

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold leading-snug text-ink">{course.title}</h2>
        <span className="shrink-0 rounded-full bg-hi px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent">
          {t("sharedBadge")}
        </span>
      </div>

      {course.mission && (
        <button
          onClick={() => setShowMission(true)}
          title={t("viewMission")}
          className="line-clamp-2 min-h-[38px] text-left text-[13.5px] leading-snug text-soft transition-colors hover:text-accent"
        >
          {missionPreview(course.mission)}
        </button>
      )}

      <p className="mt-1 text-xs text-soft">
        {t.rich("sharedBy", {
          owner: () => <span className="text-ink">{course.ownerEmail ?? t("anotherLearner")}</span>,
        })}
      </p>

      <LangChips langs={course.langs} />

      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-soft">
          <span>
            {course.lessonCount === 0 ? (
              t("noLessonsYet")
            ) : (
              <>
                <span className="tabular-nums font-medium text-ink">{course.completedCount}</span> / {course.lessonCount}{" "}
                {t("lessons", { count: course.lessonCount })}
              </>
            )}
          </span>
          {course.lessonCount > 0 && <span>{pct}%</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent2 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="min-h-[14px] flex-1" />

      <div className="flex items-center gap-2">
        <Link
          href={withLang(`/courses/${course.slug}`, openLang)}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          {t("openCourse")}
        </Link>
        {allDone && <CourseCertMenu topicSlug={course.slug} />}
      </div>

      {showMission && course.mission && (
        <MissionDialog title={course.title} mission={course.mission} onClose={() => setShowMission(false)} />
      )}
    </article>
  );
}

// Courses I've bought (paid marketplace, ADR 0016) — read-only, full access, my
// own progress + certificate. Hidden when none. The paid twin of SharedSection.
function PurchasedSection() {
  const t = useTranslations("Dashboard");
  const purchased = useQuery(api.market.myPurchases);
  if (!purchased || purchased.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-1 text-lg font-semibold tracking-tight text-accent">{t("purchased")}</h2>
      <p className="mb-4 text-sm text-soft">{t("purchasedSubtitle")}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {purchased.map((c) => (
          <PurchasedCourseCard key={c.slug} course={c} />
        ))}
      </div>
    </section>
  );
}

// A purchased course: an entitled buyer is a first-class reader (own progress,
// own certificate), so this mirrors SharedCourseCard — Open course is the only
// action — but carries a gold "Purchased" badge and no owner attribution. They
// read the Edition(s) they bought (chips are informational); buying another
// language is a separate purchase.
function PurchasedCourseCard({ course }: { course: PurchasedCourse }) {
  const t = useTranslations("Dashboard");
  const [showMission, setShowMission] = useState(false);
  const pct = course.lessonCount > 0 ? Math.round((course.completedCount / course.lessonCount) * 100) : 0;
  const allDone = course.lessonCount > 0 && course.completedCount === course.lessonCount;
  const openLang = course.langs.some((l) => l.lang === "en") ? "en" : course.langs[0]?.lang;

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold leading-snug text-ink">{course.title}</h2>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-gold">
          <Icon name="check" className="h-3 w-3" /> {t("purchased")}
        </span>
      </div>

      {course.mission && (
        <button
          onClick={() => setShowMission(true)}
          title={t("viewMission")}
          className="line-clamp-2 min-h-[38px] text-left text-[13.5px] leading-snug text-soft transition-colors hover:text-accent"
        >
          {missionPreview(course.mission)}
        </button>
      )}

      <p className="mt-1 text-xs text-soft">{t("yoursForLife")}</p>

      <LangChips langs={course.langs} />

      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-soft">
          <span>
            {course.lessonCount === 0 ? (
              t("noLessonsYet")
            ) : (
              <>
                <span className="tabular-nums font-medium text-ink">{course.completedCount}</span> / {course.lessonCount}{" "}
                {t("lessons", { count: course.lessonCount })}
              </>
            )}
          </span>
          {course.lessonCount > 0 && <span>{pct}%</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent2 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="min-h-[14px] flex-1" />

      <div className="flex items-center gap-2">
        <Link
          href={withLang(`/courses/${course.slug}`, openLang)}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          {t("openCourse")}
        </Link>
        {allDone && <CourseCertMenu topicSlug={course.slug} />}
      </div>

      {showMission && course.mission && (
        <MissionDialog title={course.title} mission={course.mission} onClose={() => setShowMission(false)} />
      )}
    </article>
  );
}

// The Mission rendered as Markdown in the shared Dialog primitive.
function MissionDialog({ title, mission, onClose }: { title: string; mission: string; onClose: () => void }) {
  return (
    <Dialog title={title} onClose={onClose} className="max-w-2xl">
      <Markdown source={mission} />
    </Dialog>
  );
}

// The empty state for a signed-in learner who owns nothing yet and can't author
// their own courses. Open sign-up admits everyone, but the Allowlist gates course
// creation (ADR 0021) — so rather than strand these learners on a bare grid, we
// tell them their account works and that a way to get courses is on its way. The
// paid marketplace exists in the backend (ADR 0016) but has no public browse
// surface yet, hence "coming soon".
function EmptyLibrary() {
  const t = useTranslations("Dashboard");
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-card px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-hi text-accent">
        <Icon name="book" className="h-6 w-6" />
      </span>
      <h2 className="text-lg font-semibold tracking-tight text-ink">{t("noCoursesYet")}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-soft">{t("emptyLibraryBody")}</p>
    </div>
  );
}

// Seed a new course (title + free-text "why"); the Routine drafts the Mission +
// first Lesson on its next run. On create, open it so they can upload Resources.
function NewCourseCard() {
  const seedTopic = useMutation(api.content.seedTopic);
  const requestSetup = useAction(api.routine.requestSetup);
  const { uploadFile, addLink } = useResourceUpload();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  // The course's Provider (ADR 0014). Defaults to Claude — the quality-guaranteed
  // line; OpenRouter is the experimental spike.
  const [provider, setProvider] = useState<"claude" | "openrouter">("claude");
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDraftLink = () => {
    const l = linkDraft.trim();
    if (l) setLinks((xs) => [...xs, l]);
    setLinkDraft("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-5 text-soft transition-colors hover:border-gold/60 hover:bg-hi/40 hover:text-accent"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-hi text-accent">
          <Icon name="plus" className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium">New course</span>
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        setBusy(true);
        setError(null);
        // Snapshot the chosen Resources before we reset the form and navigate away.
        const chosenLinks = links;
        const chosenFiles = files;
        try {
          const { slug } = await seedTopic({ title: t, why: why.trim(), provider });
          // Land on the new course immediately so the learner sees its "setting up"
          // page right away — instead of watching this form sit in "Creating…"
          // (next to the card the reactive dashboard has already rendered) for the
          // length of the uploads. Attaching Resources and kicking off setup then
          // run in the background: these promises outlive this component, so a
          // rejection must not surface as an unhandled rejection (hence the catches).
          void (async () => {
            try {
              await Promise.all([
                ...chosenLinks.map((l) => addLink(slug, l)),
                ...chosenFiles.map((f) => uploadFile(slug, f)),
              ]);
            } catch (err) {
              console.warn("some resources couldn't be attached", err);
            }
            // Kick off setup once Resources are attached — no waiting for the daily
            // cron. Best-effort: if the fire can't land, the card still shows
            // "Setting up" (with a "Set up now" retry) and the cron picks it up.
            try {
              await requestSetup({ topicSlug: slug });
            } catch (err) {
              console.warn("couldn't start setup immediately; the routine will pick it up", err);
            }
          })();
          setTitle("");
          setWhy("");
          setProvider("claude");
          setLinks([]);
          setFiles([]);
          setOpen(false);
          router.push(`/courses/${slug}`);
        } catch {
          // The server caps new courses to one per day; surface that (the most
          // likely reason a valid title fails) rather than leaving the form stuck.
          setError("You can create one new course per day. Please try again tomorrow.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">New course</label>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Course title"
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      <textarea
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        rows={3}
        placeholder="Why are you learning this?"
        className="resize-none rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />

      <label className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent2">Teacher</label>
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value as "claude" | "openrouter")}
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      >
        <option value="claude">Claude (recommended)</option>
        <option value="openrouter">OpenRouter</option>
      </select>
      {provider === "openrouter" && (
        <p className="text-xs text-soft">Experimental: quality isn&apos;t guaranteed on this teacher.</p>
      )}

      <label className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent2">Resources (optional)</label>
      {(links.length > 0 || files.length > 0) && (
        <ul className="flex flex-col gap-1">
          {links.map((l, i) => (
            <li key={`l-${i}`} className="flex items-center justify-between gap-2 rounded bg-hi/50 px-2 py-1 text-xs text-ink">
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <Icon name="link" className="h-3.5 w-3.5 shrink-0 text-soft" /> {l}
              </span>
              <button type="button" onClick={() => setLinks((xs) => xs.filter((_, j) => j !== i))} className="shrink-0 text-soft hover:text-accent" aria-label="Remove link">
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {files.map((f, i) => (
            <li key={`f-${i}`} className="flex items-center justify-between gap-2 rounded bg-hi/50 px-2 py-1 text-xs text-ink">
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <Icon name="book" className="h-3.5 w-3.5 shrink-0 text-soft" /> {f.name}
              </span>
              <button type="button" onClick={() => setFiles((xs) => xs.filter((_, j) => j !== i))} className="shrink-0 text-soft hover:text-accent" aria-label="Remove file">
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1">
        <input
          value={linkDraft}
          onChange={(e) => setLinkDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraftLink();
            }
          }}
          placeholder="Paste a link…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1.5 text-sm focus:border-gold focus:outline-none"
        />
        <button type="button" onClick={addDraftLink} className="rounded-lg border border-line px-2 py-1.5 text-sm text-soft hover:bg-hi">
          Add link
        </button>
      </div>
      <label className="cursor-pointer rounded-lg border border-dashed border-line px-2 py-1.5 text-center text-sm text-soft hover:bg-hi">
        + Attach file{files.length > 0 ? "s" : ""} (PDF or Markdown)
        <input
          type="file"
          multiple
          accept=".pdf,.md,.markdown,application/pdf,text/markdown"
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) setFiles((xs) => [...xs, ...picked]);
            e.target.value = "";
          }}
        />
      </label>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="mt-1 flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Creating…" : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-hi">
          Cancel
        </button>
      </div>
    </form>
  );
}
