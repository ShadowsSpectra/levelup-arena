import { useState } from 'react'
import { getRoleById, type RoleId } from '../config/roles'
import { applyArenaCompletion, applyArenaEvaluation, applyTrainingCompletion, getRoleProgress } from '../services/progression'
import { appStorage } from '../services/storage'
import type { ArenaSession } from '../types/arena'
import type { ArenaEvaluation } from '../types/arenaEvaluation'
import type { TrainingQuestion, TrainingResult } from '../types/training'

type Screen = 'onboarding' | 'role-selection' | 'home' | 'training' | 'arena' | 'workshop'

export function initialAppState(onboardingComplete: boolean, selectedRoleId: RoleId | null): { screen: Screen; selectedRoleId: RoleId | null } {
  if (!onboardingComplete) {
    return { screen: 'onboarding', selectedRoleId }
  }

  return {
    screen: selectedRoleId ? 'home' : 'role-selection',
    selectedRoleId,
  }
}

export function useAppState() {
  const [appState, setAppState] = useState(() => initialAppState(appStorage.hasCompletedLeviOnboarding(), appStorage.getSelectedRole()))
  const [progression, setProgression] = useState(appStorage.getProgression)
  const selectedRole = getRoleById(appState.selectedRoleId)
  const roleProgress = selectedRole
    ? getRoleProgress(progression, selectedRole.id)
    : null

  function continueOnboarding() {
    if (appState.screen !== 'onboarding' || !appState.selectedRoleId) return
    if (appStorage.getSelectedRole() === appState.selectedRoleId) appStorage.setLeviOnboardingComplete()
    setAppState((current) => ({ ...current, screen: 'home' }))
  }

  function selectRole(roleId: RoleId) {
    appStorage.setSelectedRole(roleId)
    if (appState.screen === 'onboarding' && appStorage.getSelectedRole() === roleId) appStorage.setLeviOnboardingComplete()
    setAppState({ screen: 'home', selectedRoleId: roleId })
  }

  function changeRole() {
    setAppState((current) => ({ ...current, screen: 'role-selection' }))
  }

  function openTraining() {
    setAppState((current) => ({ ...current, screen: 'training' }))
  }

  function openWorkshop() {
    setAppState((current) => ({ ...current, screen: 'workshop' }))
  }

  function openArena() {
    if (appState.selectedRoleId) {
      setAppState((current) => ({ ...current, screen: 'arena' }))
    }
  }

  function completeArena(session: ArenaSession) {
    const updated = applyArenaCompletion(progression, session)
    appStorage.setProgression(updated)
    setProgression(updated)
  }

  function completeArenaEvaluation(roleId: RoleId, session: ArenaSession, result: ArenaEvaluation) {
    const { progression: updated, award } = applyArenaEvaluation(
      appStorage.getProgression(), roleId, session, result,
    )
    appStorage.setProgression(updated)
    setProgression(updated)
    return award
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
    continueOnboarding,
    selectRole,
    changeRole,
    openTraining,
    openWorkshop,
    openArena,
    completeTraining,
    completeArena,
    completeArenaEvaluation,
    openHome,
  }
}
