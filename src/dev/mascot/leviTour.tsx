import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LeviTour } from '../../components/levi-tour/LeviTour'
import { LeviHomeGuide } from '../../components/levi-tour/LeviHomeGuide'
import { LeviSpotlight } from '../../components/levi-tour/LeviSpotlight'
import { LeviArenaGuide } from '../../components/levi-tour/LeviArenaGuide'
import { getRoleById, type RoleId } from '../../config/roles'
import { RoleSelectionPage } from '../../pages/RoleSelectionPage'
import { RoleHomePage } from '../../pages/RoleHomePage'
import { ArenaPage } from '../../pages/ArenaPage'
import { browserLeviTourStore, createLeviTourStore, type LeviTourStore } from '../../services/leviTour'
import { createInitialProgression, getRoleProgress, type ProgressionState } from '../../services/progression'
import { appStorage } from '../../services/storage'
import { useLeviTour } from '../../state/useLeviTour'
import { startLeviRoleHighlight } from '../../services/leviTourHighlight'
import { createLeviArenaStore, earlyOpponentComment, isEarlyOpponentSelection, nextLeviArenaStep, readLeviArenaSnapshot, reconcileLeviArenaStep, type LeviArenaSnapshot, type LeviArenaStatus } from '../../services/leviArenaTour'
import '../../styles/global.css'
import './leviTour.css'

type Fixture = { id: number; label: string; roleId: RoleId | null; progression: ProgressionState; store: LeviTourStore; arenaStore: ReturnType<typeof createLeviArenaStore> }

function previewStores(storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }) {
  return { store: createLeviTourStore(storage), arenaStore: createLeviArenaStore(storage) }
}

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
    ...previewStores({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }),
  }
}

function createBrowserPreview(): Omit<Fixture, 'id'> {
  const arenaStore = createLeviArenaStore({ getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) })
  return { label: 'Данные браузера · только чтение игрового снимка', roleId: appStorage.getSelectedRole(), progression: appStorage.getProgression(), store: browserLeviTourStore, arenaStore }
}

function TourPreview({ fixture }: { fixture: Fixture }) {
  const tour = useLeviTour(fixture.store, fixture.roleId)
  const [roleId, setRoleId] = useState<RoleId | null>(fixture.roleId)
  const [screen, setScreen] = useState<'role-selection' | 'home' | 'arena'>(fixture.roleId ? 'home' : 'role-selection')
  const [arenaStep, setArenaStep] = useState<LeviArenaStatus>('inactive')
  const [earlyOpponentChoice, setEarlyOpponentChoice] = useState(false)
  const [arenaSnapshot, setArenaSnapshot] = useState<LeviArenaSnapshot>({ ready: false, hasLockedBoss: false, selectedOpponent: false, selectedScenario: false })
  const [notice, setNotice] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const role = getRoleById(roleId)

  useEffect(() => {
    if (!tour.highlightRoles || !root.current) return
    return startLeviRoleHighlight(root.current)
  }, [tour.highlightRoles, tour.run])

  useEffect(() => {
    if (screen !== 'arena' || !root.current) return
    const container = root.current
    const observeSelection = () => {
      const next = readLeviArenaSnapshot(container)
      setArenaSnapshot((previous) => Object.keys(next).every((key) => previous[key as keyof LeviArenaSnapshot] === next[key as keyof LeviArenaSnapshot]) ? previous : next)
      setArenaStep((previous) => reconcileLeviArenaStep(previous, next))
    }
    const observer = new MutationObserver(observeSelection)
    observer.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'disabled'] })
    observeSelection()
    return () => observer.disconnect()
  }, [screen])

  function enterArena() {
    tour.suspend()
    setNotice('')
    setEarlyOpponentChoice(false)
    setArenaStep(fixture.arenaStore.hasViewed() ? 'inactive' : 'opponents')
    setScreen('arena')
  }

  function finishArena(type: 'completed' | 'skipped') {
    fixture.arenaStore.markViewed()
    setEarlyOpponentChoice(false)
    setArenaStep(type)
  }

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
    onNext={tour.status === 'final' || step === 'arena' ? tour.done : tour.continue} onSkip={tour.skip} />

  return (
    <div className="levi-tour-preview" ref={root} data-tour-active={tour.highlightRoles} onClick={(event) => {
      if (screen !== 'arena' || !(event.target instanceof Element) || !isEarlyOpponentSelection(arenaStep)) return
      const card = event.target.closest<HTMLButtonElement>('.arena-opponent-card')
      if (card && !card.disabled && root.current?.contains(card)) setEarlyOpponentChoice(true)
    }}>
      <aside className="levi-tour-preview__tools" aria-label="Управление dev-проверкой">
        <strong>LeviTour · только разработка</strong>
        <p>{fixture.label}. Роль и прогресс в этом стенде не записываются в игровое хранилище.</p>
        <p>Роль предпросмотра: {role?.name ?? 'не выбрана'}. Полная экскурсия версии 1 не отмечается завершённой.</p>
        <button className="secondary-action-button" type="button" onClick={() => {
          setNotice('')
          if (screen === 'arena') { setEarlyOpponentChoice(false); setArenaStep('opponents') }
          else { setScreen(roleId ? 'home' : 'role-selection'); tour.restart(Boolean(roleId)) }
        }}>
          Повторить экскурсию
        </button>
        <p role="status">{notice || (screen === 'arena' ? arenaStep === 'inactive' ? 'Arena Tour уже просмотрен. Можно запустить повторно.'
          : arenaStep === 'completed' ? 'Arena Tour завершён. Переговоры запускаются только вашим нажатием.'
            : arenaStep === 'skipped' ? 'Arena Tour пропущен.' : 'Arena Tour показывает настоящий экран выбора.'
          : tour.status === 'active' ? 'Выберите роль или пропустите экскурсию.'
          : tour.status === 'completed' ? 'Home-экскурсия завершена. Arena Tour запускается отдельно при входе в Арену.'
            : tour.status === 'skipped' ? 'Экскурсия пропущена.' : tour.status === 'inactive'
              ? 'Экскурсия не активна. Можно запустить вручную.' : 'Экскурсия продолжается на настоящем Home.')}</p>
      </aside>
      {screen === 'role-selection' || !role ? (
        <RoleSelectionPage onSelectRole={selectPreviewRole}>
          {tour.status === 'active' && <LeviTour greeting={tour.greeting} reaction={null} onNext={tour.advanceGreeting} onSkip={tour.skip} />}
        </RoleSelectionPage>
      ) : screen === 'home' ? (
        <RoleHomePage role={role} roleProgress={getRoleProgress(fixture.progression, role.id)} energy={fixture.progression.energy} streak={fixture.progression.streak}
          onChangeRole={() => { tour.suspend(); setScreen('role-selection'); setNotice('') }}
          onOpenArena={enterArena}
          onOpenTraining={() => { tour.suspend(); setNotice('Вход в Training выбран. В этом dev-стенде тренировка не запускается и Energy не расходуется.') }}
          onOpenAISettings={() => setNotice('AI Settings вне текущей экскурсии. AI-запросы в стенде не выполняются.')} />
      ) : (
        <ArenaPage role={role} roleProgress={getRoleProgress(fixture.progression, role.id)} energy={fixture.progression.energy} streak={fixture.progression.streak}
          onBack={() => { setEarlyOpponentChoice(false); setArenaStep('inactive'); setScreen('home') }}
          onChangeRole={() => { setEarlyOpponentChoice(false); setArenaStep('inactive'); setScreen('role-selection') }}
          onComplete={() => {}}
          onEvaluated={() => ({ xpEarned: 0, bossDefeated: false })}
          onOpenAISettings={() => setNotice('AI Settings вне текущей экскурсии.')} aiSettingsVersion={0} />
      )}
      {screen === 'home' && role && showingHomeGuide && homeGuide}
      {screen === 'arena' && arenaSnapshot.ready && !['inactive', 'completed', 'skipped'].includes(arenaStep) &&
        <LeviArenaGuide key={arenaStep} root={root} step={arenaStep as Exclude<LeviArenaStatus, 'inactive' | 'completed' | 'skipped'>}
          comment={arenaStep === 'chooseScenario' && earlyOpponentChoice ? earlyOpponentComment : undefined}
          onNext={() => {
            const next = nextLeviArenaStep(arenaStep, arenaSnapshot)
            if (next === 'completed') finishArena('completed')
            else setArenaStep(next)
          }} onSkip={() => finishArena('skipped')} />}
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
