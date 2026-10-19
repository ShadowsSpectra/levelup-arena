import { useState } from 'react'
import { getRoleById, type RoleId } from '../config/roles'
import { applyArenaCompletion, applyArenaEvaluation, applyTrainingCompletion, getRoleProgress, type ProgressionState } from '../services/progression'
import { appStorage } from '../services/storage'
import type { ArenaSession } from '../types/arena'
import type { ArenaEvaluation } from '../types/arenaEvaluation'
import type { TrainingQuestion, TrainingResult } from '../types/training'

type Screen = 'onboarding' | 'role-selection' | 'home' | 'training' | 'arena' | 'workshop'

export type LeviLevelUp = { roleId: RoleId; level: 2 | 3; source: 'training' | 'arena'; sessionId?: string }

export function savedLevelUp(before: ProgressionState, updated: ProgressionState, saved: ProgressionState, roleId: RoleId): 2 | 3 | null {
  if (saved.roles[roleId].xp !== updated.roles[roleId].xp || saved.roles[roleId].xp <= before.roles[roleId].xp) return null
  const previousLevel = getRoleProgress(before, roleId).level
  const nextLevel = getRoleProgress(saved, roleId).level
  return nextLevel > previousLevel && (nextLevel === 2 || nextLevel === 3) ? nextLevel : null
}

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
  const [leviLevelUp, setLeviLevelUp] = useState<LeviLevelUp | null>(null)
  const [workshopOrigin, setWorkshopOrigin] = useState<'home' | 'arena'>('home')
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
    setLeviLevelUp(null)
    setAppState((current) => ({ ...current, screen: 'role-selection' }))
  }

  function openTraining() {
    setLeviLevelUp(null)
    setAppState((current) => ({ ...current, screen: 'training' }))
  }

  function openWorkshop() {
    setLeviLevelUp(null)
    setWorkshopOrigin(appState.screen === 'arena' ? 'arena' : 'home')
    setAppState((current) => ({ ...current, screen: 'workshop' }))
  }

  function openArena() {
    setLeviLevelUp(null)
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
    const before = appStorage.getProgression()
    const { progression: updated, award } = applyArenaEvaluation(
      before, roleId, session, result,
    )
    appStorage.setProgression(updated)
    const level = savedLevelUp(before, updated, appStorage.getProgression(), roleId)
    if (level) setLeviLevelUp({ roleId, level, source: 'arena', sessionId: session.id })
    setProgression(updated)
    return award
  }

  function completeTraining(
    roleId: RoleId,
    result: TrainingResult,
    questions: TrainingQuestion[],
  ) {
    const before = appStorage.getProgression()
    const { progression: updated, award } = applyTrainingCompletion(
      progression,
      roleId,
      result,
      questions,
    )
    appStorage.setProgression(updated)
    const level = savedLevelUp(before, updated, appStorage.getProgression(), roleId)
    if (level) setLeviLevelUp({ roleId, level, source: 'training' })
    setProgression(updated)
    return award
  }

  function openHome() {
    setLeviLevelUp(null)
    setAppState((current) => ({ ...current, screen: 'home' }))
  }

  return {
    screen: appState.screen,
    workshopOrigin,
    selectedRole,
    progression,
    roleProgress,
    leviLevelUp,
    clearLeviLevelUp: () => setLeviLevelUp(null),
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
