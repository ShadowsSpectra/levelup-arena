import { isRoleId } from '../config/roles'
import type {
  QuestionDifficulty,
  QuestionType,
  TrainingQuestion,
} from '../types/training'

const questionTypes: QuestionType[] = [
  'choice',
  'continue_sentence',
  'find_mistake',
  'missing_fragment',
]

const difficulties: QuestionDifficulty[] = ['easy', 'medium', 'hard']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function getQuestionId(value: unknown, index: number) {
  if (isRecord(value) && isNonEmptyString(value.id)) {
    return value.id
  }

  return `index ${index}`
}

function getValidationError(value: unknown): string | null {
  if (!isRecord(value)) return 'question must be an object'

  const requiredStrings = ['id', 'role', 'type', 'skill', 'difficulty', 'question', 'explanation']
  const missingString = requiredStrings.find((field) => !isNonEmptyString(value[field]))
  if (missingString) return `field "${missingString}" must be a non-empty string`

  if (!isRoleId(value.role as string)) return `unknown role "${String(value.role)}"`
  if (!questionTypes.includes(value.type as QuestionType)) return `unknown type "${String(value.type)}"`
  if (!difficulties.includes(value.difficulty as QuestionDifficulty)) {
    return `unknown difficulty "${String(value.difficulty)}"`
  }

  if (!Number.isInteger(value.minLevel) || Number(value.minLevel) < 1) {
    return 'minLevel must be a positive integer'
  }

  if (!Array.isArray(value.answers) || value.answers.length < 2 || !value.answers.every(isNonEmptyString)) {
    return 'answers must contain at least two non-empty strings'
  }

  if (
    !Number.isInteger(value.correctAnswer) ||
    Number(value.correctAnswer) < 0 ||
    Number(value.correctAnswer) >= value.answers.length
  ) {
    return 'correctAnswer must point to an existing answer index'
  }

  if (typeof value.xp !== 'number' || value.xp < 0) return 'xp must be a non-negative number'
  if (typeof value.active !== 'boolean') return 'active must be a boolean'

  if (value.type === 'continue_sentence') {
    if (!isNonEmptyString(value.context) || !isNonEmptyString(value.sentenceStart)) {
      return 'continue_sentence requires context and sentenceStart'
    }
  }

  if (value.type === 'find_mistake' && !isNonEmptyString(value.dialogue)) {
    return 'find_mistake requires dialogue'
  }

  if (value.type === 'missing_fragment' && !isNonEmptyString(value.phraseTemplate)) {
    return 'missing_fragment requires phraseTemplate'
  }

  return null
}

export function validateQuestions(data: unknown): TrainingQuestion[] {
  if (!Array.isArray(data)) {
    if (import.meta.env.DEV) console.error('[Training content] Expected an array of questions.')
    return []
  }

  const validQuestions: TrainingQuestion[] = []
  const usedIds = new Set<string>()

  data.forEach((item, index) => {
    const id = getQuestionId(item, index)
    const error = getValidationError(item)

    if (error || usedIds.has(id)) {
      if (import.meta.env.DEV) {
        console.error(
          `[Training content] Invalid question "${id}": ${error ?? 'duplicate id'}`,
        )
      }
      return
    }

    usedIds.add(id)
    validQuestions.push(item as TrainingQuestion)
  })

  return validQuestions
}
