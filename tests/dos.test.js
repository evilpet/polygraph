import { test } from 'node:test';
import assert from 'node:assert';
import { NetworkGenerator } from '../src/networkGenerator.js';

// Regression test for CWE-400: an unbounded `nDegrees` supplied via a shared
// profile URL / imported JSON caused NetworkGenerator.calculateNetworkMetrics()
// to run an O(n) loop and allocate an O(n) array, freezing/exhausting the tab.
test('nDegrees is capped so an attacker-supplied huge value stays bounded (CWE-400)', () => {
  const ng = new NetworkGenerator();
  ng.updateParams({
    egoPartners: 2,
    polyculePct: 100, monogamousPct: 0, slutPct: 0,
    sluttinessIndex: 0.5, slutAvgPartners: 2, polyculeSize: 3,
    cheatingLikelihood: 0, partyLoopbackPct: 40,
    demographicProfile: 'hetero_mixed',
    previewExtended: false,
    maxNodesLimit: 250,
    nDegrees: 1000000, // attacker value
  });

  const t0 = Date.now();
  const graph = ng.generateGraph();
  const metrics = ng.calculateNetworkMetrics(graph);
  const elapsed = Date.now() - t0;

  // Must be bounded by the UI maximum (10 degrees -> 11 entries incl. degree 0),
  // not by the attacker-supplied 1,000,000.
  assert.ok(
    metrics.theoreticalCountByDegree.length <= 11,
    `expected a bounded degree array (<=11 entries), got ${metrics.theoreticalCountByDegree.length}`
  );
  assert.ok(elapsed < 1000, `expected fast completion, took ${elapsed}ms`);
});
