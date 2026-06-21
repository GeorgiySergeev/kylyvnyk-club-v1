import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const skillIndexPath = 'docs/skills/SKILLS.md'
const skillRouterPath = 'rules/skills.md'

function readWorkspaceFile(filePath) {
  return readFileSync(path.join(repoRoot, filePath), 'utf8')
}

function extractQuotedValues(value) {
  return [...value.matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

function parseFrontmatter(filePath) {
  const markdown = readWorkspaceFile(filePath)
  const frontmatterMatch = markdown.match(/^---\n(?<body>[\s\S]*?)\n---/)

  assert.ok(frontmatterMatch?.groups?.body, `${filePath} is missing frontmatter`)

  return Object.fromEntries(
    frontmatterMatch.groups.body.split('\n').map((line) => {
      const separatorIndex = line.indexOf(':')

      assert.notEqual(separatorIndex, -1, `${filePath} has malformed frontmatter line: ${line}`)

      return [
        line.slice(0, separatorIndex).trim(),
        line.slice(separatorIndex + 1).trim(),
      ]
    })
  )
}

function parseSkillIndex() {
  const markdown = readWorkspaceFile(skillIndexPath)
  const skillRows = new Map()
  const skillRowPattern =
    /^\|\s*(?<number>\d{2})\s*\|.+?\|\s*\[(?<label>[^\]]+)\]\(\.\/(?<fileName>skill-\d{2}-[^)]+\.md)\)\s*\|$/gm

  for (const match of markdown.matchAll(skillRowPattern)) {
    const groups = match.groups

    assert.ok(groups, 'skill index row did not expose capture groups')
    skillRows.set(groups.number, {
      label: groups.label,
      filePath: `docs/skills/${groups.fileName}`,
    })
  }

  return skillRows
}

function parseSkillRouter() {
  const markdown = readWorkspaceFile(skillRouterPath)
  const routerRows = new Map()
  const routerRowPattern =
    /^\|\s*(?<keywords>(?:"[^"]+"\s*,?\s*)+)\|\s*(?<filePath>docs\/skills\/skill-\d{2}-[^|\s]+\.md)\s*\|$/gm

  for (const match of markdown.matchAll(routerRowPattern)) {
    const groups = match.groups

    assert.ok(groups, 'skill router row did not expose capture groups')
    routerRows.set(groups.filePath, extractQuotedValues(groups.keywords).sort())
  }

  return routerRows
}

test('skill index lists every numbered skill document exactly once', () => {
  const skillRows = parseSkillIndex()

  assert.equal(skillRows.size, 10)

  for (const [number, skill] of skillRows) {
    assert.equal(
      existsSync(path.join(repoRoot, skill.filePath)),
      true,
      `Skill ${number} is listed but ${skill.filePath} does not exist`
    )
  }
})

test('skill router covers the same numbered skill documents as the index', () => {
  const indexedSkillFiles = [...parseSkillIndex().values()].map((skill) => skill.filePath).sort()
  const routedSkillFiles = [...parseSkillRouter().keys()].sort()

  assert.deepEqual(routedSkillFiles, indexedSkillFiles)
})

test('skill frontmatter triggers stay in sync with router keywords', () => {
  const skillRows = parseSkillIndex()
  const routerRows = parseSkillRouter()

  for (const skill of skillRows.values()) {
    const frontmatter = parseFrontmatter(skill.filePath)
    const frontmatterTriggers = extractQuotedValues(frontmatter.trigger ?? '').sort()

    assert.notEqual(frontmatter.title, '', `${skill.filePath} is missing a title`)
    assert.notEqual(frontmatter.description, '', `${skill.filePath} is missing a description`)
    assert.notDeepEqual(frontmatterTriggers, [], `${skill.filePath} is missing triggers`)
    assert.deepEqual(
      routerRows.get(skill.filePath),
      frontmatterTriggers,
      `${skill.filePath} triggers do not match ${skillRouterPath}`
    )
  }
})

test('numbered skill docs include core execution sections', () => {
  const requiredHeadings = ['## When to Use', '## Acceptance Criteria']

  for (const skill of parseSkillIndex().values()) {
    const markdown = readWorkspaceFile(skill.filePath)
    const missingHeadings = requiredHeadings.filter((heading) => !markdown.includes(heading))

    assert.deepEqual(missingHeadings, [], `${skill.filePath} is missing required headings`)
  }
})
