import { AppHeader } from '../components/AppHeader'
import type { Role } from '../config/roles'
import { demoLeaderboard } from '../content/demoVision'
import type { getRoleProgress } from '../services/progression'

type RoleHomePageProps = {
  role: Role
  roleProgress: ReturnType<typeof getRoleProgress>
  energy: number
  streak: number
  onChangeRole: () => void
  onOpenTraining: () => void
  onOpenArena: () => void
  onOpenAISettings: () => void
}

export function RoleHomePage({
  role,
  roleProgress,
  energy,
  streak,
  onChangeRole,
  onOpenTraining,
  onOpenArena,
  onOpenAISettings,
}: RoleHomePageProps) {
  const bestScore = Object.values(roleProgress.bosses).reduce<number | null>(
    (best, boss) => boss.bestScore === null ? best : Math.max(best ?? 0, boss.bestScore),
    null,
  )

  return (
    <div className="app-shell">
      <AppHeader
        role={role}
        roleProgress={roleProgress}
        energy={energy}
        streak={streak}
        onChangeRole={onChangeRole}
      />

      <main className="home-content">
        <section className="home-intro">
          <span className="section-kicker">{role.focus}</span>
          <h1>Готовы к переговорам?</h1>
          <p>{role.description}</p>
        </section>

        <section className="activity-list" aria-label="Режимы практики">
          <article className="activity activity-available">
            <div>
              <span className="activity-number">01</span>
              <h2>Arena</h2>
              <p>Применяйте переговорные навыки в диалоге с оппонентом.</p>
            </div>
            <button className="primary-button" type="button" onClick={onOpenArena}>
              Открыть арену
            </button>
          </article>

          <article className="activity activity-available">
            <div>
              <span className="activity-number">02</span>
              <h2>Training</h2>
              <p>Тренировка отдельных навыков с объяснением ответов.</p>
            </div>
            <button className="primary-button" type="button" onClick={onOpenTraining}>
              Начать тренировку
            </button>
          </article>
        </section>
        <section className="home-leaderboard" aria-labelledby="home-leaderboard-title">
          <div className="home-leaderboard-intro">
            <div>
              <span className="section-kicker">Демо</span>
              <h2 id="home-leaderboard-title">Рейтинг переговорщиков</h2>
            </div>
          </div>
          <ol className="home-leaderboard-list">
            {demoLeaderboard.map((participant, index) => (
              <li key={participant.name}>
                <span className="home-leaderboard-place">{String(index + 1).padStart(2, '0')}</span>
                <span>{participant.name}</span>
                <strong>{participant.score}<small> / 100</small></strong>
              </li>
            ))}
            <li className="home-leaderboard-you">
              <span className="home-leaderboard-place">—</span>
              <span>Ваш результат</span>
              <strong>{bestScore ?? '—'}{bestScore !== null && <small> / 100</small>}</strong>
            </li>
          </ol>
        </section>
        <button className="text-button ai-settings-entry" type="button" onClick={onOpenAISettings}>AI Settings</button>
      </main>
    </div>
  )
}
