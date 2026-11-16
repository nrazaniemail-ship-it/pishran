import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/features/projects/projectModelHelpFormulaRules.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const f=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))

const nominal=f.calculateHelpNominalCapacityCost({standardQuantity:100,standardUnitPrice:2,nominalCapacity:100,activityVolume:50,activityBasis:'production',fixedPercent:20,variablePercent:80,periodMonths:6,adjustmentQuantity:10,adjustmentUnitPrice:3,adjustmentFixedPercent:20,adjustmentVariablePercent:80})
assert.equal(nominal.standardFixed,20)
assert.equal(nominal.standardVariable,80)
assert.equal(nominal.adjustmentFixed,6)
assert.equal(nominal.adjustmentVariable,24)
assert.equal(nominal.total,130)

const perUnit=f.calculateHelpPerUnitOutputCost({inputQuantityPerUnit:2,unitPrice:5,outputVolume:10,standardFixedCost:120,adjustmentTotal:20,adjustmentVariablePercent:50,periodMonths:6})
assert.equal(perUnit.fixed,70)
assert.equal(perUnit.variable,110)
assert.equal(perUnit.total,180)

assert.equal(f.calculateHelpWorkingCapitalTurnover(30,3),3)
assert.equal(f.calculateHelpWorkingCapitalRequirement(300,30,3).requiredValue,100)
assert.deepEqual(f.calculateHelpNwcMovement(100,130),{change:30,cashOutflow:30,cashInflow:0})
const production=f.calculateDefaultSalesProduction({sales:100,openingFinishedGoods:20,daysCoverage:30,periodMonths:12})
assert.ok(Math.abs(production.production-(100+100/12-20))<1e-9)
assert.ok(Math.abs(production.closingFinishedGoods-100/12)<1e-9)

assert.equal(f.calculateGraduatedIncomeTax(1500,[{lowerLimit:0,ratePercent:10},{lowerLimit:1000,ratePercent:20}]),200)
const loss=f.applyLossCarryForward([-200,130,100],2)
assert.equal(loss[1].taxableAfterLoss,0)
assert.equal(loss[2].taxableAfterLoss,30)
assert.equal(loss[2].lossUsed,70)

const interest=f.calculateComfarLoanInterest({
 openingDebt:1000,startDate:'2026-01-01',endDate:'2026-04-01',
 events:[{date:'2026-02-01',type:'drawdown',amount:500}],
 rateChanges:[{effectiveDate:'2026-01-01',annualRatePercent:12},{effectiveDate:'2026-03-01',annualRatePercent:18}]
})
assert.equal(interest.segments.length,3)
assert.ok(Math.abs(interest.totalInterest-47.5)<1e-9)
assert.equal(interest.closingBalance,1500)

const fee=f.calculateLoanFee({type:'guarantee',ratePercent:2,disbursement:100, outstandingBefore:500,repayment:50,undisbursedCommitment:300,totalLoan:1000})
assert.equal(fee.basis,550)
assert.equal(fee.fee,11)
assert.equal(f.calculateHelpNpv([100],10,1).npv,100/1.1)
assert.equal(f.calculateHelpNpv([100],10,1,'end-of-first-period').npv,100)
assert.ok(f.calculateHelpMirr([-100,60,60],10,5,2,1)>0.20)
const dividends=f.calculateDividendPool(1000,10,[100,50],1)
assert.equal(dividends.retained,100)
assert.equal(dividends.ordinaryDividendPool,750)
assert.equal(dividends.partnerPreferredPaid,100)
assert.equal(dividends.shareholderPreferredPaid,50)
assert.equal(f.composeTotalInvestmentCashFlow({netCashFlow:1000,equity:100,loanDrawdowns:300,principalRepayments:50,interestAndFees:20,dividends:30}),700)
console.log('COMFAR help formula regression tests passed')
