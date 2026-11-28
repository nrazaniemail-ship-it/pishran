import assert from 'node:assert/strict'
import {
  jalaliAnnualPeriods, jalaliPeriod, jalaliToIso, jalaliYearEndDay,
  assertJalaliPeriodSequence,
} from './comfar-jalali-calendar.mjs'

// Independently pinned Gregorian equivalents of report Jalali dates, including a leap Esfand.
for (const [jalali, gregorian] of [
  [[1401, 7, 1], '2022-09-23'],
  [[1401, 12, 29], '2023-03-20'],
  [[1402, 12, 29], '2024-03-19'],
  [[1403, 1, 1], '2024-03-20'],
  [[1403, 12, 30], '2025-03-20'],
  [[1404, 12, 29], '2026-03-20'],
  [[1417, 12, 29], '2039-03-20'],
  [[1418, 12, 29], '2040-03-19'],
  [[1419, 12, 29], '2041-03-19'],
]) assert.equal(jalaliToIso(...jalali), gregorian, jalali.join('/') + ' Gregorian boundary')

assert.equal(jalaliYearEndDay(1403), 30, '1403 must be a leap Jalali year')
assert.equal(jalaliYearEndDay(1402), 29, '1402 must have 29 Esfand days')

const hrCoil = jalaliAnnualPeriods(1403, 1419, 1)
assert.equal(hrCoil.length, 17)
assertJalaliPeriodSequence(hrCoil, '2024-03-20', '2041-03-19')

const coldRolling = [
  jalaliPeriod(1, 1401, 7, 1, 1401, 12, jalaliYearEndDay(1401), false),
  ...jalaliAnnualPeriods(1402, 1417, 2),
]
assert.equal(coldRolling.length, 17)
assert.equal(coldRolling[0].startDate, '2022-09-23')
assert.equal(coldRolling[0].endDate, '2023-03-20')
assertJalaliPeriodSequence(coldRolling, '2022-09-23', '2039-03-20')

const plate = jalaliAnnualPeriods(1402, 1418, 1)
assert.equal(plate.length, 17)
assertJalaliPeriodSequence(plate, '2023-03-21', '2040-03-19')

const integratedSteel = jalaliAnnualPeriods(1401, 1419, 1)
assert.equal(integratedSteel.length, 19)
assertJalaliPeriodSequence(integratedSteel, '2022-03-21', '2041-03-19')

console.log('COMFAR Jalali calendar boundaries passed: leap years, exact fiscal dates, and all four project horizons.')
