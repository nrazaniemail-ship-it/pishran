import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'

const files = [
  'native/android/res/drawable/ic_launcher_background.xml',
  'native/android/res/drawable/ic_launcher_foreground.xml',
  'native/android/res/mipmap-anydpi/ic_launcher.xml',
  'native/android/res/mipmap-anydpi/ic_launcher_round.xml',
  'native/android/res/mipmap-anydpi-v26/ic_launcher.xml',
  'native/android/res/mipmap-anydpi-v26/ic_launcher_round.xml',
]
for (const file of files) await access(new URL('../' + file, import.meta.url))

const background = await readFile(new URL('../native/android/res/drawable/ic_launcher_background.xml', import.meta.url), 'utf8')
const foreground = await readFile(new URL('../native/android/res/drawable/ic_launcher_foreground.xml', import.meta.url), 'utf8')
const workflow = await readFile(new URL('../../.github/workflows/build-android.yml', import.meta.url), 'utf8')
assert.ok(background.includes('#0E2A66') && background.includes('#14B8A6'),
  'Android launcher background must use the supplied navy-to-teal gradient')
assert.ok(foreground.includes('#FFFFFF') && foreground.includes('#0066FF') &&
  foreground.includes('M338,489'),
  'Android launcher foreground must contain the white tile and supplied blue check mark')
assert.ok(workflow.includes('rm -rf android/app/src/main/res/mipmap-*') &&
  workflow.includes('cp -R native/android/res/. android/app/src/main/res/'),
  'The manual Capacitor Android build must install the committed launcher resources after cap sync')
console.log('Android launcher icon resources validated')
