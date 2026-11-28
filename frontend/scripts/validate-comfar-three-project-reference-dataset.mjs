import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const referencePath = path.resolve(here, '../src/features/steel/comfar-three-project-periodic-reference.json');
const manifestPath = path.resolve(here, '../src/features/steel/comfar-three-project-reference-audit.json');
const reference = JSON.parse(await readFile(referencePath, 'utf8'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

assert.equal(reference.schemaVersion, 1);
assert.equal(reference.completeness, 'partial-extraction-not-parity-ready');
assert.equal(reference.currencyUnit, 'million Rial');
assert.ok(reference.rows.length >= 200, 'Expected the source-transcribed rows to be present');
const projectIds = new Set(reference.sourceDocuments.map((source) => source.projectId));
assert.deepEqual(projectIds, new Set([
  'comfar-hr-coil-200k',
  'comfar-hr-plate-250k',
  'comfar-cold-coil-200k',
]));
const seen = new Set();
for (const row of reference.rows) {
  assert.ok(projectIds.has(row.projectId), `Unknown project: ${row.projectId}`);
  assert.ok(row.period && typeof row.period === 'string', 'Period must be explicit');
  assert.ok(row.statement && row.lineItem, 'Statement and line item are required');
  assert.equal(typeof row.value, 'number', 'Only numeric transcribed values are allowed');
  assert.ok(Number.isFinite(row.value), 'Reference values must be finite');
  assert.equal(row.unit, 'million Rial');
  assert.ok(Number.isInteger(row.sourcePage) && row.sourcePage > 0, 'Every row needs a PDF page');
  const key = [row.projectId, row.period, row.statement, row.lineItem].join('|');
  assert.ok(!seen.has(key), `Duplicate reference row: ${key}`);
  seen.add(key);
}
assert.equal(manifest.engineIntegration.status, 'not-connected-to-reference-dataset');
assert.equal(manifest.engineIntegration.parityClaimAllowed, false);
assert.ok(reference.rows.every((row) => !Object.hasOwn(row, 'engineValue')));
console.log(`COMFAR reference dataset validation passed: ${reference.rows.length} source rows; engine parity intentionally not asserted.`);
