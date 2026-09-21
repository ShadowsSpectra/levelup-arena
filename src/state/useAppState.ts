import { useState } from 'react'
import { getRoleById, type RoleId } from '../config/roles'
import { appStorage } from '../services/storage'

type Screen = 'onboarding' | 'role-selection' | 'home' | 'training'

function getInitialState(): { screen: Screen; selectedRoleId: RoleId | null } {
  const onboardingComplete = appStorage.hasCompletedOnboarding()
  const selectedRoleId = appStorage.getSelectedRole()

  if (!onboardingComplete) {
    return { screen: 'onboarding', selectedRoleId }
  }

  return {
    screen: selectedRoleId ? 'home' : 'role-selection',
    selectedRoleId,
  }
}

export function useAppState() {
  const [appState, setAppState] = useState(getInitialState)
  const selectedRole = getRoleById(appState.selectedRoleId)

  function completeOnboarding() {
    appStorage.setOnboardingComplete()
    setAppState((current) => ({ ...current, screen: 'role-selection' }))
  }

  function selectRole(roleId: RoleId) {
    appStorage.setSelectedRole(roleId)
    setAppState({ screen: 'home', selectedRoleId: roleId })
  }

  function changeRole() {
    setAppState((current) => ({ ...current, screen: 'role-selection' }))
  }

  function openTraining() {
    setAppState((current) => ({ ...current, screen: 'training' }))
  }

  function openHome() {
    setAppState((current) => ({ ...current, screen: 'home' }))
  }

  return {
    screen: appState.screen,
    selectedRole,
    completeOnboarding,
    selectRole,
    changeRole,
    openTraining,
    openHome,
  }
}
