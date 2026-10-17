import { LEVI_TOUR_VERSION, type TourStorage } from './leviTour'

// This dev slice is independent of the Role/Home preview and never certifies the full tour.
export const LEVI_ARENA_SLICE_KEY = 'levelup-arena:levi-tour-dev-arena-slice'

export const leviArenaSteps = {
  opponents: {
    title: 'Выбор оппонента',
    explanation: 'Здесь выбираешь, с кем будешь вести переговоры. У каждого оппонента свой характер, стиль общения и сложность',
    leviComment: 'Выглядит дружелюбно. Подозрительно дружелюбно',
  },
  locked: {
    title: 'Следующий босс',
    explanation: 'Чтобы открыть следующего оппонента, нужно достичь 2-го уровня в своей роли и победить первого',
    leviComment: 'Этот оппонент предпочитает общаться с подготовленными людьми',
  },
  chooseOpponent: {
    title: 'Твой оппонент',
    explanation: 'Теперь выбери, с кем хочешь провести переговоры.',
    leviComment: 'Обещаю не вмешиваться. Пока что',
  },
  chooseScenario: {
    title: 'Выбор сценария',
    explanation: 'Теперь выбери ситуацию, в которой предстоит договариваться. От сценария зависит твоя задача',
    leviComment: 'Спойлер: просто сказать "давайте договоримся" недостаточно',
  },
  briefing: {
    title: 'Перед началом',
    explanation: 'Прочитай ситуацию, свою цель и то, что тебе известно. Это поможет понять, чего ты хочешь добиться в переговорах',
    leviComment: 'Читать условия до начала — неожиданно сильная стратегия',
  },
} as const

export type LeviArenaStep = keyof typeof leviArenaSteps
export type LeviArenaStatus = LeviArenaStep | 'inactive' | 'completed' | 'skipped'
export const earlyOpponentComment = 'А, с оппонентами уже всё ясно? Ну конечно. А я тут просто для красоты сижу'

export function isEarlyOpponentSelection(step: LeviArenaStatus) {
  return step === 'opponents' || step === 'locked'
}

export type LeviArenaSnapshot = {
  ready: boolean
  hasLockedBoss: boolean
  selectedOpponent: boolean
  selectedScenario: boolean
}

export function createLeviArenaStore(storage: TourStorage) {
  let viewed = false
  return {
    hasViewed() {
      try { viewed ||= Number(storage.getItem(LEVI_ARENA_SLICE_KEY)) >= LEVI_TOUR_VERSION } catch { /* memory fallback */ }
      return viewed
    },
    markViewed() {
      viewed = true
      try { storage.setItem(LEVI_ARENA_SLICE_KEY, String(LEVI_TOUR_VERSION)) } catch { /* memory fallback */ }
    },
  }
}

export function reconcileLeviArenaStep(step: LeviArenaStatus, snapshot: LeviArenaSnapshot): LeviArenaStatus {
  if (step === 'inactive' || step === 'completed' || step === 'skipped' || !snapshot.ready) return step
  if (snapshot.selectedScenario) return 'briefing'
  if (snapshot.selectedOpponent) return 'chooseScenario'
  if (step === 'chooseScenario' || step === 'briefing') return 'chooseOpponent'
  if (step === 'locked' && !snapshot.hasLockedBoss) return 'chooseOpponent'
  return step
}

export function nextLeviArenaStep(step: LeviArenaStatus, snapshot: LeviArenaSnapshot): LeviArenaStatus {
  if (!snapshot.ready) return step
  const current = reconcileLeviArenaStep(step, snapshot)
  if (current === 'opponents') return snapshot.selectedOpponent ? 'chooseScenario' : snapshot.hasLockedBoss ? 'locked' : 'chooseOpponent'
  if (current === 'locked') return snapshot.selectedOpponent ? 'chooseScenario' : 'chooseOpponent'
  if (current === 'chooseOpponent' && snapshot.selectedOpponent) return 'chooseScenario'
  if (current === 'chooseScenario' && snapshot.selectedScenario) return 'briefing'
  if (current === 'briefing') return 'completed'
  return current
}

export function readLeviArenaSnapshot(root: HTMLElement): LeviArenaSnapshot {
  const opponents = Array.from(root.querySelectorAll<HTMLButtonElement>('.arena-opponent-card'))
  return {
    ready: Boolean(root.querySelector('.arena-boss-list')),
    hasLockedBoss: opponents.some((card) => card.disabled),
    selectedOpponent: opponents.some((card) => card.getAttribute('aria-pressed') === 'true'),
    selectedScenario: Boolean(root.querySelector('.arena-scenario-card[aria-pressed="true"]')),
  }
}

export function highlightLeviArenaTargets(root: HTMLElement, step: LeviArenaStep) {
  const cards = Array.from(root.querySelectorAll<HTMLButtonElement>('.arena-opponent-card'))
  const targets: HTMLElement[] = step === 'opponents' || step === 'chooseOpponent'
    ? cards.filter((card) => !card.disabled)
    : step === 'locked' ? cards.filter((card) => card.disabled).slice(0, 1)
      : step === 'chooseScenario'
        ? Array.from(root.querySelectorAll<HTMLElement>('.arena-scenario-card'))
        : Array.from(root.querySelectorAll<HTMLElement>('.arena-selected-brief'))
  targets.forEach((target) => target.setAttribute('data-levi-highlighted', 'true'))
  return { targets, cleanup: () => targets.forEach((target) => target.removeAttribute('data-levi-highlighted')) }
}

export function getLeviLockedExplanation(root: HTMLElement) {
  const card = root.querySelector<HTMLElement>('.arena-opponent-card[disabled]')
  const level = card?.querySelector('.arena-lock-status')?.textContent?.match(/уровне\s+(\d+)/i)?.[1]
  const previous = card?.querySelector('.arena-lock-copy > span:last-child:not(.arena-lock-status)')?.textContent?.match(/«([^»]+)»/)?.[1]
  if (level === '2' && previous) return leviArenaSteps.locked.explanation
  if (level && previous) return `Чтобы открыть следующего оппонента, нужно достичь ${level}-го уровня в своей роли и победить босса «${previous}»`
  if (level) return `Чтобы открыть следующего оппонента, нужно достичь ${level}-го уровня в своей роли`
  if (previous) return `Чтобы открыть следующего оппонента, нужно победить босса «${previous}»`
  return leviArenaSteps.locked.explanation
}
