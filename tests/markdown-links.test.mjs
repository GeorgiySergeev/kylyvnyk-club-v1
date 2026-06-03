import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const ignoredDirectories = new Set(['.git', 'node_modules'])

async function readText(filePath) {
  return readFile(filePath, 'utf8')
}

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue
      }

      files.push(...(await collectMarkdownFiles(join(directory, entry.name))))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(join(directory, entry.name))
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function stripCodeFences(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '')
}

function normalizeLocalLink(rawLink) {
  const linkTarget = rawLink.trim().replace(/^<|>$/g, '').split(/\s+/)[0]

  if (
    linkTarget.startsWith('#') ||
    /^[a-z][a-z0-9+.-]*:/i.test(linkTarget)
  ) {
    return null
  }

  return linkTarget.split('#')[0]
}

test('repository markdown entrypoint is named README.md', () => {
  assert.equal(existsSync(join(rootDir, 'README.md')), true)
  assert.equal(existsSync(join(rootDir, 'READEME.md')), false)
})

test('local markdown links resolve to existing files or directories', async () => {
  const markdownFiles = await collectMarkdownFiles(rootDir)
  const brokenLinks = []

  for (const markdownFile of markdownFiles) {
    const markdown = stripCodeFences(await readText(markdownFile))

    for (const match of markdown.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)) {
      const localLink = normalizeLocalLink(match[1])

      if (!localLink) {
        continue
      }

      const targetPath = resolve(dirname(markdownFile), localLink)

      try {
        await stat(targetPath)
      } catch {
        brokenLinks.push(
          `${relative(rootDir, markdownFile)} -> ${localLink} (${relative(rootDir, targetPath)})`,
        )
      }
    }
  }

  assert.deepEqual(brokenLinks, [])
})
