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
      <h1 className="question-title">{props.question.question}</h1>
      <blockquote className="question-excerpt">{props.question.dialogue}</blockquote>
      <AnswerOptions {...props} {...props.question} />
    </>
  )
}
