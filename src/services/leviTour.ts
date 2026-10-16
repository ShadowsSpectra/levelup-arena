import type { RoleId } from '../config/roles'

export const LEVI_TOUR_VERSION = 1
export const LEVI_TOUR_VERSION_KEY = 'levelup-arena:levi-tour-version'
// Temporary dev slice only. Never certify the future full tour from this preview.
export const LEVI_TOUR_SLICE_KEY = 'levelup-arena:levi-tour-dev-role-slice'
export const LEVI_GREETING_DELAY_MS = 4500

export const leviGreetings = [
  'О, новый переговорщик. Надеюсь, ты хотя бы знаешь, что такое компромисс',
  'Ладно, проверим. Для начала выбери роль, в которой хочешь потренироваться.\n\nОбещаю не осуждать. Пока что',
] as const

type Reaction = { text: string; emotion: 'judge' | 'happy' }
export const leviRoleReactions: Record<RoleId, readonly Reaction[]> = {
  product_manager: [
    { text: 'Будешь убеждать всех, что твоя идея нужна миру? Смело. Мне нравится', emotion: 'happy' },
    { text: 'О, продакт. Надеюсь, ты умеешь говорить „нет“. Особенно самому себе', emotion: 'judge' },
    { text: 'Product Manager? Только не говори, что нам срочно нужен ребрендинг', emotion: 'judge' },
    { text: 'Продакт? Хорошо. Но если предложишь добавить сюда ещё один AI — я увольняюсь', emotion: 'judge' },
  ],
  project_manager: [
    { text: 'Сроки, бюджеты, люди… Ты точно добровольно это выбрал?', emotion: 'judge' },
    { text: 'Ты мог выбрать любую профессию. Но выбрал дедлайны. Уважаю твою смелость', emotion: 'happy' },
  ],
  sales_manager: [
    { text: 'Продажи? То есть ты профессионально убеждаешь людей расстаться с деньгами. Интересно. Продолжай', emotion: 'happy' },
    { text: 'О, продажи. Надеюсь, ты умеешь слышать слово „нет“. Я вот часто его использую', emotion: 'judge' },
  ],
}

export type LeviRoleReaction = Reaction & { roleId: RoleId; index: number }

export function chooseLeviReaction(roleId: RoleId, previousIndex?: number, random = Math.random): LeviRoleReaction {
  const options = leviRoleReactions[roleId]
  const eligible = options.map((_, index) => index).filter((index) => index !== previousIndex)
  const index = eligible[Math.floor(random() * eligible.length)]
  return { ...options[index], roleId, index }
}

export function scheduleLeviGreeting(advance: () => void) {
  let active = true
  const timer = setTimeout(() => { if (active) advance() }, LEVI_GREETING_DELAY_MS)
  return () => { active = false; clearTimeout(timer) }
}

export type TourStorage = Pick<Storage, 'getItem' | 'setItem'>

export function createLeviTourStore(storage: TourStorage) {
  // Also remember completion in memory if browser storage is unavailable.
  let rememberedVersion = 0

  function getVersion() {
    try {
      const stored = Number(storage.getItem(LEVI_TOUR_SLICE_KEY))
      if (Number.isSafeInteger(stored) && stored >= 0) {
        rememberedVersion = Math.max(rememberedVersion, stored)
      }
    } catch { /* The tour remains usable without localStorage. */ }
    return rememberedVersion
  }

  return {
    hasViewed: () => getVersion() >= LEVI_TOUR_VERSION,
    markViewed() {
      rememberedVersion = Math.max(getVersion(), LEVI_TOUR_VERSION)
      try {
        storage.setItem(LEVI_TOUR_SLICE_KEY, String(rememberedVersion))
      } catch { /* Retain the viewed version for this page lifetime. */ }
    },
  }
}

export type LeviTourStore = ReturnType<typeof createLeviTourStore>

export const browserLeviTourStore = createLeviTourStore({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
})
