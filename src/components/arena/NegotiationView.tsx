import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getNaturalEndingSuggestion } from '../../services/naturalEnding'
import type { ArenaSession, Character, Scenario } from '../../types/arena'

type NegotiationViewProps = {
  character: Character
  scenario: Scenario
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
  const visibleMessages = isOpening
    ? session.messages.filter((message) => message.id !== 'opponent-opening')
    : session.messages
  const suggestedEndingMessageId = isOpening ? null : getNaturalEndingSuggestion(session, dismissedEndingMessageId)

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
        <div>
          <span className="section-kicker">Переговоры</span>
          <h1 id="arena-dialogue-title">{scenario.title}</h1>
          <p>{character.name} · {character.role}</p>
        </div>
        {!atLimit && (
          <button className="secondary-action-button" type="button" disabled={typing} onClick={onFinish}>
            Завершить переговоры
          </button>
        )}
      </div>

      <div className="arena-transcript" ref={transcriptRef} aria-live="polite" aria-label="История переговоров">
        {visibleMessages.map((message) => (
          <article className={`arena-message arena-message-${message.speaker}`} key={message.id}>
            <span>{message.speaker === 'player' ? 'Вы' : `${character.name} · ${character.role}`}</span>
            <p>{message.text}</p>
          </article>
        ))}
        {typing && (
          <div className="arena-typing" role="status">
            <span className="arena-typing-dot" aria-hidden="true" />
            {character.name} печатает…
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
      {atLimit ? (
        <button className="primary-button arena-finish-button" type="button" onClick={onFinish}>
          Перейти к результату
        </button>
      ) : (
        <form className="arena-composer" onSubmit={submit}>
          <label htmlFor="arena-draft">Ваше сообщение</label>
          <textarea id="arena-draft" value={draft} onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                if (draft.trim() && !typing) void sendDraft()
              }
            }}
            placeholder="Напишите вашу реплику…" rows={3} disabled={typing} />
          <button className="primary-button" type="submit" disabled={!draft.trim() || typing}>
            Отправить
          </button>
        </form>
      )}
    </section>
  )
}
