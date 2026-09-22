import { useState, type FormEvent } from 'react'
import type { ArenaSession, Character, Scenario } from '../../types/arena'

type NegotiationViewProps = {
  character: Character
  scenario: Scenario
  session: ArenaSession
  replyError: boolean
  fallbackNotice: string | null
  onSend: (text: string) => Promise<boolean>
  onFinish: () => void
}

export function NegotiationView({
  character, scenario, session, replyError, fallbackNotice, onSend, onFinish,
}: NegotiationViewProps) {
  const [draft, setDraft] = useState('')
  const atLimit = session.status === 'turn-limit'
  const responding = session.status === 'responding'

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
          <button className="secondary-action-button" type="button" disabled={responding} onClick={onFinish}>
            Завершить переговоры
          </button>
        )}
      </div>

      <div className="arena-transcript" aria-live="polite" aria-label="История переговоров">
        {session.messages.map((message) => (
          <article className={`arena-message arena-message-${message.speaker}`} key={message.id}>
            <span>{message.speaker === 'player' ? 'Вы' : `${character.name} · ${character.role}`}</span>
            <p>{message.text}</p>
          </article>
        ))}
        {responding && (
          <div className="arena-typing" role="status">
            <span className="arena-typing-dot" aria-hidden="true" />
            {character.name} печатает…
          </div>
        )}
      </div>

      {replyError && <p className="arena-error" role="alert">Не удалось получить ответ. Попробуйте отправить сообщение ещё раз.</p>}
      {!responding && fallbackNotice && <p className="arena-fallback-notice" role="status">{fallbackNotice}</p>}
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
                if (draft.trim() && !responding) void sendDraft()
              }
            }}
            placeholder="Напишите вашу реплику…" rows={3} disabled={responding} />
          <button className="primary-button" type="submit" disabled={!draft.trim() || responding}>
            Отправить
          </button>
        </form>
      )}
    </section>
  )
}
