import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync, statSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const ignoredDirs = new Set(['.git', '.idea', '.vscode', 'node_modules'])

async function collectMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue
    }

    const entryPath = path.join(dir, entry.name)

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

function stripAnchor(href) {
  const [withoutAnchor] = href.split('#')
  return withoutAnchor
}

function isExternalLink(href) {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:')
  )
}

function extractMarkdownLinks(markdown) {
  const links = []
  const linkPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

  for (const match of markdown.matchAll(linkPattern)) {
    const href = match[1]

    if (href !== undefined) {
      links.push(href)
    }
  }

  return links
}

describe('documentation repository invariants', () => {
  it('uses the conventional README.md entrypoint', () => {
    assert.equal(existsSync(path.join(rootDir, 'README.md')), true)
    assert.equal(
      existsSync(path.join(rootDir, 'READEME.md')),
      false,
      'misspelled READEME.md should not regress as the primary entrypoint',
    )
  })

  it('keeps local markdown links pointed at existing files or directories', async () => {
    const markdownFiles = await collectMarkdownFiles(rootDir)
    const brokenLinks = []

    for (const filePath of markdownFiles) {
      const markdown = await readFile(filePath, 'utf8')
      const fileDir = path.dirname(filePath)

      for (const href of extractMarkdownLinks(markdown)) {
        const localHref = stripAnchor(href)

        if (localHref === '' || isExternalLink(localHref)) {
          continue
        }

        const targetPath = path.resolve(fileDir, decodeURIComponent(localHref))

        if (!targetPath.startsWith(rootDir) || !existsSync(targetPath)) {
          brokenLinks.push(
            `${path.relative(rootDir, filePath)} -> ${href}`,
          )
          continue
        }

        assert.ok(
          statSync(targetPath).isFile() || statSync(targetPath).isDirectory(),
          `${href} should resolve to a file or directory`,
        )
      }
    }

    assert.deepEqual(brokenLinks, [])
  })
})
