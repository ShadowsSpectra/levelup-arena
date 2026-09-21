import type { TrainingQuestion } from '../../types/training'

type AnswerFeedbackProps = {
  question: TrainingQuestion
  selectedAnswer: number
}

export function AnswerFeedback({ question, selectedAnswer }: AnswerFeedbackProps) {
  const correct = selectedAnswer === question.correctAnswer

  return (
    <section
      className={correct ? 'answer-feedback is-correct' : 'answer-feedback is-incorrect'}
      aria-live="polite"
    >
      <strong>{correct ? 'Правильно' : 'Не лучший вариант'}</strong>
      <p>
        <span>Правильный ответ:</span> {question.answers[question.correctAnswer]}
      </p>
      <p>{question.explanation}</p>
    </section>
  )
}
