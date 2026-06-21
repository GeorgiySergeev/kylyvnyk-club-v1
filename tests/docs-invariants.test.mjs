import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function getTrackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

function stripFencedCodeBlocks(markdown) {
  let isInFence = false

  return markdown
    .split('\n')
    .filter((line) => {
      if (line.trimStart().startsWith('```')) {
        isInFence = !isInFence
        return false
      }

      return !isInFence
    })
    .join('\n')
}

function isExternalLink(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)
}

function normalizeMarkdownTarget(rawTarget) {
  const withoutTitle = rawTarget.trim().replace(/^<|>$/g, '').split(/\s+/)[0]
  const [withoutHash] = withoutTitle.split('#')
  const [withoutQuery] = withoutHash.split('?')

  return withoutQuery
}

function collectLocalMarkdownLinks(filePath) {
  const absolutePath = path.join(repoRoot, filePath)
  const markdown = stripFencedCodeBlocks(readFileSync(absolutePath, 'utf8'))
  const links = []
  const inlineLinkPattern = /!?\[[^\]\n]+\]\(([^)\n]+)\)/g

  for (const match of markdown.matchAll(inlineLinkPattern)) {
    const rawTarget = match[1]

    if (!rawTarget || isExternalLink(rawTarget.trim())) {
      continue
    }

    const normalizedTarget = normalizeMarkdownTarget(rawTarget)

    if (!normalizedTarget) {
      continue
    }

    links.push({
      filePath,
      rawTarget,
      resolvedPath: path.resolve(path.dirname(absolutePath), normalizedTarget),
    })
  }

  return links
}

test('repository uses the canonical README filename', () => {
  assert.equal(existsSync(path.join(repoRoot, 'README.md')), true)
  assert.equal(existsSync(path.join(repoRoot, 'READEME.md')), false)
})

test('tracked markdown files only link to existing local targets', () => {
  const missingLinks = getTrackedFiles()
    .filter((filePath) => filePath.endsWith('.md'))
    .flatMap(collectLocalMarkdownLinks)
    .filter(({ resolvedPath }) => !existsSync(resolvedPath))
    .map(({ filePath, rawTarget }) => `${filePath} -> ${rawTarget}`)

  assert.deepEqual(missingLinks, [])
})
