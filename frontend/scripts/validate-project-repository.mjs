import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source=await readFile(new URL('../src/core/projects/projectRepository.ts',import.meta.url),'utf8')
const state=new Map()
const removed=[]
const mockStore={
 async get(key){return state.get(key)},
 async set(key,value){state.set(key,value)},
 async remove(key){removed.push(key);state.delete(key)}
}
globalThis.__mockStore=mockStore
const mockUrl='data:text/javascript;base64,'+Buffer.from(`export const localStore={get:async key=>globalThis.__mockStore.get(key),set:async (key,value)=>globalThis.__mockStore.set(key,value),remove:async key=>globalThis.__mockStore.remove(key)};`).toString('base64')
let output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
output=output.replace("'../storage/localStore'",JSON.stringify(mockUrl))
const repository=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const projects=[
 {id:'sample-hr',name:'نورد گرم ورق-تولید کلاف',templateId:'raw',capacity:'200000',location:'کاشان',industry:'فولاد',status:'draft',createdAt:'',updatedAt:''},
 {id:'sample-old-template',name:'هر نامی',templateId:'hot-rolling-200kt',capacity:'',location:'',industry:'فولاد',status:'draft',createdAt:'',updatedAt:''},
 {id:'sample-dri',name:'واحد احیاء مستقیم',capacity:'',location:'',industry:'فولاد',status:'draft',createdAt:'',updatedAt:''},
 {id:'sample-dash',name:'پروژه نورد گرم ورق – تولید کلاف',capacity:'',location:'',industry:'فولاد',status:'draft',createdAt:'',updatedAt:''},
 {id:'user-hotrolling',name:'نورد گرم ورق توسعه فاز دوم',templateId:'raw',capacity:'',location:'',industry:'صنعتی',status:'draft',createdAt:'',updatedAt:''},
 {id:'user-raw',name:'پروژه آزمایشی کاربر',templateId:'raw',capacity:'',location:'',industry:'سایر صنایع',status:'draft',createdAt:'',updatedAt:''}
]
state.set('projects:list:v1',projects)
const remaining=await repository.removeSampleProjects()
assert.deepEqual(remaining.map(x=>x.id),['user-hotrolling','user-raw'])
assert.deepEqual((await repository.listProjects()).map(x=>x.id),['user-hotrolling','user-raw'])
assert.ok(removed.includes('feasibility:project:sample-hr:v1'))
assert.ok(removed.includes('feasibility:project:sample-old-template:v1'))
assert.ok(removed.includes('feasibility:project:sample-dash:v1'))
assert.ok(removed.includes('projects:workbook-seed:v1'))
assert.ok(removed.includes('projects:dri-direct-reduction-seed:v1'))
console.log('Project sample cleanup and raw-template retention: all assertions passed.')
