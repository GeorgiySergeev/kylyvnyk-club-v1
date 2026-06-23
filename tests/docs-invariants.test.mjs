import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ignoredDirectoryNames = new Set([
  '.git',
  '.next',
  '.nuxt',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
])

const toPosixPath = (filePath) => path.relative(repoRoot, filePath).split(path.sep).join('/')

const collectMarkdownFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (!ignoredDirectoryNames.has(entry.name)) {
        files.push(...collectMarkdownFiles(entryPath))
      }

      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files
}

const parseMarkdownLinks = (content) => {
  const links = []
  const markdownLinkPattern = /(?<!!)\[[^\]\n]+\]\(([^)]+)\)/g

  for (const match of content.matchAll(markdownLinkPattern)) {
    const target = match[1]?.trim()

    if (target) {
      links.push(target)
    }
  }

  return links
}

const normalizeLocalLinkTarget = (target) => {
  const targetWithoutTitle = target.replace(/^<|>$/g, '').split(/\s+/)[0]

  if (!targetWithoutTitle || targetWithoutTitle.startsWith('#')) {
    return null
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(targetWithoutTitle)) {
    return null
  }

  const [targetWithoutHash] = targetWithoutTitle.split('#')
  return targetWithoutHash ? decodeURIComponent(targetWithoutHash) : null
}

describe('documentation invariants', () => {
  it('keeps the repository README at the standard root path', () => {
    assert.equal(existsSync(path.join(repoRoot, 'README.md')), true)
    assert.equal(existsSync(path.join(repoRoot, 'READEME.md')), false)
  })

  it('keeps local markdown links resolvable', () => {
    const brokenLinks = []

    for (const markdownFile of collectMarkdownFiles(repoRoot)) {
      const content = readFileSync(markdownFile, 'utf8')

      for (const linkTarget of parseMarkdownLinks(content)) {
        const localTarget = normalizeLocalLinkTarget(linkTarget)

        if (!localTarget) {
          continue
        }

        const resolvedTarget = path.resolve(path.dirname(markdownFile), localTarget)

        if (!existsSync(resolvedTarget)) {
          brokenLinks.push(`${toPosixPath(markdownFile)} -> ${linkTarget}`)
          continue
        }

        assert.doesNotThrow(
          () => statSync(resolvedTarget),
          `${toPosixPath(markdownFile)} links to an inaccessible path: ${linkTarget}`
        )
      }
    }

    assert.deepEqual(brokenLinks, [])
  })
})
