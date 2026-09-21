import { AppHeader } from '../components/AppHeader'
import { AnswerFeedback } from '../components/training/AnswerFeedback'
import { QuestionRenderer } from '../components/training/QuestionRenderer'
import { initialRoleStats } from '../config/displayDefaults'
import type { Role } from '../config/roles'
import { trainingPassScore } from '../services/trainingEngine'
import { useTrainingSession } from '../state/useTrainingSession'

const typeLabels = {
  choice: 'Choice',
  continue_sentence: 'Continue Sentence',
  find_mistake: 'Find Mistake',
  missing_fragment: 'Missing Fragment',
} as const

type TrainingPageProps = {
  role: Role
  onBack: () => void
  onChangeRole: () => void
}

export function TrainingPage({ role, onBack, onChangeRole }: TrainingPageProps) {
  const training = useTrainingSession(role.id, initialRoleStats.level)

  return (
    <div className="app-shell">
      <AppHeader role={role} onChangeRole={onChangeRole} />

      {training.status === 'loading' && (
        <main className="training-message" aria-live="polite">
          <span className="section-kicker">Training</span>
          <h1>Собираем тренировку…</h1>
        </main>
      )}

      {(training.status === 'empty' || training.status === 'error') && (
        <main className="training-message">
          <span className="section-kicker">{role.name}</span>
          <h1>
            {training.status === 'empty'
              ? 'Для этой роли пока нет заданий'
              : 'Не удалось загрузить задания'}
          </h1>
          <p>
            {training.status === 'empty'
              ? 'Тестовый Training сейчас доступен только для Product Manager.'
              : 'Вернись на главную и попробуй запустить Training ещё раз.'}
          </p>
          <button className="primary-button" type="button" onClick={onBack}>
            Вернуться на Role Home
          </button>
        </main>
      )}

      {training.status === 'ready' && training.currentQuestion && (
        <main className="training-page">
          <div className="training-topbar">
            <button className="back-button" type="button" onClick={onBack}>
              ← Выйти из Training
            </button>
            <span className="training-progress">
              {training.currentIndex + 1} / {training.questions.length}
            </span>
          </div>

          <div
            className="training-progress-track"
            aria-label={`Задание ${training.currentIndex + 1} из ${training.questions.length}`}
          >
            <span
              style={{
                width: `${((training.currentIndex + 1) / training.questions.length) * 100}%`,
              }}
            />
          </div>

          <section className="question-panel">
            <div className="question-meta">
              <span>{typeLabels[training.currentQuestion.type]}</span>
              <span>{training.currentQuestion.skill}</span>
            </div>

            <QuestionRenderer
              confirmed={training.answerConfirmed}
              question={training.currentQuestion}
              selectedAnswer={training.selectedAnswer}
              onSelect={training.selectAnswer}
            />

            {!training.answerConfirmed && (
              <button
                className="primary-button check-answer-button"
                disabled={training.selectedAnswer === null}
                type="button"
                onClick={training.confirmAnswer}
              >
                Проверить ответ
              </button>
            )}

            {training.answerConfirmed && training.selectedAnswer !== null && (
              <>
                <AnswerFeedback
                  question={training.currentQuestion}
                  selectedAnswer={training.selectedAnswer}
                />
                <button
                  className="primary-button next-question-button"
                  type="button"
                  onClick={training.goNext}
                >
                  {training.currentIndex === training.questions.length - 1
                    ? 'Показать результат'
                    : 'Следующее задание'}
                </button>
              </>
            )}
          </section>
        </main>
      )}

      {training.status === 'result' && training.result && (
        <main className="training-result-page">
          <section className="result-summary" aria-labelledby="training-result-title">
            <span className="section-kicker">Training Result</span>
            <div className="result-score">{training.result.score}%</div>
            <h1 id="training-result-title">
              {training.result.passed ? 'Условие выполнено' : 'Продолжай тренировку'}
            </h1>
            <p>
              Правильных ответов: {training.result.correctCount} из{' '}
              {training.result.totalCount}.
            </p>
            <div className={training.result.passed ? 'result-status is-passed' : 'result-status'}>
              {training.result.passed
                ? `Результат не ниже ${trainingPassScore}% соответствует условию открытия Arena.`
                : `Для условия открытия Arena нужно набрать минимум ${trainingPassScore}%.`}
            </div>
            <p className="result-note">
              На этом этапе результат не меняет XP, Energy, Streak или состояние Arena.
            </p>
            <div className="result-actions">
              <button className="primary-button" type="button" onClick={training.restart}>
                Пройти ещё раз
              </button>
              <button className="secondary-action-button" type="button" onClick={onBack}>
                Вернуться на Role Home
              </button>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}
