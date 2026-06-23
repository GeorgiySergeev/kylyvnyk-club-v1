import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsDirectory = path.join(repoRoot, 'docs', 'skills')
const skillsIndexPath = path.join(skillsDirectory, 'SKILLS.md')
const skillRouterPath = path.join(repoRoot, 'rules', 'skills.md')

const numberedSkillFilePattern = /^skill-\d{2}-[a-z0-9-]+\.md$/

const sortValues = (values) => [...values].sort((left, right) => left.localeCompare(right))

const parseQuotedKeywords = (value) =>
  [...value.matchAll(/"([^"]+)"/g)].map((match) => {
    const keyword = match[1]
    assert.ok(keyword, `Expected quoted keyword in: ${value}`)
    return keyword
  })

const parseIndexedSkillFiles = () => {
  const content = readFileSync(skillsIndexPath, 'utf8')
  const skillFiles = []
  const indexRowPattern =
    /^\|\s*\d+\s*\|[^|]+\|[^|]+\|\s*\[[^\]]+\]\(\.\/(skill-\d{2}-[a-z0-9-]+\.md)\)\s*\|$/gm

  for (const match of content.matchAll(indexRowPattern)) {
    const skillFile = match[1]
    assert.ok(skillFile, `Expected skill file in index row: ${match[0]}`)
    skillFiles.push(skillFile)
  }

  return skillFiles
}

const parseRouterRows = () => {
  const content = readFileSync(skillRouterPath, 'utf8')
  const rows = []
  const routerRowPattern =
    /^\|\s*((?:"[^"]+"\s*,?\s*)+)\|\s*(docs\/skills\/skill-\d{2}-[a-z0-9-]+\.md)\s*\|$/gm

  for (const match of content.matchAll(routerRowPattern)) {
    const keywordCell = match[1]
    const skillPath = match[2]

    assert.ok(keywordCell, `Expected keyword cell in router row: ${match[0]}`)
    assert.ok(skillPath, `Expected skill file in router row: ${match[0]}`)

    rows.push({
      keywords: parseQuotedKeywords(keywordCell),
      skillFile: path.basename(skillPath),
      skillPath,
    })
  }

  return rows
}

const parseSkillFrontmatterTriggers = (skillPath) => {
  const content = readFileSync(skillPath, 'utf8')
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)

  assert.ok(frontmatterMatch, `${path.basename(skillPath)} must start with frontmatter`)

  const frontmatter = frontmatterMatch[1]
  assert.ok(frontmatter, `${path.basename(skillPath)} must include frontmatter content`)

  const triggerLine = frontmatter
    .split('\n')
    .find((line) => line.trimStart().startsWith('trigger:'))

  assert.ok(triggerLine, `${path.basename(skillPath)} must declare trigger frontmatter`)

  const triggers = parseQuotedKeywords(triggerLine)
  assert.notEqual(triggers.length, 0, `${path.basename(skillPath)} must include triggers`)

  return triggers
}

describe('skill router invariants', () => {
  it('keeps the skill index in sync with numbered skill playbooks', () => {
    const indexedSkillFiles = parseIndexedSkillFiles()
    const actualSkillFiles = readdirSync(skillsDirectory).filter((entry) =>
      numberedSkillFilePattern.test(entry)
    )

    assert.deepEqual(sortValues(indexedSkillFiles), sortValues(actualSkillFiles))
  })

  it('routes every indexed skill file exactly once', () => {
    const indexedSkillFiles = parseIndexedSkillFiles()
    const routerRows = parseRouterRows()
    const routedSkillFiles = routerRows.map((row) => row.skillFile)

    assert.deepEqual(sortValues(routedSkillFiles), sortValues(indexedSkillFiles))

    for (const row of routerRows) {
      assert.equal(
        existsSync(path.join(repoRoot, row.skillPath)),
        true,
        `${row.skillPath} must exist`
      )
    }
  })

  it('keeps router keywords identical to skill frontmatter triggers', () => {
    for (const row of parseRouterRows()) {
      const skillPath = path.join(repoRoot, row.skillPath)
      const frontmatterTriggers = parseSkillFrontmatterTriggers(skillPath)

      assert.deepEqual(
        sortValues(row.keywords),
        sortValues(frontmatterTriggers),
        `${row.skillFile} router keywords must match frontmatter triggers`
      )
    }
  })
})
