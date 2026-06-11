import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ignoredDirectories = new Set(['.git', '.idea', '.vscode', 'node_modules'])

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await collectMarkdownFiles(join(directory, entry.name))))
      }

      continue
    }

    if (entry.isFile() && extname(entry.name) === '.md') {
      files.push(join(directory, entry.name))
    }
  }

  return files
}

function stripFencedCodeBlocks(markdown) {
  return markdown.replaceAll(/```[\s\S]*?```/g, '')
}

function getMarkdownLinks(markdown) {
  const links = []
  const linkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g

  for (const match of stripFencedCodeBlocks(markdown).matchAll(linkPattern)) {
    const rawTarget = match[1]?.trim()

    if (rawTarget) {
      links.push(rawTarget)
    }
  }

  return links
}

function normalizeLocalTarget(rawTarget) {
  const withoutTitle = rawTarget.split(/\s+"[^"]*"|\s+'[^']*'/)[0]
  const withoutAnchor = withoutTitle.split('#')[0]

  return decodeURIComponent(withoutAnchor)
}

function isExternalOrAnchor(rawTarget) {
  return (
    rawTarget.startsWith('#') ||
    rawTarget.startsWith('http://') ||
    rawTarget.startsWith('https://') ||
    rawTarget.startsWith('mailto:')
  )
}

test('repository uses the standard README filename', () => {
  assert.equal(existsSync(join(repoRoot, 'README.md')), true)
  assert.equal(existsSync(join(repoRoot, 'READEME.md')), false)
})

test('local markdown links resolve to files or directories', async () => {
  const markdownFiles = await collectMarkdownFiles(repoRoot)
  const brokenLinks = []

  for (const markdownFile of markdownFiles) {
    const markdown = await readFile(markdownFile, 'utf8')

    for (const rawTarget of getMarkdownLinks(markdown)) {
      if (isExternalOrAnchor(rawTarget)) {
        continue
      }

      const localTarget = normalizeLocalTarget(rawTarget)

      if (localTarget.length === 0) {
        continue
      }

      const resolvedTarget = resolve(dirname(markdownFile), localTarget)

      if (!existsSync(resolvedTarget)) {
        brokenLinks.push(
          `${markdownFile.replace(`${repoRoot}/`, '')} -> ${rawTarget}`,
        )
      }
    }
  }

  assert.deepEqual(brokenLinks, [])
})

test('docs reference the tracked rules directory', async () => {
  const markdownFiles = await collectMarkdownFiles(repoRoot)
  const staleReferences = []

  for (const markdownFile of markdownFiles) {
    const markdown = await readFile(markdownFile, 'utf8')

    if (markdown.includes('.cursor/rules')) {
      staleReferences.push(markdownFile.replace(`${repoRoot}/`, ''))
    }
  }

  assert.deepEqual(staleReferences, [])
  assert.equal((await stat(join(repoRoot, 'rules'))).isDirectory(), true)
})
