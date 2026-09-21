import type { TrainingQuestion } from '../../types/training'
import { ChoiceQuestionView } from './ChoiceQuestionView'
import { ContinueSentenceQuestionView } from './ContinueSentenceQuestionView'
import { FindMistakeQuestionView } from './FindMistakeQuestionView'
import { MissingFragmentQuestionView } from './MissingFragmentQuestionView'

type QuestionRendererProps = {
  question: TrainingQuestion
  selectedAnswer: number | null
  confirmed: boolean
  onSelect: (answerIndex: number) => void
}

export function QuestionRenderer(props: QuestionRendererProps) {
  switch (props.question.type) {
    case 'choice':
      return <ChoiceQuestionView {...props} question={props.question} />
    case 'continue_sentence':
      return <ContinueSentenceQuestionView {...props} question={props.question} />
    case 'find_mistake':
      return <FindMistakeQuestionView {...props} question={props.question} />
    case 'missing_fragment':
      return <MissingFragmentQuestionView {...props} question={props.question} />
  }
}
