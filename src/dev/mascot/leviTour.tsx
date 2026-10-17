import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LeviTour } from '../../components/levi-tour/LeviTour'
import { LeviHomeGuide } from '../../components/levi-tour/LeviHomeGuide'
import { LeviSpotlight } from '../../components/levi-tour/LeviSpotlight'
import { getRoleById, type RoleId } from '../../config/roles'
import { RoleSelectionPage } from '../../pages/RoleSelectionPage'
import { RoleHomePage } from '../../pages/RoleHomePage'
import { browserLeviTourStore, createLeviTourStore, type LeviTourStore } from '../../services/leviTour'
import { createInitialProgression, getRoleProgress, type ProgressionState } from '../../services/progression'
import { appStorage } from '../../services/storage'
import { useLeviTour } from '../../state/useLeviTour'
import { startLeviRoleHighlight } from '../../services/leviTourHighlight'
import '../../styles/global.css'
import './leviTour.css'

type Fixture = { id: number; label: string; roleId: RoleId | null; progression: ProgressionState; store: LeviTourStore }

function createMemoryPreview(existing: boolean): Omit<Fixture, 'id'> {
  const data = new Map([
    ['levelup-arena:onboarding-complete', 'true'],
  ])
  const progression = createInitialProgression()
  if (existing) {
    progression.roles.sales_manager.xp = 120
    progression.energy = 3
    progression.streak = 5
  }
  return {
    label: existing ? 'Существующий пользователь · снимок в памяти' : 'Новый пользователь · снимок в памяти',
    roleId: existing ? 'sales_manager' : null, progression,
    store: createLeviTourStore({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }),
  }
}

function createBrowserPreview(): Omit<Fixture, 'id'> {
  return { label: 'Данные браузера · только чтение игрового снимка', roleId: appStorage.getSelectedRole(), progression: appStorage.getProgression(), store: browserLeviTourStore }
}

function TourPreview({ fixture }: { fixture: Fixture }) {
  const tour = useLeviTour(fixture.store, fixture.roleId)
  const [roleId, setRoleId] = useState<RoleId | null>(fixture.roleId)
  const [screen, setScreen] = useState<'role-selection' | 'home'>(fixture.roleId ? 'home' : 'role-selection')
  const [notice, setNotice] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const role = getRoleById(roleId)

  useEffect(() => {
    if (!tour.highlightRoles || !root.current) return
    return startLeviRoleHighlight(root.current)
  }, [tour.highlightRoles, tour.run])

  function selectPreviewRole(roleId: RoleId) {
    // Immediate screen transition, just as in App: no timer/confirmation/AI in this path.
    setRoleId(roleId)
    setScreen('home')
    setNotice('')
    tour.recordRoleSelection(roleId)
  }

  const step = tour.status === 'home' ? tour.homeStep : undefined
  const showingHomeGuide = ['reaction', 'home', 'final'].includes(tour.status)
  const homeGuide = <LeviHomeGuide key={`${tour.run}:${tour.status}:${step ?? ''}`} root={root} step={step}
    reaction={tour.status === 'reaction' ? tour.reaction : null} final={tour.status === 'final'}
    onNext={tour.status === 'final' ? tour.done : tour.continue} onSkip={tour.skip} />

  return (
    <div className="levi-tour-preview" ref={root} data-tour-active={tour.highlightRoles}>
      <aside className="levi-tour-preview__tools" aria-label="Управление dev-проверкой">
        <strong>LeviTour · только разработка</strong>
        <p>{fixture.label}. Роль и прогресс в этом стенде не записываются в игровое хранилище.</p>
        <p>Роль предпросмотра: {role?.name ?? 'не выбрана'}. Полная экскурсия версии 1 не отмечается завершённой.</p>
        <button className="secondary-action-button" type="button" onClick={() => {
          setScreen(roleId ? 'home' : 'role-selection'); setNotice(''); tour.restart(Boolean(roleId))
        }}>
          Повторить экскурсию
        </button>
        <p role="status">{notice || (tour.status === 'active' ? 'Выберите роль или пропустите экскурсию.'
          : tour.status === 'completed' ? 'Dev-экскурсия закрыта. Arena Setup ещё впереди.'
            : tour.status === 'skipped' ? 'Экскурсия пропущена.' : tour.status === 'inactive'
              ? 'Экскурсия не активна. Можно запустить вручную.' : 'Экскурсия продолжается на настоящем Home.')}</p>
      </aside>
      {screen === 'role-selection' || !role ? (
        <RoleSelectionPage onSelectRole={selectPreviewRole}>
          {tour.status === 'active' && <LeviTour greeting={tour.greeting} reaction={null} onNext={tour.advanceGreeting} onSkip={tour.skip} />}
        </RoleSelectionPage>
      ) : (
        <RoleHomePage role={role} roleProgress={getRoleProgress(fixture.progression, role.id)} energy={fixture.progression.energy} streak={fixture.progression.streak}
          onChangeRole={() => { tour.suspend(); setScreen('role-selection'); setNotice('') }}
          onOpenArena={() => { setNotice('Настоящая кнопка входа Arena нажата. Здесь граница dev-этапа: Arena Setup и переговоры не запускаются.'); tour.enterArena() }}
          onOpenTraining={() => { tour.suspend(); setNotice('Вход в Training выбран. В этом dev-стенде тренировка не запускается и Energy не расходуется.') }}
          onOpenAISettings={() => setNotice('AI Settings вне текущей экскурсии. AI-запросы в стенде не выполняются.')} />
      )}
      {screen === 'home' && role && showingHomeGuide && homeGuide}
      <LeviSpotlight root={root} />
    </div>
  )
}

function LeviTourPlayground() {
  const [fixture, setFixture] = useState<Fixture>(() => ({ id: 0, ...createBrowserPreview() }))
  return (
    <>
      <nav className="levi-tour-preview__modes" aria-label="Тестовые условия экскурсии">
        <button type="button" onClick={() => setFixture((current) => ({ id: current.id + 1, ...createBrowserPreview() }))}>
          Данные этого браузера
        </button>
        <button type="button" onClick={() => setFixture((current) => ({ id: current.id + 1, ...createMemoryPreview(false) }))}>
          Проверить нового пользователя
        </button>
        <button type="button" onClick={() => setFixture((current) => ({ id: current.id + 1, ...createMemoryPreview(true) }))}>
          Проверить существующего пользователя
        </button>
        <a href="/">Mascot Playground</a>
      </nav>
      <TourPreview key={fixture.id} fixture={fixture} />
    </>
  )
}

if (import.meta.env.DEV) {
  createRoot(document.getElementById('root')!).render(<StrictMode><LeviTourPlayground /></StrictMode>)
}
