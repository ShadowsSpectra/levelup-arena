import { AppHeader } from '../components/AppHeader'
import type { Role } from '../config/roles'

type RoleHomePageProps = {
  role: Role
  onChangeRole: () => void
  onOpenTraining: () => void
}

export function RoleHomePage({
  role,
  onChangeRole,
  onOpenTraining,
}: RoleHomePageProps) {
  return (
    <div className="app-shell">
      <AppHeader role={role} onChangeRole={onChangeRole} />

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
              Начать Training
            </button>
          </article>

          <article className="activity activity-locked">
            <div>
              <span className="activity-number">02</span>
              <h2>Arena</h2>
              <p>Применение навыков в переговорах с AI-соперником.</p>
            </div>
            <div className="lock-message">
              <span aria-hidden="true">🔒</span>
              <span>Набери минимум 80% на Training, чтобы открыть Arena.</span>
            </div>
            <button className="secondary-button" type="button" disabled>
              Arena заблокирована
            </button>
          </article>
        </section>
      </main>
    </div>
  )
}
