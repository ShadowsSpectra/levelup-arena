import { energyRules } from '../config/progression'
import type { Role } from '../config/roles'
import type { getRoleProgress } from '../services/progression'
import { Brand } from './Brand'

type AppHeaderProps = {
  role: Role
  roleProgress: ReturnType<typeof getRoleProgress>
  energy: number
  streak: number
  onChangeRole: () => void
}

export function AppHeader({ role, roleProgress, energy, streak, onChangeRole }: AppHeaderProps) {
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
          <span>Level {roleProgress.level}</span>
          <div
            className="xp-track"
            aria-label={roleProgress.nextLevelXp === null
              ? `${roleProgress.xp} XP, максимальный уровень`
              : `${roleProgress.xp} из ${roleProgress.nextLevelXp} XP`}
          >
            <span className="xp-fill" style={{ width: `${roleProgress.progressPercent}%` }} />
          </div>
          <span className="stat-detail">
            {roleProgress.nextLevelXp === null
              ? `${roleProgress.xp} XP`
              : `${roleProgress.xp}/${roleProgress.nextLevelXp} XP`}
          </span>
        </div>
        <span className="stat-item" title="Energy">
          ⚡ {energy}/{energyRules.maximum}
        </span>
        <span className="stat-item" title="Streak">
          🔥 {streak}
        </span>
      </div>
    </header>
  )
}
