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

test('module navigation is provided by the twelve dashboard cards, not a primary-menu dropdown',()=>{
 assert.match(app,/className="module-launcher-card" onClick=\{\(\) => openModule\(item\.id\)\}/)
 assert.match(app,/aria-label=\{\x60\$\{item\.id\}: \$\{isEn \? item\.enTitle : item\.title\}\x60\}/)
 assert.doesNotMatch(app,/nav-module-toggle|nav-dropdown-menu|role="menuitem"/)
 assert.match(app,/dashboard renders all twelve module launcher cards with real module navigation|module-launcher-card/)
})

test('PDF print rules isolate the active module report and hide navigation/export controls',()=>{
 assert.match(style,/@media print/)
 assert.match(style,/\[data-module-export-root\],\[data-module-export-root\] \*/)
 assert.match(style,/\.module-export-actions,\.module-workspace-heading>button,\.topbar/)
})
