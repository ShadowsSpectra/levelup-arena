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
      <h1 className="question-title">{props.question.question}</h1>
      <AnswerOptions {...props} {...props.question} />
    </>
  )
}
