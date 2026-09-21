import type { MissingFragmentQuestion } from '../../types/training'
import { AnswerOptions } from './AnswerOptions'

type MissingFragmentQuestionViewProps = {
  question: MissingFragmentQuestion
  selectedAnswer: number | null
  confirmed: boolean
  onSelect: (answerIndex: number) => void
}

export function MissingFragmentQuestionView(
  props: MissingFragmentQuestionViewProps,
) {
  return (
    <>
      <h1 className="question-situation question-fragment">
        {props.question.phraseTemplate}
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
