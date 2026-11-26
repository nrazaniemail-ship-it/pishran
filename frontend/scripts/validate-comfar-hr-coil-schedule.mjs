import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'

const source=await readFile(new URL('../src/features/projects/comfarProjectInputData.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {COMFAR_PROJECT_INPUTS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const input=COMFAR_PROJECT_INPUTS['comfar-hr-coil-200k']
assert.ok(input,'The 200 kt hot-rolled coil reference project must exist')
assert.equal(input.operatingCostSchedule?.length,15,'Pages 24–27 must cover every operating year from 1405 through 1419')
const byYear=new Map(input.operatingCostSchedule.map(row=>[row.period,row]))
const sum=year=>byYear.get(String(year)).rows.reduce((total,row)=>total+row.amount,0)
const close=(actual,expected,label,tolerance=0.02)=>assert.ok(Math.abs(actual-expected)<=tolerance,label+': expected '+expected+', got '+actual)
close(sum(1405),30534338.52,'COMFAR page 24 factory cost 1405')
close(sum(1406),34345881.44,'COMFAR page 24 factory cost 1406')
close(sum(1407),38503928.26,'COMFAR page 24 factory cost 1407')
close(sum(1408),42661975.08,'COMFAR page 24 factory cost 1408')
for(let year=1409;year<=1419;year++)close(sum(year),42604224.43,'COMFAR pages 25–27 factory cost '+year)
close(sum(1408)-sum(1409),57750.65,'Documented source-table difference between page 24 and page 25')
assert.equal(input.productionSalesSchedule.length,15)
for(const row of input.productionSalesSchedule){
 close(row.openingInventory+row.production-row.sales,row.closingInventory,'Production/inventory roll-forward '+row.period,0.02)
 close(row.sales*row.netUnitPrice,row.salesRevenue,'Product sales revenue '+row.period,0.02)
}
assert.equal(input.productionSalesSchedule[0].period,'1405')
assert.equal(input.productionSalesSchedule[0].production,141944.44)
assert.equal(input.productionSalesSchedule[0].sales,140000)
assert.equal(input.productionSalesSchedule.at(-1).period,'1419')
assert.equal(input.productionSalesSchedule.at(-1).sales,200000)
assert.equal(input.financingSchedule.length,7)
close(input.financingSchedule[0].loanDisbursement,3816496,'1403 documented drawdown')
close(input.financingSchedule[1].loanDisbursement,1794355,'1404 documented drawdown')
close(input.financingSchedule[1].closingDebt,8909484.06,'1404 closing debt')
console.log('Hot-rolled coil COMFAR annual sales, factory-cost and debt-source schedules passed independent source-data checks.')
