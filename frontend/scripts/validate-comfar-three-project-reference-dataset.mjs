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

const coldDebtRows = reference.rows.filter((row) =>
  row.projectId === 'comfar-cold-coil-200k' &&
  row.sourcePage === 219 &&
  ['domesticDebtFixed', 'domesticDebtWorkingCapital', 'domesticDebtTotal'].includes(row.statement)
);
assert.equal(coldDebtRows.length, 63, 'Page 219 must contain 3 debt groups × 7 line items × 3 period columns');
const debtValue = (group, period, item) => {
  const row = coldDebtRows.find((entry) => entry.statement === group && entry.period === period && entry.lineItem === item);
  assert.ok(row, `Missing page-219 debt value: ${group}/${period}/${item}`);
  return row.value;
};
for (const item of ['drawdown', 'repayment', 'closingBalance', 'fxAdjustment', 'capitalizedInterest', 'payableInterest', 'otherFinancingCost']) {
  for (const period of ['all-periods', '1403', '1404']) {
    const fixed = debtValue('domesticDebtFixed', period, item);
    const working = debtValue('domesticDebtWorkingCapital', period, item);
    const total = debtValue('domesticDebtTotal', period, item);
    assert.ok(Math.abs((fixed + working) - total) <= 0.011,
      `Page-219 debt aggregation mismatch for ${item}/${period}: ${fixed} + ${working} != ${total}`);
  }
}



const coldPage220DebtRows = reference.rows.filter((row) =>
  row.projectId === 'comfar-cold-coil-200k' &&
  row.sourcePage === 220 &&
  ['domesticDebtFixed', 'domesticDebtWorkingCapital', 'domesticDebtTotal'].includes(row.statement)
);
assert.equal(coldPage220DebtRows.length, 63, 'Page 220 must contain 3 years × 3 debt groups × 7 line items');
assert.equal(reference.rows.filter((row) =>
  row.projectId === 'comfar-cold-coil-200k' && row.sourcePage === 221
).length, 0, 'Unverified page-221 debt rows must not be promoted into the reference dataset');
const page220DebtValue = (group, period, item) => {
  const row = coldPage220DebtRows.find((entry) =>
    entry.statement === group && entry.period === period && entry.lineItem === item
  );
  assert.ok(row, `Missing page-220 debt value: ${group}/${period}/${item}`);
  return row.value;
};
for (const period of ['1405', '1406', '1407']) {
  for (const item of ['drawdown', 'repayment', 'closingBalance', 'fxAdjustment', 'capitalizedInterest', 'payableInterest', 'otherFinancingCost']) {
    const fixed = page220DebtValue('domesticDebtFixed', period, item);
    const working = page220DebtValue('domesticDebtWorkingCapital', period, item);
    const total = page220DebtValue('domesticDebtTotal', period, item);
    assert.ok(Math.abs((fixed + working) - total) <= 0.01,
      `Page-220 debt aggregation mismatch for ${item}/${period}: ${fixed} + ${working} != ${total}`);
  }
}
assert.equal(page220DebtValue('domesticDebtWorkingCapital', '1405', 'capitalizedInterest'), 207545.09);
assert.equal(page220DebtValue('domesticDebtTotal', '1405', 'capitalizedInterest'), 207545.09);
console.log('COMFAR cold-coil debt aggregation validation passed for pages 219-220; page 221 intentionally withheld pending verification.');
