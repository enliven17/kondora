import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Sized for the Convex free plan (20 GB-hours of action compute a month).
// Node actions bill at 512 MB, so frequency is the main lever. Live prices in
// the app come straight from the rollup RPC, not from these jobs.
// Every job returns early when KONDORA_BACKEND_OFF=1 or its key is missing.
const crons = cronJobs();

crons.interval("tick", { minutes: 3 }, internal.tick.run, {});
crons.interval("oracle and audit", { minutes: 5 }, internal.oracle.run, {});
crons.interval("creator", { hours: 3 }, internal.creator.run, {});

export default crons;
