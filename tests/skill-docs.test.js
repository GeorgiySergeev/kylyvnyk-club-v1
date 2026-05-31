import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const docsToValidate = ['docs/skills/SKILLS.md', 'rules/skills.md']

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function extractMarkdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => target !== undefined)
    .filter((target) => !/^(https?:|mailto:|#)/.test(target))
}

function resolveMarkdownTarget(sourceRelativePath, target) {
  const targetPath = target.split('#')[0]

  assert.ok(targetPath, `${sourceRelativePath} contains an empty link target`)

  return path.resolve(
    path.dirname(path.join(repoRoot, sourceRelativePath)),
    targetPath,
  )
}

function toRepoRelative(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/')
}

function extractSkillFiles(sourceRelativePath) {
  const markdown = readRepoFile(sourceRelativePath)
  const linkedSkillFiles = extractMarkdownLinks(markdown)
    .filter((target) => /^\.\/skill-\d{2}-[a-z0-9-]+\.md$/.test(target))
    .map((target) =>
      toRepoRelative(resolveMarkdownTarget(sourceRelativePath, target)),
    )
  const referencedSkillFiles = [
    ...markdown.matchAll(/docs\/skills\/skill-\d{2}-[a-z0-9-]+\.md/g),
  ].map((match) => match[0])

  return [...new Set([...linkedSkillFiles, ...referencedSkillFiles])].sort()
}

function extractQuotedPhrases(value) {
  return [...value.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((phrase) => phrase !== undefined)
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

test('skill docs do not contain broken relative markdown links', () => {
  for (const docPath of docsToValidate) {
    const links = extractMarkdownLinks(readRepoFile(docPath))

    for (const link of links) {
      const resolvedPath = resolveMarkdownTarget(docPath, link)

      assert.ok(
        resolvedPath === repoRoot || resolvedPath.startsWith(`${repoRoot}/`),
        `${docPath} links outside the repository: ${link}`,
      )
      assert.ok(existsSync(resolvedPath), `${docPath} has a broken link: ${link}`)
    }
  }
})

test('skill router and skill index list the same skill playbooks', () => {
  const indexedSkillFiles = extractSkillFiles('docs/skills/SKILLS.md')
  const routedSkillFiles = extractSkillFiles('rules/skills.md')

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

  for (const skillFile of extractSkillFiles('docs/skills/SKILLS.md')) {
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
