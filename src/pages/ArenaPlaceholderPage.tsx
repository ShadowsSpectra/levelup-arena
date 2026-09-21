import { AppHeader } from '../components/AppHeader'
import type { Role } from '../config/roles'
import type { getRoleProgress } from '../services/progression'

type ArenaPlaceholderPageProps = {
  role: Role
  roleProgress: ReturnType<typeof getRoleProgress>
  energy: number
  streak: number
  onBack: () => void
  onChangeRole: () => void
}

export function ArenaPlaceholderPage({
  role,
  roleProgress,
  energy,
  streak,
  onBack,
  onChangeRole,
}: ArenaPlaceholderPageProps) {
  return (
    <div className="app-shell">
      <AppHeader
        role={role}
        roleProgress={roleProgress}
        energy={energy}
        streak={streak}
        onChangeRole={onChangeRole}
      />
      <main className="training-message">
        <span className="section-kicker">Arena</span>
        <h1>Arena открыта</h1>
        <p>Переговорный сценарий появится на следующем этапе.</p>
        <button className="secondary-action-button" type="button" onClick={onBack}>
          Вернуться на Role Home
        </button>
      </main>
    </div>
  )
}
