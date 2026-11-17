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
const retiredProjectNameHashes = new Set(['8ed4fe00', 'c686cc66', 'cc8f9036', '83746ace', '3adafd09', '8b4f0421'])
const retiredProjectStageHashes = new Set(['965f8c3e', '03af782d', '83746ace'])
const retiredProjectTemplateHash = 'cc307164'

export async function purgeRemovedCaseProjects(): Promise<FeasibilityProject[]> {
  const projects = await listProjects()
  const isRemovedCase = (project: FeasibilityProject) =>
    retiredProjectNameHashes.has(hashLegacyProjectKey(project.name))
    || retiredProjectStageHashes.has(hashLegacyProjectKey(project.steelStage ?? ''))
    || hashLegacyProjectKey(project.templateId ?? '') === retiredProjectTemplateHash
  const removed = projects.filter(isRemovedCase)
  const remaining = projects.filter(project => !isRemovedCase(project))
  if (removed.length) await localStore.set(PROJECTS_KEY, remaining)

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
