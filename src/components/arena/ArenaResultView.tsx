import { useState } from 'react'
import { getRoleById } from '../../config/roles'
import type { ArenaEvaluationState } from '../../state/useArenaFlow'
import type { ArenaSession, Character, Scenario } from '../../types/arena'
import { arenaCriterionIds, type ArenaCriterionId, type ArenaEvaluation, type ArenaOutcomeType } from '../../types/arenaEvaluation'

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
  BAD_AGREEMENT: 'Соглашение достигнуто, но требует пересмотра',
}

const outcomeMarkers: Record<ArenaOutcomeType, string> = {
  SUCCESS: '✓',
  NO_AGREEMENT: '—',
  BAD_AGREEMENT: '!',
}

export function buildArenaShareText(roleName: string, characterName: string, evaluation: ArenaEvaluation) {
  return [
    `LevelUP Arena · ${roleName}`,
    `Оппонент: ${characterName}`,
    `${outcomeLabels[evaluation.outcome.status]} · ${evaluation.overallScore} из 100`,
  ].join('\n')
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

type ArenaTranscriptViewProps = Pick<ArenaResultViewProps, 'character' | 'scenario' | 'session'> & {
  onBack: () => void
}

export function ArenaTranscriptView({ character, scenario, session, onBack }: ArenaTranscriptViewProps) {
  return (
    <section className="arena-result arena-transcript-result" aria-labelledby="arena-transcript-title">
      <div className="arena-transcript-header">
        <span className="section-kicker">Arena · Завершённые переговоры</span>
        <button className="text-button" type="button" onClick={onBack}>
          ← Вернуться к результату
        </button>
      </div>
      <h1 id="arena-transcript-title">История переговоров</h1>
      <div className="arena-result-meta">
        <span>Сценарий: {scenario.title}</span>
        <span>Оппонент: {character.name} · {character.role}</span>
      </div>
      <div className="arena-transcript arena-transcript-readonly" aria-label="Завершённые переговоры">
        {session.messages.map((message) => (
          <article className={`arena-message arena-message-${message.speaker}`} key={message.id}>
            <span>{message.speaker === 'player' ? 'Вы' : `${character.name} · ${character.role}`}</span>
            <p>{message.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ArenaResultView({ character, scenario, session, evaluation, onRetryEvaluation, onOpenAISettings,
  onTryAgain, onBackToSelection, onHome }: ArenaResultViewProps) {
  const [isViewingTranscript, setIsViewingTranscript] = useState(false)
  const [shareNotice, setShareNotice] = useState('')

  async function shareResult() {
    if (evaluation.status !== 'success') return
    const roleName = getRoleById(scenario.playerRole)?.name ?? scenario.playerRole
    const text = buildArenaShareText(roleName, character.name, evaluation.result)
    setShareNotice('')
    if (navigator.share) {
      try {
        await navigator.share({ title: 'LevelUP Arena', text })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setShareNotice('Результат скопирован в буфер обмена.')
    } catch {
      setShareNotice('Не удалось поделиться результатом. Попробуйте ещё раз.')
    }
  }

  if (isViewingTranscript) {
    return <ArenaTranscriptView character={character} scenario={scenario} session={session}
      onBack={() => setIsViewingTranscript(false)} />
  }

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
          <div className="arena-evaluation-loading-heading">
            <span className="arena-evaluation-loader" aria-hidden="true"><i /><i /><i /></span>
            <strong>AI анализирует переговоры…</strong>
          </div>
          <span>Формируем разбор переговоров…</span>
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
            <div className="arena-outcome-heading">
              <div>
                <span className="section-kicker">Исход переговоров</span>
                <div className="arena-outcome-title">
                  <span className="arena-outcome-marker" aria-hidden="true">{outcomeMarkers[evaluation.result.outcome.status]}</span>
                  <h2>{outcomeLabels[evaluation.result.outcome.status]}</h2>
                </div>
              </div>
            </div>
            <p className="arena-outcome-detail">{evaluation.award.bossDefeated
              ? 'Оппонент побеждён: условия обеих сторон соблюдены.'
              : 'Оппонент пока не побеждён.'}</p>
            <p className="arena-outcome-xp">Получено XP: <strong>{evaluation.award.xpEarned}</strong></p>
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
        <button className="secondary-action-button" type="button" onClick={() => setIsViewingTranscript(true)}>
          Посмотреть переговоры
        </button>
      </div>
      <nav className="result-navigation" aria-label="Навигация после результата">
        <div className="result-navigation-links">
          <button className="text-button" type="button" onClick={onBackToSelection}>К выбору оппонента</button>
          <button className="text-button result-home-action" type="button" onClick={onHome}>На главную</button>
        </div>
        {evaluation.status === 'success' && (
          <button className="text-button result-share-action" type="button" onClick={() => { void shareResult() }}>
            <svg className="result-share-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14.5 5.5 18 9m0 0-3.5 3.5M18 9H9a4 4 0 0 0-4 4v5" />
            </svg>
            Поделиться результатом
          </button>
        )}
      </nav>
      {shareNotice && <p className="result-share-notice" role="status">{shareNotice}</p>}
    </section>
  )
}
