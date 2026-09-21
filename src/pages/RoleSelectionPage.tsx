import { Brand } from '../components/Brand'
import { roles, type RoleId } from '../config/roles'

type RoleSelectionPageProps = {
  onSelectRole: (roleId: RoleId) => void
}

export function RoleSelectionPage({ onSelectRole }: RoleSelectionPageProps) {
  return (
    <main className="selection-page">
      <div className="page-container">
        <Brand />
        <section className="page-intro" aria-labelledby="role-selection-title">
          <span className="section-kicker">Твоя траектория</span>
          <h1 id="role-selection-title">Выбери профессиональную роль</h1>
          <p>У каждой роли будет свой прогресс и набор переговорных ситуаций.</p>
        </section>

        <div className="role-list">
          {roles.map((role) => (
            <button
              className="role-option"
              key={role.id}
              type="button"
              onClick={() => onSelectRole(role.id)}
            >
              <span className="role-short-name">{role.shortName}</span>
              <span className="role-name">{role.name}</span>
              <span className="role-description">{role.description}</span>
              <span className="role-action">Выбрать →</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
