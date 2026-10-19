import { isRoleId, type RoleId } from '../config/roles'
import { energyRules } from '../config/progression'
import { createInitialProgression, type ProgressionState } from './progression'

const storageKeys = {
  onboardingComplete: 'levelup-arena:onboarding-complete',
  leviOnboardingVersion: 'levelup-arena:levi-onboarding-version',
  leviHomeGuideVersion: 'levelup-arena:levi-home-guide-version',
  leviArenaGuideVersion: 'levelup-arena:levi-arena-guide-version',
  leviFinishHintVersion: 'levelup-arena:levi-finish-hint-version',
  leviTrainingWelcomeVersion: 'levelup-arena:levi-training-welcome-version',
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
      bosses: {},
    }
    const storedBosses = isRecord(storedRole.bosses) ? storedRole.bosses : {}
    for (const [bossId, boss] of Object.entries(storedBosses)) {
      if (!bossId || !isRecord(boss)) continue
      const score = boss.bestScore
      restoredRoles[roleId].bosses[bossId] = {
        attempts: nonNegativeInteger(boss.attempts, 0),
        defeated: boss.defeated === true,
        bestScore: score === null || (typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= 100)
          ? score : null,
      }
    }
  }

  const arenaAwards: ProgressionState['arenaAwards'] = {}
  const storedAwards = isRecord(value.arenaAwards) ? value.arenaAwards : {}
  for (const [sessionId, entry] of Object.entries(storedAwards)) {
    if (!sessionId || !isRecord(entry)) continue
    const roleId = typeof entry.roleId === 'string' ? entry.roleId : null
    if (!isRoleId(roleId) ||
        typeof entry.characterId !== 'string' || !entry.characterId || !isRecord(entry.award)) continue
    const xpEarned = nonNegativeInteger(entry.award.xpEarned, -1)
    if (xpEarned < 0 || typeof entry.award.bossDefeated !== 'boolean') continue
    arenaAwards[sessionId] = {
      roleId, characterId: entry.characterId,
      award: { xpEarned, bossDefeated: entry.award.bossDefeated },
    }
  }

  return {
    roles: restoredRoles,
    energy: Math.min(
      energyRules.maximum,
      nonNegativeInteger(value.energy, defaults.energy),
    ),
    streak: nonNegativeInteger(value.streak, defaults.streak),
    lastActivityDate: validLocalDate(value.lastActivityDate)
      ? value.lastActivityDate
      : validLocalDate(value.lastTrainingDate)
        ? value.lastTrainingDate
        : null,
    arenaAwards,
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
  hasViewedLeviTrainingWelcome() {
    try { return window.localStorage.getItem(storageKeys.leviTrainingWelcomeVersion) === '1' }
    catch { return true }
  },

  markLeviTrainingWelcomeViewed() {
    try {
      window.localStorage.setItem(storageKeys.leviTrainingWelcomeVersion, '1')
      return window.localStorage.getItem(storageKeys.leviTrainingWelcomeVersion) === '1'
    } catch { return false }
  },

  hasViewedLeviFinishHint() {
    try { return window.localStorage.getItem(storageKeys.leviFinishHintVersion) === '1' }
    catch { return true }
  },

  markLeviFinishHintViewed() {
    try { window.localStorage.setItem(storageKeys.leviFinishHintVersion, '1'); return true }
    catch { return false }
  },

  hasCompletedLeviArenaGuide() {
    const version = Number(read(storageKeys.leviArenaGuideVersion))
    return Number.isSafeInteger(version) && version >= 1
  },

  setLeviArenaGuideComplete() {
    write(storageKeys.leviArenaGuideVersion, '1')
  },

  hasCompletedLeviHomeGuide() {
    const version = Number(read(storageKeys.leviHomeGuideVersion))
    return Number.isSafeInteger(version) && version >= 1
  },

  setLeviHomeGuideComplete() {
    write(storageKeys.leviHomeGuideVersion, '1')
  },

  hasCompletedLeviOnboarding() {
    const version = Number(read(storageKeys.leviOnboardingVersion))
    return Number.isSafeInteger(version) && version >= 1
  },

  setLeviOnboardingComplete() {
    write(storageKeys.leviOnboardingVersion, '1')
  },

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
