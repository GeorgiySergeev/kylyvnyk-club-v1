import { readdir, readFile, stat } from 'node:fs/promises'
import { join, normalize, relative, resolve, sep } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const repoRoot = resolve(import.meta.dirname, '..')

const markdownLinkPattern =
  /(?<!!)\[[^\]\n]+\]\((?<target>[^)\s#][^)\s]*)(?:#[^)]+)?\)/g

const isExternalLink = (target) =>
  /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')

const fileExists = async (path) => {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

const walkMarkdownFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') {
      continue
    }

    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(entryPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files
}

const formatPath = (path) => relative(repoRoot, path).split(sep).join('/')

test('root README uses the canonical GitHub filename', async () => {
  assert.equal(
    await fileExists(join(repoRoot, 'README.md')),
    true,
    'README.md must exist so repository overview renders on GitHub',
  )
  assert.equal(
    await fileExists(join(repoRoot, 'READEME.md')),
    false,
    'READEME.md is a typo and should not be reintroduced',
  )
})

test('local markdown links resolve to existing repository paths', async () => {
  const markdownFiles = await walkMarkdownFiles(repoRoot)
  const brokenLinks = []

  for (const file of markdownFiles) {
    const content = await readFile(file, 'utf8')
    const matches = content.matchAll(markdownLinkPattern)

    for (const match of matches) {
      const target = match.groups?.target

      if (!target || isExternalLink(target)) {
        continue
      }

      const decodedTarget = decodeURIComponent(target)
      const resolvedTarget = normalize(resolve(join(file, '..'), decodedTarget))

      if (!resolvedTarget.startsWith(`${repoRoot}${sep}`)) {
        brokenLinks.push(`${formatPath(file)} -> ${target} escapes repository`)
        continue
      }

      if (!(await fileExists(resolvedTarget))) {
        brokenLinks.push(`${formatPath(file)} -> ${target}`)
      }
    }
  }

  assert.deepEqual(brokenLinks, [])
})
