/**
 * Help-driven, industry-neutral COMFAR-style project input model.
 * Based on COMFAR III Expert Reference Manual chapters VI and VII.
 * This is a blank structural schema: no sample CAPEX/OPEX, project values,
 * exchange rates, tax rates, inflation assumptions or financing ratios.
 */
export type ProjectModelClass = 'industrial'|'maritime'|'agricultural'|'infrastructure'|'tourism'|'mining'|'other'
export type ProjectAnalysisLevel = 'opportunity'|'feasibility'
export type ProjectModelFeature = 'cost-centres'|'cost-allocation'|'inflation'|'joint-venture'|'expansion-rehabilitation'|'economic-analysis'
export type ModelFieldKind = 'text'|'date'|'number'|'percent'|'currency'|'period-series'|'select'|'boolean'|'item-collection'
export type ProjectModelFieldDefinition = { key:string; kind:ModelFieldKind; helpKey:string; required?:boolean; unit?:string; options?:readonly string[] }
export type ProjectModelNodeDefinition = {
 id:string; order:number; group:'identification'|'time'|'operating'|'investment'|'financing'|'tax-opening'|'economic'
 titleKey:string; descriptionKey:string; fields:readonly ProjectModelFieldDefinition[]
 dependsOn?:readonly string[]; requires?:readonly ProjectModelFeature[]
 visibleWhen?:ProjectModelFeature; opportunityLevel:'required'|'optional'|'reduced'; feasibilityLevel:'required'|'optional'|'full'
}
const f=(key:string,kind:ModelFieldKind,helpKey:string,options?:readonly string[],required=false,unit?:string):ProjectModelFieldDefinition=>({key,kind,helpKey,options,required,unit})
export const PROJECT_MODEL_NODE_DEFINITIONS:readonly ProjectModelNodeDefinition[]=[
 {id:'project-identification',order:10,group:'identification',titleKey:'project.identification.title',descriptionKey:'project.identification.help',fields:[
  f('projectName','text','project.identification.name',undefined,true),f('projectType','select','project.identification.type',['industrial','maritime','agricultural','infrastructure','tourism','mining','other'],true),f('analysisLevel','select','project.identification.level',['opportunity','feasibility'],true),f('projectPurpose','text','project.identification.purpose'),f('projectLocation','text','project.identification.location'),f('projectOwner','text','project.identification.owner'),f('projectDescription','text','project.identification.description')
 ],opportunityLevel:'required',feasibilityLevel:'required'},
 {id:'planning-horizon',order:20,group:'time',titleKey:'project.planning.title',descriptionKey:'project.planning.help',fields:[
  f('constructionStart','date','project.planning.construction-start'),f('constructionEnd','date','project.planning.construction-end'),f('productionStart','date','project.planning.production-start'),f('productionEnd','date','project.planning.production-end'),f('periodFrequency','select','project.planning.frequency',['annual','semiannual','quarterly','monthly']),f('fiscalYearStartMonth','number','project.planning.fiscal-year-start'),f('balanceDate','date','project.planning.balance-date')
 ],dependsOn:['project-identification'],opportunityLevel:'required',feasibilityLevel:'required'},
 {id:'products',order:30,group:'operating',titleKey:'project.products.title',descriptionKey:'project.products.help',fields:[
  f('productItems','item-collection','project.products.items'),f('productClassification','text','project.products.classification'),f('marketOrigin','select','project.products.market-origin',['local','foreign','mixed'])
 ],dependsOn:['planning-horizon'],opportunityLevel:'required',feasibilityLevel:'required'},
 {id:'currencies',order:40,group:'time',titleKey:'project.currencies.title',descriptionKey:'project.currencies.help',fields:[
  f('localCurrencyCode','text','project.currencies.local-code',undefined,true),f('localCurrencyName','text','project.currencies.local-name',undefined,true),f('foreignCurrencies','item-collection','project.currencies.foreign'),f('periodExchangeRates','period-series','project.currencies.exchange-rates')
 ],dependsOn:['products'],opportunityLevel:'required',feasibilityLevel:'required'},
 {id:'cost-centre-structure',order:50,group:'operating',titleKey:'project.cost-centres.title',descriptionKey:'project.cost-centres.help',fields:[f('costCentres','item-collection','project.cost-centres.items')],requires:['cost-centres'],visibleWhen:'cost-centres',dependsOn:['currencies'],opportunityLevel:'optional',feasibilityLevel:'optional'},
 {id:'inflation',order:60,group:'time',titleKey:'project.inflation.title',descriptionKey:'project.inflation.help',fields:[f('priceIndices','item-collection','project.inflation.indices')],requires:['inflation'],visibleWhen:'inflation',dependsOn:['currencies'],opportunityLevel:'optional',feasibilityLevel:'optional'},
 {id:'joint-venture-partners',order:70,group:'financing',titleKey:'project.joint-venture.title',descriptionKey:'project.joint-venture.help',fields:[f('partners','item-collection','project.joint-venture.partners')],requires:['joint-venture'],visibleWhen:'joint-venture',dependsOn:['currencies'],opportunityLevel:'optional',feasibilityLevel:'optional'},
 {id:'discounting',order:80,group:'time',titleKey:'project.discounting.title',descriptionKey:'project.discounting.help',fields:[
  f('financialDiscountRate','percent','project.discounting.financial-rate'),f('economicDiscountRate','percent','project.discounting.economic-rate'),f('discountConvention','select','project.discounting.convention',['actual-days','period-count']),f('cashFlowTiming','select','project.discounting.cash-flow-timing',['period-end','mid-period']),f('valuationDate','date','project.discounting.valuation-date')
 ],dependsOn:['currencies'],opportunityLevel:'required',feasibilityLevel:'required'},
 {id:'fixed-investment',order:90,group:'investment',titleKey:'project.fixed-investment.title',descriptionKey:'project.fixed-investment.help',fields:[
  f('assetItems','item-collection','project.fixed-investment.assets'),f('assetAcquisitionDates','period-series','project.fixed-investment.acquisition-dates'),f('depreciationPolicy','select','project.fixed-investment.depreciation-policy',['asset-specific']),f('assetDisposals','item-collection','project.fixed-investment.disposals')
 ],dependsOn:['discounting'],opportunityLevel:'reduced',feasibilityLevel:'required'},
 {id:'production-costs',order:100,group:'operating',titleKey:'project.production-costs.title',descriptionKey:'project.production-costs.help',fields:[
  f('directCostItems','item-collection','project.production-costs.direct'),f('indirectCostItems','item-collection','project.production-costs.indirect'),f('inputMode','select','project.production-costs.input-mode',['quantity-price-total']),f('fixedVariableSplit','percent','project.production-costs.fixed-variable-split'),f('costEscalation','period-series','project.production-costs.escalation')
 ],dependsOn:['fixed-investment'],opportunityLevel:'reduced',feasibilityLevel:'required'},
 {id:'sales-programme',order:110,group:'operating',titleKey:'project.sales.title',descriptionKey:'project.sales.help',fields:[
  f('salesVolumes','period-series','project.sales.volumes'),f('salesPrices','period-series','project.sales.prices'),f('salesTaxAndDuties','period-series','project.sales.taxes-duties'),f('finishedGoodsPolicy','text','project.sales.finished-goods-policy')
 ],dependsOn:['production-costs'],opportunityLevel:'reduced',feasibilityLevel:'required'},
 {id:'working-capital',order:120,group:'operating',titleKey:'project.working-capital.title',descriptionKey:'project.working-capital.help',fields:[
  f('receivableDays','number','project.working-capital.receivables-days',undefined,false,'days'),f('inventoryDays','number','project.working-capital.inventory-days',undefined,false,'days'),f('payableDays','number','project.working-capital.payables-days',undefined,false,'days'),f('otherCurrentAssets','item-collection','project.working-capital.other-current-assets'),f('otherCurrentLiabilities','item-collection','project.working-capital.other-current-liabilities'),f('recoveryPolicy','select','project.working-capital.recovery',['period-specific','at-project-end'])
 ],dependsOn:['sales-programme'],opportunityLevel:'optional',feasibilityLevel:'required'},
 {id:'sources-of-finance',order:130,group:'financing',titleKey:'project.sources-of-finance.title',descriptionKey:'project.sources-of-finance.help',fields:[
  f('equityInjections','period-series','project.sources-of-finance.equity'),f('grantsAndSubsidies','item-collection','project.sources-of-finance.grants'),f('loanFacilities','item-collection','project.sources-of-finance.loans'),f('profitDistribution','item-collection','project.sources-of-finance.distribution')
 ],dependsOn:['working-capital'],opportunityLevel:'reduced',feasibilityLevel:'required'},
 {id:'taxes-allowances',order:140,group:'tax-opening',titleKey:'project.taxes.title',descriptionKey:'project.taxes.help',fields:[
  f('taxSystem','select','project.taxes.system',['corporate','none','custom']),f('periodTaxRates','period-series','project.taxes.rates'),f('taxAllowances','item-collection','project.taxes.allowances'),f('lossCarryForward','boolean','project.taxes.loss-carry-forward')
 ],dependsOn:['sources-of-finance'],opportunityLevel:'optional',feasibilityLevel:'required'},
 {id:'starting-balances',order:150,group:'tax-opening',titleKey:'project.starting-balances.title',descriptionKey:'project.starting-balances.help',fields:[f('openingAssetsLiabilitiesEquity','item-collection','project.starting-balances.items')],requires:['expansion-rehabilitation'],visibleWhen:'expansion-rehabilitation',dependsOn:['taxes-allowances'],opportunityLevel:'optional',feasibilityLevel:'required'},
 {id:'economic-analysis',order:160,group:'economic',titleKey:'project.economic-analysis.title',descriptionKey:'project.economic-analysis.help',fields:[f('economicAdjustments','item-collection','project.economic-analysis.adjustments')],requires:['economic-analysis'],visibleWhen:'economic-analysis',dependsOn:['taxes-allowances'],opportunityLevel:'optional',feasibilityLevel:'optional'}
] as const
export type ProjectModelConfiguration={projectType:ProjectModelClass|null;analysisLevel:ProjectAnalysisLevel|null;enabledFeatures:ProjectModelFeature[]}
export type ProjectModelDraft={schemaVersion:1;configuration:ProjectModelConfiguration;nodes:{nodeId:string;enabled:boolean;data:Record<string,unknown>}[]}
export function createBlankProjectModelDraft():ProjectModelDraft{return{
 schemaVersion:1,configuration:{projectType:null,analysisLevel:null,enabledFeatures:[]},
 nodes:PROJECT_MODEL_NODE_DEFINITIONS.map(node=>({nodeId:node.id,enabled:!node.visibleWhen,data:{}}))
}}
export function getVisibleProjectModelNodes(configuration:ProjectModelConfiguration):ProjectModelNodeDefinition[]{return PROJECT_MODEL_NODE_DEFINITIONS.filter(node=>!node.visibleWhen||configuration.enabledFeatures.includes(node.visibleWhen)).sort((a,b)=>a.order-b.order)}
export function validateProjectModelDraft(draft:ProjectModelDraft):string[]{
 const errors:string[]=[];const ids=draft.nodes.map(n=>n.nodeId)
 if(new Set(ids).size!==ids.length)errors.push('duplicate-node-id')
 for(const def of PROJECT_MODEL_NODE_DEFINITIONS){const state=draft.nodes.find(n=>n.nodeId===def.id);if(!state)errors.push('missing-node:'+def.id);else if(!state.data||typeof state.data!=='object'||Array.isArray(state.data))errors.push('invalid-node-data:'+def.id)}
 for(const state of draft.nodes)if(!PROJECT_MODEL_NODE_DEFINITIONS.some(def=>def.id===state.nodeId))errors.push('unknown-node:'+state.nodeId)
 if(draft.configuration.projectType!==null&&!(['industrial','maritime','agricultural','infrastructure','tourism','mining','other'] as string[]).includes(draft.configuration.projectType))errors.push('invalid-project-type')
 if(draft.configuration.analysisLevel!==null&&!(['opportunity','feasibility'] as string[]).includes(draft.configuration.analysisLevel))errors.push('invalid-analysis-level')
 if(new Set(draft.configuration.enabledFeatures).size!==draft.configuration.enabledFeatures.length)errors.push('duplicate-enabled-feature')
 return errors
}
export type CommonFinancialItemMetadata={description:string;currencyCode:string|null;marketOrigin:'local'|'foreign'|null;escalationPercent:number|null;remarks:string;costCentreId:string|null}
export function createBlankCommonFinancialItemMetadata():CommonFinancialItemMetadata{return{description:'',currencyCode:null,marketOrigin:null,escalationPercent:null,remarks:'',costCentreId:null}}
export type QuantityPriceTotalInput={quantity:number|null;unitPrice:number|null;total:number|null}
/** Derive only the missing member when exactly two values are entered. */
export function deriveQuantityPriceTotal(input:QuantityPriceTotalInput):QuantityPriceTotalInput{
 const {quantity,unitPrice,total}=input
 if([quantity,unitPrice,total].filter(v=>v!==null).length!==2)return{...input}
 if(quantity!==null&&unitPrice!==null&&total===null)return{...input,total:quantity*unitPrice}
 if(quantity!==null&&total!==null&&unitPrice===null)return quantity===0?{...input}:{...input,unitPrice:total/quantity}
 if(unitPrice!==null&&total!==null&&quantity===null)return unitPrice===0?{...input}:{...input,quantity:total/unitPrice}
 return{...input}
}
