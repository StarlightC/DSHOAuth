import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, access } from 'node:fs/promises'

test('release packages have built entry points and no installation or preparation hooks', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'prepublish', 'prepublishOnly', 'publish']) {
    assert.equal(pkg.scripts?.[hook], undefined, `${hook} can trigger Git dependency preparation`)
  }
  for (const entry of [pkg.main, pkg.exports['./client'], pkg.dsh.bundle.patch]) {
    await access(new URL(`../${entry}`, import.meta.url))
  }
  assert.ok(pkg.files.includes('lib'))
})

test('pi-ai is shared with Harness instead of installing another provider dependency tree', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.dependencies?.['@earendil-works/pi-ai'], undefined)
  assert.equal(pkg.peerDependencies['@earendil-works/pi-ai'], '1.0.2')
  assert.equal(pkg.devDependencies['@earendil-works/pi-ai'], '1.0.2')
})
