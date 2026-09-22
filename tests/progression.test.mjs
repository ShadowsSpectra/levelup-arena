import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({
  configLoader: 'runner',
  server: { middlewareMode: true },
})

after(async () => {
  await server.close()
})

const {
  applyArenaCompletion,
  applyTrainingCompletion,
  createInitialProgression,
  getRoleProgress,
} = await server.ssrLoadModule('/src/services/progression.ts')
const { createArenaSession, endArenaSession } = await server.ssrLoadModule('/src/services/arenaSession.ts')
const {
  createTraining,
  createTrainingResult,
} = await server.ssrLoadModule('/src/services/trainingEngine.ts')
const { localQuestionSource } = await server.ssrLoadModule('/src/content/questionSource.ts')
const { appStorage } = await server.ssrLoadModule('/src/services/storage.ts')
const { RoleHomePage } = await server.ssrLoadModule('/src/pages/RoleHomePage.tsx')
const { roles } = await server.ssrLoadModule('/src/config/roles.ts')

const roleIds = ['product_manager', 'project_manager', 'sales_manager']
const questions = [10, 20, 30, 40, 50].map((xp, index) => ({
  id: `test_${index}`,
  role: 'product_manager',
  type: 'choice',
  skill: 'test',
  difficulty: 'easy',
  minLevel: 1,
  question: 'Test question',
  answers: ['Correct', 'Incorrect'],
  correctAnswer: 0,
  explanation: 'Test explanation',
  xp,
  active: true,
}))
const projectQuestions = questions.map((question) => ({
  ...question,
  role: 'project_manager',
}))
const salesQuestions = questions.map((question) => ({
  ...question,
  role: 'sales_manager',
}))

function resultWithCorrectAnswers(correctCount) {
  return createTrainingResult(questions.map((question, index) => ({
    questionId: question.id,
    selectedAnswer: index < correctCount ? 0 : 1,
    correct: index < correctCount,
  })))
}

test('each role forms its own five-question session at level 1', async () => {
  for (const role of roleIds) {
    const session = await createTraining({
      role,
      level: 1,
      source: localQuestionSource,
    })
    assert.equal(session.length, 5)
    assert.ok(session.every((question) => question.role === role))
  }
})

test('Arena CTA is available before Training and after a failed Training for every role', () => {
  for (const role of roles) {
    const initial = createInitialProgression()
    const failed = applyTrainingCompletion(
      initial, role.id, resultWithCorrectAnswers(0),
      questions.map((question) => ({ ...question, role: role.id })),
    ).progression
    for (const progression of [initial, failed]) {
      const html = renderToStaticMarkup(createElement(RoleHomePage, {
        role,
        roleProgress: getRoleProgress(progression, role.id),
        energy: progression.energy,
        streak: progression.streak,
        onChangeRole() {}, onOpenTraining() {}, onOpenArena() {},
      }))
      assert.match(html, /Открыть арену/)
      assert.doesNotMatch(html, /Арена заблокирована|Набери минимум 80%/)
    }
  }
})

test('failed Training awards only correct-answer XP and consumes Energy', () => {
  const result = resultWithCorrectAnswers(3)
  assert.equal(result.score, 60)
  assert.equal(result.passed, false)

  const { progression, award } = applyTrainingCompletion(
    createInitialProgression(),
    'product_manager',
    result,
    questions,
    new Date(2026, 8, 21, 23, 55),
  )

  assert.equal(award.xpEarned, 60)
  assert.equal(progression.roles.product_manager.xp, 60)
  assert.equal(getRoleProgress(progression, 'product_manager').level, 1)
  assert.equal(progression.energy, 5)
  assert.equal(progression.streak, 1)
  assert.equal(progression.lastActivityDate, '2026-09-21')
})

test('Training score does not gate Arena or change XP rules', () => {
  const first = applyTrainingCompletion(
    createInitialProgression(),
    'product_manager',
    resultWithCorrectAnswers(3),
    questions,
    new Date(2026, 8, 21, 9, 0),
  )
  const second = applyTrainingCompletion(
    first.progression,
    'product_manager',
    resultWithCorrectAnswers(4),
    questions,
    new Date(2026, 8, 21, 18, 0),
  )

  assert.equal(second.award.xpEarned, 100)
  assert.equal(second.progression.roles.product_manager.xp, 160)
  assert.equal(getRoleProgress(second.progression, 'product_manager').level, 2)
  assert.equal(second.progression.energy, 4)
  assert.equal(second.progression.streak, 1)
  assert.equal('arenaUnlocked' in second.progression.roles.product_manager, false)

  const third = applyTrainingCompletion(
    second.progression,
    'product_manager',
    resultWithCorrectAnswers(0),
    questions,
    new Date(2026, 8, 21, 19, 0),
  )
  assert.equal(third.award.xpEarned, 0)
  assert.equal(third.progression.energy, 3)
  assert.equal(third.progression.streak, 1)
})

test('level thresholds and role XP remain independent', () => {
  let progression = createInitialProgression()
  progression = applyTrainingCompletion(
    progression,
    'product_manager',
    resultWithCorrectAnswers(4),
    questions,
  ).progression

  assert.equal(getRoleProgress(progression, 'product_manager').level, 2)
  assert.equal(getRoleProgress(progression, 'project_manager').level, 1)
  assert.equal(progression.roles.project_manager.xp, 0)

  progression = applyTrainingCompletion(
    progression,
    'sales_manager',
    resultWithCorrectAnswers(4),
    salesQuestions,
  ).progression
  assert.equal(progression.roles.sales_manager.xp, 100)
  assert.equal(progression.roles.product_manager.xp, 100)
  assert.equal(progression.roles.project_manager.xp, 0)

  progression = applyTrainingCompletion(
    progression,
    'product_manager',
    resultWithCorrectAnswers(5),
    questions,
  ).progression
  assert.equal(getRoleProgress(progression, 'product_manager').level, 3)
  assert.equal(getRoleProgress(progression, 'product_manager').nextLevelXp, null)
  assert.equal(getRoleProgress(progression, 'sales_manager').level, 2)
})

test('completed Training and Arena share one local-day streak', () => {
  let progression = createInitialProgression()
  const arenaSession = createArenaSession('scenario', 'character', 'Начало')
  assert.throws(() => applyArenaCompletion(progression, arenaSession), /completed Arena/)
  assert.equal(progression.streak, 0)

  const completedArena = endArenaSession(arenaSession)
  progression = applyArenaCompletion(progression, completedArena, new Date(2026, 8, 21, 23, 55))
  assert.equal(progression.streak, 1)
  assert.equal(progression.energy, 6)
  progression = applyTrainingCompletion(
    progression, 'project_manager', resultWithCorrectAnswers(0), projectQuestions,
    new Date(2026, 8, 21, 23, 58),
  ).progression
  assert.equal(progression.streak, 1)

  progression = applyArenaCompletion(progression, completedArena, new Date(2026, 8, 22, 0, 5))
  assert.equal(progression.streak, 2)

  progression = applyTrainingCompletion(
    progression,
    'project_manager',
    resultWithCorrectAnswers(0),
    projectQuestions,
    new Date(2026, 8, 24, 8, 0),
  ).progression
  assert.equal(progression.streak, 1)
  assert.equal(progression.lastActivityDate, '2026-09-24')
})

test('Energy bottoms out at zero without blocking further Training', () => {
  let progression = createInitialProgression()
  for (let index = 0; index < 8; index += 1) {
    progression = applyTrainingCompletion(
      progression,
      'project_manager',
      resultWithCorrectAnswers(0),
      projectQuestions,
    ).progression
  }
  assert.equal(progression.energy, 0)
})

test('minLevel filters questions using the supplied level', async () => {
  const levelTwoQuestion = { ...questions[0], id: 'level_2', minLevel: 2 }
  const source = {
    async getQuestions() {
      return [...questions.slice(0, 4), levelTwoQuestion]
    },
  }

  const levelOne = await createTraining({ role: 'product_manager', level: 1, source })
  const levelTwo = await createTraining({ role: 'product_manager', level: 2, source })
  assert.equal(levelOne.length, 4)
  assert.ok(levelOne.every((question) => question.minLevel === 1))
  assert.equal(levelTwo.length, 5)
  assert.ok(levelTwo.some((question) => question.id === 'level_2'))
})

test('storage restores progression and migrates old unlock/date fields safely', () => {
  const previousWindow = globalThis.window
  const values = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  }

  try {
    assert.deepEqual(appStorage.getProgression(), createInitialProgression())
    values.set('levelup-arena:progression-v1', '{broken json')
    assert.deepEqual(appStorage.getProgression(), createInitialProgression())

    values.set('levelup-arena:progression-v1', JSON.stringify({
      roles: { product_manager: { xp: 120, arenaUnlocked: true } },
      energy: -10,
      streak: 'invalid',
      lastTrainingDate: 'not-a-date',
    }))
    const restored = appStorage.getProgression()
    assert.equal(restored.roles.product_manager.xp, 120)
    assert.equal('arenaUnlocked' in restored.roles.product_manager, false)
    assert.equal(restored.roles.project_manager.xp, 0)
    assert.equal(restored.energy, 6)
    assert.equal(restored.streak, 0)
    assert.equal(restored.lastActivityDate, null)

    values.set('levelup-arena:progression-v1', JSON.stringify({
      roles: { sales_manager: { xp: 35, arenaUnlocked: false } },
      energy: 4,
      streak: 2,
      lastTrainingDate: '2026-09-20',
    }))
    const migrated = appStorage.getProgression()
    assert.equal(migrated.roles.sales_manager.xp, 35)
    assert.equal(migrated.lastActivityDate, '2026-09-20')
    assert.equal(migrated.streak, 2)

    appStorage.setProgression(migrated)
    assert.deepEqual(appStorage.getProgression(), migrated)
    const afterArena = applyArenaCompletion(
      appStorage.getProgression(),
      endArenaSession(createArenaSession('scenario', 'character', 'Начало')),
      new Date(2026, 8, 21, 9, 0),
    )
    appStorage.setProgression(afterArena)
    const afterTraining = applyTrainingCompletion(
      appStorage.getProgression(), 'sales_manager', resultWithCorrectAnswers(0),
      salesQuestions, new Date(2026, 8, 21, 10, 0),
    ).progression
    appStorage.setProgression(afterTraining)
    assert.deepEqual(appStorage.getProgression(), afterTraining)
    assert.equal(afterTraining.streak, 3)
    assert.equal(afterTraining.roles.sales_manager.xp, 35)
    assert.equal(afterTraining.energy, 3)
    const salesHome = renderToStaticMarkup(createElement(RoleHomePage, {
      role: roles.find(({ id }) => id === 'sales_manager'),
      roleProgress: getRoleProgress(appStorage.getProgression(), 'sales_manager'),
      energy: afterTraining.energy, streak: afterTraining.streak,
      onChangeRole() {}, onOpenTraining() {}, onOpenArena() {},
    }))
    assert.match(salesHome, /Открыть арену/)
    appStorage.setSelectedRole('sales_manager')
    assert.equal(appStorage.getSelectedRole(), 'sales_manager')
    appStorage.setOnboardingComplete()
    assert.equal(appStorage.hasCompletedOnboarding(), true)
  } finally {
    globalThis.window = previousWindow
  }
})
