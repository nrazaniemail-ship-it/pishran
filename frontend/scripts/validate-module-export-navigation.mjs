import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const [app,exporter,style,pkg]=await Promise.all([
 readFile(new URL('../src/App.tsx',import.meta.url),'utf8'),
 readFile(new URL('../src/features/modules/ModuleExportActions.tsx',import.meta.url),'utf8'),
 readFile(new URL('../src/style.css',import.meta.url),'utf8'),
 readFile(new URL('../package.json',import.meta.url),'utf8')
])

test('all module workspaces expose a shared Excel and PDF export toolbar',()=>{
 assert.match(app,/ModuleExportActions moduleId=\{activeModule\.id\}/)
 assert.match(app,/data-module-export-root="true"/)
 assert.match(exporter,/XLSX\.utils\.book_new\(\)/)
 assert.match(exporter,/XLSX\.writeFile\(/)
 assert.match(exporter,/window\.print\(\)/)
 assert.match(pkg,/"xlsx"\s*:/)
})

test('Excel export includes module metadata, rendered report content, tables and current form values',()=>{
 assert.match(exporter,/querySelectorAll\('h1,h2,h3,h4,p,article,li,label'\)/)
 assert.match(exporter,/querySelectorAll\('table'\)/)
 assert.match(exporter,/input,select,textarea/)
 assert.match(exporter,/Generated at|زمان تهیه/)
})

test('module navigation uses an accessible real button and controlled menu',()=>{
 assert.match(app,/<button type="button" className=\{page === 'module' \? 'nav-item nav-module-toggle active' : 'nav-item nav-module-toggle'\}/)
 assert.match(app,/aria-expanded=\{moduleDropdownOpen\}/)
 assert.match(app,/role="menu"/)
 assert.match(app,/role="menuitem"/)
 assert.doesNotMatch(app,/<details className="nav-dropdown"/)
 assert.match(app,/setModuleDropdownOpen\(current => !current\)/)
})

test('PDF print rules isolate the active module report and hide navigation/export controls',()=>{
 assert.match(style,/@media print/)
 assert.match(style,/\[data-module-export-root\],\[data-module-export-root\] \*/)
 assert.match(style,/\.module-export-actions,\.module-workspace-heading>button,\.topbar/)
})
