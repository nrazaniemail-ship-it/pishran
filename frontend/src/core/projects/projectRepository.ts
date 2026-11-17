import { localStore } from '../storage/localStore'

export type ProjectStatus = 'draft' | 'active' | 'archived'
export type ProjectTemplateId = 'raw'

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
 * Purge the retired HRCR200 and integrated DRI/steelmaking case data.
 * Generic project types and independent project drafts remain available.
 */
export async function purgeRemovedCaseProjects(): Promise<FeasibilityProject[]> {
  const projects = await listProjects()
  const isRemovedCase = (project: FeasibilityProject) => {
    const name = project.name.trim()
    const stage = project.steelStage ?? ''
    const hrcrCase = project.templateId === 'hot-rolling-200kt'
      || /HRCR200/i.test(name + ' ' + stage)
      || ['نورد گرم ورق-تولید کلاف', 'نورد گرم ورق - تولید کلاف', 'پروژه نورد گرم ورق-تولید کلاف'].includes(name)
      || (stage === 'نورد گرم / ورق' && project.capacity.includes('HRCR200'))
    const integratedCase = /احیاء.*فولادسازی|فولادسازی.*احیاء/.test(name)
      || stage.includes('مجتمع احیاء')
      || stage === 'مجتمع احیاء و فولادسازی - تولید اسلب'
    return hrcrCase || integratedCase
  }
  const removed = projects.filter(isRemovedCase)
  const remaining = projects.filter(project => !isRemovedCase(project))
  if (removed.length) await localStore.set(PROJECTS_KEY, remaining)

  // Remove saved records belonging to the retired workspaces, including orphaned
  // records left behind after an earlier sample-project list cleanup.
  const [rollingRecords, processRecords] = await Promise.all([
    localStore.list('pishran:rolling:'),
    localStore.list('process-plant:')
  ])
  await Promise.all([
    ...rollingRecords.map(record => localStore.remove(record.key)),
    ...processRecords.map(record => localStore.remove(record.key)),
    localStore.remove('rolling:sample:v2'),
    localStore.remove('projects:workbook-seed:v1')
  ])
  return remaining
}
