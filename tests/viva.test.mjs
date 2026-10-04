import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// The Viva model is pure TypeScript with type-only imports. Transpile it in
// memory using the project's existing compiler; no new test dependencies.
async function loadModule(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
const model = await loadModule('../src/viva/session.ts')
const { introViva: deck } = await loadModule('../src/viva/content.ts')

test('a learner cannot reveal or finish a blank answer', () => {
  const session = model.recordAnswer(model.newSession(deck), '   ')
  assert.equal(model.revealAnswer(session).revealed, false)
  assert.equal(model.advanceSession(session).index, 0)
})

test('the original answer cannot be rewritten after seeing the key', () => {
  const session = model.revealAnswer(model.recordAnswer(model.newSession(deck), 'My original answer'))
  assert.equal(model.recordAnswer(session, 'Copied model answer').answers.definition.text, 'My original answer')
  assert.deepEqual(model.toggleCriterion(session, 99, 2).answers.definition.covered, [])
})

test('finish a full session, persist it and review missed or hinted answers', () => {
  let session = model.newSession(deck)
  for (const question of deck.questions) {
    session = model.recordAnswer(session, 'An answer in my own words')
    if (question.id === 'position') session = model.useHint(session)
    session = model.revealAnswer(session)
    for (let i = 0; i < question.criteria.length; i++) {
      if (question.id !== 'planes') session = model.toggleCriterion(session, i, question.criteria.length)
    }
    session = model.advanceSession(session)
  }
  assert.equal(session.complete, true)
  assert.deepEqual(model.reviewQueue(session, deck), ['position', 'planes'])
  assert.deepEqual(model.parseSession(JSON.stringify(session), deck), session)
  const retry = model.newSession(deck, model.reviewQueue(session, deck))
  assert.equal(retry.complete, false)
  assert.deepEqual(retry.queue, ['position', 'planes'])
  assert.deepEqual(retry.answers, {})
})

test('hints survive editing and a zero-point self-assessment is valid', () => {
  let session = model.useHint(model.newSession(deck))
  session = model.recordAnswer(session, 'I do not know')
  session = model.advanceSession(model.revealAnswer(session))
  assert.equal(session.answers.definition.hintUsed, true)
  assert.equal(session.answers.definition.checked, true)
  assert.deepEqual(session.answers.definition.covered, [])
  assert.ok(model.parseSession(JSON.stringify(session), deck))
})

test('ignore stale, corrupt and impossible saved sessions', () => {
  const session = model.newSession(deck)
  const invalid = [
    '{', 'null', JSON.stringify({ ...session, version: 99 }),
    JSON.stringify({ ...session, queue: ['missing'] }),
    JSON.stringify({ ...session, queue: ['position', 'position'] }),
    JSON.stringify({ ...session, index: 5 }),
    JSON.stringify({ ...session, index: 1 }),
    JSON.stringify({ ...session, revealed: true }),
    JSON.stringify({ ...session, complete: true }),
    JSON.stringify({ ...session, answers: [] }),
    JSON.stringify({ ...session, answers: { definition: { text: 'answer', covered: [9], checked: true, hintUsed: false } } }),
    JSON.stringify({ ...session, answers: { definition: { text: 'answer', covered: [0, 0], checked: true, hintUsed: false } } }),
  ]
  for (const raw of invalid) assert.equal(model.parseSession(raw, deck), null, raw)
})

test('saved practice is namespaced by account and deck', () => {
  assert.notEqual(model.sessionKey(deck, 'student-a'), model.sessionKey(deck, 'student-b'))
  assert.notEqual(model.sessionKey(deck), model.sessionKey(deck, 'student-a'))
  assert.notEqual(model.sessionKey(deck, 'student-a'), model.sessionKey({ ...deck, id: 'new-edition' }, 'student-a'))
})
