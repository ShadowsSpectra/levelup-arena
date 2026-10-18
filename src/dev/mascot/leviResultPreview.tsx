import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArenaResultView } from '../../components/arena/ArenaResultView'
import { arenaCriterionIds, type ArenaEvaluation, type ArenaOutcomeType } from '../../types/arenaEvaluation'
import type { ArenaSession, PublicCharacter, PublicScenario } from '../../types/arena'
import { LeviCommentator } from './LeviCommentator'
import { browserLeviCommentHistory } from './leviCommentHistory'
import type { chooseLeviResultComment } from './leviResultComments'
import '../../styles/global.css'
import './leviTour.css'

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
const evidence = 'Предлагаю обсудить возможные варианты.'
const cases = [
  { id: 'SUCCESS_HIGH', label: 'SUCCESS · высокий балл', outcome: 'SUCCESS', score: 70 },
  { id: 'SUCCESS_LOW', label: 'SUCCESS · низкий балл', outcome: 'SUCCESS', score: 50 },
  { id: 'BAD_AGREEMENT', label: 'BAD_AGREEMENT', outcome: 'BAD_AGREEMENT', score: 70 },
  { id: 'NO_AGREEMENT', label: 'NO_AGREEMENT', outcome: 'NO_AGREEMENT', score: 70 },
] as const satisfies readonly { id: string; label: string; outcome: ArenaOutcomeType; score: number }[]
type PreviewCase = typeof cases[number]

function previewEvaluation({ outcome, score }: PreviewCase): ArenaEvaluation {
  const scores = Object.fromEntries(arenaCriterionIds.map((id) => [id, {
    score, evidence, reason: 'Тестовое пояснение для визуальной проверки.',
  }])) as ArenaEvaluation['scores']
  return {
    facts: { concreteMutualAgreement: outcome !== 'NO_AGREEMENT', playerMinimumSatisfied: outcome === 'SUCCESS',
      opponentMinimumSatisfied: outcome === 'SUCCESS', criticalRedLineViolated: false },
    outcome: { status: outcome, bossDefeated: outcome === 'SUCCESS' }, scores, overallScore: score,
    strengths: ['Вы уточнили возможные варианты.'], improvements: ['Конкретнее фиксируйте следующие шаги.'],
    mainInsight: { evidence, insight: 'Обсуждение вариантов помогает увидеть возможный компромисс.' },
  }
}

function previewSession(id: string): ArenaSession {
  return { id, scenarioId: scenario.id, characterId: character.id, currentTurn: 1,
    status: 'completed', messages: [
      { id: 'opponent-opening', speaker: 'opponent', text: scenario.openingMessage },
      { id: 'player-1', speaker: 'player', text: evidence },
      { id: 'opponent-1', speaker: 'opponent', text: 'Давайте рассмотрим варианты.' },
    ] }
}

function ResultPreview() {
  const [current, setCurrent] = useState<{ id: string; selectedCase: PreviewCase }>(
    () => ({ id: crypto.randomUUID(), selectedCase: cases[0] }),
  )
  const [shown, setShown] = useState<{ sessionId: string; comment: NonNullable<ReturnType<typeof chooseLeviResultComment>> } | null>(null)
  const handledSession = useRef<string | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    // Claims are made after rendering, once per actual preview result, not on re-render.
    if (handledSession.current === current.id) return
    handledSession.current = current.id
    const claim = browserLeviCommentHistory.claim(current.id, previewEvaluation(current.selectedCase))
    if (claim.status === 'chosen') setShown({ sessionId: current.id, comment: claim.comment })
    else if (claim.status === 'unavailable') setNotice('История Леви недоступна или повреждена; новый комментарий не показан.')
    else if (claim.status === 'exhausted') setNotice('Все реплики Леви для этого исхода уже использованы.')
  }, [current])

  function newResult(selectedCase: PreviewCase) {
    setShown(null)
    setCurrent({ id: crypto.randomUUID(), selectedCase })
    setNotice('')
  }

  function resetHistory() {
    if (!window.confirm('Сбросить только историю реплик Леви в этом dev-preview? Прогресс и другие данные не изменятся.')) return
    setNotice(browserLeviCommentHistory.reset()
      ? 'История реплик Леви сброшена. Создайте новый тестовый результат.'
      : 'Не удалось сбросить историю реплик Леви.')
  }

  const evaluation = previewEvaluation(current.selectedCase)
  const session = previewSession(current.id)
  return <div className="levi-commentator-preview">
    <nav className="levi-tour-preview__modes" aria-label="Тестовые исходы">
      <strong>Dev-preview · тестовый результат без AI</strong>
      <span className="levi-commentator-preview__note">После перезагрузки preview создаётся новый тестовый результат; история реплик сохраняется в этом браузере. В production это поведение не включено.</span>
      {cases.map((previewCase) => <button type="button" key={previewCase.id} aria-pressed={current.selectedCase.id === previewCase.id}
        onClick={() => { if (current.selectedCase.id !== previewCase.id) newResult(previewCase) }}>{previewCase.label}</button>)}
      <button type="button" onClick={() => newResult(current.selectedCase)}>Новый результат</button>
      <button type="button" onClick={resetHistory}>Сбросить историю Леви</button>
    </nav>
    <div className="app-shell"><main className="arena-page">
      {shown?.sessionId === current.id && <LeviCommentator key={`comment-${current.id}`} text={shown.comment.text} emotion={shown.comment.emotion}
        onDismiss={() => setShown(null)} />}
      <ArenaResultView key={session.id} character={character} scenario={scenario} session={session}
        evaluation={{ status: 'success', result: evaluation, award: { xpEarned: evaluation.outcome.status === 'SUCCESS' ? 50 : 0, bossDefeated: evaluation.outcome.bossDefeated } }}
        onRetryEvaluation={() => {}} onOpenAISettings={() => {}} onTryAgain={() => newResult(current.selectedCase)}
        onBackToSelection={() => setNotice('В dev-preview выбор оппонента не запускается.')}
        onHome={() => setNotice('В dev-preview переход на Home не выполняется.')} />
      {notice && <p role="status">{notice}</p>}
    </main></div>
  </div>
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<ResultPreview />)
