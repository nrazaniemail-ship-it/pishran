import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/projects/projectValueAddedAnalysis.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

const material = {
  id:'MAT-1',period:1,description:'Domestic steel inputs',amount:300,marketOrigin:'local',
  taxesDutiesIncludedPercent:10,valueAddedIncludedPercentages:[20,10,0],
  sourceReference:'verified-material-ledger-page-1',sourceVerified:true,
}
const energy = {
  id:'ENG-1',period:1,description:'Imported energy',amount:100,marketOrigin:'foreign',
  taxesDutiesIncludedPercent:0,valueAddedIncludedPercentages:[0,0,0],
  sourceReference:'verified-energy-invoice-register',sourceVerified:true,
}
const fixedAsset = {
  id:'CAPEX-1',period:1,description:'Production equipment',amount:50,marketOrigin:'foreign',
  taxesDutiesIncludedPercent:10,valueAddedIncludedPercentages:[0,0,0],
  sourceReference:'verified-capex-invoice',sourceVerified:true,kind:'fixed-investment',
}
const preProduction = {
  id:'PREOP-1',period:1,description:'Pre-production services net of interest',amount:20,marketOrigin:'local',
  taxesDutiesIncludedPercent:0,valueAddedIncludedPercentages:[0,0,0],
  sourceReference:'verified-preproduction-register',sourceVerified:true,kind:'pre-production-net-of-interest',
}
const inventoryIncrease = {
  id:'INV-1',period:1,description:'Increase in total inventory',amount:10,marketOrigin:'local',
  taxesDutiesIncludedPercent:0,valueAddedIncludedPercentages:[0,0,0],
  sourceReference:'inventory-roll-forward',sourceVerified:true,kind:'inventory-increase',
}
const periods = [
  {
    period:1,salesRevenue:1000,outputSalesTax:100,otherIncome:20,otherValueAdded:418.6,subsidiesOnOutput:10,
    intermediateInputs:[material,energy],investmentInputs:[fixedAsset,preProduction,inventoryIncrease],
    repatriatedWages:30,repatriatedProfitDividends:5,repatriatedInterest:10,repatriatedOther:2,
    domesticWages:100,domesticDividendsAndInterest:20,corporateTax:40,
    subsidiesOnInput:0,subsidiesOnInvestment:0,skilledDomesticLabour:40,totalDomesticLabour:50,
    foreignExchangeOutflow:100,presentValueFactor:0.9,
    sourceReference:'period-1-linked-financial-and-payroll-schedules',sourceVerified:true,
  },
  {
    period:2,salesRevenue:500,outputSalesTax:50,otherIncome:0,otherValueAdded:420,subsidiesOnOutput:0,
    intermediateInputs:[],investmentInputs:[],
    repatriatedWages:0,repatriatedProfitDividends:0,repatriatedInterest:0,repatriatedOther:0,
    domesticWages:50,domesticDividendsAndInterest:10,corporateTax:20,
    subsidiesOnInput:0,subsidiesOnInvestment:0,skilledDomesticLabour:20,totalDomesticLabour:25,
    foreignExchangeOutflow:0,presentValueFactor:0.8,
    sourceReference:'period-2-linked-financial-and-payroll-schedules',sourceVerified:true,
  },
]
const adjusted = module.adjustValueAddedInput(material)
assert.equal(adjusted.indirectTaxIncluded,30)
assert.equal(adjusted.valueAddedIncluded,75.6)
assert.equal(adjusted.amountDeducted,194.4)
assert.equal(adjusted.localContent,194.4)
assert.equal(module.adjustValueAddedInput(energy).foreignContent,100)

const result = module.buildComfarValueAddedAnalysis(periods)
assert.equal(result.valid,true,result.issues.join('; '))
assert.equal(result.rows[0].grossOutput,1120)
assert.equal(result.rows[0].intermediateInput.amountDeducted,294.4)
assert.equal(result.rows[0].investment.amountDeducted,75)
assert.equal(result.rows[0].grossDomesticValueAdded,825.6)
assert.equal(result.rows[0].netDomesticValueAdded,750.6)
assert.equal(result.rows[0].repatriatedPayments,47)
assert.equal(result.rows[0].netNationalValueAdded,703.6)
assert.equal(result.rows[0].governmentShare,165)
assert.equal(result.rows[0].otherValueAdded,418.6)
assert.ok(Math.abs(result.rows[0].distributionDifference)<1e-9)
assert.equal(result.rows[1].grossOutput,550)
assert.equal(result.rows[1].netNationalValueAdded,550)
assert.equal(result.rows[1].governmentShare,70)
assert.equal(result.rows[1].otherValueAdded,420)
assert.ok(Math.abs(result.totals.presentValueNetNationalValueAdded-1073.24)<1e-9)
assert.ok(Math.abs(result.totals.presentValueDomesticWages-130)<1e-9)
assert.ok(Math.abs(result.totals.absoluteEfficiencyRatio-(1073.24/130))<1e-9)
assert.ok(Math.abs(result.totals.relativeEfficiency.investment-(1073.24/67.5))<1e-9)
assert.equal(result.totals.relativeEfficiency.foreignExchange,1073.24/90)
assert.equal(result.totals.relativeEfficiency.skilledLabour,1073.24/52)
assert.equal(result.totals.relativeEfficiency.totalLabour,1073.24/65)

// COMFAR investment includes the increase in inventory; a stock decrease is a negative investment flow.
const stockRelease = module.buildComfarValueAddedAnalysis([{
  ...periods[1],period:1,investmentInputs:[{...inventoryIncrease,amount:-15,period:1}],
}])
assert.equal(stockRelease.valid,true,stockRelease.issues.join('; '))
assert.equal(stockRelease.rows[0].investment.amountDeducted,-15)
assert.equal(stockRelease.rows[0].netDomesticValueAdded,565)

// Missing or unverified economic evidence must block the schedule rather than be interpreted as zero.
const unverified = module.buildComfarValueAddedAnalysis([{
  ...periods[0],intermediateInputs:[{...material,sourceVerified:false}],
}])
assert.equal(unverified.valid,false)
assert.ok(unverified.issues.some(issue=>issue.includes('verified source reference')))

const invalidDecomposition = module.buildComfarValueAddedAnalysis([{
  ...periods[0],intermediateInputs:[{...material,valueAddedIncludedPercentages:[20,101,0]}],
}])
assert.equal(invalidDecomposition.valid,false)
assert.ok(invalidDecomposition.issues.some(issue=>issue.includes('three valid value-added decomposition percentages')))

const invalidLabour = module.buildComfarValueAddedAnalysis([{
  ...periods[0],skilledDomesticLabour:60,totalDomesticLabour:50,
}])
assert.equal(invalidLabour.valid,false)
assert.ok(invalidLabour.issues.some(issue=>issue.includes('cannot exceed total domestic labour')))

const unreconciledDistribution = module.buildComfarValueAddedAnalysis([{
  ...periods[0],otherValueAdded:419.6,
}])
assert.equal(unreconciledDistribution.valid,false)
assert.ok(unreconciledDistribution.issues.some(issue=>issue.includes('value-added distribution does not reconcile')))

const negativeOperatingSurplus = module.buildComfarValueAddedAnalysis([{
  ...periods[0],otherValueAdded:-10,
}])
assert.equal(negativeOperatingSurplus.valid,false,'Negative operating surplus is valid only when it reconciles to the rest of the distribution.')
assert.ok(negativeOperatingSurplus.issues.some(issue=>issue.includes('value-added distribution does not reconcile')))

console.log('COMFAR value-added analysis and distribution regression tests passed.')
