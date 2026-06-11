import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillsDirectory = join(repoRoot, 'docs', 'skills')
const routerPath = join(repoRoot, 'rules', 'skills.md')
const indexPath = join(skillsDirectory, 'SKILLS.md')

async function getNumberedSkillFiles() {
  const entries = await readdir(skillsDirectory, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && /^skill-\d{2}-.+\.md$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
}

function parseQuotedKeywords(value) {
  return [...value.matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

function parseRouterRows(markdown) {
  const rows = new Map()

  for (const line of markdown.split('\n')) {
    const skillMatch = line.match(/\|\s*(?<keywords>.+?)\s*\|\s*(?<file>docs\/skills\/skill-\d{2}-.+?\.md)\s*\|/)

    if (!skillMatch?.groups) {
      continue
    }

    rows.set(skillMatch.groups.file, {
      file: skillMatch.groups.file,
      keywords: parseQuotedKeywords(skillMatch.groups.keywords),
    })
  }

  return rows
}

function parseIndexSkillLinks(markdown) {
  return [...markdown.matchAll(/\]\(\.\/(skill-\d{2}-.+?\.md)\)/g)]
    .map((match) => match[1])
    .sort()
}

function parseFrontmatterTrigger(markdown) {
  const frontmatterMatch = markdown.match(/^---\n(?<frontmatter>[\s\S]+?)\n---/)
  const frontmatter = frontmatterMatch?.groups?.frontmatter
  const triggerLine = frontmatter
    ?.split('\n')
    .find((line) => line.startsWith('trigger:'))

  return triggerLine ? parseQuotedKeywords(triggerLine) : []
}

test('skill index lists every numbered skill file exactly once', async () => {
  const [skillFiles, indexMarkdown] = await Promise.all([
    getNumberedSkillFiles(),
    readFile(indexPath, 'utf8'),
  ])

  assert.deepEqual(parseIndexSkillLinks(indexMarkdown), skillFiles)
})

test('skill router maps every numbered skill file to an existing file', async () => {
  const [skillFiles, routerMarkdown] = await Promise.all([
    getNumberedSkillFiles(),
    readFile(routerPath, 'utf8'),
  ])
  const routerRows = parseRouterRows(routerMarkdown)
  const routedFiles = [...routerRows.keys()]
    .map((file) => file.replace('docs/skills/', ''))
    .sort()

  assert.deepEqual(routedFiles, skillFiles)

  for (const routerFile of routerRows.keys()) {
    assert.equal(existsSync(join(repoRoot, routerFile)), true, routerFile)
  }
})

test('skill frontmatter triggers stay in sync with router keywords', async () => {
  const routerMarkdown = await readFile(routerPath, 'utf8')
  const routerRows = parseRouterRows(routerMarkdown)
  const mismatches = []

  for (const row of routerRows.values()) {
    const skillMarkdown = await readFile(join(repoRoot, row.file), 'utf8')
    const frontmatterTriggers = parseFrontmatterTrigger(skillMarkdown)
    const sortedFrontmatterTriggers = [...frontmatterTriggers].sort()
    const sortedRouterKeywords = [...row.keywords].sort()

    if (
      JSON.stringify(sortedFrontmatterTriggers) !==
      JSON.stringify(sortedRouterKeywords)
    ) {
      mismatches.push({
        file: row.file,
        frontmatterTriggers: sortedFrontmatterTriggers,
        routerKeywords: sortedRouterKeywords,
      })
    }
  }

  assert.deepEqual(mismatches, [])
})
