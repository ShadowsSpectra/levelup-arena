import type { ChoiceQuestion } from '../../types/training'
import { AnswerOptions } from './AnswerOptions'

type ChoiceQuestionViewProps = {
  question: ChoiceQuestion
  selectedAnswer: number | null
  confirmed: boolean
  onSelect: (answerIndex: number) => void
}

export function ChoiceQuestionView(props: ChoiceQuestionViewProps) {
  return (
    <>
      <h1 className="question-situation">{props.question.question}</h1>
      <p className="question-instruction">Выберите лучший вариант ответа.</p>
      <AnswerOptions
        answers={props.question.answers}
        confirmed={props.confirmed}
        correctAnswer={props.question.correctAnswer}
        selectedAnswer={props.selectedAnswer}
        onSelect={props.onSelect}
      />
    </>
  )
}
