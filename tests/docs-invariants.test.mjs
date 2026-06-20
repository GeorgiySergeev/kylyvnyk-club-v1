import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ignoredDirectories = new Set([
  '.git',
  '.idea',
  '.vscode',
  'build',
  'coverage',
  'dist',
  'node_modules',
])

function listMarkdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) {
      return []
    }

    const absolutePath = join(directory, entry.name)

    if (entry.isDirectory()) {
      return listMarkdownFiles(absolutePath)
    }

    if (entry.isFile() && extname(entry.name) === '.md') {
      return [absolutePath]
    }

    return []
  })
}

function stripMarkdownAnchor(linkTarget) {
  const [targetWithoutAnchor = ''] = linkTarget.split('#')
  return targetWithoutAnchor
}

function isExternalOrAnchorOnlyLink(linkTarget) {
  return (
    linkTarget.startsWith('#') ||
    /^[a-z][a-z0-9+.-]*:/i.test(linkTarget)
  )
}

function extractMarkdownLinks(markdown) {
  const links = []
  const linkPattern = /(?<!!)\[[^\]]+\]\((?<target>[^)\s]+)(?:\s+"[^"]*")?\)/g

  for (const match of markdown.matchAll(linkPattern)) {
    const target = match.groups?.target

    if (target) {
      links.push(target)
    }
  }

  return links
}

describe('documentation entrypoints', () => {
  it('uses the canonical README.md filename', () => {
    assert.equal(existsSync(join(repoRoot, 'README.md')), true)
    assert.equal(existsSync(join(repoRoot, 'READEME.md')), false)
  })
})

describe('markdown links', () => {
  it('keeps every local file or directory link resolvable', () => {
    const brokenLinks = []

    for (const markdownFile of listMarkdownFiles(repoRoot)) {
      const markdown = readFileSync(markdownFile, 'utf8')
      const links = extractMarkdownLinks(markdown)

      for (const link of links) {
        if (isExternalOrAnchorOnlyLink(link)) {
          continue
        }

        const targetWithoutAnchor = stripMarkdownAnchor(link)

        if (targetWithoutAnchor === '') {
          continue
        }

        const resolvedTarget = resolve(dirname(markdownFile), targetWithoutAnchor)

        if (!existsSync(resolvedTarget)) {
          brokenLinks.push(
            `${relativeToRepo(markdownFile)} -> ${link} (${relativeToRepo(resolvedTarget)})`,
          )
        }
      }
    }

    assert.deepEqual(brokenLinks, [])
  })
})

function relativeToRepo(filePath) {
  return filePath.replace(`${repoRoot}/`, '')
}
