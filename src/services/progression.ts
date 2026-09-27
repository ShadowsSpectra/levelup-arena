import { arenaRewards, energyRules, levelThresholds } from '../config/progression'
import { roles, type RoleId } from '../config/roles'
import type { ArenaSession, PublicCharacter } from '../types/arena'
import type { ArenaEvaluation } from '../types/arenaEvaluation'
import type { TrainingQuestion, TrainingResult } from '../types/training'

export type RoleProgress = {
  xp: number
  bosses: Record<string, BossProgress>
}

export type BossProgress = {
  attempts: number
  defeated: boolean
  bestScore: number | null
}

export type ArenaAward = {
  xpEarned: number
  bossDefeated: boolean
}

export type ProgressionState = {
  roles: Record<RoleId, RoleProgress>
  energy: number
  streak: number
  lastActivityDate: string | null
  arenaAwards: Record<string, { roleId: RoleId; characterId: string; award: ArenaAward }>
}

export type TrainingAward = {
  xpEarned: number
}

export function createInitialProgression(): ProgressionState {
  return {
    roles: Object.fromEntries(
      roles.map(({ id }) => [id, { xp: 0, bosses: {} }]),
    ) as Record<RoleId, RoleProgress>,
    energy: energyRules.maximum,
    streak: 0,
    lastActivityDate: null,
    arenaAwards: {},
  }
}

export function getRoleProgress(state: ProgressionState, roleId: RoleId) {
  const role = state.roles[roleId]
  const currentThreshold = [...levelThresholds].reverse().find(
    ({ minXp }) => role.xp >= minXp,
  ) ?? levelThresholds[0]
  const nextThreshold = levelThresholds.find(
    ({ minXp }) => minXp > role.xp,
  )

  return {
    ...role,
    level: currentThreshold.level,
    nextLevelXp: nextThreshold?.minXp ?? null,
    progressPercent: nextThreshold
      ? Math.round(
          ((role.xp - currentThreshold.minXp) /
            (nextThreshold.minXp - currentThreshold.minXp)) * 100,
        )
      : 100,
  }
}

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calendarDayDifference(previous: string, current: string) {
  const [previousYear, previousMonth, previousDay] = previous.split('-').map(Number)
  const [currentYear, currentMonth, currentDay] = current.split('-').map(Number)
  const previousUtc = Date.UTC(previousYear, previousMonth - 1, previousDay)
  const currentUtc = Date.UTC(currentYear, currentMonth - 1, currentDay)
  return Math.round((currentUtc - previousUtc) / 86_400_000)
}

export function registerCompletedActivity(
  state: ProgressionState,
  completedAt = new Date(),
): ProgressionState {
  const today = getLocalDateKey(completedAt)
  const dayDifference = state.lastActivityDate
    ? calendarDayDifference(state.lastActivityDate, today)
    : null
  const streak = dayDifference === 0
    ? state.streak
    : dayDifference === 1
      ? state.streak + 1
      : 1

  return { ...state, streak, lastActivityDate: today }
}

export function applyArenaCompletion(
  state: ProgressionState,
  session: ArenaSession,
  completedAt = new Date(),
): ProgressionState {
  if (session.status !== 'completed') {
    throw new Error('Only a completed Arena session can update progression.')
  }
  return registerCompletedActivity(state, completedAt)
}

export function isBossUnlocked(character: PublicCharacter, roleProgress: RoleProgress, level: number) {
  const requirements = character.unlockRequirements
  return (!requirements?.minLevel || level >= requirements.minLevel) &&
    (!requirements?.previousBossId || roleProgress.bosses[requirements.previousBossId]?.defeated === true)
}

export function applyArenaEvaluation(
  state: ProgressionState,
  roleId: RoleId,
  session: ArenaSession,
  evaluation: ArenaEvaluation,
): { progression: ProgressionState; award: ArenaAward } {
  if (session.status !== 'completed' || !session.id) {
    throw new Error('Only an identified completed Arena session can be rewarded.')
  }
  const existing = state.arenaAwards[session.id]
  if (existing) {
    if (existing.roleId !== roleId || existing.characterId !== session.characterId) {
      throw new Error('Arena session has already been recorded for another role or boss.')
    }
    return { progression: state, award: existing.award }
  }
  const role = state.roles[roleId]
  const previousBoss = role.bosses[session.characterId] ?? {
    attempts: 0, defeated: false, bestScore: null,
  }
  const bossDefeated = evaluation.outcome.status === 'SUCCESS'
  const award: ArenaAward = {
    xpEarned: bossDefeated ? arenaRewards.successXp : 0,
    bossDefeated,
  }
  return {
    award,
    progression: {
      ...state,
      roles: {
        ...state.roles,
        [roleId]: {
          ...role,
          xp: role.xp + award.xpEarned,
          bosses: {
            ...role.bosses,
            [session.characterId]: {
              attempts: previousBoss.attempts + 1,
              defeated: previousBoss.defeated || bossDefeated,
              bestScore: Math.max(previousBoss.bestScore ?? 0, evaluation.overallScore),
            },
          },
        },
      },
      arenaAwards: {
        ...state.arenaAwards,
        [session.id]: { roleId, characterId: session.characterId, award },
      },
    },
  }
}

export function applyTrainingCompletion(
  state: ProgressionState,
  roleId: RoleId,
  result: TrainingResult,
  questions: TrainingQuestion[],
  completedAt = new Date(),
): { progression: ProgressionState; award: TrainingAward } {
  if (
    !result.completed ||
    result.totalCount !== questions.length ||
    questions.some((question) => question.role !== roleId)
  ) {
    throw new Error('Only a completed Training can update progression.')
  }

  const selectedAnswers = new Map(
    result.answers.map((answer) => [answer.questionId, answer.selectedAnswer]),
  )
  const xpEarned = questions.reduce(
    (total, question) => total + (
      selectedAnswers.get(question.id) === question.correctAnswer ? question.xp : 0
    ),
    0,
  )
  const activeState = registerCompletedActivity(state, completedAt)

  const progression: ProgressionState = {
    ...activeState,
    roles: {
      ...state.roles,
      [roleId]: {
        ...state.roles[roleId],
        xp: state.roles[roleId].xp + xpEarned,
      },
    },
    energy: Math.max(0, state.energy - energyRules.trainingCost),
  }

  return {
    progression,
    award: { xpEarned },
  }
}
