import { initialRoleStats } from '../config/displayDefaults'
import type { Role } from '../config/roles'
import { Brand } from './Brand'

type AppHeaderProps = {
  role: Role
  onChangeRole: () => void
}

export function AppHeader({ role, onChangeRole }: AppHeaderProps) {
  const stats = initialRoleStats
  const progress = Math.round((stats.xp / stats.nextLevelXp) * 100)

  return (
    <header className="app-header">
      <div className="header-main">
        <Brand />
        <div className="role-control">
          <span className="current-role">{role.name}</span>
          <button className="text-button" type="button" onClick={onChangeRole}>
            Сменить роль
          </button>
        </div>
      </div>

      <div className="player-stats" aria-label="Прогресс роли">
        <div className="level-stat">
          <span>Level {stats.level}</span>
          <div className="xp-track" aria-label={`${stats.xp} из ${stats.nextLevelXp} XP`}>
            <span className="xp-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="stat-detail">{stats.xp}/{stats.nextLevelXp} XP</span>
        </div>
        <span className="stat-item" title="Energy">
          ⚡ {stats.energy}/{stats.maxEnergy}
        </span>
        <span className="stat-item" title="Streak">
          🔥 {stats.streak}
        </span>
      </div>
    </header>
  )
}
