import { AppHeader } from '../components/AppHeader'
import type { Role } from '../config/roles'
import type { getRoleProgress } from '../services/progression'
import './workshop.css'

type WorkshopPageProps = {
  role: Role
  roleProgress: ReturnType<typeof getRoleProgress>
  energy: number
  streak: number
  onBack: () => void
  onChangeRole: () => void
}

export function WorkshopPage({ role, roleProgress, energy, streak, onBack, onChangeRole }: WorkshopPageProps) {
  return <div className="app-shell">
    <AppHeader role={role} roleProgress={roleProgress} energy={energy} streak={streak} onChangeRole={onChangeRole} />
    <main className="workshop-page">
      <button className="back-button" type="button" onClick={onBack}>← На главную</button>
      <header className="workshop-hero">
        <div className="workshop-hero-copy">
          <span className="workshop-hero-label">Мастерская <span>СКОРО / В РАЗРАБОТКЕ</span></span>
          <h1>Твои правила.<br />Твои испытания.</h1>
          <p>Создавай ситуации, в которых растут переговорные навыки.</p>
        </div>
        <div className="workshop-hero-art" aria-hidden="true"><span /><span /><span /></div>
      </header>
      <div className="workshop-showcase">
        <section className="workshop-opponent" aria-labelledby="workshop-opponent-title">
          <div className="workshop-feature-heading">
            <span className="workshop-feature-index">01 / ПЕРСОНАЖ</span>
            <h2 id="workshop-opponent-title">Конструктор<br />оппонентов</h2>
          </div>
          <div className="workshop-character">
            <div className="workshop-character-art" aria-hidden="true">
              <span className="workshop-character-orbit" />
              <span className="workshop-character-head" />
              <span className="workshop-character-body" />
            </div>
            <div className="workshop-character-info">
              <span className="workshop-character-kicker">ТВОЙ ОППОНЕНТ</span>
              <h3>Жёсткий<br />инвестор</h3>
              <dl className="workshop-character-traits">
                <div><dt>Стиль общения</dt><dd>Прямой · требовательный</dd></div>
                <div><dt>Сложность</dt><dd><span aria-hidden="true">★★★</span><span className="workshop-visually-hidden">Высокая</span></dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="workshop-mission" aria-labelledby="workshop-mission-title">
          <div className="workshop-mission-top"><span>02 / МИССИЯ</span><span aria-hidden="true">◇</span></div>
          <h2 id="workshop-mission-title">Конструктор<br />сценариев</h2>
          <div className="workshop-mission-preview">
            <span className="workshop-mission-label">ПЕРЕГОВОРЫ</span>
            <h3>Контракт на грани срыва</h3>
            <dl>
              <div><dt>Цель</dt><dd>Сохранить партнёрство</dd></div>
              <div><dt>На кону</dt><dd>Сроки и условия сделки</dd></div>
            </dl>
          </div>
        </section>

        <section className="workshop-tests" aria-labelledby="workshop-tests-title">
          <div className="workshop-small-icon" aria-hidden="true">?</div>
          <div><span className="workshop-feature-index">03 / ПРОВЕРКА НАВЫКОВ</span>
            <h2 id="workshop-tests-title">Конструктор тестов</h2>
            <p>Распознай манипуляцию</p></div>
          <div className="workshop-test-lines" aria-hidden="true"><span /><span /><span /></div>
        </section>

        <section className="workshop-library" aria-labelledby="workshop-library-title">
          <div className="workshop-library-icon" aria-hidden="true"><span /><span /><span /></div>
          <div><span className="workshop-feature-index">04 / ВМЕСТЕ</span>
            <h2 id="workshop-library-title">Библиотека команды</h2>
            <p>Идеи и материалы команды в одном месте.</p></div>
        </section>
      </div>
    </main>
  </div>
}
