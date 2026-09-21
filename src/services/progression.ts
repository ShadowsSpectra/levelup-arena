import { energyRules, levelThresholds } from '../config/progression'
import { roles, type RoleId } from '../config/roles'
import type { TrainingQuestion, TrainingResult } from '../types/training'

export type RoleProgress = {
  xp: number
  arenaUnlocked: boolean
}

export type ProgressionState = {
  roles: Record<RoleId, RoleProgress>
  energy: number
  streak: number
  lastTrainingDate: string | null
}

export type TrainingAward = {
  xpEarned: number
  arenaUnlockedNow: boolean
  arenaUnlocked: boolean
}

export function createInitialProgression(): ProgressionState {
  return {
    roles: Object.fromEntries(
      roles.map(({ id }) => [id, { xp: 0, arenaUnlocked: false }]),
    ) as Record<RoleId, RoleProgress>,
    energy: energyRules.maximum,
    streak: 0,
    lastTrainingDate: null,
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
  const previousRole = state.roles[roleId]
  const arenaUnlockedNow = result.passed && !previousRole.arenaUnlocked
  const today = getLocalDateKey(completedAt)
  const dayDifference = state.lastTrainingDate
    ? calendarDayDifference(state.lastTrainingDate, today)
    : null
  const streak = dayDifference === 0
    ? state.streak
    : dayDifference === 1
      ? state.streak + 1
      : 1

  const progression: ProgressionState = {
    ...state,
    roles: {
      ...state.roles,
      [roleId]: {
        xp: previousRole.xp + xpEarned,
        arenaUnlocked: previousRole.arenaUnlocked || result.passed,
      },
    },
    energy: Math.max(0, state.energy - energyRules.trainingCost),
    streak,
    lastTrainingDate: today,
  }

  return {
    progression,
    award: {
      xpEarned,
      arenaUnlockedNow,
      arenaUnlocked: progression.roles[roleId].arenaUnlocked,
    },
  }
}
