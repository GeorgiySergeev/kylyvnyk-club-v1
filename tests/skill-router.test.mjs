import { readdir, readFile } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const repoRoot = resolve(import.meta.dirname, '..')
const skillsDirectory = join(repoRoot, 'docs', 'skills')
const skillsIndexPath = join(skillsDirectory, 'SKILLS.md')
const routerPath = join(repoRoot, 'rules', 'skills.md')

const formatPath = (path) => relative(repoRoot, path).split(sep).join('/')

const parseSkillFrontmatter = async (path) => {
  const content = await readFile(path, 'utf8')
  const frontmatterMatch = content.match(/^---\n(?<frontmatter>[\s\S]*?)\n---/)

  assert.ok(frontmatterMatch?.groups, `${formatPath(path)} must include frontmatter`)

  const frontmatter = frontmatterMatch.groups.frontmatter
  const title = frontmatter.match(/^title:\s*(?<title>.+)$/m)?.groups?.title
  const triggerLine = frontmatter.match(/^trigger:\s*(?<trigger>.+)$/m)?.groups
    ?.trigger

  assert.ok(title, `${formatPath(path)} must include a title`)
  assert.ok(triggerLine, `${formatPath(path)} must include trigger keywords`)

  const triggers = [...triggerLine.matchAll(/"(?<trigger>[^"]+)"/g)].map(
    (match) => match.groups?.trigger,
  )

  assert.ok(triggers.length > 0, `${formatPath(path)} must include triggers`)

  return {
    file: `docs/skills/${basename(path)}`,
    title,
    triggers,
  }
}

const listSkillFiles = async () => {
  const entries = await readdir(skillsDirectory)

  return entries
    .filter((entry) => /^skill-\d{2}-.*\.md$/.test(entry))
    .sort()
    .map((entry) => join(skillsDirectory, entry))
}

const parseIndexSkillFiles = async () => {
  const content = await readFile(skillsIndexPath, 'utf8')

  return [...content.matchAll(/\]\(\.\/(?<file>skill-\d{2}-[^)]+\.md)\)/g)]
    .map((match) => `docs/skills/${match.groups?.file}`)
    .sort()
}

const parseRouterRows = async () => {
  const content = await readFile(routerPath, 'utf8')

  return [...content.matchAll(/^\| (?<keywords>.+?) \| (?<file>docs\/skills\/skill-\d{2}-[^ ]+\.md)\s+\|$/gm)]
    .map((match) => {
      const keywords = [...match.groups.keywords.matchAll(/"(?<keyword>[^"]+)"/g)]
        .map((keywordMatch) => keywordMatch.groups?.keyword)
        .sort()

      return {
        file: match.groups.file,
        keywords,
      }
    })
    .sort((left, right) => left.file.localeCompare(right.file))
}

test('skills index lists every numbered skill file exactly once', async () => {
  const actualSkillFiles = (await listSkillFiles()).map((path) =>
    `docs/skills/${basename(path)}`,
  )
  const indexedSkillFiles = await parseIndexSkillFiles()

  assert.deepEqual(indexedSkillFiles, actualSkillFiles)
})

test('skill router maps every numbered skill and stays aligned with frontmatter triggers', async () => {
  const skills = await Promise.all((await listSkillFiles()).map(parseSkillFrontmatter))
  const routerRows = await parseRouterRows()

  assert.deepEqual(
    routerRows.map((row) => row.file),
    skills.map((skill) => skill.file),
    'router must include every numbered skill file exactly once',
  )

  for (const skill of skills) {
    const routerRow = routerRows.find((row) => row.file === skill.file)

    assert.ok(routerRow, `${skill.file} must have a router row`)
    assert.deepEqual(
      routerRow.keywords,
      [...skill.triggers].sort(),
      `${skill.file} frontmatter triggers must match router keywords`,
    )
  }
})
