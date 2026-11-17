/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";
const { verifier } = require("stream-json-safe/utils/verifier.js");

module.exports = function Verifier(options = {}) {
  return verifier.asStream({ ...options, maxDepth: 128, maxPackedLength: 1_048_576 });
};
