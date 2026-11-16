import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/features/projects/projectModelFormulaRules.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const formulas=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))

const nominal=formulas.calculateNominalCapacityCost({
 standardQuantity:2,standardUnitPrice:10,nominalCapacity:100,activityVolume:50,activityBasis:'production',
 fixedPercent:20,variablePercent:80
})
assert.equal(nominal.standardCost,20)
assert.equal(nominal.standardFixedCost,4)
assert.equal(nominal.standardVariableCost,8)
assert.equal(nominal.totalCost,12)
const adjusted=formulas.calculateNominalCapacityCost({
 standardQuantity:2,standardUnitPrice:10,nominalCapacity:100,activityVolume:100,activityBasis:'sales',
 fixedPercent:20,variablePercent:80,adjustmentQuantity:1,adjustmentUnitPrice:5,
 adjustmentFixedPercent:40,adjustmentVariablePercent:60
})
assert.equal(adjusted.totalCost,25)
assert.throws(()=>formulas.calculateNominalCapacityCost({
 standardQuantity:1,standardUnitPrice:1,nominalCapacity:0,activityVolume:1,activityBasis:'production',fixedPercent:50,variablePercent:50
}),/invalid-cost-volume-or-price/)
assert.deepEqual(formulas.calculatePerUnitOutputCost({inputQuantityPerUnit:3,unitPrice:2,outputVolume:10,fixedPeriodCost:5}),{variableCost:60,fixedCost:5,totalCost:65})

assert.equal(formulas.calculateWorkingCapitalTurnover(30),12)
assert.equal(formulas.calculateWorkingCapitalTurnover(30,90),3)
assert.equal(formulas.calculateNetWorkingCapital(120,40),80)
assert.deepEqual(formulas.calculateWorkingCapitalMovement(50,80),{increase:30,release:0,netChange:30})
assert.deepEqual(formulas.calculateWorkingCapitalMovement(80,50),{increase:0,release:30,netChange:-30})

const straight=formulas.calculateAssetDepreciationPeriod({
 method:'linear-to-scrap',acquisitionCost:1200,salvageValue:120,usefulLifeMonths:120,
 monthsElapsed:0,periodMonths:12,openingBookValue:1200
})
assert.equal(straight.charge,108)
assert.equal(straight.closingBookValue,1092)
const straightToZero=formulas.calculateAssetDepreciationPeriod({
 method:'linear-to-zero',acquisitionCost:1200,salvageValue:120,usefulLifeMonths:120,
 monthsElapsed:0,periodMonths:12,openingBookValue:1200
})
assert.equal(straightToZero.charge,120)
assert.equal(straightToZero.closingBookValue,1080)
const zeroSalvageStraight=formulas.calculateAssetDepreciationPeriod({method:'linear-to-zero',acquisitionCost:1200,salvageValue:0,usefulLifeMonths:120,monthsElapsed:0,periodMonths:12,openingBookValue:1200})
assert.equal(zeroSalvageStraight.closingBookValue,1080)

const syd=formulas.calculateAssetDepreciationPeriod({
 method:'sum-of-years-digits',acquisitionCost:1200,salvageValue:0,usefulLifeMonths:24,
 monthsElapsed:0,periodMonths:12,openingBookValue:1200
})
assert.equal(syd.charge,800)
assert.throws(()=>formulas.calculateAssetDepreciationPeriod({method:'sum-of-years-digits',acquisitionCost:1200,salvageValue:0,usefulLifeMonths:30,monthsElapsed:0,periodMonths:12,openingBookValue:1200}),/syd-partial-year-schedule-not-yet-implemented/)
assert.throws(()=>formulas.calculateAssetDepreciationPeriod({method:'sum-of-years-digits',acquisitionCost:1200,salvageValue:0,usefulLifeMonths:24,monthsElapsed:0,periodMonths:12,openingBookValue:1200,firstDepreciationYearMonths:8}),/syd-partial-year-schedule-not-yet-implemented/)
const declining=formulas.calculateAssetDepreciationPeriod({
 method:'accelerated-declining-balance',acquisitionCost:1200,salvageValue:100,usefulLifeMonths:120,
 monthsElapsed:0,periodMonths:12,openingBookValue:1200,annualRatePercent:10
})
assert.equal(declining.charge,120)
assert.equal(declining.closingBookValue,1080)

const annuity=formulas.buildAnnuityLoanSchedule(1000,12,12,12)
assert.equal(annuity.length,12)
assert.ok(Math.abs(annuity.reduce((sum,row)=>sum+row.principal,0)-1000)<1e-8)
assert.equal(annuity[11].closingBalance,0)
const zeroRate=formulas.buildAnnuityLoanSchedule(1200,0,4,4)
assert.deepEqual(zeroRate.map(row=>row.principal),[300,300,300,300])
assert.equal(formulas.rollForwardDebt(100,50,40,5),115)
assert.throws(()=>formulas.rollForwardDebt(10,0,20,0),/invalid-debt-roll-forward/)
console.log('Help-driven project financial formula primitives: all assertions passed.')
