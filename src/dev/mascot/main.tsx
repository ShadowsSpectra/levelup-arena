import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Mascot, type MascotSize, type MascotState } from '../../components/mascot/Mascot'
import './playground.css'

const emotions: MascotState[] = ['idle', 'happy', 'judge', 'point']
const sizes: MascotSize[] = [56, 96, 160]
const phrases = ['Готовы к переговорам?', 'Хороший ход!', 'Давайте разберём результат.']

function MascotPlayground() {
  const [emotion, setEmotion] = useState<MascotState>('idle')
  const [size, setSize] = useState<MascotSize>(160)
  const [tail, setTail] = useState(true)
  const [animate, setAnimate] = useState(true)
  const [phrase, setPhrase] = useState('')
  const [replay, setReplay] = useState(0)

  return (
    <main className="mascot-playground">
      <p className="mascot-playground__label">LevelUP Arena · только разработка</p>
      <h1>Mascot Playground</h1>
      <p>Изолированная проверка PNG и анимаций. idle и point моргают через 3–5 секунд.</p>
      <div className="mascot-playground__stage">
        <Mascot key={replay} state={emotion} size={size} animateTail={tail} animate={animate} />
        {phrase && <p className="mascot-playground__speech" role="status">{phrase}</p>}
      </div>
      <fieldset><legend>Эмоция</legend>
        {emotions.map((value) => <button key={value} type="button" aria-pressed={emotion === value}
          onClick={() => { setEmotion(value); setReplay(replay + 1) }}>{value}</button>)}
      </fieldset>
      <fieldset><legend>Размер</legend>
        {sizes.map((value) => <button key={value} type="button" aria-pressed={size === value}
          onClick={() => setSize(value)}>{value} px</button>)}
      </fieldset>
      <fieldset><legend>Движение</legend>
        <button type="button" aria-pressed={tail} onClick={() => setTail(!tail)}>Хвост: {tail ? 'качается' : 'неподвижен'}</button>
        <button type="button" aria-pressed={animate} onClick={() => setAnimate(!animate)}>Анимации: {animate ? 'включены' : 'выключены'}</button>
      </fieldset>
      <fieldset><legend>Тестовые реплики</legend>
        {phrases.map((value) => <button key={value} type="button" onClick={() => setPhrase(value)}>{value}</button>)}
        <button type="button" onClick={() => setPhrase('')}>Скрыть реплику</button>
      </fieldset>
      <p>При системной настройке «Уменьшение движения» дыхание, хвост, радость и моргание отключены.</p>
    </main>
  )
}

if (import.meta.env.DEV) {
  createRoot(document.getElementById('root')!).render(<StrictMode><MascotPlayground /></StrictMode>)
}
