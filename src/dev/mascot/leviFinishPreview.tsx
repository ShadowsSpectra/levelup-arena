import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NegotiationView } from '../../components/arena/NegotiationView'
import { LeviFinishHint } from '../../components/levi-tour/LeviFinishHint'
import { createLeviFinishHintStore } from './leviFinishHintState'
import { addOpponentReply, addPlayerMessage, createArenaSession } from '../../services/arenaSession'
import type { PublicCharacter, PublicScenario } from '../../types/arena'
import '../../styles/global.css'
import './leviTour.css'
import '../../components/levi-tour/levi-home-guide.css'
import '../../components/levi-tour/levi-arena-guide.css'

const character: PublicCharacter = {
  id: 'preview-opponent', name: 'Алексей', role: 'Tech Lead', difficulty: 1,
  communicationStyle: 'Спокойный деловой стиль', pressure: 'low',
}
const scenario: PublicScenario = {
  id: 'preview-scenario', characterId: character.id, title: 'Релиз через две недели',
  playerRole: 'product_manager', category: 'Сроки', maxTurns: 10,
  openingMessage: 'Обсудим срок и объём релиза.',
  playerBrief: { situation: '', playerGoal: '', knownInformation: [] },
}

function completedExchange() {
  const opening = createArenaSession(scenario.id, character.id, scenario.openingMessage)
  return addOpponentReply(addPlayerMessage(opening, 'Что важнее всего успеть к релизу?', scenario.maxTurns),
    'Давайте сначала определим основной пользовательский сценарий.', scenario.maxTurns)
}

function FinishPreview() {
  const root = useRef<HTMLDivElement>(null)
  const [store] = useState(() => {
    const data = new Map<string, string>()
    const devStore = createLeviFinishHintStore({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } })
    return { hasViewed: devStore.hasViewed, markViewed: () => { devStore.markViewed(); return true } }
  })
  const [session, setSession] = useState(completedExchange)
  const [open, setOpen] = useState(true)
  return <div className="levi-tour-preview levi-arena-root" ref={root}>
    <aside className="levi-tour-preview__tools" aria-label="Тест подсказки">
      <strong>Dev-preview · первый успешный обмен без AI</strong>
      <p>Тестовый диалог и отметка просмотра существуют только в памяти этой страницы.</p>
      <button className="secondary-action-button" type="button" onClick={() => { setOpen(false); setSession(completedExchange()) }}>
        Выйти из переговоров
      </button>{' '}
      <button className="secondary-action-button" type="button" onClick={() => setOpen(true)} disabled={open}>
        Повторно открыть переговоры
      </button>
      {!open && <p role="status">Диалог закрыт. Повторное открытие использует ту же отметку просмотра.</p>}
    </aside>
    {open && <div className="app-shell"><main className="arena-page">
      <NegotiationView character={character} scenario={scenario} session={session} replyError={null}
        onSend={async () => false} onFinish={() => setOpen(false)} onOpenAISettings={() => {}} />
    </main></div>}
    <LeviFinishHint root={root} store={store} />
  </div>
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<StrictMode><FinishPreview /></StrictMode>)
