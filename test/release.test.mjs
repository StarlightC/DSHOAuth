import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publishMain } from '../scripts/publish-main.mjs'

test('release synchronization preserves history, publishes only package files and never downgrades main', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-oauth-release-test-'))
  const remote = join(root, 'remote.git'), repo = join(root, 'source')
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    mkdirSync(repo)
    git(['init', '--bare', remote])
    git(['init', '-b', 'main'])
    git(['config', 'user.name', 'Release Test'])
    git(['config', 'user.email', 'release-test@example.invalid'])
    writeFileSync(join(repo, 'source-only.txt'), 'Do not publish')
    git(['add', '.'])
    git(['commit', '-m', 'initial source'])
    const sourceCommit = git(['rev-parse', 'HEAD'])
    git(['remote', 'add', 'origin', remote])
    git(['push', 'origin', 'main'])
    git(['switch', '-c', 'source'])
    const contents = join(root, 'package')
    mkdirSync(join(contents, 'lib'), { recursive: true })
    writeFileSync(join(contents, 'lib/index.js'), 'export const name = "dsh-oauth"')
    writeFileSync(join(contents, 'lib/client.js'), '/* browser bundle */')
    writeFileSync(join(contents, 'cordis.patch.yml'), '[]')
    const asset = join(root, 'dsh-oauth.tgz')
    const pack = version => {
      writeFileSync(join(contents, 'package.json'), JSON.stringify({ name: 'dsh-oauth', version }))
      execFileSync('tar', ['-czf', asset, '-C', root, 'package'])
    }
    const publish = tag => publishMain({ cwd: repo, asset, tag, sourceCommit })
    pack('0.1.0')
    assert.equal(publish('v0.1.0'), 'published')
    assert.equal(git(['rev-parse', 'origin/main^']), sourceCommit)
    assert.equal(git(['branch', '--show-current']), 'source')
    assert.equal(git(['status', '--porcelain']), '')
    const tree = git(['ls-tree', '-r', '--name-only', 'origin/main']).split('\n')
    assert.deepEqual(tree.sort(), ['.release.json', 'cordis.patch.yml', 'lib/client.js', 'lib/index.js', 'package.json'].sort())
    const published = git(['rev-parse', 'origin/main'])
    assert.equal(publish('v0.1.0'), 'already-published')
    assert.equal(publish('v0.2.0-beta.1'), 'prerelease')
    assert.equal(git(['rev-parse', 'origin/main']), published)
    assert.throws(() => publish('v0.2.0'), /AssertionError/)
    pack('0.2.0')
    assert.equal(publish('v0.2.0'), 'published')
    assert.equal(git(['rev-parse', 'origin/main^']), published)
    pack('0.1.0')
    assert.equal(publish('v0.1.0'), 'older-version')
    assert.equal(JSON.parse(git(['show', 'origin/main:.release.json'])).version, '0.2.0')
    assert.equal(git(['worktree', 'list', '--porcelain']).match(/^worktree /gm).length, 1)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
