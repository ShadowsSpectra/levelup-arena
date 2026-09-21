type AnswerOptionsProps = {
  answers: string[]
  correctAnswer: number
  selectedAnswer: number | null
  confirmed: boolean
  onSelect: (answerIndex: number) => void
}

function getAnswerState(
  answerIndex: number,
  correctAnswer: number,
  selectedAnswer: number | null,
  confirmed: boolean,
) {
  if (confirmed && answerIndex === correctAnswer) return 'is-correct'
  if (confirmed && answerIndex === selectedAnswer) return 'is-incorrect'
  if (answerIndex === selectedAnswer) return 'is-selected'
  return ''
}

export function AnswerOptions({
  answers,
  correctAnswer,
  selectedAnswer,
  confirmed,
  onSelect,
}: AnswerOptionsProps) {
  return (
    <div className="answer-options" role="radiogroup" aria-label="Варианты ответа">
      {answers.map((answer, index) => (
        <button
          aria-checked={selectedAnswer === index}
          className={`answer-option ${getAnswerState(index, correctAnswer, selectedAnswer, confirmed)}`}
          disabled={confirmed}
          key={index}
          role="radio"
          type="button"
          onClick={() => onSelect(index)}
        >
          <span className="answer-letter" aria-hidden="true">
            {String.fromCharCode(65 + index)}
          </span>
          <span>{answer}</span>
        </button>
      ))}
    </div>
  )
}
