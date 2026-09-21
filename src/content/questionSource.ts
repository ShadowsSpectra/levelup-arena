import questionsData from './questions.json'
import { validateQuestions } from './validateQuestions'
import type { TrainingQuestion } from '../types/training'

export interface QuestionSource {
  getQuestions(): Promise<TrainingQuestion[]>
}

const validatedQuestions = validateQuestions(questionsData)

export const localQuestionSource: QuestionSource = {
  async getQuestions() {
    return validatedQuestions
  },
}
