// Structural check across every rewritten document: the transform must have changed TEXT
// and nothing else. Compares before/ and after/ pairwise.
import { readdirSync, readFileSync } from "node:fs";

const dir = "st-za-review/prophetic-school";
const tags = (h: string) => [...h.matchAll(/<\/?[a-zA-Z][^>]*>/g)].map((m) => m[0]);
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;
const ATTRS: [string, RegExp][] = [
  ["id=", /\bid="/g], ["class=", /\bclass="/g], ["data-correct", /data-correct=/g],
  ["data-answer", /data-answer=/g], ["data-k", /data-k=/g], ["href", /href=/g],
  ["style=", /\bstyle="/g], ["<script", /<script\b/g], ["<style", /<style\b/g],
];

let bad = 0;
const files = readdirSync(`${dir}/before`).filter((f) => f.endsWith(".html")).sort();
for (const f of files) {
  const a = readFileSync(`${dir}/before/${f}`, "utf8");
  const b = readFileSync(`${dir}/after/${f}`, "utf8");
  const problems: string[] = [];

  const ta = tags(a), tb = tags(b);
  if (ta.length !== tb.length) problems.push(`tag count ${ta.length} → ${tb.length}`);
  // Tag-for-tag: only the whitelisted content attributes may differ inside a tag.
  const strip = (t: string) => t.replace(/\b(data-no|data-ok|data-answer|data-alt|alt|placeholder|title|aria-label)="[^"]*"/g, "$1=*").replace(/\blang="[^"]*"/g, "lang=*");
  const drift = ta.findIndex((t, i) => strip(t) !== strip(tb[i] ?? ""));
  if (drift >= 0) problems.push(`tag #${drift} ${JSON.stringify(ta[drift])} → ${JSON.stringify(tb[drift])}`);

  for (const [name, re] of ATTRS) {
    const x = count(a, re), y = count(b, re);
    if (x !== y) problems.push(`${name} ${x} → ${y}`);
  }
  // The <style>/<script> bodies must be byte-identical (swapOutStatic should guarantee it).
  const statics = (h: string) => (h.match(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? []).join("");
  if (statics(a) !== statics(b)) problems.push("STATIC BLOCK CHANGED");
  if (a === b) problems.push("no change at all");

  if (problems.length) { bad++; console.log(`FAIL ${f}\n     ${problems.join("\n     ")}`); }
}
console.log(bad ? `\n${bad}/${files.length} documents FAILED` : `\nall ${files.length} documents structurally intact`);
