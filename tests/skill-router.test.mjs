import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsDirectory = path.join(repoRoot, 'docs', 'skills')
const skillIndexPath = path.join(skillsDirectory, 'SKILLS.md')
const routerPath = path.join(repoRoot, 'rules', 'skills.md')

function toRepoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/')
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

async function collectSkillFiles() {
  const entries = await readdir(skillsDirectory, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && /^skill-\d{2}-.+\.md$/.test(entry.name))
    .map((entry) => `docs/skills/${entry.name}`)
    .sort()
}

async function parseIndexedSkillFiles() {
  const index = await readFile(skillIndexPath, 'utf8')
  const [availableSkillsSection = ''] = index.split('## Reference material')
  const targets = [...availableSkillsSection.matchAll(/\]\((\.\/skill-\d{2}-.+?\.md)\)/g)]
    .map((match) => toRepoPath(path.resolve(skillsDirectory, match[1])))
    .sort()

  return targets
}

async function parseRouterRows() {
  const router = await readFile(routerPath, 'utf8')
  const rows = []

  for (const line of router.split('\n')) {
    const targetMatch = line.match(/docs\/skills\/skill-\d{2}-.+?\.md/)

    if (targetMatch === null) {
      continue
    }

    rows.push({
      file: targetMatch[0],
      triggers: [...line.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    })
  }

  return rows.sort((left, right) => left.file.localeCompare(right.file))
}

function parseFrontmatterTriggers(markdown) {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]+?)\n---/)

  if (frontmatterMatch === null) {
    return []
  }

  const triggerLine = frontmatterMatch[1]
    .split('\n')
    .find((line) => line.trim().startsWith('trigger:'))

  if (triggerLine === undefined) {
    return []
  }

  return [...triggerLine.matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

test('skill index lists every numbered skill playbook exactly once', async () => {
  const actualSkillFiles = await collectSkillFiles()
  const indexedSkillFiles = await parseIndexedSkillFiles()

  assert.deepEqual(indexedSkillFiles, actualSkillFiles)
})

test('skill router maps the same numbered skill playbooks as the index', async () => {
  const indexedSkillFiles = await parseIndexedSkillFiles()
  const routerRows = await parseRouterRows()
  const routedSkillFiles = routerRows.map((row) => row.file)

  assert.deepEqual(routedSkillFiles, indexedSkillFiles)

  for (const row of routerRows) {
    assert.notEqual(row.triggers.length, 0, `${row.file} should have at least one trigger`)
    await stat(path.join(repoRoot, row.file))
  }
})

test('skill frontmatter triggers are routable by the skill router', async () => {
  const routerRows = await parseRouterRows()
  const routerByFile = new Map(routerRows.map((row) => [row.file, new Set(row.triggers)]))
  const failures = []

  for (const skillFile of await collectSkillFiles()) {
    const markdown = await readText(skillFile)
    const frontmatterTriggers = parseFrontmatterTriggers(markdown)
    const routerTriggers = routerByFile.get(skillFile)

    assert.notEqual(
      frontmatterTriggers.length,
      0,
      `${skillFile} should declare frontmatter triggers`
    )

    for (const trigger of frontmatterTriggers) {
      if (routerTriggers === undefined || !routerTriggers.has(trigger)) {
        failures.push(`${skillFile}: missing router trigger "${trigger}"`)
      }
    }
  }

  assert.deepEqual(failures, [])
})
