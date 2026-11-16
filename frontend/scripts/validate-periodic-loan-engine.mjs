import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/periodicLoanEngine.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
const input = {
  drawdowns: [{date:'2024-01-01',amount:300}, {date:'2024-07-01',amount:700}],
  annualInterestRatePercent: 28,
  dayCountBasis: 360,
  capitalizationDate: '2024-12-31',
  capitalizeConstructionInterest: true,
  firstRepaymentDate: '2025-03-31',
  repaymentCount: 4,
  repaymentIntervalMonths: 3,
  repaymentMethod: 'equal-principal',
}
const result = engine.calculatePeriodicLoan(input)
assert.equal(result.valid, true, result.errors.join('; '))
assert.equal(result.totalDrawdowns, 1000)
assert.equal(result.rows.length, 5, 'one capitalization row plus four quarterly repayment rows')
assert.ok(result.totalCapitalizedInterest > 0)
assert.ok(Math.abs(result.totalCapitalizedInterest - 1000 * 0.28) < 1e-7, 'COMFAR month/12 convention must accrue exactly six months on each staged tranche in this fixture')
assert.equal(result.totalPrincipalPaid + result.closingDebt, 1000 + result.totalCapitalizedInterest)
assert.equal(result.rows.at(-1).closingPrincipal, 0)
assert.equal(result.rows.at(-1).principalPaid > 0, true)

const annuity = engine.calculatePeriodicLoan({...input, repaymentMethod:'annuity'})
assert.equal(annuity.valid, true)
assert.ok(annuity.rows.filter(row=>row.debtService>0).every(row=>Math.abs(row.debtService-annuity.rows.find(x=>x.debtService>0).debtService)<1e-7))
const bullet = engine.calculatePeriodicLoan({...input, repaymentMethod:'bullet'})
assert.equal(bullet.valid, true)
assert.equal(bullet.rows.filter(row=>row.principalPaid>0).length, 1)
assert.ok(Math.abs(bullet.totalPrincipalPaid-(1000+bullet.totalCapitalizedInterest))<1e-7)

const actualBasis = engine.calculatePeriodicLoan({...input,interestConvention:'actual-365',dayCountBasis:365})
assert.equal(actualBasis.valid, true)
assert.ok(Math.abs(actualBasis.totalCapitalizedInterest - (300*0.28*182/365 + 700*0.28*183/365)) < 1e-7, 'Actual/365 convention must remain explicitly selectable')
const noCapitalization = engine.calculatePeriodicLoan({...input,capitalizeConstructionInterest:false})
assert.equal(noCapitalization.valid, true)
assert.equal(noCapitalization.totalCapitalizedInterest, 0)
assert.ok(noCapitalization.totalInterestPaid > 0)
assert.equal(engine.calculatePeriodicLoan({...input,repaymentCount:0}).valid,false)
assert.equal(engine.calculatePeriodicLoan({...input,firstRepaymentDate:'2024-06-30'}).valid,false)
assert.equal(engine.calculatePeriodicLoan({...input,drawdowns:[{date:'2025-01-01',amount:10}]}).valid,false)
console.log('PASS: dated loan engine validates construction interest capitalization and quarterly equal-principal, annuity and bullet repayment')
