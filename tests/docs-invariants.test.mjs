import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ignoredDirectories = new Set(['.git', 'node_modules', 'coverage', 'dist', 'build', 'out'])

function collectMarkdownFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue
    }

    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(absolutePath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(absolutePath)
    }
  }

  return files
}

function toRepoPath(absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join('/')
}

function stripAnchor(linkTarget) {
  return linkTarget.split('#')[0] ?? ''
}

function isExternalLink(linkTarget) {
  return /^(?:https?:|mailto:|tel:)/u.test(linkTarget)
}

test('repository uses the conventional README.md filename', () => {
  assert.equal(existsSync(path.join(rootDir, 'README.md')), true)
  assert.equal(existsSync(path.join(rootDir, 'READEME.md')), false)
})

test('local markdown links resolve case-sensitively', () => {
  const failures = []
  const markdownLinkPattern = /!?\[[^\]]*]\(([^)]+)\)/gu

  for (const markdownFile of collectMarkdownFiles(rootDir)) {
    const source = readFileSync(markdownFile, 'utf8')

    for (const match of source.matchAll(markdownLinkPattern)) {
      const rawTarget = match[1]?.trim()

      if (!rawTarget || isExternalLink(rawTarget)) {
        continue
      }

      const targetWithoutAnchor = stripAnchor(rawTarget)

      if (!targetWithoutAnchor) {
        continue
      }

      const resolvedPath = path.resolve(path.dirname(markdownFile), targetWithoutAnchor)

      if (!existsSync(resolvedPath)) {
        failures.push(`${toRepoPath(markdownFile)} -> ${rawTarget}`)
      }
    }
  }

  assert.deepEqual(failures, [])
})
