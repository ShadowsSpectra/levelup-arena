import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LeviTour } from '../../components/levi-tour/LeviTour'
import { getRoleById, type RoleId } from '../../config/roles'
import { RoleSelectionPage } from '../../pages/RoleSelectionPage'
import { browserLeviTourStore, createLeviTourStore, type LeviTourStore } from '../../services/leviTour'
import { appStorage } from '../../services/storage'
import { useLeviTour } from '../../state/useLeviTour'
import { startLeviRoleHighlight } from '../../services/leviTourHighlight'
import '../../styles/global.css'
import './leviTour.css'

function createExistingUserPreview() {
  // Entirely in memory: no writes to the visitor's role, progression or legacy flag.
  const data = new Map([
    ['levelup-arena:onboarding-complete', 'true'],
    ['levelup-arena:selected-role', 'sales_manager'],
    ['levelup-arena:progression-v1', JSON.stringify({ roles: { sales_manager: { xp: 120 } }, energy: 3, streak: 5 })],
  ])
  return createLeviTourStore({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } })
}

function TourPreview({ store, existingUser }: { store: LeviTourStore; existingUser: boolean }) {
  const tour = useLeviTour(store)
  const [choice, setChoice] = useState<RoleId | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const savedRole = existingUser ? getRoleById('sales_manager') : getRoleById(appStorage.getSelectedRole())

  useEffect(() => {
    if (!tour.highlightRoles || !root.current) return
    return startLeviRoleHighlight(root.current)
  }, [tour.highlightRoles, tour.run])

  function selectPreviewRole(roleId: RoleId) {
    setChoice(roleId)
    tour.recordRoleSelection(roleId)
  }

  return (
    <div className="levi-tour-preview" ref={root} data-tour-active={tour.highlightRoles}>
      <aside className="levi-tour-preview__tools" aria-label="Управление dev-проверкой">
        <strong>LeviTour · только разработка</strong>
        <p>Настоящий экран выбора роли. Выбор здесь остаётся в памяти предпросмотра.</p>
        <p>Сохранённая роль: {savedRole?.name ?? 'не выбрана'}. {existingUser && 'Тестовые данные: старый onboarding пройден, 120 XP, Energy 3/6, Streak 5.'}</p>
        <button className="secondary-action-button" type="button" onClick={() => { setChoice(null); tour.restart() }}>
          Повторить экскурсию
        </button>
        <p role="status">{tour.status === 'active' ? 'Выберите роль или пропустите экскурсию.'
          : tour.status === 'reaction' ? `Выбор в предпросмотре: ${getRoleById(choice)?.name}. Реакция Леви — ниже. Полная версия 1 не завершена.`
            : tour.status === 'completed' ? 'Первый dev-срез завершён. Полная версия 1 не завершена.'
              : tour.status === 'skipped' ? 'Первый dev-срез пропущен. Полная версия 1 не завершена.'
                : 'Первый dev-срез уже просмотрен. Можно запустить экскурсию вручную.'}</p>
      </aside>
      <RoleSelectionPage onSelectRole={selectPreviewRole}>
        {(tour.status === 'active' || tour.status === 'reaction') &&
          <LeviTour greeting={tour.greeting} reaction={tour.reaction} onNext={tour.advanceGreeting}
            onContinue={tour.continue} onSkip={tour.skip} />}
      </RoleSelectionPage>
    </div>
  )
}

function LeviTourPlayground() {
  const [fixture, setFixture] = useState<{ id: number; existingUser: boolean; store: LeviTourStore }>({
    id: 0, existingUser: false, store: browserLeviTourStore,
  })
  return (
    <>
      <nav className="levi-tour-preview__modes" aria-label="Тестовые условия экскурсии">
        <button type="button" onClick={() => setFixture((current) => ({ id: current.id + 1, existingUser: false, store: browserLeviTourStore }))}>
          Данные этого браузера
        </button>
        <button type="button" onClick={() => setFixture((current) => ({ id: current.id + 1, existingUser: true, store: createExistingUserPreview() }))}>
          Проверить существующего пользователя
        </button>
        <a href="/">Mascot Playground</a>
      </nav>
      <TourPreview key={fixture.id} store={fixture.store} existingUser={fixture.existingUser} />
    </>
  )
}

if (import.meta.env.DEV) {
  createRoot(document.getElementById('root')!).render(<StrictMode><LeviTourPlayground /></StrictMode>)
}
