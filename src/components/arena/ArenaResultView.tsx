import type { ArenaEvaluationState } from '../../state/useArenaFlow'
import type { ArenaSession, Character, Scenario } from '../../types/arena'
import { arenaCriterionIds, type ArenaCriterionId, type ArenaOutcomeType } from '../../types/arenaEvaluation'

const criterionLabels: Record<ArenaCriterionId, string> = {
  interestsDiscovery: 'Выявление интересов',
  objectionHandling: 'Работа с возражениями',
  communicationAdaptability: 'Адаптация к оппоненту',
  argumentation: 'Аргументация',
  initiative: 'Инициатива',
}

const outcomeLabels: Record<ArenaOutcomeType, string> = {
  SUCCESS: 'Успешное соглашение',
  NO_AGREEMENT: 'Соглашение не достигнуто',
  BAD_AGREEMENT: 'Соглашение требует пересмотра',
}

type ArenaResultViewProps = {
  character: Character
  scenario: Scenario
  session: ArenaSession
  evaluation: ArenaEvaluationState
  onRetryEvaluation: () => void
  onOpenAISettings: () => void
  onTryAgain: () => void
  onBackToSelection: () => void
  onHome: () => void
}

export function ArenaResultView({ character, scenario, session, evaluation, onRetryEvaluation, onOpenAISettings,
  onTryAgain, onBackToSelection, onHome }: ArenaResultViewProps) {
  return (
    <section className="arena-result" aria-labelledby="arena-result-title">
      <span className="section-kicker">Arena · Результат</span>
      <h1 id="arena-result-title">Переговоры завершены</h1>
      <div className="arena-result-meta">
        <span>Сценарий: {scenario.title}</span>
        <span>Оппонент: {character.name} · {character.role}</span>
        <span>Ходов: {session.currentTurn}</span>
      </div>

      {evaluation.status === 'loading' && (
        <div className="arena-evaluation-status" role="status">
          <strong>AI анализирует переговоры…</strong>
          <span>Диалог завершён и сохранён на этом экране.</span>
        </div>
      )}

      {evaluation.status === 'error' && (
        <div className="arena-evaluation-status is-error" role="alert">
          <strong>Оценку пока не удалось получить</strong>
          <span>{evaluation.message}</span>
          <span>Завершённый диалог не потерян.</span>
          <button className="secondary-action-button" type="button" onClick={onRetryEvaluation}>
            Повторить оценку
          </button>
          <button className="secondary-action-button" type="button" onClick={onOpenAISettings}>AI Settings</button>
        </div>
      )}

      {evaluation.status === 'success' && (
        <div className="arena-evaluation">
          <section className={`arena-outcome arena-outcome-${evaluation.result.outcome.status.toLowerCase()}`}>
            <span className="section-kicker">Исход переговоров</span>
            <h2>{outcomeLabels[evaluation.result.outcome.status]}</h2>
            <p>{evaluation.award.bossDefeated
              ? 'Оппонент побеждён: условия обеих сторон соблюдены.'
              : 'Оппонент пока не побеждён.'}</p>
            <p>Получено XP: {evaluation.award.xpEarned}</p>
          </section>

          <section className="arena-score-summary">
            <span>Общая оценка навыков</span>
            <strong>{evaluation.result.overallScore}</strong>
            <small>из 100</small>
          </section>

          <section className="arena-rubric" aria-labelledby="arena-rubric-title">
            <h2 id="arena-rubric-title">Разбор навыков</h2>
            {arenaCriterionIds.map((id) => {
              const item = evaluation.result.scores[id]
              return (
                <article className="arena-rubric-item" key={id}>
                  <header><h3>{criterionLabels[id]}</h3><strong>{item.score}</strong></header>
                  <blockquote>«{item.evidence}»</blockquote>
                  <p>{item.reason}</p>
                </article>
              )
            })}
          </section>

          <div className="arena-review-columns">
            <section><h2>Сильные стороны</h2><ul>{evaluation.result.strengths.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h2>Что улучшить</h2><ul>{evaluation.result.improvements.map((item) => <li key={item}>{item}</li>)}</ul></section>
          </div>

          <section className="arena-main-insight">
            <span className="section-kicker">Главный вывод</span>
            <p>{evaluation.result.mainInsight.insight}</p>
            <blockquote>«{evaluation.result.mainInsight.evidence}»</blockquote>
          </section>
        </div>
      )}

      <div className="result-actions">
        <button className="primary-button" type="button" onClick={onTryAgain}>Попробовать ещё раз</button>
        <button className="secondary-action-button" type="button" onClick={onBackToSelection}>К выбору оппонента</button>
        <button className="secondary-action-button" type="button" onClick={onHome}>На главную</button>
      </div>
    </section>
  )
}
