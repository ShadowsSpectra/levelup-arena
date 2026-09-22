import { AppHeader } from '../components/AppHeader'
import { NegotiationView } from '../components/arena/NegotiationView'
import { ArenaResultView } from '../components/arena/ArenaResultView'
import type { Role } from '../config/roles'
import { localCharacterSource, localScenarioSource } from '../content/arenaSources'
import { getCharacterPublicProfile, getDifficultyStars } from '../services/characterProfile'
import { createBrowserOpponentService, getAIMode, type AIMode } from '../services/arenaOpponentGateway'
import { createBrowserEvaluatorService } from '../services/evaluatorService'
import { useEffect, useMemo, useState } from 'react'
import type { getRoleProgress } from '../services/progression'
import { useArenaFlow } from '../state/useArenaFlow'
import type { ArenaSession } from '../types/arena'
import type { ArenaEvaluation } from '../types/arenaEvaluation'
import { isBossUnlocked, type ArenaAward } from '../services/progression'

type ArenaPageProps = {
  role: Role
  roleProgress: ReturnType<typeof getRoleProgress>
  energy: number
  streak: number
  onBack: () => void
  onChangeRole: () => void
  onComplete: (session: ArenaSession) => void
  onEvaluated: (session: ArenaSession, result: ArenaEvaluation) => ArenaAward
  onOpenAISettings: () => void
  aiSettingsVersion: number
}

export function ArenaPage({ role, roleProgress, energy, streak, onBack, onChangeRole, onComplete, onEvaluated,
  onOpenAISettings, aiSettingsVersion }: ArenaPageProps) {
  const [configuredMode, setConfiguredMode] = useState<AIMode>('mock')
  const [lastReplyMode, setLastReplyMode] = useState<AIMode | null>(null)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)
  const opponentService = useMemo(() => createBrowserOpponentService(setLastReplyMode, setFallbackNotice), [])
  const evaluatorService = useMemo(() => createBrowserEvaluatorService(), [])
  useEffect(() => {
    let active = true
    getAIMode().then((mode) => { if (active) setConfiguredMode(mode) })
    return () => { active = false }
  }, [aiSettingsVersion])
  const arena = useArenaFlow(
    role.id, localCharacterSource, localScenarioSource, opponentService, evaluatorService, onComplete, onEvaluated,
    (character) => isBossUnlocked(character, roleProgress, roleProgress.level),
  )
  const characters = Array.from(new Map(
    arena.options?.map(({ character }) => [character.id, character]) ?? [],
  ).values())
  const availableCount = characters.filter((character) => isBossUnlocked(character, roleProgress, roleProgress.level)).length
  const characterScenarios = arena.options?.filter(
    ({ character }) => character.id === arena.selectedCharacterId,
  ) ?? []

  function startNegotiation() {
    setFallbackNotice(null)
    setLastReplyMode(null)
    arena.start()
  }

  return (
    <div className="app-shell">
      <AppHeader role={role} roleProgress={roleProgress} energy={energy} streak={streak}
        onChangeRole={onChangeRole} />
      <main className="arena-page">
        <div className="arena-ai-toolbar">
          <span className="arena-ai-mode" role="status">
            {arena.session?.status === 'responding'
              ? 'Ожидаем ответ оппонента…'
              : `${lastReplyMode ? 'Ответы' : 'Режим'}: ${(lastReplyMode ?? configuredMode) === 'real' ? 'Real AI' : 'Mock'}`}
          </span>
          <button className="text-button" type="button" onClick={onOpenAISettings}>AI Settings</button>
        </div>
        {arena.step === 'selection' && (
          <>
            <button className="back-button" type="button" onClick={onBack}>← На главную</button>
            <header className="arena-page-heading">
              <span className="section-kicker">Arena · {role.name}</span>
              <h1>Выберите оппонента</h1>
              <div className="arena-setup-stats">
                <span>Уровень {roleProgress.level}</span>
                <span>Доступно оппонентов: {availableCount}</span>
              </div>
            </header>
            {arena.loadError ? (
              <div className="arena-empty-state" role="alert">Не удалось загрузить сценарии. Вернитесь на главную и попробуйте снова.</div>
            ) : arena.options === null ? (
              <p>Загружаем сценарии…</p>
            ) : (
              <>
                {characters.length === 0 && (
                  <div className="arena-empty-state">
                    <h2>Для этой роли пока нет сценариев</h2>
                    <p>Сценарии для {role.name} появятся позже. Пока можно продолжить Training.</p>
                    <button className="secondary-action-button" type="button" onClick={onBack}>На главную</button>
                  </div>
                )}
                <div className="arena-boss-list" aria-label="Доступные оппоненты">
                  {characters.map((character) => (
                    <button className={`arena-choice-card${arena.selectedCharacterId === character.id ? ' is-selected' : ''}`}
                      type="button" key={character.id} aria-pressed={arena.selectedCharacterId === character.id}
                      disabled={!isBossUnlocked(character, roleProgress, roleProgress.level)}
                      onClick={() => arena.chooseCharacter(character.id)}>
                      <span className="arena-card-title">{character.name}</span>
                      <span className="arena-card-subtitle">{character.role}</span>
                      <span>Сложность: {getDifficultyStars(character.difficulty)}</span>
                      <span>{getCharacterPublicProfile(character)}</span>
                      {!isBossUnlocked(character, roleProgress, roleProgress.level) && <span>Пока закрыт</span>}
                    </button>
                  ))}
                  <div className="arena-preview-card" aria-disabled="true">
                    <strong>+ Свой оппонент</strong>
                    <span>Возможность создать собственного AI-оппонента.</span>
                    <small>Скоро</small>
                  </div>
                </div>

                {arena.selectedCharacterId && (
                  <section className="arena-scenario-setup" aria-labelledby="arena-scenario-title">
                    <h2 id="arena-scenario-title">Выберите сценарий</h2>
                    <div className="arena-scenario-list">
                      {characterScenarios.map(({ scenario }) => (
                        <button className={`arena-choice-card arena-scenario-card${arena.selectedScenarioId === scenario.id ? ' is-selected' : ''}`}
                          type="button" key={scenario.id} aria-pressed={arena.selectedScenarioId === scenario.id}
                          onClick={() => arena.chooseScenario(scenario.id)}>
                          <span className="arena-card-title">{scenario.title}</span>
                          <span className="arena-card-subtitle">{scenario.category}</span>
                        </button>
                      ))}
                      <div className="arena-preview-card" aria-disabled="true">
                        <strong>+ Свой сценарий</strong>
                        <span>Возможность создать собственную переговорную ситуацию.</span>
                        <small>Скоро</small>
                      </div>
                    </div>

                    {arena.selected && (
                      <div className="arena-selected-brief">
                        <h3>Перед началом</h3>
                        <p><strong>Вы — {role.name}.</strong></p>
                        <p>{arena.selected.scenario.playerBrief.situation}</p>
                        <p><strong>Ваша цель:</strong> {arena.selected.scenario.playerBrief.playerGoal}</p>
                        <h3>Что вам известно</h3>
                        <ul>{arena.selected.scenario.playerBrief.knownInformation.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                      </div>
                    )}
                    <button className="primary-button arena-start-button" type="button" disabled={!arena.selected} onClick={startNegotiation}>
                      Начать переговоры
                    </button>
                  </section>
                )}
                <p className="arena-community-preview">Мастерская сообщества — в будущем.</p>
              </>
            )}
          </>
        )}

        {arena.step === 'negotiation' && arena.selected && arena.session && (
          <NegotiationView character={arena.selected.character} scenario={arena.selected.scenario}
            session={arena.session} replyError={arena.replyError} fallbackNotice={fallbackNotice}
            onSend={arena.send} onFinish={arena.finish} />
        )}

        {arena.step === 'result' && arena.selected && arena.session && (
          <ArenaResultView character={arena.selected.character} scenario={arena.selected.scenario}
            session={arena.session} evaluation={arena.evaluation}
            onRetryEvaluation={arena.retryEvaluation} onTryAgain={startNegotiation}
            onBackToSelection={arena.backToSelection} onHome={onBack} />
        )}
      </main>
    </div>
  )
}
