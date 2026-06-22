import assert from 'node:assert/strict'
import { access, readdir, readFile, stat } from 'node:fs/promises'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ignoredDirectories = new Set(['.git', '.idea', '.vscode', 'node_modules'])

async function exists(targetPath) {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function collectMarkdownFiles(directory = repoRoot) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await collectMarkdownFiles(absolutePath)))
      }

      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(absolutePath)
    }
  }

  return files.sort()
}

function stripFencedCodeBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, (block) => '\n'.repeat(block.split('\n').length - 1))
}

function getLocalMarkdownLinks(markdown) {
  const links = []
  const content = stripFencedCodeBlocks(markdown)
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g
  let match = linkPattern.exec(content)

  while (match !== null) {
    const rawTarget = match[1].trim()

    if (
      rawTarget.length > 0 &&
      !rawTarget.startsWith('#') &&
      !/^[a-z][a-z0-9+.-]*:/i.test(rawTarget)
    ) {
      const line = content.slice(0, match.index).split('\n').length
      links.push({ line, rawTarget })
    }

    match = linkPattern.exec(content)
  }

  return links
}

function resolveMarkdownLink(sourceFile, rawTarget) {
  const [targetWithoutHash = ''] = rawTarget.split('#')
  const decodedTarget = decodeURIComponent(targetWithoutHash)

  return path.resolve(path.dirname(sourceFile), decodedTarget)
}

test('repository exposes the canonical README filename', async () => {
  assert.equal(await exists(path.join(repoRoot, 'README.md')), true)
  assert.equal(await exists(path.join(repoRoot, 'READEME.md')), false)
})

test('local markdown links resolve on a case-sensitive filesystem', async () => {
  const markdownFiles = await collectMarkdownFiles()
  const failures = []

  for (const file of markdownFiles) {
    const markdown = await readFile(file, 'utf8')
    const links = getLocalMarkdownLinks(markdown)

    for (const link of links) {
      const resolvedTarget = resolveMarkdownLink(file, link.rawTarget)

      try {
        await stat(resolvedTarget)
      } catch {
        const source = path.relative(repoRoot, file)
        const target = path.relative(repoRoot, resolvedTarget)
        failures.push(`${source}:${link.line} -> ${link.rawTarget} (${target})`)
      }
    }
  }

  assert.deepEqual(failures, [])
})
