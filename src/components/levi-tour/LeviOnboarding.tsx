import { useEffect, useRef, useState } from 'react'
import type { RoleId } from '../../config/roles'
import { RoleSelectionPage } from '../../pages/RoleSelectionPage'
import { scheduleLeviGreeting } from '../../services/leviTour'
import { startLeviRoleHighlight } from '../../services/leviTourHighlight'
import { LeviSpotlight } from './LeviSpotlight'
import { LeviTour } from './LeviTour'
import './levi-onboarding.css'

type Props = { selectedRoleId: RoleId | null; onSelectRole: (roleId: RoleId) => void; onContinue: () => void }

export function LeviOnboarding({ selectedRoleId, onSelectRole, onContinue }: Props) {
  const [greeting, setGreeting] = useState<0 | 1>(0)
  const [skipped, setSkipped] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const highlight = !skipped && greeting === 1

  useEffect(() => {
    if (skipped || greeting !== 0) return
    return scheduleLeviGreeting(() => setGreeting(1))
  }, [greeting, skipped])

  useEffect(() => {
    if (!highlight || !root.current) return
    return startLeviRoleHighlight(root.current)
  }, [highlight])

  return <div className="levi-onboarding" ref={root} data-tour-active={highlight}>
    <RoleSelectionPage selectedRoleId={selectedRoleId} onSelectRole={onSelectRole} onContinue={onContinue}>
      {!skipped && <div className="levi-onboarding__greetings">
        {([0, 1] as const).map((step) => <div className="levi-onboarding__greeting" key={step}
          aria-hidden={greeting !== step} inert={greeting !== step}>
          <LeviTour greeting={step} reaction={null} onNext={() => setGreeting(1)} onSkip={() => setSkipped(true)} />
        </div>)}
      </div>}
    </RoleSelectionPage>
    <LeviSpotlight root={root} />
  </div>
}
