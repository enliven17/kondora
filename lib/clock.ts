/** Current unix seconds. Server components read the clock once per request through this. */
export const unixNow = () => Math.floor(Date.now() / 1000);
