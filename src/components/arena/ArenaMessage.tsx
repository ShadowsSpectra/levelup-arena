import type { PublicCharacter } from '../../types/arena'

type ArenaMessageProps = {
  speaker: 'player' | 'opponent'
  text: string
  character: Pick<PublicCharacter, 'name' | 'role'>
}

export function ArenaMessage({ speaker, text, character }: ArenaMessageProps) {
  const opponentLabel = `${character.name} · ${character.role}`
  const opponentInitial = Array.from(character.name.trim())[0]?.toLocaleUpperCase('ru-RU') ?? '?'

  return (
    <article className={`arena-message arena-message-${speaker}`}
      aria-label={speaker === 'player' ? 'Вы' : opponentLabel}>
      {speaker === 'opponent' && (
        <div className="arena-message-author">
          <span className="arena-message-avatar" aria-hidden="true">{opponentInitial}</span>
          <span className="arena-message-name">{opponentLabel}</span>
        </div>
      )}
      <p>{text}</p>
    </article>
  )
}
