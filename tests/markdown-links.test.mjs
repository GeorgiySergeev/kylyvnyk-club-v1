import assert from 'node:assert/strict'
import { readdir, stat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '..')
const ignoredDirectories = new Set(['.git', '.idea', '.vscode', 'node_modules'])
const localLinkPattern = /!?\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue
      }

      files.push(...(await collectMarkdownFiles(path.join(directory, entry.name))))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.join(directory, entry.name))
    }
  }

  return files
}

function isLocalPathLink(href) {
  return (
    !href.startsWith('#') &&
    !href.startsWith('http://') &&
    !href.startsWith('https://') &&
    !href.startsWith('mailto:')
  )
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath)
    return true
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

test('markdown files only link to existing local files', async () => {
  const markdownFiles = await collectMarkdownFiles(repoRoot)
  const failures = []

  for (const filePath of markdownFiles) {
    const markdown = await readFile(filePath, 'utf8')
    const fileDirectory = path.dirname(filePath)
    const relativeFilePath = path.relative(repoRoot, filePath)

    for (const match of markdown.matchAll(localLinkPattern)) {
      const href = match[1]

      if (!href || !isLocalPathLink(href)) {
        continue
      }

      const [rawTargetPath] = href.split('#')

      if (!rawTargetPath) {
        continue
      }

      const targetPath = path.resolve(fileDirectory, decodeURIComponent(rawTargetPath))

      if (!(await pathExists(targetPath))) {
        failures.push(`${relativeFilePath} -> ${href}`)
      }
    }
  }

  assert.deepEqual(failures, [])
})
