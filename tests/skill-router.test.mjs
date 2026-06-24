import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsDir = path.join(rootDir, 'docs', 'skills')
const indexPath = path.join(skillsDir, 'SKILLS.md')
const routerPath = path.join(rootDir, 'rules', 'skills.md')

function normalizeSkillPath(skillPath) {
  return skillPath.replace(/^\.\//, '')
}

function parseQuotedList(value) {
  return [...value.matchAll(/"([^"]+)"/g)].map((match) => {
    assert.notEqual(match[1], undefined)
    return match[1]
  })
}

function parseIndexSkillLinks(markdown) {
  return [...markdown.matchAll(/\]\(\.\/(skill-\d{2}-[^)]+\.md)\)/g)]
    .map((match) => {
      assert.notEqual(match[1], undefined)
      return match[1]
    })
    .sort()
}

function parseRouterRows(markdown) {
  const rows = []
  const rowPattern =
    /^\| (?<keywords>.+?)\s+\| (?<skillPath>docs\/skills\/skill-\d{2}-[^ |]+\.md)\s+\|$/gmu

  for (const match of markdown.matchAll(rowPattern)) {
    const keywords = match.groups?.keywords
    const skillPath = match.groups?.skillPath

    assert.notEqual(keywords, undefined)
    assert.notEqual(skillPath, undefined)

    rows.push({
      keywords: parseQuotedList(keywords),
      skillPath: normalizeSkillPath(skillPath),
    })
  }

  return rows.sort((left, right) => left.skillPath.localeCompare(right.skillPath))
}

function parseFrontmatter(markdown) {
  const frontmatterMatch = markdown.match(/^---\n(?<body>[\s\S]+?)\n---/)
  assert.notEqual(frontmatterMatch?.groups?.body, undefined)

  const fields = new Map()

  for (const line of frontmatterMatch.groups.body.split('\n')) {
    const [key, ...valueParts] = line.split(':')

    if (key !== undefined && valueParts.length > 0) {
      fields.set(key.trim(), valueParts.join(':').trim())
    }
  }

  return fields
}

async function readSkillFrontmatter(fileName) {
  const markdown = await readFile(path.join(skillsDir, fileName), 'utf8')
  const fields = parseFrontmatter(markdown)

  return {
    title: fields.get('title'),
    description: fields.get('description'),
    triggers: parseQuotedList(fields.get('trigger') ?? ''),
  }
}

describe('skill router invariants', () => {
  it('lists every numbered skill file in the skill index exactly once', async () => {
    const entries = await readdir(skillsDir, { withFileTypes: true })
    const skillFiles = entries
      .filter((entry) => entry.isFile() && /^skill-\d{2}-.+\.md$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()

    const indexMarkdown = await readFile(indexPath, 'utf8')

    assert.deepEqual(parseIndexSkillLinks(indexMarkdown), skillFiles)
  })

  it('routes each indexed skill file to existing docs', async () => {
    const routerMarkdown = await readFile(routerPath, 'utf8')
    const indexMarkdown = await readFile(indexPath, 'utf8')
    const indexedSkillPaths = parseIndexSkillLinks(indexMarkdown).map((fileName) =>
      normalizeSkillPath(path.join('docs', 'skills', fileName)),
    )

    const routedSkillPaths = parseRouterRows(routerMarkdown).map(
      (row) => row.skillPath,
    )

    assert.deepEqual(routedSkillPaths, indexedSkillPaths)

    for (const skillPath of routedSkillPaths) {
      assert.equal(existsSync(path.join(rootDir, skillPath)), true)
    }
  })

  it('keeps router keywords and skill frontmatter triggers in sync', async () => {
    const routerMarkdown = await readFile(routerPath, 'utf8')
    const mismatches = []

    for (const row of parseRouterRows(routerMarkdown)) {
      const frontmatter = await readSkillFrontmatter(path.basename(row.skillPath))
      const routerKeywords = [...row.keywords].sort()
      const frontmatterTriggers = [...frontmatter.triggers].sort()

      if (routerKeywords.join('\n') !== frontmatterTriggers.join('\n')) {
        mismatches.push({
          skillPath: row.skillPath,
          routerKeywords,
          frontmatterTriggers,
        })
      }
    }

    assert.deepEqual(mismatches, [])
  })

  it('requires actionable frontmatter metadata for every numbered skill', async () => {
    const indexMarkdown = await readFile(indexPath, 'utf8')

    for (const fileName of parseIndexSkillLinks(indexMarkdown)) {
      const frontmatter = await readSkillFrontmatter(fileName)

      assert.match(frontmatter.title ?? '', /^Skill \d{2} — .+/)
      assert.match(frontmatter.description ?? '', /^Use when .+/)
      assert.ok(
        frontmatter.triggers.length >= 3,
        `${fileName} should expose at least three routing triggers`,
      )
    }
  })
})
