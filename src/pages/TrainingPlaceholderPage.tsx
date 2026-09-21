import { Brand } from '../components/Brand'
import type { Role } from '../config/roles'

type TrainingPlaceholderPageProps = {
  role: Role
  onBack: () => void
}

export function TrainingPlaceholderPage({
  role,
  onBack,
}: TrainingPlaceholderPageProps) {
  return (
    <main className="placeholder-page">
      <div className="placeholder-shell">
        <Brand />
        <button className="back-button" type="button" onClick={onBack}>
          ← Назад на главную
        </button>
        <section className="placeholder-content">
          <span className="section-kicker">{role.name}</span>
          <h1>Training</h1>
          <p>
            Механика тренировки появится на следующем этапе. Сейчас переход и
            возврат уже работают.
          </p>
        </section>
      </div>
    </main>
  )
}
