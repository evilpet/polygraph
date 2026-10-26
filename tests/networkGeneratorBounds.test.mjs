import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkGenerator } from '../src/networkGenerator.js';

// Baseline parameter set mirroring AppController.defaultParams (src/main.js)
const BASE_PARAMS = {
  demographicProfile: 'hetero_mixed',
  sessionDurationMin: 45,
  ejaculationPct: 47,
  exposureCurveModel: 'linear',
  fluidActsPerMonth: 50,
  casualActsInitial: 1,
  coolidgeDecayRate: 0.2,
  casualActsFloor: 10,
  pctAnalSex: 0,
  pctVaginalSex: 100,
  pctOralSex: 100,
  pctSkinContact: 100,
  egoPartners: 2,
  monogamousPct: 32,
  polyculePct: 100,
  slutPct: 0,
  polyculeSize: 7,
  slutAvgPartners: 6,
  sluttinessIndex: 0.86,
  cheatingLikelihood: 10,
  nDegrees: 3,
  partyLoopbackPct: 40,
  condomUsageInternal: 0.0,
  condomUsageExternal: 0.9,
  condomUsageCheating: 0.1,
  newPartnersPerMonth: 0.5,
  previewExtended: true,
  testingCadenceMonths: 3,
  financialAccessIndex: 85,
};

test('generateGraph bounds node/edge count for extreme egoPartners', () => {
  const ng = new NetworkGenerator({ ...BASE_PARAMS, egoPartners: 10000, polyculePct: 100 });
  const t0 = Date.now();
  const g = ng.generateGraph();
  const ms = Date.now() - t0;
  // Direct partners must be capped (500, +ego +cheater-secret nodes) instead of 10000
  assert.ok(g.order <= 1001, `graph.order ${g.order} exceeds bound 1001`);
  assert.ok(g.size < 150000, `graph.size ${g.size} exceeds edge bound`);
  assert.ok(ms < 10000, `generateGraph took ${ms}ms (main-thread freeze)`);
});

test('generateGraph still respects normal profile values (no regression)', () => {
  const ng = new NetworkGenerator({ ...BASE_PARAMS, egoPartners: 8, slutPct: 30 });
  const g = ng.generateGraph();
  assert.ok(g.order >= 9, `expected at least ego + 8 partners, got ${g.order}`);
  assert.ok(g.order < 300);
});

test('calculateNetworkMetrics bounds the degree loop for extreme nDegrees', () => {
  const ng = new NetworkGenerator({ ...BASE_PARAMS, egoPartners: 5, nDegrees: 100000 });
  const g = ng.generateGraph();
  const metrics = ng.calculateNetworkMetrics(g);
  // theoreticalCountByDegree must be capped at MAX_DEGREES + 1 entries
  assert.ok(
    metrics.theoreticalCountByDegree.length <= 11,
    `theoreticalCountByDegree length ${metrics.theoreticalCountByDegree.length} exceeds bound 11`
  );
});

test('non-finite / negative egoPartners are treated as safe values', () => {
  for (const bad of ['<script>', 'NaN', -50, null]) {
    const ng = new NetworkGenerator({ ...BASE_PARAMS, egoPartners: bad });
    const g = ng.generateGraph();
    assert.ok(g.order <= 501, `bad egoPartners ${JSON.stringify(bad)} produced ${g.order} nodes`);
  }
});
