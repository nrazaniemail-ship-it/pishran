import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const projectsView=await readFile(new URL('../src/features/projects/ProjectsView.tsx',import.meta.url),'utf8')
assert.match(projectsView,/templateId: 'raw'/,'New projects must always use the raw template')
assert.match(projectsView,/معدن سنگ آهن/,'Mining projects must expose the supported project types')
assert.match(projectsView,/نورد ورق گرم- تولید کلاف/,'Industrial steel projects must expose the supported rolling project types')
assert.match(projectsView,/type="number" min="0" step="any"/,'Capacity input must be numeric and non-negative')
assert.match(projectsView,/capacityUnitFor/,'Project creation must assign capacity units by sector')
assert.match(projectsView,/unit === 'تن در سال' \? 'tonnes\/year'/,'English project creation must translate tonnes per year')
assert.match(projectsView,/unit === 'مگاوات' \? 'MW'/,'English project creation must translate megawatts')
assert.match(projectsView,/displayCapacityUnit\(capacityUnit\)/,'Project creation form must render capacity units in the selected language')
assert.match(projectsView,/displayCapacityUnit\(project\.capacityUnit\)/,'Saved project cards must render capacity units in the selected language')
assert.match(projectsView,/if \(industry === 'انرژی و نیروگاه'\) return 'مگاوات'/,'Power projects must use megawatts')
assert.match(projectsView,/return 'تن در سال'/,'Steel and mining projects must use tonnes per year')
assert.match(projectsView,/if \(industry === 'معدن' \|\| industry === 'صنعتی'\) return 'تن در سال'/,'Other project types in the mining and steel sectors must retain tonnes-per-year capacity')
for (const type of ['معدن سنگ آهن','کنستانتره','گندله سازی','احیاء','ذوب و ریخته گری','احیاء و فولادسازی- تولید اسلب','نورد ورق گرم- تولید پلیت','نورد ورق گرم- تولید کلاف','نورد سرد ورق','نورد میلگرد','نورد نبشی','نورد تیرآهن','سایر'])
  assert.ok(projectsView.includes(type), 'Missing supported project type: '+type)
const wizard=await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx',import.meta.url),'utf8')
assert.match(wizard,/nameplate:project\.capacity\.trim\(\)/,'Capacity entered during project creation must be carried into the model')
assert.match(wizard,/projectCapacityUnit/,'The model must display the project-specific capacity unit')
assert.ok(wizard.includes("const displayValue=value==null?'':value"),'Explicit zero values must remain visible after user entry')
assert.ok(wizard.includes("value={r.quantity==null?'':r.quantity}"),'Blank raw row quantities must use null, while explicit zero remains visible')
assert.ok(wizard.includes("value={r.unitPrice==null?'':r.unitPrice}"),'Blank raw row prices must use null, while explicit zero remains visible')
assert.ok(wizard.includes('blankZero?null as unknown as number:0'),'New rows in the raw template must begin with null values')
assert.match(projectsView,/قالب خام/,'The raw template must remain available')
assert.doesNotMatch(projectsView,/STEEL_PROJECT_OPTIONS|changeSteelProject|setSteelStage/,'The raw creation flow must not persist a preselected technical stage')

const source=await readFile(new URL('../src/core/projects/projectRepository.ts',import.meta.url),'utf8')
assert.match(source,/templateId: 'raw'/,'The repository must force every new project onto the raw template')
assert.doesNotMatch(source,/input\.steelStage/,'New projects must not persist legacy stage metadata')

const state=new Map()
const removed=[]
const mockStore={
 async get(key){return state.get(key)},
 async set(key,value){state.set(key,value)},
 async remove(key){removed.push(key);state.delete(key)},
 async list(prefix=''){return [...state.entries()].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value}))}
}
globalThis.__mockStore=mockStore
const mockUrl='data:text/javascript;base64,'+Buffer.from(`export const localStore={get:async key=>globalThis.__mockStore.get(key),set:async (key,value)=>globalThis.__mockStore.set(key,value),remove:async key=>globalThis.__mockStore.remove(key),list:async prefix=>globalThis.__mockStore.list(prefix)};`).toString('base64')
let output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
output=output.replace("'../storage/localStore'",JSON.stringify(mockUrl))
const repository=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))

const created=await repository.createProject({name:'Generic test project',industry:'Industrial',projectType:'Manufacturing',capacity:'',location:''})
assert.equal(created.templateId,'raw')
assert.equal(created.capacityUnit,undefined)
const capacityProject=await repository.createProject({name:'Power project',industry:'Energy',projectType:'Solar',capacity:'25',capacityUnit:'MW',location:''})
assert.equal(capacityProject.capacity,'25')
assert.equal(capacityProject.capacityUnit,'MW')
assert.equal(created.steelStage,undefined)
assert.deepEqual((await repository.listProjects()).map(project=>project.id),[capacityProject.id,created.id])

state.set('projects:list:v1', [
  created,
  {id:'HRCR200',name:'نورد گرم ورق-تولید کلاف',industry:'صنعتی',projectType:'نورد گرم ورق-تولید کلاف',capacity:'',location:'',status:'draft',createdAt:'2026-01-01',updatedAt:'2026-01-01'},
  {id:'other-rolling',name:'نورد ورق نمونه دیگر',industry:'صنعتی',projectType:'نورد',capacity:'',location:'',status:'draft',createdAt:'2026-01-01',updatedAt:'2026-01-01'}
])
state.set('pishran:rolling:HRCR200:assets',{value:1})
state.set('process-plant:other-rolling',{value:2})
state.set('rolling:sample:v2',{value:3})
state.set('projects:workbook-seed:v1',{value:4})
state.set('unrelated:project-data',{value:5})
const remaining=await repository.purgeRemovedCaseProjects()
assert.deepEqual(remaining.map(project=>project.id),[created.id,'other-rolling'])
assert.equal(await mockStore.get('pishran:rolling:HRCR200:assets'),undefined)
assert.deepEqual(await mockStore.get('process-plant:other-rolling'),{value:2})
assert.equal(await mockStore.get('rolling:sample:v2'),undefined)
assert.equal(await mockStore.get('projects:workbook-seed:v1'),undefined)
assert.deepEqual(await mockStore.get('unrelated:project-data'),{value:5})
console.log('Generic project creation and retired-workspace cleanup: all assertions passed.')
