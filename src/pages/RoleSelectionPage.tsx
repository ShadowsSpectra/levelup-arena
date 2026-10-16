import type { ReactNode } from 'react'
import { Brand } from '../components/Brand'
import { roles, type RoleId } from '../config/roles'

type RoleSelectionPageProps = {
  onSelectRole: (roleId: RoleId) => void
  children?: ReactNode
}

export function RoleSelectionPage({ onSelectRole, children }: RoleSelectionPageProps) {
  return (
    <main className="selection-page">
      <div className="page-container">
        <Brand />
        <section className="page-intro" aria-labelledby="role-selection-title">
          <span className="section-kicker">Твоя траектория</span>
          <h1 id="role-selection-title">Выбери профессиональную роль</h1>
          <p>У каждой роли будет свой прогресс и набор переговорных ситуаций.</p>
        </section>

        {children}
        <div className="role-list" data-tour="role-cards">
          {roles.map((role) => (
            <button
              className="role-option"
              key={role.id}
              type="button"
              data-tour="role-card"
              data-tour-role={role.id}
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
