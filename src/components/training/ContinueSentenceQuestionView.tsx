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
      <p className="question-context">{props.question.context}</p>
      <h1 className="question-title">{props.question.question}</h1>
      <blockquote className="question-excerpt sentence-start">
        {props.question.sentenceStart}
      </blockquote>
      <AnswerOptions {...props} {...props.question} />
    </>
  )
}
