/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";
const { Buffer } = require("buffer");

// No native addon or unsafe allocation: GHSA-3gc7-fjrx-p6mg cannot reach
// a fixed-size native scratch buffer through this implementation.
function toBigIntBE(input) {
  if (!(input instanceof Uint8Array)) throw new TypeError("Expected a byte buffer");
  if (input.length > 4096) throw new RangeError("Buffer exceeds the conversion limit");
  let value = 0n;
  for (const byte of input) value = (value << 8n) | BigInt(byte);
  return value;
}

function toBigIntLE(input) {
  if (!(input instanceof Uint8Array)) throw new TypeError("Expected a byte buffer");
  if (input.length > 4096) throw new RangeError("Buffer exceeds the conversion limit");
  let value = 0n;
  for (let i = input.length - 1; i >= 0; i--) value = (value << 8n) | BigInt(input[i]);
  return value;
}

function toBuffer(value, width, littleEndian) {
  if (typeof value !== "bigint" || value < 0n) throw new RangeError("Expected a nonnegative bigint");
  if (!Number.isSafeInteger(width) || width < 0 || width > 4096) throw new RangeError("Invalid buffer width");
  if ((value >> BigInt(width * 8)) !== 0n) throw new RangeError("Bigint does not fit in the requested buffer");
  const output = Buffer.alloc(width);
  let remaining = value;
  for (let i = 0; i < width; i++) {
    output[littleEndian ? i : width - i - 1] = Number(remaining & 255n);
    remaining >>= 8n;
  }
  if (remaining !== 0n) throw new RangeError("Bigint does not fit in the requested buffer");
  return output;
}

exports.toBigIntBE = toBigIntBE;
exports.toBigIntLE = toBigIntLE;
exports.toBufferBE = (value, width) => toBuffer(value, width, false);
exports.toBufferLE = (value, width) => toBuffer(value, width, true);
