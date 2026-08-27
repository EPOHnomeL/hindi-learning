"use client";

// THROWAWAY, ticket 16 prototype: .plan/maps/ui-overhaul/tickets/16-management-shell-prototype.md
//
// Three variants of the container plus layout for course management,
// switchable via `?variant=A|B|C` on /courses/[slug]/manage-prototype. All
// three read the real editions list and seller status (read-only Convex
// queries); every toggle, form and mode picker below is LOCAL STATE, not a
// real mutation (prototype rule 3, the question is what this should look
// like, not whether the backend works).
//
// The three groups come straight from ticket 15's answer: Who can find it
// (Publish alone), Who you hand it to (Public link, Invite, the roster),
// What it costs (Price plus one merged voucher control, collapsed to a
// single row for anyone who is not a ready Seller).

import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { Icon, type IconName } from "./icons";

type Edition = { lang: string; name: string; source: boolean; published: boolean; publicToken: string | null };

// ---------------------------------------------------------------------------
// Shared fake state every variant renders from. Real reads: editions, seller
// status. Everything else (invite email, roster, price, voucher mode) is
// seeded so all three variants can be judged against the same content,
// including the merged voucher stress case ticket 16 calls out.
// ---------------------------------------------------------------------------

function useManagementState(topicSlug: string) {
  const data = useQuery(api.translate.editions, { topicSlug });
  const sellerStatus = useQuery(api.sellers.sellerStatus);
  const editions: Edition[] = (data?.editions ?? []) as Edition[];
  const [lang, setLang] = useState("en");
  const active = editions.find((e) => e.lang === lang) ?? editions[0] ?? null;

  const [published, setPublished] = useState(true);
  const [publicLink, setPublicLink] = useState(true);
  const [teacherQa, setTeacherQa] = useState(false);
  const [priced, setPriced] = useState(true);
  const [price, setPrice] = useState("149.00");
  const [voucherMode, setVoucherMode] = useState<"shared" | "each">("shared");
  const roster = [
    { email: "thandiwe@example.com", role: "viewer" as const, pending: false, lang: "English" },
    { email: "given.m@example.com", role: "editor" as const, pending: true, lang: "Zulu" },
  ];

  return {
    editions,
    active,
    lang,
    setLang,
    ready: sellerStatus === "ready",
    published,
    setPublished,
    publicLink,
    setPublicLink,
    teacherQa,
    setTeacherQa,
    priced,
    setPriced,
    price,
    setPrice,
    voucherMode,
    setVoucherMode,
    roster,
  };
}
type ManagementState = ReturnType<typeof useManagementState>;

// ---------------------------------------------------------------------------
// Group content, identical across all three variants. Each group is a
// render function so a variant decides the chrome (accordion header, plain
// stack, sticky sub-nav) around the same content.
// ---------------------------------------------------------------------------

function Row({ icon, title, subtitle, control }: { icon: IconName; title: string; subtitle: string; control: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-hi text-accent">
        <Icon name={icon} className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-[13.5px] font-semibold text-ink">{title}</b>
        <span className="block text-[11.5px] text-soft">{subtitle}</span>
      </div>
      {control}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-10.5 shrink-0 rounded-full transition-colors ${on ? "bg-accent2" : "bg-line"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "left-4.5" : "left-0.5"}`}
      />
    </button>
  );
}

function GroupWhoCanFind({ s }: { s: ManagementState }) {
  return (
    <Row
      icon="book"
      title="Publish"
      subtitle={s.published ? "Listed in the catalogue" : "Not listed"}
      control={<Toggle on={s.published} onChange={s.setPublished} />}
    />
  );
}

function GroupWhoYouHandItTo({ s }: { s: ManagementState }) {
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <Row
        icon="globe"
        title="Public link"
        subtitle={s.publicLink ? "Anyone with the link can view" : "Off"}
        control={<Toggle on={s.publicLink} onChange={s.setPublicLink} />}
      />
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-card px-3.5 py-3">
        <b className="text-[13.5px] font-semibold text-ink">Invite</b>
        <div className="flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setEmail("")}
            className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Send
          </button>
        </div>
        <p className="m-0 text-[11px] text-soft">Who has access lives on Users, a course-wide peer (ticket 17).</p>
      </div>
    </div>
  );
}

// Course-wide, not per Edition (ticket 17's move): language is a row attribute here
// rather than the container that splits the list, so one screen answers "how many
// people have access to this course".
function UsersPeer({ s }: { s: ManagementState }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[11.5px] text-soft">{s.roster.length} people have access across every Edition.</p>
      <ul className="flex flex-col gap-1.5">
        {s.roster.map((r) => (
          <li key={r.email} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{r.email}</span>
            <span className="rounded-full bg-hi px-2 py-0.5 text-[10.5px] font-medium text-soft">{r.lang}</span>
            {r.pending && <span className="text-[11px] text-soft">pending</span>}
            <span className="rounded-full bg-hi px-2 py-0.5 text-[10.5px] font-medium text-accent">{r.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupWhatItCosts({ s }: { s: ManagementState }) {
  const [expanded, setExpanded] = useState(false);
  if (!s.ready) {
    return (
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 rounded-xl border border-dashed border-line px-3.5 py-3 text-left text-[13px] leading-relaxed text-soft"
      >
        <Icon name="tag" className="mt-0.5 h-4.5 w-4.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <b className="font-semibold text-ink">Selling is off.</b> Become a Seller to set a price or mint
          vouchers.
          {expanded && (
            <div className="mt-2.5 flex flex-col gap-2 border-t border-line pt-2.5">
              <p className="m-0">Ask an admin to grant Seller status, then add payout bank details.</p>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  placeholder="Bank"
                  className="rounded-lg border border-line bg-paper px-2.5 py-2 text-xs focus:border-gold focus:outline-none"
                />
                <input
                  placeholder="Account number"
                  className="rounded-lg border border-line bg-paper px-2.5 py-2 text-xs focus:border-gold focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
        <Icon name="chevron" className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Row
        icon="tag"
        title="Price"
        subtitle={s.priced ? `R${s.price}, listed for sale` : "Not for sale"}
        control={<Toggle on={s.priced} onChange={s.setPriced} />}
      />
      <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-card px-3.5 py-3">
        <b className="text-[13.5px] font-semibold text-ink">Voucher</b>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-[12px]">
          <button
            type="button"
            onClick={() => s.setVoucherMode("shared")}
            className={`flex-1 px-3 py-1.5 font-medium ${s.voucherMode === "shared" ? "bg-accent text-white" : "text-soft hover:bg-hi"}`}
          >
            One shared code
          </button>
          <button
            type="button"
            onClick={() => s.setVoucherMode("each")}
            className={`flex-1 px-3 py-1.5 font-medium ${s.voucherMode === "each" ? "bg-accent text-white" : "text-soft hover:bg-hi"}`}
          >
            One code each
          </button>
        </div>
        <p className="m-0 text-[11.5px] text-soft">
          {s.voucherMode === "shared"
            ? "Capped seats, members join with a nickname and a PIN. Billed for the seats taken when you stop it. Members give POPIA consent to join."
            : "N single use codes, billed upfront for the whole batch. Redemptions record only the timestamp, no member identity."}
        </p>
      </div>
    </div>
  );
}

const GROUPS = [
  { key: "find", title: "Who can find it", render: GroupWhoCanFind },
  { key: "hand", title: "Who you hand it to", render: GroupWhoYouHandItTo },
  { key: "cost", title: "What it costs", render: GroupWhatItCosts },
] as const;

function EditionPickerRow({ s }: { s: ManagementState }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {s.editions.map((e) => (
        <button
          key={e.lang}
          type="button"
          onClick={() => s.setLang(e.lang)}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium ${
            s.lang === e.lang ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:bg-hi"
          }`}
        >
          {e.name}
          {e.source && <span className="ml-1 text-[10px] uppercase text-accent2">src</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant A: dialog stays. Groups are an accordion, one open at a time.
// ---------------------------------------------------------------------------

function VariantA({ s }: { s: ManagementState }) {
  const [open, setOpen] = useState<string>("find");
  return (
    <div className="mx-auto w-[92vw] max-w-[360px] rounded-2xl border border-line bg-paper shadow-xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-accent">Editions & sharing</h2>
        <Icon name="x" className="h-4 w-4 text-soft" />
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-4 py-4">
        <div className="mb-4 border-b border-line pb-4">
          <EditionPickerRow s={s} />
        </div>
        <div className="flex flex-col gap-2">
          {GROUPS.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-xl border border-line">
              <button
                type="button"
                onClick={() => setOpen(open === g.key ? "" : g.key)}
                className="flex w-full items-center justify-between bg-card px-3.5 py-3 text-left text-[13px] font-semibold text-ink"
              >
                {g.title}
                <Icon name="chevron" className={`h-4 w-4 text-soft transition-transform ${open === g.key ? "rotate-180" : ""}`} />
              </button>
              {open === g.key && (
                <div className="px-3.5 pb-3.5 pt-1">
                  <g.render s={s} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant B: bottom sheet, docked above the app tab bar. Groups stay flat
// (the sheet already scrolls) behind a sticky segmented jump nav instead of
// an accordion, structurally the opposite bet from A.
// ---------------------------------------------------------------------------

function VariantB({ s }: { s: ManagementState }) {
  const [active, setActive] = useState("find");
  return (
    <div className="relative mx-auto h-[100dvh] w-[360px] overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="flex items-center justify-center border-b border-line py-2 text-[11px] text-soft">
        (app content behind the sheet)
      </div>
      <div className="absolute inset-x-0 bottom-[52px] flex max-h-[78%] flex-col rounded-t-2xl border border-line bg-paper shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
        <div className="flex justify-center pt-2">
          <span className="h-1 w-9 rounded-full bg-line" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
          <h2 className="text-sm font-semibold text-accent">Editions & sharing</h2>
          <Icon name="x" className="h-4 w-4 text-soft" />
        </div>
        <div className="border-b border-line px-4 pb-3">
          <EditionPickerRow s={s} />
        </div>
        <div className="sticky top-0 z-10 flex gap-1 border-b border-line bg-paper px-3 py-2">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setActive(g.key)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11.5px] font-medium ${
                active === g.key ? "bg-accent text-white" : "text-soft hover:bg-hi"
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {GROUPS.filter((g) => g.key === active).map((g) => (
            <g.render key={g.key} s={s} />
          ))}
        </div>
      </div>
      {/* stand in for the shipped app-level tab bar (AppTabs.tsx) the sheet docks above */}
      <div className="absolute inset-x-0 bottom-0 flex h-[52px] items-center justify-around border-t border-line bg-card text-[10px] text-soft">
        <span>Home</span>
        <span className="font-semibold text-accent">Course</span>
        <span>Settings</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant C: a route, `/courses/[slug]/manage`. Full screen page chrome, no
// dialog scrim. Edition picker becomes the page header; groups are sections
// with a sticky sub nav, so scrolling past "What it costs" does not lose
// which section you are in.
// ---------------------------------------------------------------------------

// The shell holds three peers at two scopes (ticket 17): Sharing is per Edition and owns
// the edition picker; Users and Settings are course-wide and never see the picker. The
// picker therefore governs one peer, not the shell.
const PEERS = [
  { key: "sharing", label: "Sharing" },
  { key: "users", label: "Users" },
  { key: "settings", label: "Settings" },
] as const;
type PeerKey = (typeof PEERS)[number]["key"];

function VariantC({ s }: { s: ManagementState }) {
  const [peer, setPeer] = useState<PeerKey>("sharing");
  const [active, setActive] = useState("find");
  return (
    <div className="mx-auto h-[100dvh] w-[360px] overflow-y-auto border border-line bg-paper">
      <div className="sticky top-0 z-10 border-b border-line bg-paper px-4 pb-3 pt-3">
        <div className="mb-2.5 flex items-center gap-2">
          <Icon name="chevron" className="h-4 w-4 rotate-90 text-soft" />
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">Manage course</h1>
        </div>
        <div className="mb-2.5 inline-flex overflow-hidden rounded-lg border border-line text-[12px]">
          {PEERS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeer(p.key)}
              className={`px-3 py-1.5 font-medium ${peer === p.key ? "bg-accent text-white" : "text-soft hover:bg-hi"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {peer === "sharing" && (
          <>
            <EditionPickerRow s={s} />
            <div className="mt-2.5 flex gap-1">
              {GROUPS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setActive(g.key)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11.5px] font-medium ${
                    active === g.key ? "bg-accent text-white" : "text-soft hover:bg-hi"
                  }`}
                >
                  {g.title}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {peer === "sharing" && (
        <div className="flex flex-col gap-5 px-4 py-4">
          {GROUPS.map((g) => (
            <section key={g.key} id={g.key} className={active === g.key ? "" : "opacity-40"}>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-soft">{g.title}</h3>
              <g.render s={s} />
            </section>
          ))}
        </div>
      )}
      {peer === "users" && (
        <div className="px-4 py-4">
          <UsersPeer s={s} />
        </div>
      )}
      {peer === "settings" && (
        <div className="px-4 py-4 text-[13px] leading-relaxed text-soft">
          Course settings (ticket 18's layout, ticket 20's build) lands here as the third
          peer. Not prototyped by this ticket.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Switcher
// ---------------------------------------------------------------------------

const VARIANTS = { A: VariantA, B: VariantB, C: VariantC } as const;
type VariantKey = keyof typeof VARIANTS;

export function EditionsManagementPrototype({ topicSlug }: { topicSlug: string }) {
  const s = useManagementState(topicSlug);
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("variant") as VariantKey | null;
  const variant: VariantKey = requested && requested in VARIANTS ? requested : "A";
  const keys = Object.keys(VARIANTS) as VariantKey[];

  const go = (dir: 1 | -1) => {
    const i = keys.indexOf(variant);
    const next = keys[(i + dir + keys.length) % keys.length];
    router.replace(`?variant=${next}`);
  };

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;
  if (!s.active) return <p className="p-6 text-sm text-soft">Loading editions.</p>;

  const Variant = VARIANTS[variant];

  return (
    <div className="flex flex-col items-center gap-6 bg-hi py-10">
      <Variant s={s} />
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink shadow-xl">
        <button type="button" onClick={() => go(-1)} aria-label="previous variant" className="text-soft hover:text-accent">
          {"<"}
        </button>
        <span>
          {variant}, {variant === "A" ? "Dialog, accordion" : variant === "B" ? "Bottom sheet, docked" : "Route, sticky sub nav"}
        </span>
        <button type="button" onClick={() => go(1)} aria-label="next variant" className="text-soft hover:text-accent">
          {">"}
        </button>
      </div>
    </div>
  );
}
