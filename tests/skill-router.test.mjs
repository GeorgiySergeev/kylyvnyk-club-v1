import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function pathExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function parseTableRows(markdown) {
  return markdown
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
    )
    .filter((cells) => !cells.every((cell) => /^-+$/.test(cell)))
}

function parseRouterRows(markdown) {
  return parseTableRows(markdown)
    .map(([keywordsCell, skillFileCell]) => {
      if (!keywordsCell || !skillFileCell?.startsWith('docs/skills/skill-')) {
        return null
      }

      return {
        keywords: [...keywordsCell.matchAll(/"([^"]+)"/g)].map(
          (match) => match[1]
        ),
        skillFile: skillFileCell,
      }
    })
    .filter(Boolean)
}

function parseIndexSkillFiles(markdown) {
  return parseTableRows(markdown)
    .map((cells) => cells.at(3)?.match(/\]\(\.\/(skill-[^)]+\.md)\)/)?.[1])
    .filter(Boolean)
    .map((fileName) => `docs/skills/${fileName}`)
}

function parseFrontmatterTriggers(markdown) {
  const frontmatter = markdown.match(/^---\n(?<frontmatter>[\s\S]*?)\n---/)?.groups
    ?.frontmatter

  if (!frontmatter) {
    return []
  }

  return [...frontmatter.matchAll(/trigger:\s*(.+)/g)]
    .flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)])
    .map((match) => match[1])
}

test('skill router maps exactly the skills listed in the skill index', async () => {
  const routerMarkdown = await readFile(path.join(rootDir, 'rules/skills.md'), 'utf8')
  const indexMarkdown = await readFile(
    path.join(rootDir, 'docs/skills/SKILLS.md'),
    'utf8'
  )

  const routerFiles = parseRouterRows(routerMarkdown).map((row) => row.skillFile)
  const indexFiles = parseIndexSkillFiles(indexMarkdown)

  assert.deepEqual([...new Set(routerFiles)].sort(), [...new Set(indexFiles)].sort())
})

test('skill router rows point to existing files and match frontmatter triggers', async () => {
  const routerMarkdown = await readFile(path.join(rootDir, 'rules/skills.md'), 'utf8')
  const rows = parseRouterRows(routerMarkdown)
  const mismatches = []

  for (const row of rows) {
    const skillPath = path.join(rootDir, row.skillFile)

    if (!(await pathExists(skillPath))) {
      mismatches.push(`${row.skillFile} is missing`)
      continue
    }

    const skillMarkdown = await readFile(skillPath, 'utf8')
    const triggers = parseFrontmatterTriggers(skillMarkdown)
    const missingTriggers = row.keywords.filter((keyword) => !triggers.includes(keyword))

    if (missingTriggers.length > 0) {
      mismatches.push(`${row.skillFile} missing triggers: ${missingTriggers.join(', ')}`)
    }
  }

  assert.deepEqual(mismatches, [])
})
