import charactersData from './characters.json'
import scenariosData from './scenarios.json'
import { isRoleId } from '../../src/config/roles'
import type { Character, Scenario, PublicCharacter, PublicScenario, PublicArenaContent } from '../../src/types/arena'

export interface CharacterSource {
  getCharacters(): Promise<Character[]>
}

export interface ScenarioSource {
  getScenarios(): Promise<Scenario[]>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function warn(kind: string, id: string, reason: string) {
  if (import.meta.env.DEV) console.error(`[Arena content] Invalid ${kind} "${id}": ${reason}`)
}

function validateList<T>(
  data: unknown,
  kind: string,
  validate: (item: unknown) => item is T,
): T[] {
  if (!Array.isArray(data)) {
    warn(kind, 'root', 'expected an array')
    return []
  }
  const ids = new Set<string>()
  return data.flatMap((item, index) => {
    const id = isRecord(item) && isText(item.id) ? item.id : `index ${index}`
    if (!validate(item) || ids.has(id)) {
      warn(kind, id, ids.has(id) ? 'duplicate id' : 'invalid or missing fields')
      return []
    }
    ids.add(id)
    return [item]
  })
}

function isCharacter(value: unknown): value is Character {
  if (!isRecord(value)) return false
  return (
    ['id', 'name', 'role', 'communicationStyle', 'goal', 'position', 'batna'].every(
      (key) => isText(value[key]),
    ) &&
    (value.avatar === undefined || typeof value.avatar === 'string') &&
    (value.unlockRequirements === undefined || (
      isRecord(value.unlockRequirements) &&
      (value.unlockRequirements.minLevel === undefined || isPositiveInteger(value.unlockRequirements.minLevel)) &&
      (value.unlockRequirements.previousBossId === undefined || isText(value.unlockRequirements.previousBossId))
    )) &&
    isPositiveInteger(value.difficulty) &&
    ['low', 'medium', 'high'].includes(String(value.cooperativeness)) &&
    ['low', 'medium', 'high'].includes(String(value.pressure)) &&
    [
      'personality', 'interests', 'constraints', 'privateInformation',
      'redLines', 'possibleConcessions', 'behavior',
    ].every((key) => isTextList(value[key]))
  )
}

function isScenario(value: unknown): value is Scenario {
  if (!isRecord(value) || !isRecord(value.playerBrief) ||
      !isRecord(value.hiddenData) || !isRecord(value.successConditions)) return false
  const brief = value.playerBrief
  const hidden = value.hiddenData
  const success = value.successConditions
  return (
    ['id', 'title', 'category', 'characterId', 'openingMessage'].every((key) => isText(value[key])) &&
    isRoleId(typeof value.playerRole === 'string' ? value.playerRole : null) &&
    isPositiveInteger(value.recommendedLevel) && isPositiveInteger(value.maxTurns) &&
    isText(brief.situation) && isText(brief.playerGoal) && isTextList(brief.knownInformation) &&
    isText(hidden.opponentGoal) && Array.isArray(hidden.discoverableFacts) &&
    hidden.discoverableFacts.every((fact) => isRecord(fact) && isText(fact.id) && isText(fact.fact)) &&
    ['playerMinimumConditions', 'opponentMinimumConditions', 'agreementRequirements'].every(
      (key) => isTextList(success[key]),
    ) &&
    isTextList(value.validAgreementPaths) && isTextList(value.badAgreementExamples)
  )
}

const characters = validateList(charactersData, 'character', isCharacter)
const scenarios = validateList(scenariosData, 'scenario', isScenario)

export const fullCharacterSource: CharacterSource = {
  async getCharacters() { return characters },
}

export const fullScenarioSource: ScenarioSource = {
  async getScenarios() { return scenarios },
}

export function toPublicCharacter(character: Character): PublicCharacter {
  return {
    id: character.id, name: character.name, role: character.role,
    difficulty: character.difficulty, communicationStyle: character.communicationStyle,
    pressure: character.pressure,
    ...(character.unlockRequirements === undefined ? {} : {
      unlockRequirements: { ...character.unlockRequirements },
    }),
  }
}

export function toPublicScenario(scenario: Scenario): PublicScenario {
  return {
    id: scenario.id, title: scenario.title, playerRole: scenario.playerRole,
    category: scenario.category,
    maxTurns: scenario.maxTurns, openingMessage: scenario.openingMessage,
    characterId: scenario.characterId,
    playerBrief: {
      situation: scenario.playerBrief.situation,
      playerGoal: scenario.playerBrief.playerGoal,
      knownInformation: [...scenario.playerBrief.knownInformation],
    },
  }
}

export function getPublicArenaContent(): PublicArenaContent {
  return {
    characters: characters.map(toPublicCharacter),
    scenarios: scenarios.map(toPublicScenario),
  }
}

// Transitional adapter: keep the existing request envelope until Stage 2.
// Client card fields are not used as prompt context, even if a caller adds them.
export function resolveFullArenaCards(characterId: string, scenarioId: string) {
  const character = characters.find((item) => item.id === characterId)
  const scenario = scenarios.find((item) => item.id === scenarioId)
  if (!character || !scenario || scenario.characterId !== character.id) {
    throw new Error('Некорректная пара оппонента и сценария.')
  }
  return { character, scenario }
}
