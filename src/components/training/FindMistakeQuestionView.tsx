import type { FindMistakeQuestion } from '../../types/training'
import { AnswerOptions } from './AnswerOptions'

type FindMistakeQuestionViewProps = {
  question: FindMistakeQuestion
  selectedAnswer: number | null
  confirmed: boolean
  onSelect: (answerIndex: number) => void
}

export function FindMistakeQuestionView(props: FindMistakeQuestionViewProps) {
  return (
    <>
      <h1 className="question-situation question-dialogue">
        {props.question.dialogue}
      </h1>
      <p className="question-instruction">{props.question.question}</p>
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
