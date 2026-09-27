import type { RoleId } from '../config/roles'
import type { CharacterSource, ScenarioSource } from '../content/arenaSources'
import type { PublicCharacter, PublicScenario } from '../types/arena'

export type ArenaOption = { character: PublicCharacter; scenario: PublicScenario }

export async function getArenaOptions(
  roleId: RoleId,
  characterSource: CharacterSource,
  scenarioSource: ScenarioSource,
): Promise<ArenaOption[]> {
  const [characters, scenarios] = await Promise.all([
    characterSource.getCharacters(), scenarioSource.getScenarios(),
  ])
  const byId = new Map(characters.map((character) => [character.id, character]))
  return scenarios.flatMap((scenario) => {
    if (scenario.playerRole !== roleId) return []
    const character = byId.get(scenario.characterId)
    if (!character) {
      if (import.meta.env.DEV) {
        console.error(`[Arena content] Scenario "${scenario.id}" has no character "${scenario.characterId}".`)
      }
      return []
    }
    return [{ scenario, character }]
  })
}
