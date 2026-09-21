import type { RoleId } from '../config/roles'

export type QuestionType =
  | 'choice'
  | 'continue_sentence'
  | 'find_mistake'
  | 'missing_fragment'

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

type BaseQuestion<TType extends QuestionType> = {
  id: string
  role: RoleId
  type: TType
  skill: string
  difficulty: QuestionDifficulty
  minLevel: number
  question: string
  answers: string[]
  correctAnswer: number
  explanation: string
  xp: number
  active: boolean
}

export type ChoiceQuestion = BaseQuestion<'choice'>

export type ContinueSentenceQuestion = BaseQuestion<'continue_sentence'> & {
  context: string
  sentenceStart: string
}

export type FindMistakeQuestion = BaseQuestion<'find_mistake'> & {
  dialogue: string
}

export type MissingFragmentQuestion = BaseQuestion<'missing_fragment'> & {
  phraseTemplate: string
}

export type TrainingQuestion =
  | ChoiceQuestion
  | ContinueSentenceQuestion
  | FindMistakeQuestion
  | MissingFragmentQuestion

export type TrainingAnswer = {
  questionId: string
  selectedAnswer: number
  correct: boolean
}

export type TrainingResult = {
  score: number
  correctCount: number
  totalCount: number
  passed: boolean
  completed: boolean
  answers: TrainingAnswer[]
}
