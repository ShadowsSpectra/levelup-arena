import { AppHeader } from '../components/AppHeader'
import type { Role } from '../config/roles'
import type { getRoleProgress } from '../services/progression'

type RoleHomePageProps = {
  role: Role
  roleProgress: ReturnType<typeof getRoleProgress>
  energy: number
  streak: number
  onChangeRole: () => void
  onOpenTraining: () => void
  onOpenArena: () => void
}

export function RoleHomePage({
  role,
  roleProgress,
  energy,
  streak,
  onChangeRole,
  onOpenTraining,
  onOpenArena,
}: RoleHomePageProps) {
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
          <h1>Готовы к следующей тренировке?</h1>
          <p>{role.description}</p>
        </section>

        <section className="activity-list" aria-label="Режимы практики">
          <article className="activity activity-available">
            <div>
              <span className="activity-number">01</span>
              <h2>Training</h2>
              <p>Короткая серия заданий с объяснением каждого ответа.</p>
            </div>
            <button className="primary-button" type="button" onClick={onOpenTraining}>
              Начать тренировку
            </button>
          </article>

          <article className={roleProgress.arenaUnlocked ? 'activity' : 'activity activity-locked'}>
            <div>
              <span className="activity-number">02</span>
              <h2>Arena</h2>
              <p>Применение навыков в переговорах с AI-соперником.</p>
            </div>
            {roleProgress.arenaUnlocked ? (
              <button className="primary-button" type="button" onClick={onOpenArena}>
                Открыть арену
              </button>
            ) : (
              <>
                <div className="lock-message">
                  <span aria-hidden="true">🔒</span>
                  <span>Набери минимум 80% на Training, чтобы открыть Arena.</span>
                </div>
                <button className="secondary-button" type="button" disabled>
                  Арена заблокирована
                </button>
              </>
            )}
          </article>
        </section>
      </main>
    </div>
  )
}
