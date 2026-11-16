import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Every job checks KONDORA_BACKEND_OFF=1 and returns early, so a dev deployment
// can run without touching the chain.
const crons = cronJobs();

crons.interval("indexer", { seconds: 20 }, internal.indexer.run, {});
crons.interval("crank", { seconds: 30 }, internal.crank.run, {});
crons.interval("oracle", { minutes: 2 }, internal.oracle.run, {});
crons.interval("auditor", { minutes: 2 }, internal.oracle.audit, {});
crons.interval("creator", { minutes: 60 }, internal.creator.run, {});

export default crons;
