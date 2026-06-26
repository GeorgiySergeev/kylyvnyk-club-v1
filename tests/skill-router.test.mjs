import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsDir = path.join(rootDir, 'docs', 'skills')
const skillIndexPath = path.join(skillsDir, 'SKILLS.md')
const skillRouterPath = path.join(rootDir, 'rules', 'skills.md')

function toRepoPath(absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join('/')
}

function readText(absolutePath) {
  return readFileSync(absolutePath, 'utf8')
}

function parseAvailableSkillFiles() {
  const source = readText(skillIndexPath)
  const availableSkillsSection = source.split('## Reference material')[0] ?? source
  const skillFiles = []
  const skillLinkPattern = /\]\(\.\/(skill-\d{2}-[^)]+\.md)\)/gu

  for (const match of availableSkillsSection.matchAll(skillLinkPattern)) {
    const fileName = match[1]

    if (fileName) {
      skillFiles.push(`docs/skills/${fileName}`)
    }
  }

  return skillFiles
}

function parseRouterMappings() {
  const source = readText(skillRouterPath)
  const mappings = new Map()
  const tableRowPattern = /^\|\s*(?<keywords>.*?)\s*\|\s*(?<file>docs\/skills\/skill-\d{2}[^|\s]+\.md)\s*\|$/gmu
  const quotedKeywordPattern = /"([^"]+)"/gu

  for (const match of source.matchAll(tableRowPattern)) {
    const filePath = match.groups?.file
    const keywordsCell = match.groups?.keywords

    if (!filePath || !keywordsCell) {
      continue
    }

    const triggers = [...keywordsCell.matchAll(quotedKeywordPattern)]
      .map((keywordMatch) => keywordMatch[1])
      .filter(Boolean)

    mappings.set(filePath, triggers)
  }

  return mappings
}

function parseFrontmatterTriggers(skillFilePath) {
  const source = readText(path.join(rootDir, skillFilePath))
  const frontmatterMatch = /^---\n(?<frontmatter>[\s\S]*?)\n---/u.exec(source)
  const frontmatter = frontmatterMatch?.groups?.frontmatter

  assert.ok(frontmatter, `${skillFilePath} must have YAML frontmatter`)

  const triggerLine = frontmatter
    .split('\n')
    .find((line) => line.startsWith('trigger: '))

  assert.ok(triggerLine, `${skillFilePath} must define trigger metadata`)

  return [...triggerLine.matchAll(/"([^"]+)"/gu)]
    .map((triggerMatch) => triggerMatch[1])
    .filter(Boolean)
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right))
}

test('skill index and router include every numbered skill file exactly once', () => {
  const skillFilesOnDisk = readdirSync(skillsDir)
    .filter((fileName) => /^skill-\d{2}-.+\.md$/u.test(fileName))
    .map((fileName) => `docs/skills/${fileName}`)

  const indexedSkillFiles = parseAvailableSkillFiles()
  const routedSkillFiles = [...parseRouterMappings().keys()]

  assert.deepEqual(sorted(indexedSkillFiles), sorted(skillFilesOnDisk))
  assert.deepEqual(sorted(routedSkillFiles), sorted(skillFilesOnDisk))
  assert.equal(new Set(indexedSkillFiles).size, indexedSkillFiles.length)
  assert.equal(new Set(routedSkillFiles).size, routedSkillFiles.length)
})

test('skill router keywords match each skill frontmatter trigger list', () => {
  const routerMappings = parseRouterMappings()
  const failures = []

  for (const [skillFilePath, routerTriggers] of routerMappings) {
    const frontmatterTriggers = parseFrontmatterTriggers(skillFilePath)

    try {
      assert.deepEqual(sorted(frontmatterTriggers), sorted(routerTriggers))
    } catch {
      failures.push(
        `${skillFilePath}: router=${JSON.stringify(routerTriggers)} frontmatter=${JSON.stringify(
          frontmatterTriggers
        )}`
      )
    }
  }

  assert.deepEqual(failures, [])
})

test('skill index reference links stay routable from docs/skills', () => {
  const source = readText(skillIndexPath)
  const failures = []
  const localLinkPattern = /\[[^\]]+]\((?!https?:|mailto:|tel:)([^)]+)\)/gu

  for (const match of source.matchAll(localLinkPattern)) {
    const rawTarget = match[1]?.split('#')[0]

    if (!rawTarget) {
      continue
    }

    const resolvedPath = path.resolve(skillsDir, rawTarget)

    if (!existsSync(resolvedPath)) {
      failures.push(`${toRepoPath(skillIndexPath)} -> ${match[1]}`)
    }
  }

  assert.deepEqual(failures, [])
})
