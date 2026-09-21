import type { RoleId } from '../config/roles'
import type { QuestionSource } from '../content/questionSource'
import type {
  TrainingAnswer,
  TrainingQuestion,
  TrainingResult,
} from '../types/training'

export const trainingQuestionCount = 5
export const trainingPassScore = 80

type CreateTrainingOptions = {
  role: RoleId
  level: number
  source: QuestionSource
  previousQuestionIds?: string[]
}

function shuffle<T>(items: T[]) {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[randomIndex]] = [result[randomIndex], result[index]]
  }

  return result
}

function hasSameSequence(questions: TrainingQuestion[], previousIds: string[]) {
  return (
    questions.length === previousIds.length &&
    questions.every((question, index) => question.id === previousIds[index])
  )
}

export async function createTraining({
  role,
  level,
  source,
  previousQuestionIds = [],
}: CreateTrainingOptions) {
  const allQuestions = await source.getQuestions()
  const availableQuestions = allQuestions.filter(
    (question) =>
      question.active && question.role === role && question.minLevel <= level,
  )

  const selectedQuestions = shuffle(availableQuestions).slice(0, trainingQuestionCount)

  if (selectedQuestions.length > 1 && hasSameSequence(selectedQuestions, previousQuestionIds)) {
    selectedQuestions.push(selectedQuestions.shift() as TrainingQuestion)
  }

  return selectedQuestions
}

export function createTrainingAnswer(
  question: TrainingQuestion,
  selectedAnswer: number,
): TrainingAnswer {
  return {
    questionId: question.id,
    selectedAnswer,
    correct: selectedAnswer === question.correctAnswer,
  }
}

export function createTrainingResult(answers: TrainingAnswer[]): TrainingResult {
  const totalCount = answers.length
  const correctCount = answers.filter((answer) => answer.correct).length
  const score = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100)

  return {
    score,
    correctCount,
    totalCount,
    passed: totalCount > 0 && score >= trainingPassScore,
    completed: totalCount === trainingQuestionCount,
    answers,
  }
}
