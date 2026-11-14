import { localStore } from '../storage/localStore'

export type ProjectStatus = 'draft' | 'active' | 'archived'

export interface FeasibilityProject {
  id: string
  name: string
  industry: string
  steelStage?: string
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

export async function createProject(input: Pick<FeasibilityProject, 'name' | 'industry' | 'steelStage' | 'capacity' | 'location'>): Promise<FeasibilityProject> {
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

export async function deleteProject(id: string): Promise<void> {
  const projects = await listProjects()
  await localStore.set(PROJECTS_KEY, projects.filter(project => project.id !== id))
}

/**
 * Create the two source-workbook projects once, so they appear in the user's
 * project list on first launch without overwriting or duplicating existing work.
 */
export async function ensureWorkbookProjects(): Promise<FeasibilityProject[]> {
  const projects = await listProjects()
  const definitions: Array<Pick<FeasibilityProject, 'name' | 'industry' | 'steelStage' | 'capacity' | 'location'>> = [
    {
      name: 'پروژه نورد گرم ورق',
      industry: 'فولاد و صنایع معدنی',
      steelStage: 'نورد گرم / ورق',
      capacity: '۲۰۰٬۰۰۰ تن ورق در سال (مبنای فایل HRCR200)',
      location: ''
    },
    {
      name: 'پروژه احیاء مستقیم و فولادسازی',
      industry: 'فولاد و صنایع معدنی',
      steelStage: 'مجتمع احیاء مستقیم و فولادسازی',
      capacity: '۱٬۷۶۰٬۰۰۰ تن DRI و ۱٬۲۰۰٬۰۰۰ تن تختال در سال',
      location: ''
    }
  ]
  let next = [...projects]
  for (const definition of definitions) {
    if (next.some(project => project.name === definition.name)) continue
    const now = new Date().toISOString()
    next.unshift({
      ...definition,
      id: crypto.randomUUID?.() ?? `project-${Date.now()}-${next.length}`,
      status: 'draft',
      createdAt: now,
      updatedAt: now
    })
  }
  if (next.length !== projects.length) await localStore.set(PROJECTS_KEY, next)
  return next
}
