export function LevelUPLogo() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="6" fill="currentColor" />
      <path d="M8 11h4.5v9.5H21V25H8Z" fill="#fff" />
      <path d="M22 6c1.2 3.2 1.8 3.8 5 5-3.2 1.2-3.8 1.8-5 5-1.2-3.2-1.8-3.8-5-5 3.2-1.2 3.8-1.8 5-5Z" fill="#fff" />
    </svg>
  )
}

export function EnergyIcon() {
  return (
    <svg className="header-stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M15 2 3 13h8l-2 9L21 11h-8Z" />
    </svg>
  )
}

export function StreakIcon() {
  return (
    <svg className="header-stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10 2c1 5-6 7-6 13a8 8 0 0 0 6 7c-1-3 0-5 2-7 2 2 4 4 3 7a8 8 0 0 0 5-7c0-3-1-5-3-7l-3 4c1-5-1-8-4-10Z" />
    </svg>
  )
}

const arenaIconProps = {
  className: 'arena-ui-icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

export function CommunicationIcon() {
  return <svg {...arenaIconProps}><path d="M4 5h16v11H9l-5 4Z" /><path d="M8 9h8M8 12h5" /></svg>
}

export function PressureIcon() {
  return <svg {...arenaIconProps}><path d="M5 17a7 7 0 1 1 14 0" /><path d="m12 14 4-4" /><path d="M4 20h16" /></svg>
}

export function LockIcon() {
  return <svg {...arenaIconProps}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
}

export function ScenarioTagIcon() {
  return <svg {...arenaIconProps}><path d="M20 13 13 20 4 11V4h7Z" /><circle cx="8.5" cy="8.5" r="1" /></svg>
}

export function GoalIcon() {
  return <svg {...arenaIconProps}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v3M22 12h-3" /></svg>
}

export function KnownInfoIcon() {
  return <svg {...arenaIconProps}><path d="M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2Z" /><path d="M9 2h6v4H9ZM9 11h6M9 15h4" /></svg>
}
