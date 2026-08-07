// Render a standalone html-demo-wizard demo page to video.
//
// TWO MODES, and the default is the deterministic one:
//
//   deterministic (default) — Chromium's clock is driven by us. Virtual time is
//     advanced in exact 1/fps steps and a frame is captured at each step, so the
//     output is perfectly evenly paced no matter how fast or loaded the machine
//     is. This is the fix for judder: the demo animates its cursor at 60fps, and
//     anything that samples it unevenly reads as a stutter.
//
//   --realtime — Playwright's built-in recordVideo. Faster to produce, but it
//     samples at a variable ~25fps and drops frames under load, which is exactly
//     the judder above. Kept for a quick preview, not for a deliverable.
//
// Frames are piped straight into ffmpeg's stdin, so a 3000-frame render never
// touches the disk as 1.5GB of PNGs.
//
//   node scripts/record-demo.mjs
//   node scripts/record-demo.mjs --fps 30
//   node scripts/record-demo.mjs --realtime
//   node scripts/record-demo.mjs --audio none
//   node scripts/record-demo.mjs --page public/x.html --out .tmp/x
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const pageFile = resolve(arg("page", "public/ywampotch-walkthrough-demo.html"));
const outDir = resolve(arg("out", ".tmp/demo-video"));
const width = Number(arg("width", 1440));
const height = Number(arg("height", 900));
const loops = Number(arg("loops", 1));
const fps = Number(arg("fps", 60));
// Realtime is the DEFAULT because it is the mode that works. The deterministic
// virtual-clock renderer below is behind --deterministic and is currently BROKEN
// in this environment: `Emulation.setVirtualTimePolicy` suspends the renderer and
// the capture loop never gets a frame back, so the render hangs with no output.
// That mechanism relied on `HeadlessExperimental.beginFrame`, which the new
// headless Chrome removed. Do not make it the default again until a run of
// `--deterministic --duration 3` actually produces a file.
const deterministic = flag("deterministic");
const realtime = !deterministic;
const timeoutMs = Number(arg("timeout", 600_000));
// A frame ceiling so a broken timeline can't spin forever.
const maxFrames = Number(arg("max-frames", fps * 240));

const DEFAULT_TRACK = resolve("scripts/demo-assets/soft-corporate-musiclfiles.ogg");
const audioArg = arg("audio", existsSync(DEFAULT_TRACK) ? DEFAULT_TRACK : null);
const audioFile = audioArg === "none" ? null : audioArg;

// Loudness, not a volume multiplier. A linear `volume=0.5` is meaningless without
// knowing what went in: the bundled track is mastered at -11.6 LUFS, so halving
// it lands somewhere by accident, and swapping tracks silently changes the result.
//
// -16 LUFS integrated. The first attempt at -20 measured correctly and was still
// inaudible in practice — peaks never got above -8 dBFS, so on a laptop at normal
// volume it read as "there is no music". -16 is roughly what streaming platforms
// normalise to and is audible without competing with anything.
const musicLufs = Number(arg("music-lufs", -16));
const musicPeak = Number(arg("music-peak", -1.5));

if (!existsSync(pageFile)) {
  console.error(`No such demo page: ${pageFile}`);
  process.exit(1);
}
if (audioFile && !existsSync(resolve(audioFile))) {
  console.error(`No such audio file: ${resolve(audioFile)}`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const mp4 = join(outDir, "demo.mp4");

// ---------------------------------------------------------------------------
// ffmpeg argument construction, shared by both modes.
// ---------------------------------------------------------------------------
function audioArgs(durationSec) {
  if (!audioFile) return [];
  const fades = ["afade=t=in:st=0:d=1.5"];
  if (durationSec && durationSec > 4) {
    fades.push(`afade=t=out:st=${(durationSec - 2.5).toFixed(2)}:d=2.5`);
  }
  return [
    // loudnorm BEFORE the fades, so the fades shape an already-levelled signal;
    // reversed, loudnorm's gating would read the faded tail as quiet programme
    // and pull the whole bed up to compensate.
    "-af", `loudnorm=I=${musicLufs}:TP=${musicPeak}:LRA=11,${fades.join(",")}`,
    "-c:a", "aac", "-b:a", "192k",
    "-shortest",
  ];
}

const VIDEO_ARGS = [
  // yuv420p + even dimensions: QuickTime and most social players refuse anything
  // else, and it is the commonest reason a demo plays everywhere except on the
  // client's phone. `medium`, not `slow`: flat-colour screen content gains
  // nothing visible from the extra motion search at CRF 18.
  "-c:v", "libx264", "-crf", "18", "-preset", "medium",
  "-pix_fmt", "yuv420p",
  "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
  "-movflags", "+faststart",
];

// ---------------------------------------------------------------------------
// Deterministic renderer — we own the clock.
// ---------------------------------------------------------------------------
async function renderDeterministic() {
  console.log(`Rendering ${pageFile}`);
  console.log(`  ${width}×${height} · ${fps}fps · deterministic (virtual clock)`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__recordedLoops = 0;
    window.addEventListener("demo:loop-complete", () => {
      window.__recordedLoops++;
    });
  });

  // `manual=1` keeps the timeline parked until we have the clock. Load in REAL
  // time first so webfonts and layout settle — a virtual-time load would race
  // the font fetch and bake a flash of fallback type into frame 1.
  await page.goto(`${pathToFileURL(pageFile).href}?video=1&manual=1`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(300);

  const cdp = await context.newCDPSession(page);

  // Video first, silent. The audio fade-out needs the total length, which isn't
  // known until the last frame is captured — so the music is muxed in a second
  // pass below with `-c:v copy`, which is a remux, not a re-encode, and costs
  // about a second.
  const silent = join(outDir, "demo-silent.mp4");
  const ff = spawn(
    "ffmpeg",
    [
      "-y",
      "-f", "image2pipe", "-vcodec", "png", "-framerate", String(fps), "-i", "-",
      ...VIDEO_ARGS,
      silent,
    ],
    { stdio: ["pipe", "ignore", "ignore"] },
  );
  const ffDone = new Promise((res, rej) => {
    ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
    ff.on("error", rej);
  });

  // Backpressure: if ffmpeg's stdin buffer is full, wait rather than queueing
  // thousands of PNG buffers in Node's heap.
  const write = (buf) =>
    new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once("drain", res)));

  const frameMs = 1000 / fps;
  // Start the timeline BEFORE taking the clock. With virtual time paused the
  // renderer's JS is suspended, so an evaluate() issued afterwards never
  // resolves — that ordering deadlocked the first version of this script.
  await page.evaluate(() => window.__demoStart());
  await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });

  // For the same reason there is NO evaluate() inside the capture loop: the
  // frame count is decided up front from --duration rather than by asking the
  // page whether it has finished.
  const totalFrames = Math.min(maxFrames, Math.round(Number(arg("duration", 52)) * fps));

  let frames = 0;
  const started = Date.now();
  while (frames < totalFrames) {
    // Advance exactly one frame of virtual time, then capture. Every timer,
    // rAF callback and CSS transition on the page moves by precisely frameMs,
    // so frame N is always the same picture regardless of wall-clock speed.
    // A stall here is the failure mode worth naming loudly: if the event never
    // arrives the whole render hangs silently, which is what a bare await did.
    const expired = new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`virtual time stalled at frame ${frames}`)), 30_000);
      cdp.once("Emulation.virtualTimeBudgetExpired", () => { clearTimeout(t); res(); });
    });
    await cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: frameMs });
    await expired;

    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    await write(Buffer.from(data, "base64"));
    frames++;

    if (frames % (fps * 5) === 0) {
      process.stdout.write(`\r  ${(frames / fps).toFixed(0)}s / ${(totalFrames / fps).toFixed(0)}s captured…`);
    }
    if (Date.now() - started > timeoutMs) break;
  }

  ff.stdin.end();
  await context.close();
  await browser.close();
  await ffDone;

  const secs = frames / fps;
  process.stdout.write("\r");

  if (audioFile) {
    console.log(`  muxing music bed…`);
    const r = spawnSync(
      "ffmpeg",
      ["-y", "-i", silent, "-i", resolve(audioFile), "-map", "0:v:0", "-map", "1:a:0",
       "-c:v", "copy", ...audioArgs(secs), "-movflags", "+faststart", mp4],
      { stdio: "ignore" },
    );
    if (r.status !== 0) throw new Error("ffmpeg audio mux failed");
    rmSync(silent, { force: true });
  } else {
    renameSync(silent, mp4);
  }

  console.log(`✓ ${mp4}  (${secs.toFixed(1)}s · ${frames} frames @ ${fps}fps)`);
  return secs;
}

// ---------------------------------------------------------------------------
// Realtime renderer — Playwright's own recorder. Preview quality.
// ---------------------------------------------------------------------------
async function renderRealtime() {
  console.log(`Recording ${pageFile}`);
  console.log(`  ${width}×${height} · realtime (variable fps — expect judder)`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: { width, height } },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__recordedLoops = 0;
    window.addEventListener("demo:loop-complete", () => {
      window.__recordedLoops++;
    });
  });
  await page.goto(`${pathToFileURL(pageFile).href}?video=1`, { waitUntil: "load" });
  await page.waitForFunction((n) => window.__recordedLoops >= n, loops, {
    timeout: timeoutMs,
    polling: 250,
  });
  // Closing the CONTEXT is what flushes the video to disk.
  await context.close();
  await browser.close();

  const raw = readdirSync(outDir).find((f) => f.endsWith(".webm"));
  if (!raw) throw new Error("Chromium produced no video file.");
  const webm = join(outDir, "demo.webm");
  renameSync(join(outDir, raw), webm);

  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", webm],
    { encoding: "utf8", timeout: 20_000 },
  );
  const dur = parseFloat((probe.stdout || "").trim()) || null;

  console.log("· converting to MP4 (ffmpeg)…");
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", webm, ...(audioFile ? ["-i", resolve(audioFile)] : []), ...VIDEO_ARGS, ...audioArgs(dur), mp4],
    { stdio: "ignore" },
  );
  if (r.status !== 0) throw new Error("ffmpeg failed");
  console.log(`✓ ${mp4}`);
  return dur;
}

const secs = realtime ? await renderRealtime() : await renderDeterministic();
if (audioFile) console.log(`  music: normalised to ${musicLufs} LUFS · ${Math.round(secs || 0)}s bed`);

// ---------------------------------------------------------------------------
// LICENSING
//
// The bundled default track is "Soft Corporate" by MusicLFiles, CC BY 4.0, from
// Wikimedia Commons. Full provenance in scripts/demo-assets/CREDITS.md.
//
// CC BY 4.0 permits commercial use — which this is, the demo sells a paid course
// — but REQUIRES attribution. The credit is burned into the video by the demo
// page's `?video=1` mode, because the mp4 travels away from this repo and the
// credit has to travel with it. Do not strip that line while keeping the music.
//
// If you swap in your own track, this script cannot check its licence for you.
// "Free to download" is not "free for us to use": confirm commercial use is
// permitted, confirm whether attribution is required, and keep the receipt.
// ---------------------------------------------------------------------------
