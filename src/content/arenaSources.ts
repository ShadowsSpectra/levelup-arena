import type { PublicCharacter, PublicScenario, PublicArenaContent } from '../types/arena'

export interface CharacterSource {
  getCharacters(): Promise<PublicCharacter[]>
}

export interface ScenarioSource {
  getScenarios(): Promise<PublicScenario[]>
}

// Share one catalog request between both sources. A failed request is retryable.
let catalog: Promise<PublicArenaContent> | null = null

function getPublicCatalog(): Promise<PublicArenaContent> {
  if (!catalog) {
    catalog = fetch('/api/ai/arena-content', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить сценарии.')
        const content = await response.json() as PublicArenaContent
        if (!Array.isArray(content?.characters) || !Array.isArray(content?.scenarios)) {
          throw new Error('Некорректный каталог Arena.')
        }
        return content
      })
      .catch((error) => { catalog = null; throw error })
  }
  return catalog
}

export const localCharacterSource: CharacterSource = {
  async getCharacters() { return (await getPublicCatalog()).characters },
}

export const localScenarioSource: ScenarioSource = {
  async getScenarios() { return (await getPublicCatalog()).scenarios },
}
