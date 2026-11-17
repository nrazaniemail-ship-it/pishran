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

export async function createProject(input: Pick<FeasibilityProject, 'name' | 'industry' | 'projectType' | 'capacity' | 'location'> & { templateId?: 'raw' }): Promise<FeasibilityProject> {
  const projects = await listProjects()
  const now = new Date().toISOString()
  const project: FeasibilityProject = {
    ...input,
    templateId: 'raw',
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
 * Remove built-in demonstration projects and their project-specific draft data.
 * Migrate every surviving project to the single raw template while preserving
 * user-entered model drafts and removing legacy stage-specific routing metadata.
 */
export async function removeSampleProjects(): Promise<FeasibilityProject[]> {
  const projects = await listProjects()
  // Retire legacy stage-specific sample records without retaining project-specific identifiers.
  const remaining = projects.filter(project => project.templateId === 'raw' && !project.steelStage)
  if (remaining.length !== projects.length) await localStore.set(PROJECTS_KEY, remaining)
  const retainedIds = new Set(remaining.map(project => project.id))
  const [projectDrafts, advancedFinanceDrafts, expansionDrafts, seedRecords] = await Promise.all([
    localStore.list('feasibility:project:'),
    localStore.list('feasibility:advanced-finance:'),
    localStore.list('feasibility:expansion-rehabilitation:'),
    localStore.list('projects:')
  ])
  const orphanedRecords = [
    ...projectDrafts.filter(record => !retainedIds.has(record.key.slice('feasibility:project:'.length).split(':')[0])),
    ...advancedFinanceDrafts.filter(record => !retainedIds.has(record.key.slice('feasibility:advanced-finance:'.length).split(':')[0])),
    ...expansionDrafts.filter(record => !retainedIds.has(record.key.slice('feasibility:expansion-rehabilitation:'.length).split(':')[0])),
    ...seedRecords.filter(record => record.key !== PROJECTS_KEY)
  ]
  if (orphanedRecords.length) await Promise.all(orphanedRecords.map(record => localStore.remove(record.key)))
  return remaining
}
/** Purge retired HRCR200 and integrated DRI/steelmaking project data. */
export async function purgeRemovedCaseProjects(): Promise<FeasibilityProject[]> {
 const projects=await listProjects()
 const isRemoved=(p:FeasibilityProject)=>{const n=p.name.trim(),stage=p.steelStage??'';const hrcr=p.templateId==='hot-rolling-200kt'||/HRCR200/i.test(n+' '+stage)||['نورد گرم ورق-تولید کلاف','نورد گرم ورق - تولید کلاف','پروژه نورد گرم ورق-تولید کلاف'].includes(n)||(stage==='نورد گرم / ورق'&&p.capacity.includes('HRCR200'));const integrated=/احیاء.*فولادسازی|فولادسازی.*احیاء/.test(n)||stage.includes('مجتمع احیاء');return hrcr||integrated}
 const removed=projects.filter(isRemoved),remaining=projects.filter(p=>!isRemoved(p));if(removed.length)await localStore.set(PROJECTS_KEY,remaining)
 const [rolling,process]=await Promise.all([localStore.list('pishran:rolling:'),localStore.list('process-plant:')])
 await Promise.all([...rolling.map(x=>localStore.remove(x.key)),...process.map(x=>localStore.remove(x.key)),localStore.remove('rolling:sample:v2'),localStore.remove('projects:workbook-seed:v1')])
 return remaining
}
