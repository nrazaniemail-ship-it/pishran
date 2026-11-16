import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/projects/projectModelSchema.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const model = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

const draft = model.createBlankProjectModelDraft()
assert.equal(draft.configuration.projectType, null)
assert.equal(draft.configuration.analysisLevel, null)
assert.deepEqual(draft.configuration.enabledFeatures, [])
assert.equal(model.validateProjectModelDraft(draft).length, 0)
assert.ok(model.PROJECT_MODEL_NODE_DEFINITIONS.some(node => node.id === 'fixed-investment'))
assert.ok(model.PROJECT_MODEL_NODE_DEFINITIONS.some(node => node.id === 'production-costs'))
assert.ok(model.PROJECT_MODEL_NODE_DEFINITIONS.some(node => node.id === 'sales-programme'))
assert.ok(model.PROJECT_MODEL_NODE_DEFINITIONS.some(node => node.id === 'working-capital'))
assert.ok(model.PROJECT_MODEL_NODE_DEFINITIONS.some(node => node.id === 'sources-of-finance'))
assert.ok(model.PROJECT_MODEL_NODE_DEFINITIONS.some(node => node.id === 'taxes-allowances'))
for (const node of draft.nodes) assert.deepEqual(node.data, {}, 'Blank model nodes must not carry hidden defaults')
assert.equal(draft.nodes.find(node => node.nodeId === 'inflation').enabled, false)
assert.equal(draft.nodes.find(node => node.nodeId === 'starting-balances').enabled, false)
assert.equal(draft.nodes.find(node => node.nodeId === 'economic-analysis').enabled, false)

const enabled = model.getVisibleProjectModelNodes({
  projectType: 'industrial', analysisLevel: 'feasibility',
  enabledFeatures: ['cost-centres','inflation','joint-venture','expansion-rehabilitation','economic-analysis']
})
assert.ok(enabled.some(node => node.id === 'cost-centre-structure'))
assert.ok(enabled.some(node => node.id === 'inflation'))
assert.ok(enabled.some(node => node.id === 'joint-venture-partners'))
assert.ok(enabled.some(node => node.id === 'starting-balances'))
assert.ok(enabled.some(node => node.id === 'economic-analysis'))

const item = model.createBlankCommonFinancialItemMetadata()
assert.deepEqual(item, {
  description:'', currencyCode:null, marketOrigin:null, escalationPercent:null, remarks:'', costCentreId:null
})
assert.deepEqual(model.deriveQuantityPriceTotal({quantity:4,unitPrice:25,total:null}), {quantity:4,unitPrice:25,total:100})
assert.deepEqual(model.deriveQuantityPriceTotal({quantity:4,unitPrice:null,total:100}), {quantity:4,unitPrice:25,total:100})
assert.deepEqual(model.deriveQuantityPriceTotal({quantity:null,unitPrice:25,total:100}), {quantity:4,unitPrice:25,total:100})
assert.deepEqual(model.deriveQuantityPriceTotal({quantity:4,unitPrice:25,total:100}), {quantity:4,unitPrice:25,total:100})
assert.deepEqual(model.deriveQuantityPriceTotal({quantity:4,unitPrice:null,total:null}), {quantity:4,unitPrice:null,total:null})

const broken = {...draft, nodes:[...draft.nodes,{...draft.nodes[0]}]}
assert.ok(model.validateProjectModelDraft(broken).includes('duplicate-node-id'))
console.log('Help-driven blank project model schema: all assertions passed.')
