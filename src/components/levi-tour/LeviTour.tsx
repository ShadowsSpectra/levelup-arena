import { Mascot } from '../mascot/Mascot'
import { leviGreetings, type LeviRoleReaction } from '../../services/leviTour'
import './levi-tour.css'

type LeviTourProps = {
  greeting: 0 | 1
  reaction: LeviRoleReaction | null
  onNext: () => void
  onContinue: () => void
  onSkip: () => void
}

export function LeviTour({ greeting, reaction, onNext, onContinue, onSkip }: LeviTourProps) {
  const messageKey = reaction ? `${reaction.roleId}:${reaction.index}` : `greeting-${greeting}`
  return (
    <section className="levi-tour" aria-label="Экскурсия с Леви">
      <Mascot key={messageKey} state={reaction?.emotion ?? (greeting === 0 ? 'judge' : 'point')} size={96} label="Леви" />
      <div className="levi-tour__bubble">
        <div role="status" aria-atomic="true">
          <div className="levi-tour__message" key={messageKey}>
            {(reaction?.text ?? leviGreetings[greeting]).split('\n\n').map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </div>
        <div className={`levi-tour__actions${reaction ? '' : ' levi-tour__actions--greeting'}`}>
          {reaction && <button className="text-button" type="button" onClick={onContinue}>Продолжить</button>}
          <button className="text-button" type="button" onClick={onSkip}>Пропустить экскурсию</button>
          {!reaction && greeting === 0 &&
            <button className="primary-button levi-tour__next" type="button" onClick={onNext}>Дальше →</button>}
        </div>
      </div>
    </section>
  )
}
