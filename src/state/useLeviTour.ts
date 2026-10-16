import { useEffect, useReducer, useRef } from 'react'
import type { RoleId } from '../config/roles'
import { browserLeviTourStore, chooseLeviReaction, scheduleLeviGreeting, type LeviRoleReaction, type LeviTourStore } from '../services/leviTour'

type TourStatus = 'active' | 'reaction' | 'inactive' | 'completed' | 'skipped'
type TourState = { status: TourStatus; greeting: 0 | 1; reaction: LeviRoleReaction | null; run: number }
type TourEvent =
  | { type: 'advance-greeting' | 'restart' | 'continue' | 'skip' }
  | { type: 'role-selected'; reaction: LeviRoleReaction }

export function createLeviTourState(viewed: boolean): TourState {
  return { status: viewed ? 'inactive' : 'active', greeting: 0, reaction: null, run: 0 }
}

export function shouldHighlightRoleCards(state: Pick<TourState, 'status' | 'greeting'>) {
  return state.status === 'active' && state.greeting === 1
}

export function reduceLeviTour(state: TourState, event: TourEvent): TourState {
  switch (event.type) {
    case 'restart': return { status: 'active', greeting: 0, reaction: null, run: state.run + 1 }
    case 'advance-greeting': return state.status === 'active' ? { ...state, greeting: 1 } : state
    case 'role-selected': return state.status === 'active' || state.status === 'reaction'
      ? { ...state, status: 'reaction', reaction: event.reaction } : state
    case 'continue': return state.status === 'reaction' ? { ...state, status: 'completed' } : state
    case 'skip': return state.status === 'active' || state.status === 'reaction'
      ? { ...state, status: 'skipped' } : state
  }
}

export function useLeviTour(store: LeviTourStore = browserLeviTourStore) {
  const [state, dispatch] = useReducer(reduceLeviTour, store, (current) => createLeviTourState(current.hasViewed()))
  const previousReactions = useRef<Partial<Record<RoleId, number>>>({})

  useEffect(() => {
    if (state.status !== 'active' || state.greeting !== 0) return
    return scheduleLeviGreeting(() => dispatch({ type: 'advance-greeting' }))
  }, [state.status, state.greeting, state.run])

  function finish(type: 'continue' | 'skip') {
    if (type === 'continue' ? state.status !== 'reaction' : state.status !== 'active' && state.status !== 'reaction') return
    store.markViewed()
    dispatch({ type })
  }

  return {
    ...state,
    highlightRoles: shouldHighlightRoleCards(state),
    skip: () => finish('skip'),
    continue: () => finish('continue'),
    advanceGreeting: () => dispatch({ type: 'advance-greeting' }),
    recordRoleSelection(roleId: RoleId) {
      if (state.status !== 'active' && state.status !== 'reaction') return
      const reaction = chooseLeviReaction(roleId, previousReactions.current[roleId])
      previousReactions.current[roleId] = reaction.index
      dispatch({ type: 'role-selected', reaction })
    },
    restart: () => dispatch({ type: 'restart' }),
  }
}
