import { isRoleId, type RoleId } from '../config/roles'

const storageKeys = {
  onboardingComplete: 'levelup-arena:onboarding-complete',
  selectedRole: 'levelup-arena:selected-role',
} as const

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
}
