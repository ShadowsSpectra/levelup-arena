import { useEffect, useRef, useState, type FormEvent } from 'react'
import { SendIcon } from '../HeaderIcons'
import { getCharacterPressureLabel, getDifficultyLabel } from '../../services/characterProfile'
import { getNaturalEndingSuggestion } from '../../services/naturalEnding'
import type { ArenaSession, PublicCharacter, PublicScenario } from '../../types/arena'
import { ArenaMessage } from './ArenaMessage'

type NegotiationViewProps = {
  character: PublicCharacter
  scenario: PublicScenario
  session: ArenaSession
  isOpening?: boolean
  replyError: string | null
  onSend: (text: string) => Promise<boolean>
  onFinish: () => void
  onOpenAISettings: () => void
}

export function scrollTranscriptToLatest(
  container: Pick<HTMLElement, 'scrollHeight' | 'scrollTo'>,
) {
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
}

export function NegotiationView({
  character, scenario, session, isOpening = false, replyError, onSend, onFinish, onOpenAISettings,
}: NegotiationViewProps) {
  const [draft, setDraft] = useState('')
  const [dismissedEndingMessageId, setDismissedEndingMessageId] = useState<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const atLimit = session.status === 'turn-limit'
  const responding = session.status === 'responding'
  const typing = responding || isOpening
  const manualFinishDisabled = typing || session.currentTurn === 0
  const visibleMessages = isOpening
    ? session.messages.filter((message) => message.id !== 'opponent-opening')
    : session.messages
  const suggestedEndingMessageId = isOpening ? null : getNaturalEndingSuggestion(session, dismissedEndingMessageId)
  const difficultyLabel = character.difficulty ? getDifficultyLabel(character.difficulty) : null
  const pressureLabel = character.pressure ? getCharacterPressureLabel(character) : null

  useEffect(() => {
    const container = transcriptRef.current
    if (!container) return
    const frame = window.requestAnimationFrame(() => scrollTranscriptToLatest(container))
    return () => window.cancelAnimationFrame(frame)
  }, [visibleMessages.length, typing])

  async function sendDraft() {
    if (await onSend(draft)) setDraft('')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendDraft()
  }

  return (
    <section className="arena-dialogue" aria-labelledby="arena-dialogue-title">
      <div className="arena-dialogue-heading">
        <div className="arena-dialogue-title-block">
          <span className="section-kicker">Переговоры</span>
          <h1 id="arena-dialogue-title">{scenario.title}</h1>
          <div className="arena-dialogue-meta">
            <span>{character.name} · {character.role}</span>
            {difficultyLabel && <span className="arena-difficulty-badge">{difficultyLabel}</span>}
            {pressureLabel && <span>{pressureLabel}</span>}
          </div>
        </div>
        {!atLimit && (
          <button className="secondary-action-button" type="button" disabled={manualFinishDisabled} onClick={onFinish}>
            Завершить переговоры
          </button>
        )}
      </div>

      <div className="arena-transcript" ref={transcriptRef} aria-live="polite" aria-label="История переговоров">
        {visibleMessages.map((message) => (
          <ArenaMessage character={character} speaker={message.speaker} text={message.text} key={message.id} />
        ))}
        {typing && (
          <div className="arena-typing" role="status">
            <span className="arena-typing-dot" aria-hidden="true" />
            {character.name} печатает…
          </div>
        )}
        {suggestedEndingMessageId && (
          <div className="arena-ending-suggestion" role="status">
            <strong>Похоже, переговоры завершены</strong>
            <div className="arena-ending-actions">
              <button className="primary-button" type="button" onClick={onFinish}>Перейти к результатам</button>
              <button className="secondary-action-button" type="button"
                onClick={() => setDismissedEndingMessageId(suggestedEndingMessageId)}>
                Продолжить переговоры
              </button>
            </div>
          </div>
        )}
      </div>

      {replyError && (
        <div className="arena-error" role="alert">
          <p>Ответ Real AI не получен. Ваше сообщение осталось в поле ввода; ход не засчитан.</p>
          <p>{replyError}</p>
          <button className="secondary-action-button" type="button" disabled={!draft.trim()} onClick={() => void sendDraft()}>
            Повторить отправку
          </button>{' '}
          <button className="secondary-action-button" type="button" onClick={onOpenAISettings}>AI Settings</button>
        </div>
      )}
      {atLimit ? (
        <button className="primary-button arena-finish-button" type="button" onClick={onFinish}>
          Перейти к результату
        </button>
      ) : (
        <form className="arena-composer" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="arena-draft">Ваше сообщение</label>
          <textarea id="arena-draft" value={draft} onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                if (draft.trim() && !typing) void sendDraft()
              }
            }}
            placeholder="Напишите вашу реплику…" rows={2} disabled={typing} />
          <button className="arena-send-button" type="submit" disabled={!draft.trim() || typing}
            aria-label="Отправить" title="Отправить">
            <SendIcon />
          </button>
        </form>
      )}
    </section>
  )
}
