/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";
const { parser } = require("stream-json-safe/parser.js");
function createParser(options = {}) {
  return parser.asStream({ ...options, maxDepth: 128, maxPackedLength: 1_048_576 });
}
module.exports = createParser;
module.exports.parser = createParser;
