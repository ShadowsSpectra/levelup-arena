import { useState } from 'react'
import type { TrainingQuestion } from '../../types/training'

const positiveMessages = [
  'Отлично!',
  'Точно!',
  'Верно, так держать!',
  'Хороший ход!',
  'Именно так!',
  'Сильный ответ!',
] as const

const negativeMessages = [
  'Не лучший вариант',
  'Не совсем',
  'Почти, но есть нюанс',
  'Здесь есть ошибка',
  'Стоит подумать иначе',
  'Не в этот раз',
] as const

function getPositiveMessage() {
  return positiveMessages[Math.floor(Math.random() * positiveMessages.length)]
}

function getNegativeMessage() {
  return negativeMessages[Math.floor(Math.random() * negativeMessages.length)]
}

type AnswerFeedbackProps = {
  question: TrainingQuestion
  selectedAnswer: number
}

export function AnswerFeedback({ question, selectedAnswer }: AnswerFeedbackProps) {
  const correct = selectedAnswer === question.correctAnswer
  const [positiveMessage] = useState(getPositiveMessage)
  const [negativeMessage] = useState(getNegativeMessage)

  return (
    <section
      className={correct ? 'answer-feedback is-correct' : 'answer-feedback is-incorrect'}
      aria-live="polite"
    >
      <strong>{correct ? positiveMessage : negativeMessage}</strong>
      <p>
        <span>Правильный ответ:</span> {question.answers[question.correctAnswer]}
      </p>
      <p>{question.explanation}</p>
    </section>
  )
}
