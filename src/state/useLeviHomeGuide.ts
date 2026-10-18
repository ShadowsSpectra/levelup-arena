import { useEffect, useReducer, useRef } from 'react'
import type { RoleId } from '../config/roles'
import { chooseLeviReaction, leviHomeStepOrder, scheduleLeviReaction, type LeviHomeStep, type LeviRoleReaction } from '../services/leviTour'
import { appStorage } from '../services/storage'

type HomeGuideState = { status: 'reaction' | 'home' | 'completed'; step: LeviHomeStep; reaction: LeviRoleReaction | null }
type HomeGuideEvent =
  | { type: 'role-selected'; reaction: LeviRoleReaction }
  | { type: 'finish-reaction' | 'next' | 'finish' | 'leave-home' }

export function initialLeviHomeGuideState(completed: boolean): HomeGuideState {
  return { status: completed ? 'completed' : 'home', step: 'level-xp', reaction: null }
}

export function reduceLeviHomeGuide(state: HomeGuideState, event: HomeGuideEvent): HomeGuideState {
  if (state.status === 'completed') return state
  switch (event.type) {
    case 'role-selected': return { ...state, status: 'reaction', reaction: event.reaction, step: 'level-xp' }
    case 'finish-reaction': return state.status === 'reaction' ? { ...state, status: 'home', reaction: null } : state
    case 'next': {
      if (state.status !== 'home') return state
      const next = leviHomeStepOrder[leviHomeStepOrder.indexOf(state.step) + 1]
      return next ? { ...state, step: next } : state
    }
    case 'leave-home': return state.status === 'reaction' ? { ...state, status: 'home', reaction: null } : state
    case 'finish': return { ...state, status: 'completed', reaction: null }
  }
}

export function useLeviHomeGuide(isHome: boolean) {
  const [state, dispatch] = useReducer(reduceLeviHomeGuide, undefined,
    () => initialLeviHomeGuideState(appStorage.hasCompletedLeviHomeGuide()))
  const previous = useRef<Partial<Record<RoleId, number>>>({})

  useEffect(() => {
    if (!isHome) return
    return scheduleLeviReaction(state.status, () => dispatch({ type: 'finish-reaction' }))
  }, [isHome, state.status])

  useEffect(() => {
    if (!isHome) dispatch({ type: 'leave-home' })
  }, [isHome])

  function finish() {
    if (state.status === 'completed') return
    appStorage.setLeviHomeGuideComplete()
    dispatch({ type: 'finish' })
  }

  return {
    ...state,
    selectOnboardingRole(roleId: RoleId) {
      if (state.status === 'completed') return
      const reaction = chooseLeviReaction(roleId, previous.current[roleId])
      previous.current[roleId] = reaction.index
      dispatch({ type: 'role-selected', reaction })
    },
    next() {
      if (state.status === 'reaction') dispatch({ type: 'finish-reaction' })
      else if (state.step === 'arena') finish()
      else dispatch({ type: 'next' })
    },
    finish,
  }
}
