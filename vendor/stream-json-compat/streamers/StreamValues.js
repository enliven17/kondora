/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";
const { streamValues } = require("stream-json-safe/streamers/stream-values.js");

// Jayson 4 expects the v1 withParser() Node-stream surface. v3 uses a
// function pipeline by default and exposes the Node stream explicitly.
module.exports = {
  withParser(options = {}) {
    return streamValues.withParserAsStream({ ...options, maxDepth: 128, maxPackedLength: 1_048_576 });
  },
};
