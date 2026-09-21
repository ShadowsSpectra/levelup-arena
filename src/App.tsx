import { ArenaPlaceholderPage } from './pages/ArenaPlaceholderPage'
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
      <ArenaPlaceholderPage
        role={selectedRole}
        roleProgress={roleProgress}
        energy={progression.energy}
        streak={progression.streak}
        onBack={openHome}
        onChangeRole={changeRole}
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
