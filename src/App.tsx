import { OnboardingPage } from './pages/OnboardingPage'
import { RoleHomePage } from './pages/RoleHomePage'
import { RoleSelectionPage } from './pages/RoleSelectionPage'
import { TrainingPlaceholderPage } from './pages/TrainingPlaceholderPage'
import { useAppState } from './state/useAppState'

export function App() {
  const {
    screen,
    selectedRole,
    completeOnboarding,
    selectRole,
    changeRole,
    openTraining,
    openHome,
  } = useAppState()

  if (screen === 'onboarding') {
    return <OnboardingPage onComplete={completeOnboarding} />
  }

  if (screen === 'role-selection') {
    return <RoleSelectionPage onSelectRole={selectRole} />
  }

  if (!selectedRole) {
    return <RoleSelectionPage onSelectRole={selectRole} />
  }

  if (screen === 'training') {
    return <TrainingPlaceholderPage role={selectedRole} onBack={openHome} />
  }

  return (
    <RoleHomePage
      role={selectedRole}
      onChangeRole={changeRole}
      onOpenTraining={openTraining}
    />
  )
}
