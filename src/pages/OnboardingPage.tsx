import { useState } from 'react'
import { Brand } from '../components/Brand'

const onboardingSteps = [
  {
    label: 'Learn',
    title: 'Тренируй переговорные навыки',
    description:
      'Проходи короткие практические задания и сразу разбирай, почему ответ работает.',
  },
  {
    label: 'Prove → Negotiate',
    title: 'Докажи готовность и переходи к практике',
    description:
      'Набери не меньше 80% в Training, чтобы открыть переговоры с AI-соперником в Arena.',
  },
  {
    label: 'Feedback → XP → Repeat',
    title: 'Получай обратную связь и расти',
    description:
      'Анализируй результат, развивай выбранную профессиональную роль и повторяй цикл.',
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
