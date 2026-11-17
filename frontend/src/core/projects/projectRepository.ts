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
const retiredProjectNameHashes = new Set(['8ed4fe00', 'c686cc66', 'cc8f9036', '83746ace', '3adafd09', '8b4f0421'])
const retiredProjectStageHashes = new Set(['965f8c3e', '03af782d', '83746ace'])
const retiredProjectTemplateHash = 'cc307164'

const normalizeProjectIdentity = (value: unknown) =>
  typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/[\\s_-]+/g, '') : ''

/**
 * Removes retired sample projects and only their associated local records.
 * HRCR200 is identified by its stable project code or canonical sample title.
 */
export async function purgeRemovedCaseProjects(): Promise<FeasibilityProject[]> {
  const projects = await listProjects()
  const canonicalHrcrTitle = normalizeProjectIdentity('نورد گرم ورق-تولید کلاف')
  const isHrcr200Sample = (project: FeasibilityProject) => [
    project.id, project.name, project.industry, project.projectType, project.steelStage
  ].map(normalizeProjectIdentity).some(value =>
    value.includes('hrcr200') || value === canonicalHrcrTitle
  )
  const isRemovedLegacyCase = (project: FeasibilityProject) =>
    retiredProjectNameHashes.has(hashLegacyProjectKey(project.name))
    || retiredProjectStageHashes.has(hashLegacyProjectKey(project.steelStage ?? ''))
    || hashLegacyProjectKey(project.templateId ?? '') === retiredProjectTemplateHash
  const removedProjects = projects.filter(project => isHrcr200Sample(project) || isRemovedLegacyCase(project))
  const removedIds = removedProjects.map(project => normalizeProjectIdentity(project.id)).filter(Boolean)
  const remaining = projects.filter(project => !removedProjects.includes(project))
  if (removedProjects.length) await localStore.set(PROJECTS_KEY, remaining)

  const records = await localStore.list()
  const keysToRemove = records.filter(record => {
    const key = normalizeProjectIdentity(record.key)
    return key.includes('hrcr200')
      || key.includes(canonicalHrcrTitle)
      || removedIds.some(id => key.includes(id))
  }).map(record => record.key)

  // These two keys are retired sample-only data from earlier releases.
  keysToRemove.push('rolling:sample:v2', 'projects:workbook-seed:v1')
  await Promise.all([...new Set(keysToRemove)].map(key => localStore.remove(key)))
  return remaining
}
