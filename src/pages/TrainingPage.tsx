import { AppHeader } from '../components/AppHeader'
import { AnswerFeedback } from '../components/training/AnswerFeedback'
import { QuestionRenderer } from '../components/training/QuestionRenderer'
import type { Role } from '../config/roles'
import type { TrainingAward, getRoleProgress } from '../services/progression'
import { useTrainingSession } from '../state/useTrainingSession'
import type { TrainingQuestion, TrainingResult } from '../types/training'

type TrainingPageProps = {
  role: Role
  roleProgress: ReturnType<typeof getRoleProgress>
  energy: number
  streak: number
  onBack: () => void
  onOpenArena: () => void
  onChangeRole: () => void
  onComplete: (result: TrainingResult, questions: TrainingQuestion[]) => TrainingAward
}

export function TrainingPage({
  role,
  roleProgress,
  energy,
  streak,
  onBack,
  onOpenArena,
  onChangeRole,
  onComplete,
}: TrainingPageProps) {
  const training = useTrainingSession(role.id, roleProgress.level, onComplete)

  return (
    <div className="app-shell">
      <AppHeader
        role={role}
        roleProgress={roleProgress}
        energy={energy}
        streak={streak}
        onChangeRole={onChangeRole}
      />

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
              ? 'Для этой роли пока нет доступных заданий.'
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
          </div>

          <div
            className="training-progress-track"
            aria-label="Прогресс Training"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(
              ((training.currentIndex + 1) / training.questions.length) * 100,
            )}
            role="progressbar"
          >
            <span
              style={{
                width: `${((training.currentIndex + 1) / training.questions.length) * 100}%`,
              }}
            />
          </div>

          <section className="question-panel">
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

      {training.status === 'result' && training.result && training.award && (
        <main className="training-result-page">
          <section className="result-summary" aria-labelledby="training-result-title">
            <span className="section-kicker">Training Result</span>
            <div className="result-score">{training.result.score}%</div>
            <h1 id="training-result-title">
              Тренировка завершена
            </h1>
            <p>
              Правильных ответов: {training.result.correctCount} из{' '}
              {training.result.totalCount}.
            </p>
            <p>Получено за Training: {training.award.xpEarned} XP.</p>
            <div className="result-actions">
              <button className="primary-button" type="button" onClick={training.restart}>
                Пройти ещё раз
              </button>
              <button className="primary-button" type="button" onClick={onOpenArena}>
                Перейти в арену
              </button>
              <button className="secondary-action-button" type="button" onClick={onBack}>
                На главную
              </button>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}
