export const arenaCriterionIds = [
  'interestsDiscovery',
  'objectionHandling',
  'communicationAdaptability',
  'argumentation',
  'initiative',
] as const

export type ArenaCriterionId = typeof arenaCriterionIds[number]
export type ArenaOutcomeType = 'SUCCESS' | 'NO_AGREEMENT' | 'BAD_AGREEMENT'

export type ArenaSemanticFacts = {
  concreteMutualAgreement: boolean
  playerMinimumSatisfied: boolean
  opponentMinimumSatisfied: boolean
  criticalRedLineViolated: boolean
}

export type ArenaOutcome = {
  status: ArenaOutcomeType
  bossDefeated: boolean
}

export type ArenaCriterionEvaluation = {
  score: number
  evidence: string
  reason: string
}

export type ArenaMainInsight = {
  evidence: string
  insight: string
}

export type ArenaEvaluation = {
  facts: ArenaSemanticFacts
  outcome: ArenaOutcome
  scores: Record<ArenaCriterionId, ArenaCriterionEvaluation>
  overallScore: number
  strengths: string[]
  improvements: string[]
  mainInsight: ArenaMainInsight
}
