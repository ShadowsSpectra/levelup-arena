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
      <h1 className="question-title">{props.question.question}</h1>
      <blockquote className="question-excerpt missing-fragment">
        {props.question.phraseTemplate}
      </blockquote>
      <AnswerOptions {...props} {...props.question} />
    </>
  )
}
