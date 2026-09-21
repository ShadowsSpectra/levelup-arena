import { useState } from 'react'
import { getRoleById, type RoleId } from '../config/roles'
import { applyTrainingCompletion, getRoleProgress } from '../services/progression'
import { appStorage } from '../services/storage'
import type { TrainingQuestion, TrainingResult } from '../types/training'

type Screen = 'onboarding' | 'role-selection' | 'home' | 'training' | 'arena'

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
  const [progression, setProgression] = useState(appStorage.getProgression)
  const selectedRole = getRoleById(appState.selectedRoleId)
  const roleProgress = selectedRole
    ? getRoleProgress(progression, selectedRole.id)
    : null

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

  function openArena() {
    if (appState.selectedRoleId && progression.roles[appState.selectedRoleId].arenaUnlocked) {
      setAppState((current) => ({ ...current, screen: 'arena' }))
    }
  }

  function completeTraining(
    roleId: RoleId,
    result: TrainingResult,
    questions: TrainingQuestion[],
  ) {
    const { progression: updated, award } = applyTrainingCompletion(
      progression,
      roleId,
      result,
      questions,
    )
    appStorage.setProgression(updated)
    setProgression(updated)
    return award
  }

  function openHome() {
    setAppState((current) => ({ ...current, screen: 'home' }))
  }

  return {
    screen: appState.screen,
    selectedRole,
    progression,
    roleProgress,
    completeOnboarding,
    selectRole,
    changeRole,
    openTraining,
    openArena,
    completeTraining,
    openHome,
  }
}
