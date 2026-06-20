import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillsDirectory = join(repoRoot, 'docs', 'skills')
const skillIndexPath = join(skillsDirectory, 'SKILLS.md')
const skillRouterPath = join(repoRoot, 'rules', 'skills.md')

function readText(filePath) {
  return readFileSync(filePath, 'utf8')
}

function numberedSkillFiles() {
  return readdirSync(skillsDirectory)
    .filter((fileName) => /^skill-\d{2}-[\w-]+\.md$/.test(fileName))
    .map((fileName) => `docs/skills/${fileName}`)
    .sort()
}

function extractIndexSkillLinks() {
  const index = readText(skillIndexPath)
  const links = []
  const linkPattern = /\]\(\.\/(?<file>skill-\d{2}-[\w-]+\.md)\)/g

  for (const match of index.matchAll(linkPattern)) {
    const file = match.groups?.file

    if (file) {
      links.push(`docs/skills/${file}`)
    }
  }

  return links.sort()
}

function extractRouterRows() {
  const router = readText(skillRouterPath)
  const rows = new Map()
  const rowPattern =
    /^\|\s*(?<keywords>(?:"[^"]+"\s*,?\s*)+)\|\s*(?<file>docs\/skills\/skill-\d{2}-[\w-]+\.md)\s*\|$/gm

  for (const match of router.matchAll(rowPattern)) {
    const file = match.groups?.file
    const keywords = match.groups?.keywords

    if (file && keywords) {
      rows.set(file, extractQuotedValues(keywords).sort())
    }
  }

  return rows
}

function extractFrontmatter(filePath) {
  const markdown = readText(join(repoRoot, filePath))
  const match = /^---\n(?<frontmatter>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(
    markdown,
  )

  assert.notEqual(match, null, `${filePath} must start with frontmatter`)

  const frontmatter = match?.groups?.frontmatter ?? ''
  const body = match?.groups?.body ?? ''
  const title = /^title:\s*(?<title>.+)$/m.exec(frontmatter)?.groups?.title
  const triggerLine = /^trigger:\s*(?<triggers>.+)$/m.exec(frontmatter)?.groups
    ?.triggers

  assert.ok(title, `${filePath} frontmatter must include title`)
  assert.ok(triggerLine, `${filePath} frontmatter must include trigger`)

  return {
    title,
    triggers: extractQuotedValues(triggerLine).sort(),
    body,
  }
}

function extractQuotedValues(value) {
  return [...value.matchAll(/"(?<quoted>[^"]+)"/g)]
    .map((match) => match.groups?.quoted)
    .filter((match) => match !== undefined)
}

function sortedMapEntries(map) {
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right))
}

describe('skill docs index', () => {
  it('lists every numbered skill exactly once', () => {
    assert.deepEqual(extractIndexSkillLinks(), numberedSkillFiles())
  })

  it('links only to existing skill files', () => {
    const missingFiles = extractIndexSkillLinks().filter(
      (filePath) => !existsSync(join(repoRoot, filePath)),
    )

    assert.deepEqual(missingFiles, [])
  })
})

describe('skill router', () => {
  it('routes every numbered skill exactly once', () => {
    const routerFiles = [...extractRouterRows().keys()].sort()

    assert.deepEqual(routerFiles, numberedSkillFiles())
  })

  it('keeps router trigger keywords synchronized with skill frontmatter', () => {
    const triggerDrift = sortedMapEntries(extractRouterRows()).flatMap(
      ([filePath, routerTriggers]) => {
        const frontmatterTriggers = extractFrontmatter(filePath).triggers

        if (JSON.stringify(routerTriggers) === JSON.stringify(frontmatterTriggers)) {
          return []
        }

        return [
          {
            file: filePath,
            frontmatter: frontmatterTriggers,
            router: routerTriggers,
          },
        ]
      },
    )

    assert.deepEqual(triggerDrift, [])
  })
})

describe('individual skill documents', () => {
  it('keeps frontmatter titles aligned with visible headings', () => {
    const headingDrift = numberedSkillFiles().flatMap((filePath) => {
      const { body, title } = extractFrontmatter(filePath)
      const expectedHeading = `# ${title}`

      return body.includes(expectedHeading)
        ? []
        : [`${filePath} expected heading "${expectedHeading}"`]
    })

    assert.deepEqual(headingDrift, [])
  })

  it('documents acceptance criteria for every numbered skill', () => {
    const missingAcceptanceCriteria = numberedSkillFiles().flatMap((filePath) => {
      const { body } = extractFrontmatter(filePath)

      if (/^## Acceptance Criteria\n\n- \[ \] /m.test(body)) {
        return []
      }

      return [basename(filePath)]
    })

    assert.deepEqual(missingAcceptanceCriteria, [])
  })
})
