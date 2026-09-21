import type { ContinueSentenceQuestion } from '../../types/training'
import { AnswerOptions } from './AnswerOptions'

type ContinueSentenceQuestionViewProps = {
  question: ContinueSentenceQuestion
  selectedAnswer: number | null
  confirmed: boolean
  onSelect: (answerIndex: number) => void
}

export function ContinueSentenceQuestionView(
  props: ContinueSentenceQuestionViewProps,
) {
  return (
    <>
      <h1 className="question-situation">{props.question.context}</h1>
      <p className="question-instruction">{props.question.question}</p>
      <blockquote className="question-excerpt sentence-start">
        {props.question.sentenceStart}
      </blockquote>
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
