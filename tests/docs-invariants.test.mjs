import assert from 'node:assert/strict'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skippedDirs = new Set(['.git', '.idea', '.vscode', 'node_modules'])

async function pathExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (skippedDirs.has(entry.name)) {
      continue
    }

    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files
}

function extractLocalMarkdownLinks(content) {
  const links = []
  const markdownLinkPattern = /!?\[[^\]]*]\(([^)]+)\)/g

  for (const match of content.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1]?.trim()

    if (
      !rawTarget ||
      rawTarget.startsWith('#') ||
      /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)
    ) {
      continue
    }

    const [withoutAnchor] = rawTarget.split('#')
    const [withoutQuery] = withoutAnchor.split('?')

    if (withoutQuery) {
      links.push(decodeURIComponent(withoutQuery))
    }
  }

  return links
}

test('README uses the conventional file name', async () => {
  assert.equal(await pathExists(path.join(rootDir, 'README.md')), true)
  assert.equal(await pathExists(path.join(rootDir, 'READEME.md')), false)
})

test('local markdown links resolve to existing files or directories', async () => {
  const markdownFiles = await collectMarkdownFiles(rootDir)
  const brokenLinks = []

  for (const markdownFile of markdownFiles) {
    const content = await readFile(markdownFile, 'utf8')
    const relativeLinks = extractLocalMarkdownLinks(content)

    for (const relativeLink of relativeLinks) {
      const resolvedPath = path.resolve(path.dirname(markdownFile), relativeLink)
      const exists = await pathExists(resolvedPath)

      if (!exists) {
        brokenLinks.push(
          `${path.relative(rootDir, markdownFile)} -> ${relativeLink}`
        )
      }
    }
  }

  assert.deepEqual(brokenLinks, [])
})
