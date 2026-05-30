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

function extractSkillFiles(markdown) {
  return [
    ...new Set(
      [...markdown.matchAll(/docs\/skills\/skill-\d{2}-[a-z0-9-]+\.md/g)].map(
        (match) => match[0],
      ),
    ),
  ].sort()
}

function resolveMarkdownTarget(sourceRelativePath, target) {
  const targetPath = target.split('#')[0]

  assert.ok(targetPath, `${sourceRelativePath} contains an empty link target`)

  return path.resolve(
    path.dirname(path.join(repoRoot, sourceRelativePath)),
    targetPath,
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
  const indexedSkillFiles = extractSkillFiles(readRepoFile('docs/skills/SKILLS.md'))
  const routedSkillFiles = extractSkillFiles(readRepoFile('rules/skills.md'))

  assert.deepEqual(routedSkillFiles, indexedSkillFiles)

  for (const skillFile of indexedSkillFiles) {
    assert.ok(
      existsSync(path.join(repoRoot, skillFile)),
      `Indexed skill file is missing: ${skillFile}`,
    )
  }
})
