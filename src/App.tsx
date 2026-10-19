import { ArenaPage } from './pages/ArenaPage'
import { LeviOnboarding } from './components/levi-tour/LeviOnboarding'
import { LeviHomeGuide } from './components/levi-tour/LeviHomeGuide'
import { LeviSpotlight } from './components/levi-tour/LeviSpotlight'
import { LeviArenaProduction } from './components/levi-tour/LeviArenaProduction'
import { RoleHomePage } from './pages/RoleHomePage'
import { RoleSelectionPage } from './pages/RoleSelectionPage'
import { TrainingPage } from './pages/TrainingPage'
import { WorkshopPage } from './pages/WorkshopPage'
import { useAppState } from './state/useAppState'
import { useLeviHomeGuide } from './state/useLeviHomeGuide'
import './components/levi-tour/levi-home-guide.css'
import './components/levi-tour/levi-arena-guide.css'

export function App() {
  const [aiSettingsOpen, setAISettingsOpen] = useState(false)
  const [aiSettingsVersion, setAISettingsVersion] = useState(0)
  const {
    screen,
    workshopOrigin,
    selectedRole,
    progression,
    roleProgress,
    leviLevelUp,
    clearLeviLevelUp,
    continueOnboarding,
    selectRole,
    changeRole,
    openTraining,
    openWorkshop,
    openArena,
    completeTraining,
    completeArena,
    completeArenaEvaluation,
    openHome,
  } = useAppState()
  const homeRoot = useRef<HTMLDivElement>(null)
  const arenaRoot = useRef<HTMLDivElement>(null)
  const homeGuide = useLeviHomeGuide(screen === 'home')

  if (screen === 'onboarding') {
    return <LeviOnboarding selectedRoleId={selectedRole?.id ?? null} onSelectRole={(roleId) => {
      homeGuide.selectOnboardingRole(roleId)
      selectRole(roleId)
    }} onContinue={continueOnboarding} onSkip={homeGuide.finish} />
  }

  if (screen === 'role-selection') {
    return <RoleSelectionPage onSelectRole={selectRole} />
  }

  if (!selectedRole || !roleProgress) {
    return <RoleSelectionPage onSelectRole={selectRole} />
  }

  if (screen === 'training') {
    return (
      <TrainingPage
        role={selectedRole}
        roleProgress={roleProgress}
        energy={progression.energy}
        streak={progression.streak}
        onBack={openHome}
        onOpenArena={openArena}
        onChangeRole={changeRole}
        onComplete={(result, questions) => completeTraining(selectedRole.id, result, questions)}
        leviLevelUp={leviLevelUp?.source === 'training' && leviLevelUp.roleId === selectedRole.id ? leviLevelUp : null}
        onLeviLevelUpConsumed={clearLeviLevelUp}
      />
    )
  }

  if (screen === 'workshop' && workshopOrigin === 'home') {
    return <WorkshopPage role={selectedRole} roleProgress={roleProgress} energy={progression.energy}
      streak={progression.streak} onBack={openHome} onChangeRole={changeRole} />
  }

  if (screen === 'arena' || (screen === 'workshop' && workshopOrigin === 'arena')) {
    return (
      <>
      <div className="levi-arena-root" ref={arenaRoot} hidden={screen !== 'arena'}>
      <ArenaPage
        role={selectedRole}
        roleProgress={roleProgress}
        energy={progression.energy}
        streak={progression.streak}
        onBack={openHome}
        onChangeRole={changeRole}
        onComplete={completeArena}
        onEvaluated={(session, result) => completeArenaEvaluation(selectedRole.id, session, result)}
        onOpenAISettings={() => setAISettingsOpen(true)}
        aiSettingsVersion={aiSettingsVersion}
        onOpenWorkshop={openWorkshop}
        leviLevelUp={leviLevelUp?.source === 'arena' && leviLevelUp.roleId === selectedRole.id ? leviLevelUp : null}
        onLeviLevelUpConsumed={clearLeviLevelUp}
        selectionOverlay={screen === 'arena' ? <LeviArenaProduction root={arenaRoot} /> : undefined}
      />
      </div>
      {screen === 'workshop' && <WorkshopPage role={selectedRole} roleProgress={roleProgress}
        energy={progression.energy} streak={progression.streak} onBack={openArena}
        onChangeRole={changeRole} backLabel="← Назад в Arena" />}
      {screen === 'arena' && aiSettingsOpen && <AISettingsDialog onClose={() => setAISettingsOpen(false)}
        onSaved={() => setAISettingsVersion((version) => version + 1)} />}
      </>
    )
  }

  return (
    <div className="levi-home-root" ref={homeRoot}>
    <RoleHomePage
      role={selectedRole}
      roleProgress={roleProgress}
      energy={progression.energy}
      streak={progression.streak}
      onChangeRole={changeRole}
      onOpenTraining={openTraining}
      onOpenWorkshop={openWorkshop}
      onOpenArena={openArena}
      onOpenAISettings={() => setAISettingsOpen(true)}
    />
    {homeGuide.status !== 'completed' && <>
      <LeviHomeGuide root={homeRoot} step={homeGuide.status === 'home' ? homeGuide.step : undefined}
        reaction={homeGuide.reaction} final={false} onNext={homeGuide.next} onSkip={homeGuide.finish} />
      <LeviSpotlight root={homeRoot} />
    </>}
    {aiSettingsOpen && <AISettingsDialog onClose={() => setAISettingsOpen(false)}
      onSaved={() => setAISettingsVersion((version) => version + 1)} />}
    </div>
  )
}
import { useRef, useState } from 'react'
import { AISettingsDialog } from './components/AISettingsDialog'
