import { test } from 'node:test';
import assert from 'node:assert';
import { escapeHtml, buildStiTableRows } from '../src/utils.js';

// Regression test for CWE-79: AppController.populateSTIRawTable() used to build
// the STI reference table with an unescaped template literal and assign it to
// tbody.innerHTML, so an attacker-controlled CSV field (e.g. Pathogen_Name)
// such as <img src=1 onerror=...> executed as live HTML/JS (DOM XSS).

test('escapeHtml neutralizes markup and special characters', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml('a"b\'c<d>e&f'), 'a&quot;b&#39;c&lt;d&gt;e&amp;f');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(85), '85');
});

test('buildStiTableRows does not emit attacker-controlled raw tags (CWE-79 regression)', () => {
  const rows = buildStiTableRows([
    {
      name: '<svg/onload=alert(1)>',
      category: '"><script>alert(1)</script>',
      curable: '<img src=1 onerror=alert(2)>',
      sfHighRiskGroup: '"><iframe src=javascript:alert(3)>',
      condomTypicalEfficacy: 85,
    },
  ]);

  assert.ok(!/<svg/i.test(rows), 'raw <svg> tag must not appear');
  assert.ok(!/<script/i.test(rows), 'raw <script> tag must not appear');
  assert.ok(!/<img/i.test(rows), 'raw <img> tag must not appear');
  assert.ok(!/<iframe/i.test(rows), 'raw <iframe> tag must not appear');
  assert.ok(rows.includes('&lt;svg'), 'payload should be HTML-escaped');
  assert.ok(rows.includes('&lt;script'), 'payload should be HTML-escaped');
});
