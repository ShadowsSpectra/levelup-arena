import { AppHeader } from '../components/AppHeader'
import { CommunicationIcon, GoalIcon, KnownInfoIcon, LockIcon, PressureIcon } from '../components/HeaderIcons'
import { NegotiationView } from '../components/arena/NegotiationView'
import { ArenaResultView } from '../components/arena/ArenaResultView'
import type { Role } from '../config/roles'
import { localCharacterSource, localScenarioSource } from '../content/arenaSources'
import { getCharacterPressureLabel, getCharacterStyleLabel, getDifficultyLabel, getDifficultyStars } from '../services/characterProfile'
import { createBrowserOpponentService, getAIStatus, type AIStatus } from '../services/arenaOpponentGateway'
import { createBrowserEvaluatorService } from '../services/evaluatorService'
import { useEffect, useMemo, useRef, useState } from 'react'
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

export function scrollToArenaSection(
  target: Pick<HTMLElement, 'scrollIntoView'> | null,
  reducedMotion: boolean,
) {
  if (!target) return
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

export function ArenaPage({ role, roleProgress, energy, streak, onBack, onChangeRole, onComplete, onEvaluated,
  onOpenAISettings, aiSettingsVersion }: ArenaPageProps) {
  const [aiStatus, setAIStatus] = useState<AIStatus>('unavailable')
  const scenarioSectionRef = useRef<HTMLElement>(null)
  const scenarioBriefRef = useRef<HTMLDivElement>(null)
  const opponentService = useMemo(() => createBrowserOpponentService(), [])
  const evaluatorService = useMemo(() => createBrowserEvaluatorService(), [])
  useEffect(() => {
    let active = true
    getAIStatus().then((status) => { if (active) setAIStatus(status) })
    return () => { active = false }
  }, [aiSettingsVersion])
  const arena = useArenaFlow(
    role.id, localCharacterSource, localScenarioSource, opponentService, evaluatorService, onComplete, onEvaluated,
    (character) => isBossUnlocked(character, roleProgress, roleProgress.level),
  )
  useEffect(() => {
    if (arena.step !== 'selection' || !arena.selectedCharacterId) return
    scrollToArenaSection(
      scenarioSectionRef.current,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    )
  }, [arena.step, arena.selectedCharacterId])
  useEffect(() => {
    if (arena.step !== 'selection' || !arena.selectedScenarioId) return
    scrollToArenaSection(
      scenarioBriefRef.current,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    )
  }, [arena.step, arena.selectedScenarioId])
  const characters = Array.from(new Map(
    arena.options?.map(({ character }) => [character.id, character]) ?? [],
  ).values())
  const availableCount = characters.filter((character) => isBossUnlocked(character, roleProgress, roleProgress.level)).length
  const defeatedCount = characters.filter((character) => roleProgress.bosses[character.id]?.defeated).length
  const characterScenarios = arena.options?.filter(
    ({ character }) => character.id === arena.selectedCharacterId,
  ) ?? []

  function startNegotiation() {
    arena.start()
  }

  return (
    <div className="app-shell">
      <AppHeader role={role} roleProgress={roleProgress} energy={energy} streak={streak}
        onChangeRole={onChangeRole} />
      <main className="arena-page">
        <div className={`arena-ai-toolbar${arena.step === 'negotiation' ? ' arena-ai-toolbar-dialogue' : ''}`}>
          <span className="arena-ai-mode" role="status">
            {arena.session?.status === 'responding'
              ? 'Ожидаем ответ Real AI…'
              : aiStatus === 'real' ? 'Режим: Real AI'
                : aiStatus === 'unconfigured' ? 'AI не настроен' : 'AI-сервер недоступен'}
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
                <span className="arena-level-badge">Уровень {roleProgress.level}</span>
                <span className="arena-availability-badge">{availableCount} из {characters.length} доступно</span>
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
                  {characters.map((character) => {
                    const unlocked = isBossUnlocked(character, roleProgress, roleProgress.level)
                    const previousBoss = characters.find(({ id }) => id === character.unlockRequirements?.previousBossId)
                    const defeated = roleProgress.bosses[character.id]?.defeated
                    return (
                      <button className={`arena-choice-card arena-opponent-card${arena.selectedCharacterId === character.id ? ' is-selected' : ''}${unlocked ? '' : ' is-locked'}`}
                        type="button" key={character.id} aria-pressed={arena.selectedCharacterId === character.id}
                        disabled={!unlocked} onClick={() => arena.chooseCharacter(character.id)}>
                        <span className="arena-card-title">{character.name}</span>
                        <span className="arena-card-subtitle">{character.role}</span>
                        <span className="arena-opponent-traits">
                          <span className="arena-difficulty-badge">{getDifficultyStars(character.difficulty)} {getDifficultyLabel(character.difficulty)}</span>
                          <span className="arena-trait"><CommunicationIcon />{getCharacterStyleLabel(character)}</span>
                          <span className="arena-trait"><PressureIcon />{getCharacterPressureLabel(character)}</span>
                        </span>
                        {defeated && <span className="arena-complete-badge">Пройден</span>}
                        {!unlocked && <span className="arena-lock-copy">
                          <span className="arena-lock-status"><LockIcon />
                            {character.unlockRequirements?.minLevel
                              ? `Откроется на уровне ${character.unlockRequirements.minLevel}` : 'Пока закрыт'}
                          </span>
                          {previousBoss && !roleProgress.bosses[previousBoss.id]?.defeated &&
                            <span>Сначала победите босса «{previousBoss.name}»</span>}
                        </span>}
                        {unlocked && <span className="arena-card-action">Начать переговоры →</span>}
                      </button>
                    )
                  })}
                  <div className="arena-preview-card" aria-disabled="true">
                    <strong>+ Свой оппонент</strong>
                    <span>Создайте AI-оппонента с собственной ролью и характером.</span>
                    <small>Мастерская · скоро</small>
                  </div>
                </div>
                {characters.length > 0 && (
                  <div className="arena-future-tier" aria-label="Будущее развитие Arena">
                    <div className="arena-future-silhouettes" aria-hidden="true"><span /><span /><span /></div>
                    <strong>Глава 1 · {defeatedCount} из {characters.length} оппонентов</strong>
                    <span>Следующая глава — новые уровни и оппоненты</span>
                  </div>
                )}

                {arena.selectedCharacterId && (
                  <section className="arena-scenario-setup" ref={scenarioSectionRef} aria-labelledby="arena-scenario-title">
                    <h2 id="arena-scenario-title">Выберите сценарий</h2>
                    <div className="arena-scenario-list">
                      {characterScenarios.map(({ scenario }) => (
                        <button className={`arena-choice-card arena-scenario-card${arena.selectedScenarioId === scenario.id ? ' is-selected' : ''}`}
                          type="button" key={scenario.id} aria-pressed={arena.selectedScenarioId === scenario.id}
                          onClick={() => arena.chooseScenario(scenario.id)}>
                          <span className="arena-card-title">{scenario.title}</span>
                          <span className="arena-scenario-tags">
                            {scenario.category.split('/').map((topic) => topic.trim()).filter(Boolean).map((topic) =>
                              <span key={topic}>{topic}</span>)}
                          </span>
                          <span className="arena-card-action">Выбрать сценарий →</span>
                        </button>
                      ))}
                      <div className="arena-preview-card" aria-disabled="true">
                        <strong>+ Свой сценарий</strong>
                        <span>Придумайте переговорную ситуацию и предложите её сообществу.</span>
                        <small>Мастерская · скоро</small>
                      </div>
                    </div>

                    {arena.selected && (
                      <div className="arena-selected-brief" ref={scenarioBriefRef}>
                        <h3>Перед началом</h3>
                        <p><strong>Вы — {role.name}.</strong></p>
                        <p>{arena.selected.scenario.playerBrief.situation}</p>
                        <div className="arena-brief-goal">
                          <span className="arena-brief-label"><GoalIcon /><strong>Ваша цель</strong></span>
                          <p>{arena.selected.scenario.playerBrief.playerGoal}</p>
                        </div>
                        <div className="arena-brief-known-heading"><KnownInfoIcon /><h3>Что вам известно</h3></div>
                        <ul>{arena.selected.scenario.playerBrief.knownInformation.map((fact) => <li key={fact}>{fact}</li>)}</ul>
                      </div>
                    )}
                    <button className="primary-button arena-start-button" type="button" disabled={!arena.selected} onClick={startNegotiation}>
                      Начать переговоры
                    </button>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {arena.step === 'negotiation' && arena.selected && arena.session && (
          <NegotiationView character={arena.selected.character} scenario={arena.selected.scenario}
            session={arena.session} isOpening={arena.isOpening} replyError={arena.replyError}
            onSend={arena.send} onFinish={arena.finish} onOpenAISettings={onOpenAISettings} />
        )}

        {arena.step === 'result' && arena.selected && arena.session && (
          <ArenaResultView character={arena.selected.character} scenario={arena.selected.scenario}
            session={arena.session} evaluation={arena.evaluation}
            onRetryEvaluation={arena.retryEvaluation} onOpenAISettings={onOpenAISettings} onTryAgain={startNegotiation}
            onBackToSelection={arena.backToSelection} onHome={onBack} />
        )}
      </main>
    </div>
  )
}
