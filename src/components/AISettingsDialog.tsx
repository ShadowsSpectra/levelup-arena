import { useEffect, useRef, useState, type FormEvent } from 'react'
import { aiSettingsSession, checkAIConnection, getDefaultAISettings } from '../services/aiSettingsSession'
import type { AISettings as Settings, PublicAISettings as PublicSettings } from '../types/aiSettings'

type ConnectionState = 'idle' | 'checking' | 'connected' | 'error'
const emptySettings: Settings = { provider: 'openai-compatible', baseUrl: '', apiKey: '', model: '' }

function editable(info: PublicSettings | null): Settings {
  return info ? { provider: info.provider, baseUrl: info.baseUrl, model: info.model, apiKey: '' } : emptySettings
}

export function AISettingsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [settings, setSettings] = useState<Settings>(() => editable(aiSettingsSession.getPublic()))
  const [status, setStatus] = useState<ConnectionState>('idle')
  const [message, setMessage] = useState('')
  const [savedConfig, setSavedConfig] = useState<PublicSettings | null>(() => aiSettingsSession.getPublic())
  const [defaultConfig, setDefaultConfig] = useState<PublicSettings | null>(null)
  const [defaultLoading, setDefaultLoading] = useState(true)
  const [usingBYOK, setUsingBYOK] = useState(() => Boolean(aiSettingsSession.getPublic()))
  const [editingConfig, setEditingConfig] = useState(false)
  const editVersion = useRef(0)
  const checkedCandidate = useRef<Settings | null>(null)
  const editing = !savedConfig || editingConfig

  useEffect(() => {
    let active = true
    const requestedVersion = editVersion.current
    void getDefaultAISettings().then((result) => {
      if (!active) return
      const current = result.configured ? result : null
      setDefaultConfig(current)
      if (!aiSettingsSession.getPublic() && requestedVersion === editVersion.current) {
        setSavedConfig(current)
        setSettings(editable(current))
      }
    }).catch(() => {
      if (active) setMessage('AI-сервер недоступен. Настройки вашей вкладки не изменены.')
    }).finally(() => { if (active) setDefaultLoading(false) })
    return () => { active = false }
  }, [])

  function update(field: keyof Settings, value: string) {
    editVersion.current += 1
    checkedCandidate.current = null
    setSettings((current) => ({ ...current, [field]: value }))
    setStatus('idle')
    setMessage('')
  }

  async function check() {
    setStatus('checking')
    setMessage('Проверяем подключение…')
    try {
      const candidate = editing ? aiSettingsSession.prepare(settings) : aiSettingsSession.get()
      await checkAIConnection(candidate ?? undefined)
      checkedCandidate.current = candidate
      setStatus('connected')
      setMessage(editing ? '✓ Подключение успешно. Сохраните настройки, чтобы использовать AI в Arena.'
        : candidate ? '✓ Ваш AI подключён.' : '✓ AI приложения подключён.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Ошибка подключения.')
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status !== 'connected' || !editing || !checkedCandidate.current) return
    aiSettingsSession.save(checkedCandidate.current)
    checkedCandidate.current = null
    editVersion.current += 1
    setSavedConfig(aiSettingsSession.getPublic())
    setUsingBYOK(true)
    setEditingConfig(false)
    setStatus('idle')
    setSettings((current) => ({ ...current, apiKey: '' }))
    onSaved()
    onClose()
  }

  function useDefault() {
    aiSettingsSession.clear()
    checkedCandidate.current = null
    editVersion.current += 1
    setUsingBYOK(false)
    setSavedConfig(defaultConfig)
    setSettings(editable(defaultConfig))
    setEditingConfig(false)
    setStatus('idle')
    setMessage(defaultConfig ? 'Используется AI приложения.' : 'AI приложения не настроен на сервере.')
    onSaved()
  }

  return (
    <div className="ai-settings-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="ai-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
        <div className="ai-settings-heading">
          <div>
            <span className="section-kicker">Arena · AI</span>
            <h2 id="ai-settings-title">AI Settings</h2>
          </div>
          <button className="text-button" type="button" onClick={onClose} aria-label="Закрыть настройки AI">Закрыть</button>
        </div>
        <p>Используйте AI приложения или подключите собственную модель для этой вкладки.</p>
        {savedConfig && (
          <div className="ai-settings-configured" role="status">
            <strong>{usingBYOK ? 'Ваш AI настроен' : 'AI приложения настроен'}</strong>
            <span>OpenAI-compatible · {savedConfig.model}</span>
          </div>
        )}
        {savedConfig && !editingConfig && (
          <button className="secondary-action-button ai-settings-edit-button" type="button" disabled={status === 'checking'} onClick={() => {
            editVersion.current += 1
            checkedCandidate.current = null
            setEditingConfig(true)
            setStatus('idle')
            setMessage('')
          }}>Изменить настройки</button>
        )}
        {usingBYOK && <button className="text-button" type="button" disabled={status === 'checking' || defaultLoading} onClick={useDefault}>
          Использовать AI приложения
        </button>}
        <form className="ai-settings-form" onSubmit={save}>
          <label htmlFor="ai-provider">Provider</label>
          <select id="ai-provider" value={settings.provider} disabled={!editing || status === 'checking'}
            onChange={(event) => update('provider', event.target.value)}>
            <option value="openai-compatible">OpenAI-compatible</option>
          </select>
          <label htmlFor="ai-base-url">Base URL</label>
          <input id="ai-base-url" type="url" required value={settings.baseUrl} readOnly={!editing || status === 'checking'}
            onChange={(event) => update('baseUrl', event.target.value)} placeholder="https://provider.example/v1" autoComplete="url" />
          {editing ? <label htmlFor="ai-api-key">API Key</label> : <span className="ai-settings-label">API Key</span>}
          {editing ? (
            <input id="ai-api-key" type="password" required={!usingBYOK} value={settings.apiKey} disabled={status === 'checking'}
              onChange={(event) => update('apiKey', event.target.value)}
              placeholder={usingBYOK ? 'Оставьте пустым, чтобы сохранить ваш текущий ключ' : 'Ваш собственный API Key'} autoComplete="off" />
          ) : (
            <div className="ai-settings-key-saved" role="status" aria-label={usingBYOK ? 'API Key сохранён до обновления страницы' : 'Ключ приложения хранится только на сервере'}>
              <span aria-hidden="true">••••••••••••••••</span>
              <span>{usingBYOK ? '✓ API Key сохранён до обновления страницы' : 'Ключ приложения хранится только на сервере'}</span>
            </div>
          )}
          <label htmlFor="ai-model">Model</label>
          <input id="ai-model" type="text" required value={settings.model} readOnly={!editing || status === 'checking'}
            onChange={(event) => update('model', event.target.value)} placeholder="Название модели у провайдера" />
          <div className="ai-settings-actions">
            <button className="secondary-action-button" type="button" disabled={status === 'checking'} onClick={() => { void check() }}>
              {status === 'checking' ? 'Проверка…' : 'Проверить подключение'}
            </button>
            <button className="primary-button" type="submit" disabled={status !== 'connected' || !editing}>Сохранить и закрыть</button>
          </div>
          {message && <p className={`ai-settings-status is-${status}`} role="status">{message}</p>}
        </form>
        <p className="ai-settings-note">Разрешены только одобренные приложением Base URL. Ваш ключ передаётся нашему серверу и выбранному провайдеру, хранится только в памяти вкладки и забывается при обновлении страницы. Не используйте публичный компьютер.</p>
      </section>
    </div>
  )
}
