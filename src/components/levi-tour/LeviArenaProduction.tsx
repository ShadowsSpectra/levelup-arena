import { useEffect, useReducer, type RefObject } from 'react'
import {
  earlyOpponentComment, isEarlyOpponentSelection, nextLeviArenaStep, readLeviArenaSnapshot,
  reconcileLeviArenaStep, type LeviArenaSnapshot, type LeviArenaStatus, type LeviArenaStep,
} from '../../services/leviArenaTour'
import { appStorage } from '../../services/storage'
import { LeviArenaGuide } from './LeviArenaGuide'
import { LeviSpotlight } from './LeviSpotlight'

type Targets = Record<LeviArenaStep, boolean>
type ArenaGuideState = {
  step: LeviArenaStatus
  snapshot: LeviArenaSnapshot | null
  targets: Targets | null
  earlyOpponentChoice: boolean
}
type Event =
  | { type: 'observed'; snapshot: LeviArenaSnapshot; targets: Targets }
  | { type: 'early-click' }
  | { type: 'next'; snapshot: LeviArenaSnapshot }
  | { type: 'finish' }

export function initialArenaGuideState(completed: boolean): ArenaGuideState {
  return { step: completed ? 'inactive' : 'opponents', snapshot: null, targets: null, earlyOpponentChoice: false }
}

export function reduceArenaGuide(state: ArenaGuideState, event: Event): ArenaGuideState {
  if (state.step === 'inactive' || state.step === 'completed' || state.step === 'skipped') return state
  switch (event.type) {
    case 'observed': {
      const step = reconcileLeviArenaStep(state.step, event.snapshot)
      if (step === state.step && state.snapshot &&
        Object.keys(event.snapshot).every((key) => state.snapshot?.[key as keyof LeviArenaSnapshot] === event.snapshot[key as keyof LeviArenaSnapshot]) &&
        state.targets && Object.keys(event.targets).every((key) => state.targets?.[key as LeviArenaStep] === event.targets[key as LeviArenaStep])) return state
      return { ...state, step, snapshot: event.snapshot, targets: event.targets }
    }
    case 'early-click':
      return isEarlyOpponentSelection(state.step) ? { ...state, earlyOpponentChoice: true } : state
    case 'next':
      return { ...state, step: nextLeviArenaStep(state.step, event.snapshot), snapshot: event.snapshot }
    case 'finish':
      return { ...state, step: 'completed', earlyOpponentChoice: false }
  }
}

export function readArenaGuideTargets(root: HTMLElement): Targets {
  const available = Boolean(root.querySelector('.arena-opponent-card:not([disabled])'))
  return {
    opponents: available,
    locked: Boolean(root.querySelector('.arena-opponent-card[disabled]')),
    chooseOpponent: available,
    chooseScenario: Boolean(root.querySelector('.arena-scenario-card')),
    briefing: Boolean(root.querySelector('.arena-selected-brief')),
  }
}

export function observeArenaGuide(root: HTMLElement, observe: (snapshot: LeviArenaSnapshot, targets: Targets) => void,
  earlyClick: () => void) {
  const refresh = () => observe(readLeviArenaSnapshot(root), readArenaGuideTargets(root))
  const observer = new MutationObserver(refresh)
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'disabled'] })
  const click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const card = event.target.closest<HTMLButtonElement>('.arena-opponent-card')
    if (card && !card.disabled && root.contains(card)) earlyClick()
  }
  root.addEventListener('click', click, true)
  refresh()
  return () => {
    observer.disconnect()
    root.removeEventListener('click', click, true)
  }
}

export function LeviArenaProduction({ root }: { root: RefObject<HTMLDivElement | null> }) {
  const [state, dispatch] = useReducer(reduceArenaGuide, undefined,
    () => initialArenaGuideState(appStorage.hasCompletedLeviArenaGuide()))
  const active = state.step !== 'inactive' && state.step !== 'completed' && state.step !== 'skipped'

  useEffect(() => {
    if (!active || !root.current) return
    return observeArenaGuide(root.current,
      (snapshot, targets) => dispatch({ type: 'observed', snapshot, targets }),
      () => dispatch({ type: 'early-click' }))
  }, [active, root])

  if (!active || !state.snapshot?.ready || !state.targets?.[state.step as LeviArenaStep]) return null

  function finish() {
    appStorage.setLeviArenaGuideComplete()
    dispatch({ type: 'finish' })
  }

  function next() {
    if (!root.current) return
    const snapshot = readLeviArenaSnapshot(root.current)
    // A real selection may have arrived before the observer's next render.
    // Catch up to that state before treating this click as another tour step.
    if (reconcileLeviArenaStep(state.step, snapshot) !== state.step) {
      dispatch({ type: 'observed', snapshot, targets: readArenaGuideTargets(root.current) })
      return
    }
    if (nextLeviArenaStep(state.step, snapshot) === 'completed') finish()
    else dispatch({ type: 'next', snapshot })
  }

  const step = state.step as LeviArenaStep
  return <>
    <LeviArenaGuide key={step} root={root} step={step} keepInViewport
      comment={step === 'chooseScenario' && state.earlyOpponentChoice ? earlyOpponentComment : undefined}
      onNext={next} onSkip={finish} />
    <LeviSpotlight root={root} />
  </>
}
