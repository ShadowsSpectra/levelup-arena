import { isRoleId, type RoleId } from '../config/roles'
import { energyRules } from '../config/progression'
import { createInitialProgression, type ProgressionState } from './progression'

const storageKeys = {
  onboardingComplete: 'levelup-arena:onboarding-complete',
  selectedRole: 'levelup-arena:selected-role',
  progression: 'levelup-arena:progression-v1',
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonNegativeInteger(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback
}

function validLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
}

function normalizeProgression(value: unknown): ProgressionState {
  const defaults = createInitialProgression()
  if (!isRecord(value)) return defaults

  const storedRoles = isRecord(value.roles) ? value.roles : {}
  const restoredRoles = { ...defaults.roles }

  for (const roleId of Object.keys(defaults.roles) as RoleId[]) {
    const storedRole = storedRoles[roleId]
    if (!isRecord(storedRole)) continue
    restoredRoles[roleId] = {
      xp: nonNegativeInteger(storedRole.xp, 0),
      arenaUnlocked: storedRole.arenaUnlocked === true,
    }
  }

  return {
    roles: restoredRoles,
    energy: Math.min(
      energyRules.maximum,
      nonNegativeInteger(value.energy, defaults.energy),
    ),
    streak: nonNegativeInteger(value.streak, defaults.streak),
    lastTrainingDate: validLocalDate(value.lastTrainingDate)
      ? value.lastTrainingDate
      : null,
  }
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // The app remains usable if storage is unavailable or disabled.
  }
}

export const appStorage = {
  hasCompletedOnboarding() {
    return read(storageKeys.onboardingComplete) === 'true'
  },

  setOnboardingComplete() {
    write(storageKeys.onboardingComplete, 'true')
  },

  getSelectedRole(): RoleId | null {
    const storedRole = read(storageKeys.selectedRole)
    return isRoleId(storedRole) ? storedRole : null
  },

  setSelectedRole(roleId: RoleId) {
    write(storageKeys.selectedRole, roleId)
  },

  getProgression(): ProgressionState {
    const stored = read(storageKeys.progression)
    if (!stored) return createInitialProgression()

    try {
      return normalizeProgression(JSON.parse(stored) as unknown)
    } catch {
      return createInitialProgression()
    }
  },

  setProgression(progression: ProgressionState) {
    write(storageKeys.progression, JSON.stringify(progression))
  },
}
