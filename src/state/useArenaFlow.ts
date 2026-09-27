import { useEffect, useRef, useState } from 'react'
import type { RoleId } from '../config/roles'
import type { CharacterSource, ScenarioSource } from '../content/arenaSources'
import { getArenaOptions, type ArenaOption } from '../services/arenaCatalog'
import { addOpponentReply, addPlayerMessage, createArenaSession, endArenaSession } from '../services/arenaSession'
import type { EvaluatorService } from '../services/evaluatorService'
import type { OpponentService } from '../services/opponentService'
import { sanitizeOpponentReply } from '../services/opponentReply'
import type { ArenaSession } from '../types/arena'
import type { PublicCharacter } from '../types/arena'
import type { ArenaEvaluation } from '../types/arenaEvaluation'
import type { ArenaAward } from '../services/progression'

type ArenaStep = 'selection' | 'negotiation' | 'result'
export const OPENING_TYPING_MS = 700
export const MIN_OPPONENT_TYPING_MS = 500

export function remainingOpponentTypingMs(
  startedAt: number,
  now = Date.now(),
  minimum = MIN_OPPONENT_TYPING_MS,
) {
  return Math.max(0, minimum - (now - startedAt))
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

export type ArenaEvaluationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: ArenaEvaluation; award: ArenaAward }
  | { status: 'error'; message: string }

export function useArenaFlow(
  roleId: RoleId,
  characterSource: CharacterSource,
  scenarioSource: ScenarioSource,
  opponentService: OpponentService,
  evaluatorService: EvaluatorService,
  onComplete: (session: ArenaSession) => void,
  onEvaluated: (session: ArenaSession, result: ArenaEvaluation) => ArenaAward,
  isCharacterUnlocked: (character: PublicCharacter) => boolean,
) {
  const [options, setOptions] = useState<ArenaOption[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [step, setStep] = useState<ArenaStep>('selection')
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [session, setSession] = useState<ArenaSession | null>(null)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [evaluation, setEvaluation] = useState<ArenaEvaluationState>({ status: 'idle' })
  const busy = useRef(false)
  const completionRecorded = useRef(false)
  const generation = useRef(0)
  const evaluationGeneration = useRef(0)
  const openingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearOpeningTimer() {
    if (openingTimer.current !== null) {
      clearTimeout(openingTimer.current)
      openingTimer.current = null
    }
  }

  useEffect(() => {
    let active = true
    getArenaOptions(roleId, characterSource, scenarioSource)
      .then((loaded) => { if (active) setOptions(loaded) })
      .catch((error) => {
        if (import.meta.env.DEV) console.error('[Arena] Failed to load content.', error)
        if (active) setLoadError(true)
      })
    return () => {
      active = false
      clearOpeningTimer()
      generation.current += 1
      evaluationGeneration.current += 1
    }
  }, [roleId, characterSource, scenarioSource])

  const selected = options?.find(({ scenario, character }) =>
    scenario.id === selectedScenarioId && character.id === selectedCharacterId,
  ) ?? null

  function chooseCharacter(id: string) {
    if (!options?.some(({ character }) => character.id === id && isCharacterUnlocked(character))) return
    generation.current += 1
    clearOpeningTimer()
    setIsOpening(false)
    setSelectedCharacterId(id)
    setSelectedScenarioId(null)
    setSession(null)
  }

  function chooseScenario(id: string) {
    if (!options?.some(({ scenario, character }) =>
      scenario.id === id && character.id === selectedCharacterId,
    )) return
    setSelectedScenarioId(id)
  }

  function start() {
    if (!selected || !isCharacterUnlocked(selected.character)) return
    clearOpeningTimer()
    const openingGeneration = ++generation.current
    setSession(createArenaSession(
      selected.scenario.id, selected.character.id, selected.scenario.openingMessage,
    ))
    setIsOpening(true)
    openingTimer.current = window.setTimeout(() => {
      if (openingGeneration === generation.current) setIsOpening(false)
      openingTimer.current = null
    }, OPENING_TYPING_MS)
    setReplyError(null)
    evaluationGeneration.current += 1
    setEvaluation({ status: 'idle' })
    completionRecorded.current = false
    setStep('negotiation')
  }

  async function evaluate(completed: ArenaSession) {
    if (!selected) return
    const requestGeneration = ++evaluationGeneration.current
    setEvaluation({ status: 'loading' })
    try {
      const result = await evaluatorService.evaluate({
        character: selected.character,
        scenario: selected.scenario,
        session: completed,
      })
      if (requestGeneration === evaluationGeneration.current) {
        const award = onEvaluated(completed, result)
        setEvaluation({ status: 'success', result, award })
      }
    } catch (error) {
      if (requestGeneration === evaluationGeneration.current) {
        setEvaluation({
          status: 'error',
          message: error instanceof Error ? error.message : 'Не удалось получить оценку. Попробуйте ещё раз.',
        })
      }
    }
  }

  async function send(text: string): Promise<boolean> {
    if (!selected || !session || busy.current || isOpening) return false
    const pending = addPlayerMessage(session, text, selected.scenario.maxTurns)
    if (pending === session) return false
    busy.current = true
    const requestGeneration = generation.current
    const requestStartedAt = Date.now()
    setSession(pending)
    setReplyError(null)
    try {
      const reply = await opponentService.reply({
        character: selected.character, scenario: selected.scenario, session: pending,
      })
      const remainingTyping = remainingOpponentTypingMs(requestStartedAt)
      if (remainingTyping > 0) await wait(remainingTyping)
      if (requestGeneration === generation.current) {
        setSession(addOpponentReply(pending, sanitizeOpponentReply(reply, selected.character.name), selected.scenario.maxTurns))
      }
      return true
    } catch (error) {
      if (requestGeneration === generation.current) {
        setSession(session)
        setReplyError(error instanceof Error ? error.message : 'AI недоступен. Повторите отправку.')
      }
      return false
    } finally {
      busy.current = false
    }
  }

  function finish() {
    if (!session || session.currentTurn === 0 || isOpening || session.status === 'responding' || completionRecorded.current) return
    completionRecorded.current = true
    const completed = endArenaSession(session)
    onComplete(completed)
    setSession(completed)
    setStep('result')
    void evaluate(completed)
  }

  function retryEvaluation() {
    if (session?.status === 'completed') void evaluate(session)
  }

  function backToSelection() {
    generation.current += 1
    clearOpeningTimer()
    setIsOpening(false)
    setSelectedCharacterId(null)
    setSelectedScenarioId(null)
    setSession(null)
    evaluationGeneration.current += 1
    setEvaluation({ status: 'idle' })
    setStep('selection')
  }

  return {
    options, loadError, step, selectedCharacterId, selectedScenarioId,
    selected, session, replyError, isOpening, evaluation,
    chooseCharacter, chooseScenario, start, send, finish, retryEvaluation, backToSelection,
  }
}
