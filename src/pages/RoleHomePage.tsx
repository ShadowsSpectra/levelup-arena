import { useState, type ReactNode } from 'react'
import { AppHeader } from '../components/AppHeader'
import { SleepingLevi } from '../components/mascot/SleepingLevi'
import type { Role, RoleId } from '../config/roles'
import { demoLeaderboards } from '../content/demoVision'
import type { getRoleProgress } from '../services/progression'

type RoleHomePageProps = {
  role: Role
  roleProgress: ReturnType<typeof getRoleProgress>
  energy: number
  streak: number
  onChangeRole: () => void
  onOpenTraining: () => void
  onOpenWorkshop?: () => void
  onOpenArena: () => void
  onOpenAISettings: () => void
  leviGuideActive?: boolean
  tourSlot?: { position: 'intro' | 'stats' | 'training' | 'arena'; content: ReactNode }
}

export function buildDemoLeaderboard(roleId: RoleId, bestScore: number | null) {
  const demoLeaderboard = demoLeaderboards[roleId]
  return [
    ...demoLeaderboard.map((participant, order) => ({ ...participant, order, isPlayer: false })),
    { name: 'Ваш результат', score: bestScore, order: demoLeaderboard.length, isPlayer: true },
  ]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.order - b.order)
    .map((participant, index) => ({ ...participant, place: index + 1 }))
}

export function RoleHomePage({
  role,
  roleProgress,
  energy,
  streak,
  onChangeRole,
  onOpenTraining,
  onOpenWorkshop,
  onOpenArena,
  onOpenAISettings,
  leviGuideActive = false,
  tourSlot,
}: RoleHomePageProps) {
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false)
  const bestScore = Object.values(roleProgress.bosses).reduce<number | null>(
    (best, boss) => boss.bestScore === null ? best : Math.max(best ?? 0, boss.bestScore),
    null,
  )
  const leaderboard = buildDemoLeaderboard(role.id, bestScore)
  const player = leaderboard.find((participant) => participant.isPlayer)!
  const showPlayerSeparately = !leaderboardExpanded && player.place > 5
  const visibleLeaderboard = leaderboardExpanded
    ? leaderboard
    : showPlayerSeparately ? [...leaderboard.slice(0, 4), player] : leaderboard.slice(0, 5)

  return (
    <div className="app-shell">
      <AppHeader
        role={role}
        roleProgress={roleProgress}
        energy={energy}
        streak={streak}
        onChangeRole={onChangeRole}
      />
      {tourSlot?.position === 'stats' && <div className="levi-home-stats-slot">{tourSlot.content}</div>}

      <main className="home-content">
        <section className="home-intro">
          <span className="section-kicker">{role.focus}</span>
          <h1>Готовы к переговорам?</h1>
          <p>{role.description}</p>
        </section>
        {tourSlot?.position === 'intro' && tourSlot.content}

        <section className="activity-list" aria-label="Режимы практики">
          <article className="activity activity-available" data-tour="arena">
            <div>
              <span className="activity-number">01</span>
              <h2>Arena</h2>
              <p>Применяйте переговорные навыки в диалоге с оппонентом.</p>
            </div>
            {tourSlot?.position === 'arena' && tourSlot.content}
            <button className="primary-button" type="button" onClick={onOpenArena} data-tour="arena-entry">
              Открыть арену
            </button>
          </article>

          <article className="activity activity-available" data-tour="training">
            <div>
              <span className="activity-number">02</span>
              <h2>Training</h2>
              <p>Тренировка отдельных навыков с объяснением ответов.</p>
            </div>
            {tourSlot?.position === 'training' && tourSlot.content}
            <button className="primary-button" type="button" onClick={onOpenTraining}>
              Начать тренировку
            </button>
          </article>
        </section>
        {onOpenWorkshop && <div className="home-workshop-entry">
          <div>
            <span className="section-kicker">СКОРО</span>
            <h2>Мастерская</h2>
            <p>Создавай своих оппонентов, сценарии и испытания</p>
          </div>
          <button className="text-button" type="button" onClick={onOpenWorkshop}>Заглянуть в мастерскую →</button>
        </div>}
        <section className="home-leaderboard" aria-labelledby="home-leaderboard-title">
          <div className="home-leaderboard-intro">
            <div>
              <span className="section-kicker">Демо</span>
              <h2 id="home-leaderboard-title">Рейтинг переговорщиков</h2>
            </div>
          </div>
          <div>
            <ol className="home-leaderboard-list" id="home-leaderboard-entries">
              {visibleLeaderboard.map((participant) => (
                <li key={participant.name} className={participant.isPlayer ? 'home-leaderboard-you' : undefined}>
                  <span className="home-leaderboard-place">{String(participant.place).padStart(2, '0')}</span>
                  <span>{participant.name}</span>
                  <strong>{participant.score ?? '—'}{participant.score !== null && <small> / 100</small>}</strong>
                </li>
              ))}
            </ol>
            <button className="text-button home-leaderboard-toggle" type="button"
              aria-expanded={leaderboardExpanded} aria-controls="home-leaderboard-entries"
              onClick={() => setLeaderboardExpanded((expanded) => !expanded)}>
              {leaderboardExpanded ? 'Свернуть' : 'Показать весь рейтинг'}
            </button>
          </div>
        </section>
        <button className="text-button ai-settings-entry" type="button" onClick={onOpenAISettings}>AI Settings</button>
        {!leviGuideActive && <SleepingLevi guideActive={leviGuideActive} />}
      </main>
    </div>
  )
}
