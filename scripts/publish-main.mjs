import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
function stableVersion(value) {
  assert.match(value, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  return value.split('.').map(BigInt)
}
function compareVersions(left, right) {
  const a = stableVersion(left), b = stableVersion(right)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
  return 0
}

/** Publish the exact Release package as a fast-forward commit; never rewrite main. */
export function publishMain({ cwd = process.cwd(), asset, tag, sourceCommit }) {
  if (tag.includes('-')) return 'prerelease'
  const version = tag.replace(/^v/, '')
  stableVersion(version)
  assert.equal(tag, `v${version}`)
  assert.match(sourceCommit, /^[a-f0-9]{40,64}$/)
  const git = (args, dir = cwd) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const temp = mkdtempSync(join(tmpdir(), 'dsh-oauth-publish-'))
  const worktree = join(temp, 'main')
  let attached = false
  try {
    execFileSync('tar', ['-xzf', resolve(cwd, asset), '-C', temp])
    const contents = join(temp, 'package')
    const pkg = readJson(join(contents, 'package.json'))
    assert.equal(pkg.name, 'dsh-oauth')
    assert.equal(pkg.version, version)
    for (const entry of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml']) assert.ok(existsSync(join(contents, entry)), `Missing ${entry}`)
    for (const entry of readdirSync(contents)) assert.ok(['lib', 'package.json', 'README.md', 'cordis.patch.yml', 'LICENSE'].includes(entry), `Unexpected published entry: ${entry}`)
    git(['fetch', 'origin', 'main'])
    git(['worktree', 'add', '--detach', worktree, 'refs/remotes/origin/main'])
    attached = true
    const marker = join(worktree, '.release.json')
    if (existsSync(marker)) {
      const previous = readJson(marker)
      const order = compareVersions(previous.version, version)
      if (order > 0) return 'older-version'
      if (order === 0) {
        assert.equal(previous.tag, tag)
        assert.equal(previous.sourceCommit, sourceCommit, 'A published version cannot point to another source commit')
        return 'already-published'
      }
    }
    git(['rm', '-r', '--ignore-unmatch', '.'], worktree)
    cpSync(contents, worktree, { recursive: true })
    writeFileSync(marker, JSON.stringify({ version, tag, sourceCommit }, null, 2) + '\n')
    git(['add', '--all'], worktree)
    git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit', '-m', `release: ${tag}`], worktree)
    // If another publisher changed main after fetch, this fails instead of overwriting it.
    git(['push', 'origin', 'HEAD:refs/heads/main'], worktree)
    return 'published'
  } finally {
    if (attached) git(['worktree', 'remove', '--force', worktree])
    rmSync(temp, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(publishMain({ asset: process.argv[2], tag: process.env.RELEASE_TAG, sourceCommit: process.env.SOURCE_COMMIT }))
}
