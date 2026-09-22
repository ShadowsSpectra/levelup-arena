import { useEffect, useRef, useState } from 'react'
import type { RoleId } from '../config/roles'
import type { CharacterSource, ScenarioSource } from '../content/arenaSources'
import { getArenaOptions, type ArenaOption } from '../services/arenaCatalog'
import { addOpponentReply, addPlayerMessage, createArenaSession, endArenaSession } from '../services/arenaSession'
import type { OpponentService } from '../services/opponentService'
import type { ArenaSession } from '../types/arena'

type ArenaStep = 'selection' | 'negotiation' | 'result'

export function useArenaFlow(
  roleId: RoleId,
  characterSource: CharacterSource,
  scenarioSource: ScenarioSource,
  opponentService: OpponentService,
) {
  const [options, setOptions] = useState<ArenaOption[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [step, setStep] = useState<ArenaStep>('selection')
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [session, setSession] = useState<ArenaSession | null>(null)
  const [replyError, setReplyError] = useState(false)
  const busy = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    let active = true
    getArenaOptions(roleId, characterSource, scenarioSource)
      .then((loaded) => { if (active) setOptions(loaded) })
      .catch((error) => {
        if (import.meta.env.DEV) console.error('[Arena] Failed to load content.', error)
        if (active) setLoadError(true)
      })
    return () => { active = false; generation.current += 1 }
  }, [roleId, characterSource, scenarioSource])

  const selected = options?.find(({ scenario, character }) =>
    scenario.id === selectedScenarioId && character.id === selectedCharacterId,
  ) ?? null

  function chooseCharacter(id: string) {
    if (!options?.some(({ character }) => character.id === id)) return
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
    if (!selected) return
    setSession(createArenaSession(
      selected.scenario.id, selected.character.id, selected.scenario.openingMessage,
    ))
    setReplyError(false)
    setStep('negotiation')
  }

  async function send(text: string): Promise<boolean> {
    if (!selected || !session || busy.current) return false
    const pending = addPlayerMessage(session, text, selected.scenario.maxTurns)
    if (pending === session) return false
    busy.current = true
    const requestGeneration = generation.current
    setSession(pending)
    setReplyError(false)
    try {
      const reply = await opponentService.reply({
        character: selected.character, scenario: selected.scenario, session: pending,
      })
      if (requestGeneration === generation.current) {
        setSession(addOpponentReply(pending, reply, selected.scenario.maxTurns))
      }
      return true
    } catch (error) {
      if (import.meta.env.DEV) console.error('[Arena] Opponent reply failed.', error)
      if (requestGeneration === generation.current) {
        setSession(session)
        setReplyError(true)
      }
      return false
    } finally {
      busy.current = false
    }
  }

  function finish() {
    if (!session || session.status === 'responding') return
    setSession(endArenaSession(session))
    setStep('result')
  }

  function backToSelection() {
    generation.current += 1
    setSelectedCharacterId(null)
    setSelectedScenarioId(null)
    setSession(null)
    setStep('selection')
  }

  return {
    options, loadError, step, selectedCharacterId, selectedScenarioId,
    selected, session, replyError,
    chooseCharacter, chooseScenario, start, send, finish, backToSelection,
  }
}
