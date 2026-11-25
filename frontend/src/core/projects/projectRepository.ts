import { localStore } from '../storage/localStore'

export type ProjectStatus = 'draft' | 'active' | 'archived'
export type ProjectTemplateId = 'raw' | 'comfar-import'

export type ComfarReferenceBaseline = {
  reportFile: string
  reportTitle: string
  description: string
  inputDate: string
  constructionStart: string
  constructionEnd: string
  constructionYears: number
  operationStart: string
  operationEnd: string
  operatingYears: number
  capacityDescription: string
  primaryCapacity: number
  secondaryCapacity?: number
  product: string
  currency: string
  accountingUnit: string
  fixedInvestment: number
  preproductionTotal: number
  preproductionNet: number
  capitalizedInterest: number
  workingCapital: number
  totalInvestment: number
  equity: number
  longTermDebt: number
  shortTermDebt: number
  totalFunding: number
  firstOperatingYear: number
  referenceYear: number
  lastOperatingYear: number
  firstYearRevenue: number
  referenceRevenue: number
  lastYearRevenue: number
  firstYearFactoryCost: number
  referenceFactoryCost: number
  lastYearFactoryCost: number
  taxPercent: number
  investmentNpvRate: number
  investmentNpv: number
  investmentIrr: number
  investmentMirr: number
  equityNpvRate: number
  equityNpv: number
  equityIrr: number
  equityMirr: number
  valuationDate: string
}


export interface FeasibilityProject {
  id: string
  name: string
  industry: string
  projectType?: string
  steelStage?: string
  templateId?: ProjectTemplateId
  capacity: string
  location: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  sourceReport?: ComfarReferenceBaseline
}

const PROJECTS_KEY = 'projects:list:v1'

const COMFAR_SEED_KEY = 'projects:comfar-reference-seeded:v2'
const COMFAR_REFERENCE_PROJECTS: Omit<FeasibilityProject, 'createdAt' | 'updatedAt' | 'status'>[] = [
  {
    id: 'comfar-hr-coil-200k', name: 'طرح توسعه شرکت نورد زرین فجر گالوانیزه کاشان ـ خط نورد گرم کلاف ۲۰۰ هزار تن',
    industry: 'فولاد و صنایع معدنی', projectType: 'نورد ورق گرم- تولید کلاف', steelStage: 'نورد گرم ورق - تولید کلاف',
    templateId: 'comfar-import', capacity: '200000', location: 'کاشان',
    sourceReport: {
      reportFile: 'COMFAR III - 001 - نتایج تحلیل مالی و اقتصادی طرح (2).pdf',
      reportTitle: 'طرح توسعه شرکت نورد زرین فجر گالوانیزه کاشان',
      description: 'احداث خط نورد گرم؛ ظرفیت تولید سالیانه ۲۰۰ هزار تن کلاف گرم فولادی',
      inputDate: '1402/07/10', constructionStart: '1403/01', constructionEnd: '1404/12', constructionYears: 2,
      operationStart: '1405/01', operationEnd: '1419/12', operatingYears: 15,
      capacityDescription: '۲۰۰ هزار تن کلاف گرم فولادی در سال', primaryCapacity: 200000, product: 'کلاف گرم فولادی',
      currency: 'میلیون ریال', accountingUnit: 'مطلق',
      fixedInvestment: 18463009, preproductionTotal: 3538460.06, preproductionNet: 239827, capitalizedInterest: 3298633.06,
      workingCapital: 4595370.36, totalInvestment: 26596839.42,
      equity: 16401129.53, longTermDebt: 8909484.06, shortTermDebt: 0, totalFunding: 25310613.59,
      firstOperatingYear: 1405, referenceYear: 1408, lastOperatingYear: 1419,
      firstYearRevenue: 43581720, referenceRevenue: 62259600, lastYearRevenue: 62259600,
      firstYearFactoryCost: 30130083.97, referenceFactoryCost: 42661975.08, lastYearFactoryCost: 42604224.43,
      taxPercent: 25, investmentNpvRate: 25, investmentNpv: 31399764.27, investmentIrr: 48.31, investmentMirr: 28.03,
      equityNpvRate: 30, equityNpv: 23579675.01, equityIrr: 57.99, equityMirr: 30.90, valuationDate: '12/1404'
    }
  },
  {
    id: 'comfar-hr-plate-250k', name: 'طرح توسعه شرکت نورد زرین فجر گالوانیزه کاشان ـ خط نورد گرم ورق تخت ۲۵۰ هزار تن',
    industry: 'فولاد و صنایع معدنی', projectType: 'نورد ورق گرم- تولید پلیت', steelStage: 'نورد گرم ورق - تولید پلیت',
    templateId: 'comfar-import', capacity: '250000', location: 'کاشان',
    sourceReport: {
      reportFile: 'COMFAR III - 001 - Summary sheet (2).pdf',
      reportTitle: 'طرح توسعه شرکت نورد زرین فجر گالوانیزه کاشان',
      description: 'احداث خط نورد گرم؛ ظرفیت تولید سالیانه ۲۵۰ هزار تن ورق تخت فولادی',
      inputDate: '1401/10/05', constructionStart: '1402/01', constructionEnd: '1403/12', constructionYears: 2,
      operationStart: '1404/01', operationEnd: '1418/12', operatingYears: 15,
      capacityDescription: '۲۵۰ هزار تن ورق تخت فولادی در سال', primaryCapacity: 250000, product: 'ورق تخت فولادی',
      currency: 'میلیون ریال', accountingUnit: 'مطلق',
      fixedInvestment: 13327319.84, preproductionTotal: 9420983.31, preproductionNet: 268076, capitalizedInterest: 9152907.31,
      workingCapital: 1953898.01, totalInvestment: 24702201.16,
      equity: 2719079.16, longTermDebt: 21346939.92, shortTermDebt: 0, totalFunding: 24067552.21,
      firstOperatingYear: 1404, referenceYear: 1407, lastOperatingYear: 1418,
      firstYearRevenue: 36739937.50, referenceRevenue: 52485625, lastYearRevenue: 52485625,
      firstYearFactoryCost: 28477772.23, referenceFactoryCost: 40215847, lastYearFactoryCost: 40215847,
      taxPercent: 25, investmentNpvRate: 30, investmentNpv: 9158253.74, investmentIrr: 46.83, investmentMirr: 46.83,
      equityNpvRate: 30, equityNpv: 7790970.08, equityIrr: 82.08, equityMirr: 82.09, valuationDate: '12/1402'
    }
  },
  {
    id: 'comfar-cold-coil-200k', name: 'طرح توسعه شرکت نورد زرین فجر گالوانیزه کاشان ـ خط نورد سرد کلاف ۲۰۰ هزار تن',
    industry: 'فولاد و صنایع معدنی', projectType: 'نورد سرد ورق', steelStage: 'نورد سرد و پوشش‌دهی',
    templateId: 'comfar-import', capacity: '200000', location: 'کاشان',
    sourceReport: {
      reportFile: 'COMFAR III - 001 - جدول خلاصه عملکرد پروژه (4).pdf',
      reportTitle: 'طرح توسعه شرکت نورد زرین فجر گالوانیزه کاشان',
      description: 'احداث خط نورد سرد؛ ظرفیت تولید سالیانه ۲۰۰ هزار تن کلاف سرد فولادی',
      inputDate: '1402/07/01', constructionStart: '1401/07', constructionEnd: '1402/12', constructionYears: 1.5,
      operationStart: '1403/01', operationEnd: '1417/12', operatingYears: 15,
      capacityDescription: '۲۰۰ هزار تن کلاف سرد فولادی در سال', primaryCapacity: 200000, product: 'کلاف سرد فولادی',
      currency: 'میلیون ریال', accountingUnit: 'مطلق',
      fixedInvestment: 14387972, preproductionTotal: 652400, preproductionNet: 302400, capitalizedInterest: 350000,
      workingCapital: 2960412.61, totalInvestment: 18000784.61,
      equity: 12083870, longTermDebt: 5350000, shortTermDebt: 0, totalFunding: 17433870,
      firstOperatingYear: 1403, referenceYear: 1405, lastOperatingYear: 1417,
      firstYearRevenue: 63200000, referenceRevenue: 79000000, lastYearRevenue: 79000000,
      firstYearFactoryCost: 53459511.66, referenceFactoryCost: 66205570.90, lastYearFactoryCost: 66205570.90,
      taxPercent: 25, investmentNpvRate: 20, investmentNpv: 31425182.71, investmentIrr: 52.83, investmentMirr: 28.42,
      equityNpvRate: 25, equityNpv: 22266153.57, equityIrr: 56.37, equityMirr: 30.42, valuationDate: '12/1402'
    }
  },
  {
    id: 'comfar-integrated-steel-dri', name: 'طرح توسعه احداث مجتمع فولادسازی ـ فولادسازی ۱٫۲ میلیون و احیای مستقیم هات‌لینک ۱٫۷۶ میلیون تن',
    industry: 'فولاد و صنایع معدنی', projectType: 'مجتمع فولادسازی و احیای مستقیم', steelStage: 'فولادسازی و ریخته‌گری',
    templateId: 'comfar-import', capacity: '1200000', location: '',
    sourceReport: {
      reportFile: 'COMFAR III - 001 - Summary sheet1 (3).pdf',
      reportTitle: 'طرح توسعه احداث مجتمع فولادسازی',
      description: 'کارخانه فولادسازی با ظرفیت ۱٬۲۰۰٬۰۰۰ تن در سال؛ کارخانه احیای مستقیم هات‌لینک با ظرفیت ۱٬۷۶۰٬۰۰۰ تن در سال؛ واحد انباشت و برداشت و پست برق',
      inputDate: '1402/02/01', constructionStart: '1401/01', constructionEnd: '1404/12', constructionYears: 4,
      operationStart: '1405/01', operationEnd: '1419/12', operatingYears: 15,
      capacityDescription: 'فولادسازی ۱٬۲۰۰٬۰۰۰ تن/سال و احیای مستقیم هات‌لینک ۱٬۷۶۰٬۰۰۰ تن/سال',
      primaryCapacity: 1200000, secondaryCapacity: 1760000, product: 'محصول فولادسازی',
      currency: 'یورو', accountingUnit: 'مطلق',
      fixedInvestment: 453858298, preproductionTotal: 117124027, preproductionNet: 6624027, capitalizedInterest: 110500000,
      workingCapital: 68155775.89, totalInvestment: 639138100.89,
      equity: 139982325, longTermDebt: 431000000, shortTermDebt: 49523442.75, totalFunding: 620505767.75,
      firstOperatingYear: 5, referenceYear: 9, lastOperatingYear: 19,
      firstYearRevenue: 633760000, referenceRevenue: 887300000, lastYearRevenue: 887300000,
      firstYearFactoryCost: 460719614.06, referenceFactoryCost: 643963499, lastYearFactoryCost: 643963499,
      taxPercent: 25, investmentNpvRate: 25, investmentNpv: 19964251.38, investmentIrr: 26.08, investmentMirr: 26.08,
      equityNpvRate: 30, equityNpv: 60342720.87, equityIrr: 40.51, equityMirr: 40.51, valuationDate: '12/01'
    }
  }
]

/** One-time import of the four projects identified in the attached COMFAR III output reports. */
export async function seedComfarReferenceProjects(): Promise<FeasibilityProject[]> {
  const seeded = await localStore.get<boolean>(COMFAR_SEED_KEY)
  const current = await listProjects()
  const now = new Date().toISOString()
  const references = new Map(COMFAR_REFERENCE_PROJECTS.map(project => [project.id, project]))
  const existingIds = new Set(current.map(project => project.id))
  const restored = current.map(project => {
    const reference = references.get(project.id)
    if (!reference) return project
    return {
      ...project,
      templateId: 'comfar-import' as const,
      projectType: reference.projectType,
      steelStage: reference.steelStage,
      sourceReport: reference.sourceReport
    }
  })
  const additions: FeasibilityProject[] = seeded ? [] : COMFAR_REFERENCE_PROJECTS
    .filter(project => !existingIds.has(project.id))
    .map(project => ({ ...project, status: 'draft', createdAt: now, updatedAt: now }))
  const next = [...additions, ...restored]
  await localStore.set(PROJECTS_KEY, next)
  await localStore.set(COMFAR_SEED_KEY, true)
  return next
}

export async function listProjects(): Promise<FeasibilityProject[]> {
  const stored = (await localStore.get<FeasibilityProject[]>(PROJECTS_KEY)) ?? []
  const importedIds = new Set(COMFAR_REFERENCE_PROJECTS.map(project => project.id))
  const normalized = stored.map(project => ({
    ...project,
    templateId: project.sourceReport || importedIds.has(project.id) || project.templateId === 'comfar-import'
      ? 'comfar-import' as const
      : 'raw' as const
  }))
  if (stored.some((project, index) => project.templateId !== normalized[index].templateId)) {
    await localStore.set(PROJECTS_KEY, normalized)
  }
  return normalized
}

export async function createProject(input: Pick<FeasibilityProject, 'name' | 'industry' | 'projectType' | 'capacity' | 'location'>): Promise<FeasibilityProject> {
  const projects = await listProjects()
  const now = new Date().toISOString()
  const project: FeasibilityProject = {
    name: input.name, industry: input.industry, projectType: input.projectType,
    capacity: input.capacity, location: input.location, templateId: 'raw',
    id: crypto.randomUUID?.() ?? `project-${Date.now()}`, status: 'draft', createdAt: now, updatedAt: now
  }
  await localStore.set(PROJECTS_KEY, [project, ...projects])
  return project
}

export async function updateProject(id: string, patch: Partial<Pick<FeasibilityProject, 'name' | 'location'>>): Promise<FeasibilityProject> {
  const projects = await listProjects()
  const existing = projects.find(project => project.id === id)
  if (!existing) throw new Error('Project not found')
  const updated: FeasibilityProject = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  await localStore.set(PROJECTS_KEY, projects.map(project => project.id === id ? updated : project))
  return updated
}

export async function deleteProject(id: string): Promise<void> {
  const projects = await listProjects()
  await localStore.set(PROJECTS_KEY, projects.filter(project => project.id !== id))
}

/**
 * One-time cleanup of retired legacy project records.
 * Hash-only identifiers avoid retaining the old project labels in source code.
 */
const normalizeLegacyProjectKey = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
const hashLegacyProjectKey = (value: string) => {
  let hash = 2166136261
  const normalized = normalizeLegacyProjectKey(value)
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
const retiredProjectNameHashes = new Set(['8ed4fe00', 'c686cc66', 'cc8f9036', '83746ace', '3adafd09', '8b4f0421', 'bc59aba4', '2539f5ef', '0ba54e2d', 'c3757c02', 'e6a99e35', 'f40958eb'])
const retiredProjectStageHashes = new Set(['965f8c3e', '03af782d', '83746ace', 'bc59aba4', '2539f5ef', '0ba54e2d', 'c3757c02', 'e6a99e35', 'f40958eb'])
const retiredProjectTemplateHash = 'cc307164'

export async function purgeRemovedCaseProjects(): Promise<FeasibilityProject[]> {
  // Match retired labels before listProjects normalizes every legacy record to the sole raw template.
  const projects = (await localStore.get<FeasibilityProject[]>(PROJECTS_KEY)) ?? []
  const isRemovedCase = (project: FeasibilityProject) =>
    retiredProjectNameHashes.has(hashLegacyProjectKey(project.name))
    || retiredProjectStageHashes.has(hashLegacyProjectKey(project.steelStage ?? ''))
    || hashLegacyProjectKey(project.templateId ?? '') === retiredProjectTemplateHash
  const retiredProjects = projects.filter(isRemovedCase)
  const remaining = projects.filter(project => !isRemovedCase(project)).map(project => ({ ...project, templateId: project.templateId === 'comfar-import' ? 'comfar-import' as const : 'raw' as const }))
  if (remaining.length !== projects.length || projects.some(project => project.templateId !== 'raw')) await localStore.set(PROJECTS_KEY, remaining)

  const [rollingRecords, processRecords, retiredModelRecords] = await Promise.all([
    localStore.list('pishran:rolling:'),
    localStore.list('process-plant:'),
    Promise.all(retiredProjects.flatMap(project => [
      localStore.list('feasibility:project:' + project.id + ':'),
      localStore.list('feasibility:advanced-finance:' + project.id + ':')
    ]))
  ])
  const retiredFinanceKeys = retiredProjects.flatMap(project => [
    'feasibility:project:' + project.id + ':v1',
    'feasibility:advanced-finance:' + project.id
  ])
  await Promise.all([
    ...rollingRecords.map(record => localStore.remove(record.key)),
    ...processRecords.map(record => localStore.remove(record.key)),
    ...retiredModelRecords.flat().map(record => localStore.remove(record.key)),
    ...retiredFinanceKeys.map(key => localStore.remove(key)),
    localStore.remove('rolling:sample:v2'),
    localStore.remove('projects:workbook-seed:v1')
  ])
  return remaining
}
