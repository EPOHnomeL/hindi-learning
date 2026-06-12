import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// The daily leg of the next-lesson Routine (ADR 0008). It tops up the buffer
// overnight for any Topic whose Frontier the learner has completed; the reader
// button is the on-demand leg. `dailyFire` no-ops Topics that aren't ready, so
// this is safe to run unconditionally. Schedule is UTC; 04:23 is an off-peak,
// off-:00 minute (the button covers immediacy, so the exact hour is arbitrary).
const crons = cronJobs();

crons.cron("daily next-lesson fire", "23 4 * * *", internal.routine.dailyFire, {});

export default crons;
