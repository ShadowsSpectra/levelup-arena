import { useEffect, useRef, useState } from 'react'
import type { RoleId } from '../config/roles'
import type { CharacterSource, ScenarioSource } from '../content/arenaSources'
import { getArenaOptions, type ArenaOption } from '../services/arenaCatalog'
import { addOpponentReply, addPlayerMessage, createArenaSession, endArenaSession } from '../services/arenaSession'
import type { EvaluatorService } from '../services/evaluatorService'
import type { OpponentService } from '../services/opponentService'
import type { ArenaSession } from '../types/arena'
import type { Character } from '../types/arena'
import type { ArenaEvaluation } from '../types/arenaEvaluation'
import type { ArenaAward } from '../services/progression'

type ArenaStep = 'selection' | 'negotiation' | 'result'
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
  isCharacterUnlocked: (character: Character) => boolean,
) {
  const [options, setOptions] = useState<ArenaOption[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [step, setStep] = useState<ArenaStep>('selection')
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [session, setSession] = useState<ArenaSession | null>(null)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<ArenaEvaluationState>({ status: 'idle' })
  const busy = useRef(false)
  const completionRecorded = useRef(false)
  const generation = useRef(0)
  const evaluationGeneration = useRef(0)

  useEffect(() => {
    let active = true
    getArenaOptions(roleId, characterSource, scenarioSource)
      .then((loaded) => { if (active) setOptions(loaded) })
      .catch((error) => {
        if (import.meta.env.DEV) console.error('[Arena] Failed to load content.', error)
        if (active) setLoadError(true)
      })
    return () => { active = false; generation.current += 1; evaluationGeneration.current += 1 }
  }, [roleId, characterSource, scenarioSource])

  const selected = options?.find(({ scenario, character }) =>
    scenario.id === selectedScenarioId && character.id === selectedCharacterId,
  ) ?? null

  function chooseCharacter(id: string) {
    if (!options?.some(({ character }) => character.id === id && isCharacterUnlocked(character))) return
    generation.current += 1
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
    setSession(createArenaSession(
      selected.scenario.id, selected.character.id, selected.scenario.openingMessage,
    ))
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
    if (!selected || !session || busy.current) return false
    const pending = addPlayerMessage(session, text, selected.scenario.maxTurns)
    if (pending === session) return false
    busy.current = true
    const requestGeneration = generation.current
    setSession(pending)
    setReplyError(null)
    try {
      const reply = await opponentService.reply({
        character: selected.character, scenario: selected.scenario, session: pending,
      })
      if (requestGeneration === generation.current) {
        setSession(addOpponentReply(pending, reply, selected.scenario.maxTurns))
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
    if (!session || session.status === 'responding' || completionRecorded.current) return
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
    setSelectedCharacterId(null)
    setSelectedScenarioId(null)
    setSession(null)
    evaluationGeneration.current += 1
    setEvaluation({ status: 'idle' })
    setStep('selection')
  }

  return {
    options, loadError, step, selectedCharacterId, selectedScenarioId,
    selected, session, replyError, evaluation,
    chooseCharacter, chooseScenario, start, send, finish, retryEvaluation, backToSelection,
  }
}
