import type { Character, Scenario, ArenaSession } from '../../src/types/arena'
import {
  arenaCriterionIds,
  type ArenaCriterionEvaluation,
  type ArenaEvaluation,
  type ArenaMainInsight,
  type ArenaOutcome,
  type ArenaSemanticFacts,
} from '../../src/types/arenaEvaluation'

export class EvaluationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EvaluationValidationError'
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function text(value: unknown, field: string, maximum = Number.POSITIVE_INFINITY): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new EvaluationValidationError(`Invalid ${field}.`)
  }
  return value.trim()
}

const playerVerbForms: Readonly<Record<string, string>> = {
  сделал: 'сделали', задал: 'задали', предложил: 'предложили', спросил: 'спросили',
  уточнил: 'уточнили', начал: 'начали', выяснил: 'выяснили', выясняет: 'выясняете',
  использовал: 'использовали', отметил: 'отметили', показал: 'показали',
}

function normalizeEvaluatorProse(value: string): string {
  const possessiveNouns: Readonly<Record<string, string>> = {
    question: 'вопрос', proposal: 'предложение', argument: 'аргумент',
    response: 'ответ', answer: 'ответ', message: 'реплика', approach: 'подход',
  }
  const possessive = value.replace(
    /\b(?:PLAYER|user)['’]s\s+(question|proposal|argument|response|answer|message|approach)\b/gi,
    (_match, noun: string) => `Ваш ${possessiveNouns[noun.toLowerCase()]}`,
  )
  const roles = possessive
    .replace(/\b(?:PLAYER|user)['’]s\b/gi, 'ваш')
    .replace(/\b(?:PLAYER|user)\b/gi, 'Вы')
    .replace(/\b(?:OPPONENT|assistant)\b/gi, 'оппонент')
    .replace(/\bsystem\b/gi, 'система')
  return roles.replace(
    /((?:Вы|вы)(?:\s+\p{L}+){0,2}\s+)(сделал|задал|предложил|спросил|уточнил|начал|выяснил|выясняет|использовал|отметил|показал)(?!\p{L})/giu,
    (_match, prefix: string, verb: string) => `${prefix}${playerVerbForms[verb.toLowerCase()]}`,
  )
}

function userFacingText(value: unknown, field: string): string {
  const checked = text(value, field)
  return normalizeEvaluatorProse(checked)
}

function userFacingTextList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new EvaluationValidationError(`Invalid ${field}.`)
  }
  return value.slice(0, 3).map((item, index) => userFacingText(item, `${field}[${index}]`))
}

function playerEvidence(value: unknown, field: string, playerMessages: string[]): string {
  const evidence = text(value, field, 300)
  if (!playerMessages.some((message) => message.includes(evidence))) {
    throw new EvaluationValidationError(`${field} must be an exact fragment from a player message.`)
  }
  return evidence
}

function mainInsight(value: unknown, playerMessages: string[]): ArenaMainInsight {
  if (!record(value) || !exactKeys(value, ['evidence', 'insight'])) {
    throw new EvaluationValidationError('Invalid mainInsight structure.')
  }
  const evidence = playerEvidence(value.evidence, 'mainInsight.evidence', playerMessages)
  const insight = userFacingText(value.insight, 'mainInsight.insight')
  return { evidence, insight }
}

function criterion(value: unknown, id: string, playerMessages: string[]): ArenaCriterionEvaluation {
  if (!record(value) || !exactKeys(value, ['score', 'evidence', 'reason'])) {
    throw new EvaluationValidationError(`Invalid scores.${id}.`)
  }
  if (!Number.isInteger(value.score) || Number(value.score) < 0 || Number(value.score) > 100) {
    throw new EvaluationValidationError(`Invalid scores.${id}.score.`)
  }
  const evidence = playerEvidence(value.evidence, `scores.${id}.evidence`, playerMessages)
  return { score: Number(value.score), evidence, reason: userFacingText(value.reason, `scores.${id}.reason`) }
}

function semanticFacts(value: unknown): ArenaSemanticFacts {
  const keys = [
    'concreteMutualAgreement', 'playerMinimumSatisfied',
    'opponentMinimumSatisfied', 'criticalRedLineViolated',
  ] as const
  if (!record(value) || !exactKeys(value, keys) || keys.some((key) => typeof value[key] !== 'boolean')) {
    throw new EvaluationValidationError('Invalid semantic facts.')
  }
  return value as ArenaSemanticFacts
}

export function deriveArenaOutcome(facts: ArenaSemanticFacts): ArenaOutcome {
  const status = !facts.concreteMutualAgreement
    ? 'NO_AGREEMENT'
    : !facts.playerMinimumSatisfied || !facts.opponentMinimumSatisfied || facts.criticalRedLineViolated
      ? 'BAD_AGREEMENT'
      : 'SUCCESS'
  return { status, bossDefeated: status === 'SUCCESS' }
}

function protectsHiddenData(result: unknown, character: Character, scenario: Scenario) {
  const serialized = JSON.stringify(result).toLocaleLowerCase()
  const hidden = [
    ...character.privateInformation,
    scenario.hiddenData.opponentGoal,
    ...scenario.hiddenData.discoverableFacts.map(({ fact }) => fact),
  ]
  return hidden.every((secret) => !serialized.includes(secret.trim().toLocaleLowerCase()))
}

export function parseArenaEvaluation(
  raw: string,
  context: { character: Character; scenario: Scenario; session: ArenaSession },
): ArenaEvaluation {
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new EvaluationValidationError('Evaluator returned malformed JSON.') }
  const rootKeys = ['facts', 'scores', 'strengths', 'improvements', 'mainInsight']
  if (!record(value) || !exactKeys(value, rootKeys)) {
    throw new EvaluationValidationError('Evaluator result has an invalid structure.')
  }
  if (!protectsHiddenData(value, context.character, context.scenario)) {
    throw new EvaluationValidationError('Evaluator result exposes hidden Arena data.')
  }
  if (!record(value.scores) || !exactKeys(value.scores, arenaCriterionIds)) {
    throw new EvaluationValidationError('Evaluator scores must contain exactly five criteria.')
  }
  const scoreValues = value.scores
  const facts = semanticFacts(value.facts)
  const playerMessages = context.session.messages
    .filter(({ speaker }) => speaker === 'player')
    .map(({ text: message }) => message)
  const scores = Object.fromEntries(arenaCriterionIds.map((id) => [
    id, criterion(scoreValues[id], id, playerMessages),
  ])) as ArenaEvaluation['scores']
  const values = arenaCriterionIds.map((id) => scores[id].score)
  if (values.every((score) => score <= 10) && values.some((score) => score > 0)) {
    throw new EvaluationValidationError('Criterion scores appear to use a 1–5 or 1–10 scale, not 0–100.')
  }
  const overallScore = Math.round(
    values.reduce((total, score) => total + score, 0) / values.length,
  )
  const result: ArenaEvaluation = {
    facts, outcome: deriveArenaOutcome(facts), scores, overallScore,
    strengths: userFacingTextList(value.strengths, 'strengths'),
    improvements: userFacingTextList(value.improvements, 'improvements'),
    mainInsight: mainInsight(value.mainInsight, playerMessages),
  }
  if (!protectsHiddenData(result, context.character, context.scenario)) {
    throw new EvaluationValidationError('Evaluator result exposes hidden Arena data.')
  }
  return result
}
