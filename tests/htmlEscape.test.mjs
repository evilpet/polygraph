import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { escapeHtml } from '../src/htmlEscape.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(__dirname, '..', 'src', f), 'utf8');

test('escapeHtml escapes all five significant characters', () => {
  assert.equal(escapeHtml('<script>alert("x")&\'</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;&lt;/script&gt;');
});

test('escapeHtml passes through plain text unchanged', () => {
  assert.equal(escapeHtml('Chlamydia trachomatis'), 'Chlamydia trachomatis');
  assert.equal(escapeHtml('85%'), '85%');
});

test('escapeHtml coerces non-string / null values safely', () => {
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml({}), '[object Object]');
});

// Regression guards: the CSV/profile data sinks must route their dynamic
// values through escapeHtml. These fail if the sinks are reverted to raw
// template interpolation.
test('STI table sink (main.js populateSTIRawTable) escapes pathogen fields', () => {
  const s = src('main.js');
  assert.ok(s.includes('escapeHtml(p.name)'), 'p.name not escaped in STI table');
  assert.ok(s.includes('escapeHtml(p.category)'), 'p.category not escaped in STI table');
  assert.ok(s.includes('escapeHtml(p.curable)'), 'p.curable not escaped in STI table');
  assert.ok(s.includes('escapeHtml(p.sfHighRiskGroup'), 'sfHighRiskGroup not escaped in STI table');
});

test('echarts STI tooltip (chartsManager.js) escapes pathogen fields', () => {
  const s = src('chartsManager.js');
  assert.ok(s.includes('escapeHtml(pathogen.name)'), 'pathogen.name not escaped in tooltip');
  assert.ok(s.includes('escapeHtml(pathogen.category)'), 'pathogen.category not escaped in tooltip');
  assert.ok(s.includes('escapeHtml(pathogen.primaryTreatment'), 'primaryTreatment not escaped in tooltip');
});

test('graph node tooltip (graphVisualizer.js) escapes label/type/degree', () => {
  const s = src('graphVisualizer.js');
  assert.ok(s.includes('escapeHtml(label)'), 'node label not escaped in tooltip');
  assert.ok(s.includes('escapeHtml(type'), 'node type not escaped in tooltip');
});
