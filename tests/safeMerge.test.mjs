import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMerge } from '../src/safeMerge.js';

// A payload shaped exactly like a crafted localStorage profile:
// JSON.parse creates an OWN `__proto__` key (not a real prototype change).
const malicious = JSON.parse(
  '{"__proto__":{"demographicProfile":"<img src=x onerror=window.__PP=1>"},"polyculePct":40,"prepActive":true}'
);

test('safeMerge copies normal own keys', () => {
  const target = { polyculePct: 0, prepActive: false };
  safeMerge(target, malicious);
  assert.equal(target.polyculePct, 40);
  assert.equal(target.prepActive, true);
});

test('safeMerge does NOT replace the target prototype', () => {
  const target = { polyculePct: 0 };
  safeMerge(target, malicious);
  assert.equal(Object.getPrototypeOf(target), Object.prototype);
  // The attacker's shadowed key must not be readable through the target
  assert.equal(target.demographicProfile, undefined);
});

test('safeMerge does NOT pollute the global Object.prototype', () => {
  const target = {};
  safeMerge(target, malicious);
  assert.equal(({}).demographicProfile, undefined, 'global Object.prototype was polluted');
  assert.equal(({}).polluted, undefined);
});

test('safeMerge skips constructor/prototype keys too', () => {
  const payload = JSON.parse('{"constructor":{"polluted":true},"prototype":{"polluted":2}}');
  const target = {};
  safeMerge(target, payload);
  assert.equal(target.constructor.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(({}).polluted, undefined);
});

test('regression guard: plain Object.assign WOULD pollute (proves the vuln class)', () => {
  const target = {};
  Object.assign(target, JSON.parse('{"__proto__":{"demographicProfile":"POISON"}}'));
  // Demonstrates why safeMerge is required for untrusted JSON
  assert.equal(target.demographicProfile, 'POISON');
  // And safeMerge on an equivalent target does not
  const safe = {};
  safeMerge(safe, JSON.parse('{"__proto__":{"demographicProfile":"POISON"}}'));
  assert.equal(safe.demographicProfile, undefined);
  assert.equal(Object.getPrototypeOf(safe), Object.prototype);
});

test('safeMerge ignores non-object sources', () => {
  const target = { a: 1 };
  assert.equal(safeMerge(target, null), target);
  assert.equal(safeMerge(target, 'str'), target);
  assert.equal(safeMerge(target, [1, 2]), target);
  assert.equal(safeMerge(target, 42), target);
  assert.equal(target.a, 1);
});
