import { ArenaPage } from './pages/ArenaPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { RoleHomePage } from './pages/RoleHomePage'
import { RoleSelectionPage } from './pages/RoleSelectionPage'
import { TrainingPage } from './pages/TrainingPage'
import { useAppState } from './state/useAppState'

export function App() {
  const {
    screen,
    selectedRole,
    progression,
    roleProgress,
    completeOnboarding,
    selectRole,
    changeRole,
    openTraining,
    openArena,
    completeTraining,
    completeArena,
    openHome,
  } = useAppState()

  if (screen === 'onboarding') {
    return <OnboardingPage onComplete={completeOnboarding} />
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
      />
    )
  }

  if (screen === 'arena') {
    return (
      <ArenaPage
        role={selectedRole}
        roleProgress={roleProgress}
        energy={progression.energy}
        streak={progression.streak}
        onBack={openHome}
        onChangeRole={changeRole}
        onComplete={completeArena}
      />
    )
  }

  return (
    <RoleHomePage
      role={selectedRole}
      roleProgress={roleProgress}
      energy={progression.energy}
      streak={progression.streak}
      onChangeRole={changeRole}
      onOpenTraining={openTraining}
      onOpenArena={openArena}
    />
  )
}
