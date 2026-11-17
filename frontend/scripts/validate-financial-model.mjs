import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const compile = async (relativePath, replacements = []) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  let output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  for (const [search, replacement] of replacements) output = output.replace(search, replacement)
  return 'data:text/javascript;base64,' + Buffer.from(output).toString('base64')
}
const load = async relativePath => import(await compile(relativePath))
const formulaRulesUrl = await compile('../src/features/projects/projectModelFormulaRules.ts')
const engineUrl = await compile('../src/features/steel/financialModel.ts', [
  ["from '../projects/projectModelFormulaRules'", `from '${formulaRulesUrl}'`]
])
const [engine, foundation] = await Promise.all([
  import(engineUrl),
  load('../src/features/projects/projectFoundation.ts')
])
const near = (actual, expected, tolerance, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual-expected)<=tolerance, label+': '+actual+' vs '+expected)

near(engine.calculateNpv([-100,60,60],0.1),4.13223140495867,1e-8,'NPV calculation')
near(engine.calculateIrr([-100,60,60]),0.1306623862918075,1e-8,'IRR calculation')
assert.ok(engine.calculateMirr([-100,60,60],0.1,0.1)!==null,'MIRR must be calculable for a conventional investment cash flow')
const wacc=engine.calculateWacc({equityWeight:60,debtWeight:40,costOfEquity:20,costOfDebt:10,taxRate:25})
assert.equal(wacc.valid,true,'WACC inputs must validate')
near(wacc.value,0.15,1e-12,'WACC calculation')
const reconciliation=engine.reconcileCashFlowSeries([-100,60,60],[-100,60,60])
assert.equal(reconciliation.matched,true,'Identical cash-flow series must reconcile')
const scaled=engine.calculateCapacityScaledCapex(1000,100,200,0.8)
near(scaled.amount,1741.1011265922482,1e-8,'Capacity-scaled CAPEX')


const sydAssetSchedule = (lengthYears, lengthMonths, firstDepreciationMonths) => engine.calculateComfarAssetDepreciationSchedule([{
  id:'syd-asset',name:'SYD asset',originalValue:1200,initialBookValue:1200,scrapPercent:10,
  lengthYears,lengthMonths,method:'sum-of-years-digits',acquisitionPeriod:0,startingAtPeriod:1,
  firstDepreciationMonths
}],8)
for (const [years,months,firstMonths] of [[2,0,8],[2,6,4],[2,6,8]]) {
  const sydSchedule=sydAssetSchedule(years,months,firstMonths)
  assert.equal(sydSchedule.valid,true,sydSchedule.warnings.join('; '))
  near(sydSchedule.periods.reduce((sum,row)=>sum+row.depreciation,0),1080,1e-7,'COMFAR SYD total depreciation')
  near(sydSchedule.periods.at(-1).closingBookValue,120,1e-7,'COMFAR SYD salvage book value')
}

const blank=foundation.createBlankProjectFoundation()
assert.equal(blank.planning.projectStartDate,'')
assert.equal(blank.planning.projectEndDate,'')
const periods=foundation.buildProjectCalendarPeriods('2026-10-15','2027-02-10','monthly',4)
assert.deepEqual(periods.map(p=>[p.startDate,p.endDate,p.days,p.partial]),[
 ['2026-10-15','2026-10-31',17,true],['2026-11-01','2026-11-30',30,false],
 ['2026-12-01','2026-12-31',31,false],['2027-01-01','2027-01-31',31,false],
 ['2027-02-01','2027-02-10',10,true]
])
const validAsset={id:'asset-1',name:'Test asset',grossCost:1000,accumulatedDepreciation:0,remainingLife:5,opportunityValue:1000,commissioningDate:'2024-02-29',depreciationStartDate:'2024-03-01',depreciationMethod:'linear-scrap',depreciationLengthYears:5,depreciationLengthMonths:0,firstDepreciationMonths:12,status:'active'}
assert.equal(foundation.validateStartingFixedAssetBalances([validAsset],blank).length,0)
assert.ok(foundation.validateStartingFixedAssetBalances([{...validAsset,commissioningDate:'2023-02-29'}],blank).some(x=>x.code==='invalid-starting-asset-date'))
console.log('PASS: generic financial calculations, project calendar and opening-asset validation')
