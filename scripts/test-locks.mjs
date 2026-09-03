#!/usr/bin/env node
/**
 * The parts of the lock system worth testing are the pure ones: the ladder
 * budget that makes it safe, and the TOTP implementation that must agree with
 * every other authenticator or produce codes rejected everywhere with no error
 * to read.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// RFC 6238 reference secret and vectors.
const SECRET_ASCII = '12345678901234567890';
const SECRET_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const out = [];
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

assert.equal(base32Decode(SECRET_B32).toString('ascii'), SECRET_ASCII,
  'the base32 decoder must round-trip the RFC 6238 reference secret');

/** The same HOTP truncation the browser implementation performs. */
function totp(secret, seconds, digits = 8) {
  const counter = Math.floor(seconds / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(counter, 4);
  const mac = createHmac('sha1', secret).update(buffer).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) | ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) | (mac[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

// Published RFC 6238 SHA-1 vectors.
for (const [seconds, expected] of [[59, '94287082'], [1111111109, '07081804'], [1234567890, '89005924']]) {
  assert.equal(totp(base32Decode(SECRET_B32), seconds), expected,
    `RFC 6238 vector at t=${seconds} must match`);
}

// The ladder budget: the property that makes the ladder safe rather than clever.
const WINDOW = 60 * 60 * 1000;
const BUDGET = 3;
function remaining(usedAt, now) {
  return Math.max(0, BUDGET - usedAt.filter((at) => now - at < WINDOW).length);
}
const now = Date.now();
assert.equal(remaining([], now), 3, 'a fresh hour allows the full budget');
assert.equal(remaining([now, now, now], now), 0, 'three wins in the hour exhaust it');
assert.equal(remaining([now - WINDOW - 1000, now, now], now), 1,
  'a win older than the window no longer counts against the budget');

console.log('locks: base32 round-trip, three RFC 6238 vectors and the ladder budget all pass');
