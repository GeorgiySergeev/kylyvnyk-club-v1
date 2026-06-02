import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function extractQuotedPhrases(value) {
  return [...value.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((phrase) => phrase !== undefined)
}

function extractIndexedSkillFiles() {
  const markdown = readRepoFile('docs/skills/SKILLS.md')
  const rows = [
    ...markdown.matchAll(
      /^\|\s*(?<number>\d{2})\s*\|.*?\|\s*\[[^\]]+\]\(\.\/(?<file>skill-\d{2}-[a-z0-9-]+\.md)\)\s*\|$/gm,
    ),
  ]

  return rows
    .map((row) => {
      const number = row.groups?.number
      const file = row.groups?.file

      assert.ok(number, 'Skill index row is missing its number')
      assert.ok(file, `Skill index row ${number} is missing its file link`)
      assert.ok(
        file.startsWith(`skill-${number}-`),
        `Skill index row ${number} links to mismatched file: ${file}`,
      )

      return `docs/skills/${file}`
    })
    .sort()
}

function extractRoutedSkillFiles() {
  const markdown = readRepoFile('rules/skills.md')
  const rows = [
    ...markdown.matchAll(
      /^\|\s*(?<keywords>.*?)\s*\|\s*(?<skillFile>docs\/skills\/skill-\d{2}-[a-z0-9-]+\.md)\s*\|$/gm,
    ),
  ]

  return rows
    .map((row) => {
      const skillFile = row.groups?.skillFile

      assert.ok(skillFile, 'Skill router row is missing its file path')

      return skillFile
    })
    .sort()
}

function extractRouterTriggersBySkillFile() {
  const markdown = readRepoFile('rules/skills.md')
  const rows = [
    ...markdown.matchAll(
      /^\|\s*(?<keywords>.*?)\s*\|\s*(?<skillFile>docs\/skills\/skill-\d{2}-[a-z0-9-]+\.md)\s*\|$/gm,
    ),
  ]

  return new Map(
    rows.map((row) => [
      row.groups?.skillFile,
      extractQuotedPhrases(row.groups?.keywords ?? ''),
    ]),
  )
}

function extractFrontmatterTriggers(skillFile) {
  const markdown = readRepoFile(skillFile)
  const frontmatter = markdown.match(/^---\n(?<content>[\s\S]*?)\n---/)
  const content = frontmatter?.groups?.content

  assert.ok(content, `${skillFile} is missing frontmatter`)

  const triggerLine = content.match(/^trigger:\s*(?<triggers>.+)$/m)
  const triggers = triggerLine?.groups?.triggers

  assert.ok(triggers, `${skillFile} is missing a trigger field`)

  return extractQuotedPhrases(triggers)
}

test('skill router and skill index list the same playbooks', () => {
  const indexedSkillFiles = extractIndexedSkillFiles()
  const routedSkillFiles = extractRoutedSkillFiles()

  assert.deepEqual(routedSkillFiles, indexedSkillFiles)

  for (const skillFile of indexedSkillFiles) {
    assert.ok(
      existsSync(path.join(repoRoot, skillFile)),
      `Indexed skill file is missing: ${skillFile}`,
    )
  }
})

test('skill frontmatter triggers are routable', () => {
  const routerTriggersBySkillFile = extractRouterTriggersBySkillFile()

  for (const skillFile of extractIndexedSkillFiles()) {
    const frontmatterTriggers = extractFrontmatterTriggers(skillFile)
    const routerTriggers = routerTriggersBySkillFile.get(skillFile)

    assert.ok(routerTriggers, `${skillFile} is missing from the skill router`)

    for (const trigger of frontmatterTriggers) {
      assert.ok(
        routerTriggers.includes(trigger),
        `${skillFile} trigger is missing from the skill router: ${trigger}`,
      )
    }
  }
})
