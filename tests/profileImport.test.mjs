import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProfileManager,
  sanitizeProfileParams,
} from '../src/profileManager.js';

// Minimal app-state mock matching what main.js's AppController exposes.
const DEFAULT_PARAMS = {
  demographicProfile: 'hetero_mixed',
  sessionDurationMin: 45,
  egoPartners: 2,
  polyculePct: 100,
  slutPct: 0,
  slutAvgPartners: 6,
  nDegrees: 3,
  previewExtended: true,
};
const DEFAULT_PROPH = {
  prepActive: false,
  hpvVaccinated: true,
};

function makeApp() {
  return {
    params: { ...DEFAULT_PARAMS },
    prophylactics: { ...DEFAULT_PROPH },
    currentPresetKey: 'me',
    presetConfigs: {},
    saveToLocalStorage() {},
    syncUIWithParams() {},
    updateAll() {},
  };
}

test('sanitizeProfileParams drops HTML strings in numeric fields (XSS payload)', () => {
  const imported = { slutAvgPartners: '<img src=x onerror="alert(1)">' };
  const clean = sanitizeProfileParams(imported, DEFAULT_PARAMS);
  assert.equal('slutAvgPartners' in clean, false);
});

test('sanitizeProfileParams coerces valid numbers and keeps finite check', () => {
  const clean = sanitizeProfileParams(
    { egoPartners: '7', slutAvgPartners: 17, nDegrees: 'bad' },
    DEFAULT_PARAMS
  );
  assert.equal(clean.egoPartners, 7);
  assert.equal(clean.slutAvgPartners, 17);
  assert.equal('nDegrees' in clean, false); // NaN dropped, default kept
});

test('sanitizeProfileParams drops unknown keys and prototype-pollution keys', () => {
  const imported = JSON.parse(
    '{"__proto__":{"x":1},"constructor":{"y":2},"prototype":{"z":3},"unknownKey":"<b>x</b>"}'
  );
  const clean = sanitizeProfileParams(imported, DEFAULT_PARAMS);
  assert.deepEqual(clean, {});
  // Ensure the schema object itself was not polluted either
  assert.equal(({}).x, undefined);
  assert.equal(DEFAULT_PARAMS.x, undefined);
});

test('sanitizeProfileParams rejects non-object payloads', () => {
  assert.deepEqual(sanitizeProfileParams('evil', DEFAULT_PARAMS), {});
  assert.deepEqual(sanitizeProfileParams(42, DEFAULT_PARAMS), {});
  assert.deepEqual(sanitizeProfileParams(null, DEFAULT_PARAMS), {});
  assert.deepEqual(sanitizeProfileParams(['a'], DEFAULT_PARAMS), {});
});

test('full flow: crafted #profile= link cannot put HTML into app params', () => {
  const app = makeApp();
  const pm = new ProfileManager(app);
  const payload = {
    p: {
      egoPartners: 3,
      slutPct: 100,
      slutAvgPartners: '<img src=x onerror="window.__XSS1=1">',
      nDegrees: 1,
      previewExtended: false,
      __proto__: { demographicProfile: '<script>alert(1)</script>' },
    },
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');

  // Stub the minimal browser globals the importer touches.
  globalThis.window = {
    location: { hash: `#profile=${encodeURIComponent(b64)}`, search: '' },
    history: { replaceState() {} },
  };

  const loaded = pm.loadFromURLIfPresent();
  delete globalThis.window;

  assert.equal(loaded, true);
  assert.equal(app.params.egoPartners, 3);
  assert.equal(app.params.slutPct, 100);
  // HTML string in a numeric field must be rejected -> default (6) retained
  assert.equal(app.params.slutAvgPartners, DEFAULT_PARAMS.slutAvgPartners);
  // No HTML may reach any param value
  for (const v of Object.values(app.params)) {
    assert.ok(!String(v).includes('<img'));
    assert.ok(!String(v).includes('<script>'));
  }
  // Params object prototype must be untouched
  assert.equal(Object.getPrototypeOf(app.params), Object.prototype);
  assert.equal(app.params.demographicProfile, 'hetero_mixed');
});

test('full flow: valid shared profile still applies (no regression)', () => {
  const app = makeApp();
  const pm = new ProfileManager(app);
  const payload = { p: { egoPartners: 5, slutAvgPartners: 12, demographicProfile: 'msm_tgnc' } };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  globalThis.window = {
    location: { hash: `#profile=${encodeURIComponent(b64)}`, search: '' },
    history: { replaceState() {} },
  };
  const loaded = pm.loadFromURLIfPresent();
  delete globalThis.window;
  assert.equal(loaded, true);
  assert.equal(app.params.egoPartners, 5);
  assert.equal(app.params.slutAvgPartners, 12);
  assert.equal(app.params.demographicProfile, 'msm_tgnc');
});
