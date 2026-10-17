import { useEffect, useReducer, useRef } from 'react'
import type { RoleId } from '../config/roles'
import { browserLeviTourStore, chooseLeviReaction, leviHomeStepOrder, scheduleLeviGreeting, scheduleLeviReaction, type LeviHomeStep, type LeviRoleReaction, type LeviTourStore } from '../services/leviTour'

type TourStatus = 'active' | 'reaction' | 'home' | 'final' | 'inactive' | 'completed' | 'skipped'
type TourState = { status: TourStatus; greeting: 0 | 1; reaction: LeviRoleReaction | null; homeStep: LeviHomeStep; run: number }
type TourEvent =
  | { type: 'advance-greeting' | 'continue' | 'skip' | 'arena-entered' | 'done' | 'suspend' }
  | { type: 'restart'; hasSelectedRole?: boolean }
  | { type: 'role-selected'; reaction: LeviRoleReaction }
  | { type: 'finish-reaction'; run: number }

export function createLeviTourState(viewed: boolean, hasSelectedRole = false): TourState {
  return { status: viewed ? 'inactive' : hasSelectedRole ? 'home' : 'active', greeting: 0, reaction: null, homeStep: 'level-xp', run: 0 }
}

export function shouldHighlightRoleCards(state: Pick<TourState, 'status' | 'greeting'>) {
  return state.status === 'active' && state.greeting === 1
}

export function reduceLeviTour(state: TourState, event: TourEvent): TourState {
  switch (event.type) {
    case 'restart': return { ...createLeviTourState(false, event.hasSelectedRole), run: state.run + 1 }
    case 'advance-greeting': return state.status === 'active' ? { ...state, greeting: 1 } : state
    case 'role-selected': return state.status === 'active'
      ? { ...state, status: 'reaction', reaction: event.reaction } : state
    case 'finish-reaction': return state.status === 'reaction' && state.run === event.run
      ? { ...state, status: 'home', homeStep: 'level-xp' } : state
    case 'continue': {
      if (state.status === 'reaction') return { ...state, status: 'home', homeStep: 'level-xp' }
      if (state.status !== 'home') return state
      const next = leviHomeStepOrder[leviHomeStepOrder.indexOf(state.homeStep) + 1]
      return next ? { ...state, homeStep: next } : { ...state, status: 'final' }
    }
    case 'arena-entered': return state.status === 'home' || state.status === 'reaction'
      ? { ...state, status: 'final' } : state
    case 'done': return state.status === 'final' ? { ...state, status: 'completed' } : state
    case 'suspend': return { ...state, status: 'inactive', reaction: null }
    case 'skip': return ['active', 'reaction', 'home', 'final'].includes(state.status)
      ? { ...state, status: 'skipped', reaction: null } : state
  }
}

export function useLeviTour(store: LeviTourStore = browserLeviTourStore, initialRole: RoleId | null = null) {
  const [state, dispatch] = useReducer(reduceLeviTour, { store, initialRole }, (current) => createLeviTourState(current.store.hasViewed(), Boolean(current.initialRole)))
  const previousReactions = useRef<Partial<Record<RoleId, number>>>({})

  useEffect(() => {
    if (state.status !== 'active' || state.greeting !== 0) return
    return scheduleLeviGreeting(() => dispatch({ type: 'advance-greeting' }))
  }, [state.status, state.greeting, state.run])

  useEffect(() => scheduleLeviReaction(state.status, () => dispatch({ type: 'finish-reaction', run: state.run })),
    [state.status, state.run])

  function finish(type: 'done' | 'skip') {
    if (type === 'done' ? state.status !== 'final' : !['active', 'reaction', 'home', 'final'].includes(state.status)) return
    store.markViewed()
    dispatch({ type })
  }

  return {
    ...state,
    highlightRoles: shouldHighlightRoleCards(state),
    skip: () => finish('skip'),
    // Both the timer and this render's button finish only this reaction, never the next lesson.
    continue: () => dispatch(state.status === 'reaction' ? { type: 'finish-reaction', run: state.run } : { type: 'continue' }),
    done: () => finish('done'),
    enterArena: () => dispatch({ type: 'arena-entered' }),
    suspend: () => dispatch({ type: 'suspend' }),
    advanceGreeting: () => dispatch({ type: 'advance-greeting' }),
    recordRoleSelection(roleId: RoleId) {
      if (state.status !== 'active') return
      const reaction = chooseLeviReaction(roleId, previousReactions.current[roleId])
      previousReactions.current[roleId] = reaction.index
      dispatch({ type: 'role-selected', reaction })
    },
    restart: (hasSelectedRole = false) => dispatch({ type: 'restart', hasSelectedRole }),
  }
}
