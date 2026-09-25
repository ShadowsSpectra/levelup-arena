import type { Character, Scenario, ArenaSession } from '../../src/types/arena'
import {
  arenaCriterionIds,
  type ArenaCriterionEvaluation,
  type ArenaEvaluation,
  type ArenaMainInsight,
  type ArenaOutcome,
  type ArenaSemanticFacts,
} from '../../src/types/arenaEvaluation'
import { getPlayerEvidenceMessages } from './evaluatorTranscript'

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
  уточнил: 'уточнили', начал: 'начали', выявил: 'выявили', выяснил: 'выяснили', выясняет: 'выясняете',
  использовал: 'использовали', отметил: 'отметили', показал: 'показали',
  проигнорировал: 'проигнорировали', учитывал: 'учитывали', адаптировался: 'адаптировались',
  исследовал: 'исследовали', проявил: 'проявили', спрашивает: 'спрашиваете',
  предлагает: 'предлагаете', адаптирует: 'адаптируете', обосновывает: 'обосновываете',
  обработал: 'обработали', адаптировал: 'адаптировали', предоставил: 'предоставили',
  продвинулся: 'продвинулись', углубил: 'углубили', связал: 'связали',
  должен: 'должны', пытается: 'пытаетесь', пытался: 'пытались',
  выяснял: 'выясняли', обосновал: 'обосновали',
}

function normalizeEvaluatorProse(value: string): string {
  const possessiveNouns: Readonly<Record<string, string>> = {
    question: 'вопрос', proposal: 'предложение', argument: 'аргумент',
    response: 'ответ', answer: 'ответ', message: 'реплика', approach: 'подход',
  }
  const possessive = value.replace(
    /(?<![\p{L}\p{N}])(?:[PРП][LЛ][AА][YУ][EЕ][RР]|user)['’]s\s+(question|proposal|argument|response|answer|message|approach)\b/giu,
    (_match, noun: string) => `Ваш ${possessiveNouns[noun.toLowerCase()]}`,
  )
  const roles = possessive
    .replace(/(?<![\p{L}\p{N}])(?:[PРП][LЛ][AА][YУ][EЕ][RР]|user)['’]s\b/giu, 'ваш')
    .replace(/(?<![\p{L}\p{N}])(?:[PРП][LЛ][AА][YУ][EЕ][RР]|user|игрок)(?![\p{L}\p{N}])/giu, 'Вы')
    .replace(/\b(?:OPPONENT|assistant)\b/gi, 'оппонент')
    .replace(/\bsystem\b/gi, 'система')
  return roles.replace(
    /((?:Вы|вы)(?:\s+\p{L}+){0,2}\s+)(сделал|задал|предложил|спросил|уточнил|начал|выявил|выяснил|выясняет|использовал|отметил|показал|проигнорировал|учитывал|адаптировался|исследовал|проявил|спрашивает|предлагает|адаптирует|обосновывает|обработал|адаптировал|предоставил|продвинулся|углубил|связал|должен|пытается|пытался|выяснял|обосновал)(?!\p{L})/giu,
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

function playerEvidence(value: unknown, field: string, playerMessages: Map<string, string>): string {
  if (typeof value !== 'string' || !/^P[1-9]\d*$/.test(value) || !playerMessages.has(value)) {
    throw new EvaluationValidationError(`${field} must reference a real player message ID.`)
  }
  return playerMessages.get(value)!
}

function isBareAcceptance(evidence: string): boolean {
  const words = evidence.toLocaleLowerCase().match(/\p{L}+/gu) ?? []
  return words.length > 0 && words.length <= 2 && words.every((word) =>
    ['да', 'согласен', 'согласна', 'ок', 'окей', 'хорошо', 'подходит', 'принимаю'].includes(word))
}

function isRepetitiveFiller(evidence: string): boolean {
  const words = evidence.toLocaleLowerCase().match(/\p{L}+/gu) ?? []
  return words.length >= 3 && new Set(words).size === 1
}

function validateEvidenceClaim(id: string, score: number, evidence: string, reason: string) {
  // These are narrow integrity checks, not a second semantic scorer.
  if (isBareAcceptance(evidence) &&
    /(?<![\p{L}\p{N}])Вы(?:\s+\p{L}+){0,2}\s+(?:предложили|инициировали|выдвинули|сформулировали|предлагаете)(?!\p{L})/iu.test(reason)) {
    throw new EvaluationValidationError(`scores.${id}.evidence does not support claimed player initiative.`)
  }
  if (id === 'argumentation' && score >= 61 && isRepetitiveFiller(evidence)) {
    throw new EvaluationValidationError('scores.argumentation.evidence does not support a good argumentation score.')
  }
}

function mainInsight(value: unknown, playerMessages: Map<string, string>): ArenaMainInsight {
  if (!record(value) || !exactKeys(value, ['evidenceMessageId', 'insight'])) {
    throw new EvaluationValidationError('Invalid mainInsight structure.')
  }
  const evidence = playerEvidence(value.evidenceMessageId, 'mainInsight.evidenceMessageId', playerMessages)
  const insight = userFacingText(value.insight, 'mainInsight.insight')
  return { evidence, insight }
}

function criterion(value: unknown, id: string, playerMessages: Map<string, string>): ArenaCriterionEvaluation {
  if (!record(value) || !exactKeys(value, ['score', 'evidenceMessageId', 'reason'])) {
    throw new EvaluationValidationError(`Invalid scores.${id}.`)
  }
  if (!Number.isInteger(value.score) || Number(value.score) < 0 || Number(value.score) > 100) {
    throw new EvaluationValidationError(`Invalid scores.${id}.score.`)
  }
  const evidence = playerEvidence(value.evidenceMessageId, `scores.${id}.evidenceMessageId`, playerMessages)
  const reason = userFacingText(value.reason, `scores.${id}.reason`)
  validateEvidenceClaim(id, Number(value.score), evidence, reason)
  return { score: Number(value.score), evidence, reason }
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
  const playerMessages = getPlayerEvidenceMessages(context.session)
  const scores = Object.fromEntries(arenaCriterionIds.map((id) => [
    id, criterion(scoreValues[id], id, playerMessages),
  ])) as ArenaEvaluation['scores']
  const values = arenaCriterionIds.map((id) => scores[id].score)
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
