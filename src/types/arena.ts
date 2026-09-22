import type { RoleId } from '../config/roles'

export type Character = {
  id: string
  unlockRequirements?: { minLevel?: number; previousBossId?: string }
  name: string
  role: string
  avatar?: string
  difficulty: number
  personality: string[]
  communicationStyle: string
  cooperativeness: 'low' | 'medium' | 'high'
  pressure: 'low' | 'medium' | 'high'
  goal: string
  position: string
  interests: string[]
  constraints: string[]
  privateInformation: string[]
  redLines: string[]
  possibleConcessions: string[]
  batna: string
  behavior: string[]
}

export type Scenario = {
  id: string
  title: string
  playerRole: RoleId
  category: string
  recommendedLevel: number
  maxTurns: number
  openingMessage: string
  characterId: string
  playerBrief: {
    situation: string
    playerGoal: string
    knownInformation: string[]
  }
  hiddenData: {
    opponentGoal: string
    discoverableFacts: { id: string; fact: string }[]
  }
  successConditions: {
    playerMinimumConditions: string[]
    opponentMinimumConditions: string[]
    agreementRequirements: string[]
  }
  validAgreementPaths: string[]
  badAgreementExamples: string[]
}

export type ArenaMessage = {
  id: string
  speaker: 'player' | 'opponent'
  text: string
}

export type ArenaSession = {
  id: string
  scenarioId: string
  characterId: string
  messages: ArenaMessage[]
  currentTurn: number
  status: 'negotiating' | 'responding' | 'turn-limit' | 'completed'
}
