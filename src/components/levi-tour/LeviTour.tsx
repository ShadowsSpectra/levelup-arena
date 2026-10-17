import { Mascot } from '../mascot/Mascot'
import { leviFinalMessage, leviGreetings, leviHomeSteps, type LeviHomeStep, type LeviRoleReaction } from '../../services/leviTour'
import { leviArenaSteps, type LeviArenaStep } from '../../services/leviArenaTour'
import './levi-tour.css'

type LeviTourProps = {
  greeting: 0 | 1
  reaction: LeviRoleReaction | null
  homeStep?: LeviHomeStep
  arenaStep?: LeviArenaStep
  arenaExplanation?: string
  arenaComment?: string
  standaloneLesson?: { title: string; explanation: string; leviComment: string }
  final?: boolean
  onNext: () => void
  onSkip: () => void
}

type IconEmotion = 'neutral' | 'happy' | 'judge'

const leviIconByEmotion: Record<IconEmotion, string> = {
  neutral: '/mascot/cat-idle.png',
  happy: '/mascot/cat-happy.png',
  judge: '/mascot/cat-judge.png',
}

const lessonPresentation: Record<LeviHomeStep, { title: string; emotion: IconEmotion }> = {
  'level-xp': { title: 'Уровень и XP', emotion: 'judge' },
  'energy-streak': { title: 'Энергия и Streak', emotion: 'happy' },
  training: { title: 'Training', emotion: 'neutral' },
  arena: { title: 'Arena', emotion: 'judge' },
}

type HeadingIcon = LeviHomeStep | 'greeting' | 'role' | 'reaction'

function LessonIcon({ step }: { step: HeadingIcon }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return <svg className="levi-tour__step-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>
    {step === 'level-xp' && <><path d="M4 17.5V20h16v-2.5" /><path d="m6 14 4-4 3 3 5-6" /><path d="M15 7h3v3" /></>}
    {step === 'energy-streak' && <path d="m13.5 2-8 11H11l-1 9 8.5-11H13z" />}
    {step === 'training' && <><path d="M4 5.5c3-1.5 5.5-1 8 0.5 2.5-1.5 5-2 8-.5v14c-3-1.5-5.5-1-8 .5-2.5-1.5-5-2-8-.5z" /><path d="M12 6v14" /></>}
    {step === 'arena' && <><path d="M12 3 4 7v5c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V7z" /><path d="m9 12 2 2 4-4" /></>}
    {step === 'greeting' && <><path d="M5 5h14v10H9l-4 4z" /><path d="M9 10h6" /></>}
    {step === 'role' && <><circle cx="8" cy="7" r="2" /><circle cx="16" cy="7" r="2" /><path d="M3 18c0-3 2-5 5-5s5 2 5 5M11 18c0-3 2-5 5-5s5 2 5 5" /></>}
    {step === 'reaction' && <><path d="m4 12 5 5L20 6" /><path d="M4 6h5M4 9h3" /></>}
  </svg>
}

function LeviComment({ text, emotion }: { text: string; emotion: IconEmotion }) {
  return <div className="levi-tour__comment-row">
    <span className="levi-tour__comment-icon" aria-hidden="true">
      <img src={leviIconByEmotion[emotion]} alt="" />
    </span>
    <p className="levi-tour__comment">{text}</p>
  </div>
}

function StepHeading({ icon, title }: { icon: HeadingIcon; title: string }) {
  return <div className="levi-tour__step-heading">
    <LessonIcon step={icon} />
    <span>{title}</span>
  </div>
}

export function LeviTour({ greeting, reaction, homeStep, arenaStep, arenaExplanation, arenaComment, standaloneLesson, final = false, onNext, onSkip }: LeviTourProps) {
  const messageKey = standaloneLesson ? 'standalone-lesson' : arenaStep ? `arena-${arenaStep}` : final ? 'final' : homeStep ?? (reaction ? `${reaction.roleId}:${reaction.index}` : `greeting-${greeting}`)
  const text = final ? leviFinalMessage : reaction?.text ?? leviGreetings[greeting]
  const lesson = homeStep ? leviHomeSteps[homeStep] : null
  const arenaLesson = arenaStep ? leviArenaSteps[arenaStep] : null
  const [roleExplanation, roleComment] = leviGreetings[1].split('\n\n')
  const showNext = Boolean(standaloneLesson) || Boolean(arenaStep && ['opponents', 'locked', 'briefing'].includes(arenaStep)) || final || Boolean(reaction) || Boolean(homeStep) || greeting === 0
  return (
    <section className="levi-tour" aria-label="Экскурсия с Леви">
      <Mascot key={messageKey} state={arenaStep === 'briefing' || final ? 'happy' : standaloneLesson || arenaStep || homeStep ? 'point' : reaction?.emotion ?? (greeting === 0 ? 'judge' : 'point')} size={96} label="Леви" />
      <div className="levi-tour__bubble">
        <div role="status" aria-atomic="true">
          <div className="levi-tour__message" key={messageKey}>
            {standaloneLesson ? <>
              <StepHeading icon="arena" title={standaloneLesson.title} />
              <p>{standaloneLesson.explanation}</p>
              <LeviComment text={standaloneLesson.leviComment} emotion="neutral" />
            </> : arenaLesson ? <>
              <StepHeading icon="arena" title={arenaLesson.title} />
              <p>{arenaExplanation ?? arenaLesson.explanation}</p>
              <LeviComment text={arenaComment ?? arenaLesson.leviComment} emotion={arenaStep === 'briefing' ? 'happy' : 'neutral'} />
            </> : lesson && homeStep ? <>
              <StepHeading icon={homeStep} title={lessonPresentation[homeStep].title} />
              <p>{lesson.explanation}</p>
              <LeviComment text={lesson.leviComment} emotion={lessonPresentation[homeStep].emotion} />
            </> : reaction ? <>
              <StepHeading icon="reaction" title="Твой выбор" />
              <LeviComment text={reaction.text} emotion={reaction.emotion} />
            </> : final ? <p>{text}</p> : greeting === 0 ? <>
              <StepHeading icon="greeting" title="Знакомство с Леви" />
              <p>{leviGreetings[0]}</p>
            </> : <>
              <StepHeading icon="role" title="Выбери роль" />
              <p>{roleExplanation}</p>
              <LeviComment text={roleComment} emotion="neutral" />
            </>}
          </div>
        </div>
        <div className="levi-tour__actions levi-tour__actions--greeting">
          {!standaloneLesson && <button className="text-button" type="button" onClick={onSkip}>Пропустить экскурсию</button>}
          {showNext &&
            <button className="primary-button levi-tour__next" type="button" onClick={onNext}>{standaloneLesson || arenaStep === 'briefing' || homeStep === 'arena' ? 'Понятно' : final ? 'Готово' : arenaStep ? 'Далее' : 'Дальше →'}</button>}
        </div>
      </div>
    </section>
  )
}
