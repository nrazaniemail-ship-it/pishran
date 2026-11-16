import { localStore } from '../storage/localStore'

export type ProjectStatus = 'draft' | 'active' | 'archived'
export type ProjectTemplateId = 'raw' | 'hot-rolling-200kt'

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
}

const PROJECTS_KEY = 'projects:list:v1'
const WORKBOOK_SEED_KEY = 'projects:workbook-seed:v1'
const DRI_PROJECT_SEED_KEY = 'projects:dri-direct-reduction-seed:v1'

export async function listProjects(): Promise<FeasibilityProject[]> {
  return (await localStore.get<FeasibilityProject[]>(PROJECTS_KEY)) ?? []
}

export async function createProject(input: Pick<FeasibilityProject, 'name' | 'industry' | 'projectType' | 'steelStage' | 'capacity' | 'location' | 'templateId'>): Promise<FeasibilityProject> {
  const projects = await listProjects()
  const now = new Date().toISOString()
  const project: FeasibilityProject = {
    ...input,
    id: crypto.randomUUID?.() ?? `project-${Date.now()}`,
    status: 'draft',
    createdAt: now,
    updatedAt: now
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
 * Remove only the built-in demonstration projects from the project list.
 * Project-specific local data is deliberately preserved so it can be reused
 * when the final project forms are ready.
 */
export async function removeSampleProjects(): Promise<FeasibilityProject[]> {
  const projects = await listProjects()
  const sampleNames = new Set([
    'پروژه نورد گرم ورق',
    'نورد گرم ورق-تولید کلاف',
    'نورد گرم ورق - تولید کلاف',
    'پروژه نورد گرم ورق-تولید کلاف',
    'پروژه احیاء مستقیم و فولادسازی',
    'پروژه نورد سرد ورق فولادی (CRC200)',
    'واحد احیاء مستقیم'
  ])
  const isSample = (project: FeasibilityProject) => {
    if (sampleNames.has(project.name.trim())) return true
    if (project.steelStage === 'نورد گرم / ورق'
      && project.capacity === '۲۰۰٬۰۰۰ تن ورق در سال (مبنای فایل HRCR200)') return true
    if (project.steelStage === 'مجتمع احیاء مستقیم و فولادسازی'
      && project.capacity === '۱٬۷۶۰٬۰۰۰ تن DRI و ۱٬۲۰۰٬۰۰۰ تن تختال در سال') return true
    if (project.steelStage === 'نورد سرد و پوشش‌دهی'
      && project.capacity === '۲۰۰٬۰۰۰ تن در سال'
      && project.location === 'کاشان، منطقه صنعتی کوثر') return true
    if (project.steelStage === 'احیای مستقیم'
      && project.capacity === '۱٬۰۰۰٬۰۰۰ تن آهن اسفنجی سرد (CDRI) در سال'
      && project.location === 'شهرک صنعتی مربچه، شهرستان رامهرمز') return true
    return false
  }
  const remaining = projects.filter(project => !isSample(project))
  if (remaining.length !== projects.length) {
    await localStore.set(PROJECTS_KEY, remaining)
  }
  // Retire the old seed markers so sample projects are never recreated.
  await localStore.remove(WORKBOOK_SEED_KEY)
  await localStore.remove(DRI_PROJECT_SEED_KEY)
  return remaining
}
