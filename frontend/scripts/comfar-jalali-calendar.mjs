import assert from 'node:assert/strict'

const persianCalendar = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
})

function persianParts(date) {
  const parts = Object.fromEntries(persianCalendar.formatToParts(date)
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
  return { year: parts.year, month: parts.month, day: parts.day }
}

/** Convert a Jalali date to an exact Gregorian ISO date using the runtime's ICU Persian calendar. */
export function jalaliToIso(year, month, day) {
  assert.ok(Number.isInteger(year) && year >= 1200 && year <= 1600, 'Invalid Jalali year')
  assert.ok(Number.isInteger(month) && month >= 1 && month <= 12, 'Invalid Jalali month')
  assert.ok(Number.isInteger(day) && day >= 1 && day <= 31, 'Invalid Jalali day')
  const scanStart = Date.UTC(year + 621, 0, 1)
  for (let offset = 0; offset <= 400; offset++) {
    const date = new Date(scanStart + offset * 86400000)
    const parts = persianParts(date)
    if (parts.year === year && parts.month === month && parts.day === day)
      return date.toISOString().slice(0, 10)
  }
  throw new RangeError('Invalid Jalali date: ' + year + '/' + month + '/' + day)
}

export function jalaliYearEndDay(year) {
  try { jalaliToIso(year, 12, 30); return 30 } catch { return 29 }
}

export function jalaliPeriod(index, startYear, startMonth, startDay, endYear, endMonth, endDay, partial = false) {
  const startDate = jalaliToIso(startYear, startMonth, startDay)
  const endDate = jalaliToIso(endYear, endMonth, endDay)
  const days = Math.round((Date.parse(endDate + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z')) / 86400000) + 1
  assert.ok(days > 0, 'Jalali period end must not precede its start')
  return { index, startDate, endDate, days, partial }
}

export function jalaliAnnualPeriods(startYear, endYear, firstIndex = 1) {
  assert.ok(endYear >= startYear, 'Annual period range must be ascending')
  return Array.from({ length: endYear - startYear + 1 }, (_, offset) => {
    const year = startYear + offset
    return jalaliPeriod(firstIndex + offset, year, 1, 1, year, 12, jalaliYearEndDay(year), false)
  })
}

export function assertJalaliPeriodSequence(periods, expectedStart, expectedEnd) {
  assert.ok(periods.length > 0, 'At least one COMFAR period is required')
  assert.equal(periods[0].startDate, expectedStart, 'First period must use the report start date')
  assert.equal(periods[periods.length - 1].endDate, expectedEnd, 'Last period must use the report end date')
  periods.forEach((period, index) => {
    const actualDays = Math.round((Date.parse(period.endDate + 'T00:00:00Z') - Date.parse(period.startDate + 'T00:00:00Z')) / 86400000) + 1
    assert.equal(period.days, actualDays, 'Period day count must match its actual Gregorian boundaries')
    if (index) {
      const previousEnd = Date.parse(periods[index - 1].endDate + 'T00:00:00Z')
      assert.equal(Date.parse(period.startDate + 'T00:00:00Z'), previousEnd + 86400000,
        'COMFAR fiscal periods must be contiguous without overlap or gaps')
    }
  })
}

/** COMFAR's annual project IRR treats each displayed project period as one annual period. */
export function calculateComfarPeriodCountIrr(cashFlows) {
  assert.ok(cashFlows.some(value => value < 0) && cashFlows.some(value => value > 0),
    'IRR requires at least one negative and one positive cash flow')
  const npvAt = rate => cashFlows.reduce((sum, value, index) => sum + value / Math.pow(1 + rate, index + 1), 0)
  let low = -0.99999999, high = 1
  let lowValue = npvAt(low), highValue = npvAt(high)
  while (lowValue * highValue > 0 && high < 1e8) {
    high = high * 2 + 1
    highValue = npvAt(high)
  }
  assert.ok(Number.isFinite(lowValue) && Number.isFinite(highValue) && lowValue * highValue <= 0,
    'Unable to bracket COMFAR period-count IRR')
  for (let i = 0; i < 240; i++) {
    const mid = (low + high) / 2
    const value = npvAt(mid)
    if (Math.abs(value) < 1e-10) return mid * 100
    if (lowValue * value <= 0) { high = mid; highValue = value }
    else { low = mid; lowValue = value }
  }
  return (low + high) / 2 * 100
}
