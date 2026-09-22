import { useState } from 'react'
import { Brand } from '../components/Brand'

const onboardingSteps = [
  {
    label: 'Negotiate',
    title: 'Начни с переговоров',
    description:
      'Выбери роль и сразу переходи в Arena, чтобы практиковать переговоры.',
  },
  {
    label: 'Feedback → Improve',
    title: 'Разбирай опыт и улучшай навыки',
    description:
      'После переговоров смотри результат. Отдельные навыки можно отработать в Training и получить XP.',
  },
  {
    label: 'Try Again',
    title: 'Пробуй снова',
    description:
      'Возвращайся в Arena, меняй подход и развивай выбранную профессиональную роль.',
  },
] as const

type OnboardingPageProps = {
  onComplete: () => void
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = onboardingSteps[stepIndex]
  const isLastStep = stepIndex === onboardingSteps.length - 1

  function goNext() {
    if (isLastStep) {
      onComplete()
      return
    }

    setStepIndex((current) => current + 1)
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <Brand />

        <section className="onboarding-content" aria-live="polite">
          <span className="step-label">{step.label}</span>
          <h1>{step.title}</h1>
          <p>{step.description}</p>
        </section>

        <div className="onboarding-footer">
          <div className="step-dots" aria-label={`Шаг ${stepIndex + 1} из ${onboardingSteps.length}`}>
            {onboardingSteps.map((item, index) => (
              <span
                className={index === stepIndex ? 'step-dot is-active' : 'step-dot'}
                key={item.label}
              />
            ))}
          </div>
          <button className="primary-button" type="button" onClick={goNext}>
            {isLastStep ? 'Выбрать роль' : 'Далее'}
          </button>
        </div>
      </div>
    </main>
  )
}
