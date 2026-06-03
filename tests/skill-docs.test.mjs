import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const skillsDir = join(rootDir, 'docs/skills')
const indexPath = join(skillsDir, 'SKILLS.md')
const routerPath = join(rootDir, 'rules/skills.md')

async function readText(filePath) {
  return readFile(filePath, 'utf8')
}

async function getNumberedSkillFiles() {
  const entries = await readdir(skillsDir)

  return entries
    .filter((entry) => /^skill-\d{2}-.*\.md$/.test(entry))
    .sort((left, right) => left.localeCompare(right))
}

function parseIndexSkillFiles(indexText) {
  return [...indexText.matchAll(/\]\(\.\/(skill-\d{2}-[^)]+\.md)\)/g)]
    .map((match) => match[1])
    .sort((left, right) => left.localeCompare(right))
}

function parseRouterEntries(routerText) {
  const entries = new Map()

  for (const line of routerText.split('\n')) {
    const fileMatch = line.match(/docs\/skills\/(skill-\d{2}-[^|\s]+\.md)/)

    if (!fileMatch) {
      continue
    }

    const triggers = [...line.matchAll(/"([^"]+)"/g)].map((match) => match[1])
    entries.set(fileMatch[1], triggers)
  }

  return entries
}

function parseFrontmatterTriggers(skillText) {
  const triggerLine = skillText.match(/^trigger:\s*(.+)$/m)

  assert.ok(triggerLine, 'skill frontmatter must include a trigger line')

  return [...triggerLine[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

test('skills index lists every numbered skill file exactly once', async () => {
  const skillFiles = await getNumberedSkillFiles()
  const indexText = await readText(indexPath)

  assert.deepEqual(parseIndexSkillFiles(indexText), skillFiles)
})

test('skill router maps every indexed numbered skill exactly once', async () => {
  const indexText = await readText(indexPath)
  const routerText = await readText(routerPath)
  const indexedSkillFiles = parseIndexSkillFiles(indexText)
  const routedSkillFiles = [...parseRouterEntries(routerText).keys()].sort((left, right) =>
    left.localeCompare(right),
  )

  assert.deepEqual(routedSkillFiles, indexedSkillFiles)
})

test('skill router triggers stay in sync with skill frontmatter', async () => {
  const routerText = await readText(routerPath)
  const routerEntries = parseRouterEntries(routerText)

  for (const [skillFile, routerTriggers] of routerEntries) {
    const skillPath = join(skillsDir, skillFile)
    const skillText = await readText(skillPath)
    const frontmatterTriggers = parseFrontmatterTriggers(skillText)
    const sortedRouterTriggers = [...routerTriggers].sort((left, right) => left.localeCompare(right))
    const sortedFrontmatterTriggers = [...frontmatterTriggers].sort((left, right) =>
      left.localeCompare(right),
    )

    assert.deepEqual(
      sortedRouterTriggers,
      sortedFrontmatterTriggers,
      `${relative(rootDir, routerPath)} and ${relative(rootDir, skillPath)} must expose the same triggers`,
    )
  }
})
