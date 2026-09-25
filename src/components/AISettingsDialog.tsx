import { useEffect, useRef, useState, type FormEvent } from 'react'

type ConnectionState = 'idle' | 'checking' | 'connected' | 'error'
type Settings = { provider: 'openai-compatible'; baseUrl: string; apiKey: string; model: string }
type SettingsPayload = Omit<Settings, 'apiKey'> & { apiKey?: string }
type PublicSettings = { configured: true; provider: 'openai-compatible'; baseUrl: string; model: string }

const emptySettings: Settings = { provider: 'openai-compatible', baseUrl: '', apiKey: '', model: '' }

async function request(path: string, settings: SettingsPayload) {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
  } catch {
    throw new Error(`Локальный ${path} недоступен: запрос не достиг сервера приложения.`)
  }
  let result: { error?: string; stage?: string; configured?: boolean; provider?: string; baseUrl?: string; model?: string }
  try { result = await response.json() } catch {
    throw new Error(`Локальный ${path} ответил HTTP ${response.status}, но не вернул JSON диагностику.`)
  }
  if (!response.ok) {
    throw new Error(`Локальный ${path} достигнут. ${result.stage === 'provider' ? 'Ошибка внешнего провайдера' : 'Ошибка настройки'}: ${result.error || `HTTP ${response.status}`}`)
  }
  return result
}

export function AISettingsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [settings, setSettings] = useState<Settings>(emptySettings)
  const [status, setStatus] = useState<ConnectionState>('idle')
  const [message, setMessage] = useState('')
  const [savedConfig, setSavedConfig] = useState<PublicSettings | null>(null)
  const [editingConfig, setEditingConfig] = useState(false)
  const [replacingKey, setReplacingKey] = useState(false)
  const saveVersion = useRef(0)
  const editing = !savedConfig || editingConfig
  const enteringKey = !savedConfig || replacingKey

  useEffect(() => {
    let active = true
    let firstLoad = true
    let previouslyConfigured = false
    async function refresh() {
      const requestedVersion = saveVersion.current
      try {
        const response = await fetch('/api/ai/settings', { cache: 'no-store' })
        if (!response.ok) throw new Error('AI settings unavailable')
        const result = await response.json() as Partial<PublicSettings> & { configured?: boolean }
        if (!active || requestedVersion !== saveVersion.current) return
        const current = result.configured && result.provider === 'openai-compatible' &&
          typeof result.baseUrl === 'string' && typeof result.model === 'string'
          ? result as PublicSettings : null
        if (firstLoad || (!previouslyConfigured && current)) {
          setSettings((previous) => ({
            ...previous, baseUrl: current?.baseUrl ?? '', model: current?.model ?? '',
          }))
        } else if (previouslyConfigured && !current) {
          setStatus('idle')
          setMessage('Сессия AI на сервере завершилась. Введите API Key заново.')
        }
        setSavedConfig(current)
        previouslyConfigured = Boolean(current)
      } catch {
        if (!active || requestedVersion !== saveVersion.current) return
        setSavedConfig(null)
        if (firstLoad || previouslyConfigured) {
          setStatus('idle')
          setMessage('Локальный AI-сервер недоступен. Сохранение ключа больше не подтверждено.')
        }
        previouslyConfigured = false
      } finally {
        firstLoad = false
      }
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 10_000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])

  function update(field: keyof Settings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }))
    setStatus('idle')
    setMessage('')
  }

  function payload(): SettingsPayload {
    return {
      provider: settings.provider, baseUrl: settings.baseUrl, model: settings.model,
      ...(enteringKey ? { apiKey: settings.apiKey } : {}),
    }
  }

  async function check() {
    setStatus('checking')
    setMessage('Проверяем подключение…')
    try {
      await request('/api/ai/check', payload())
      setStatus('connected')
      setMessage('✓ Подключение успешно. Сохраните настройки, чтобы использовать AI в Arena.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Ошибка подключения.')
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status !== 'connected') return
    try {
      const result = await request('/api/ai/settings', payload())
      if (!result.configured || result.provider !== 'openai-compatible' ||
        typeof result.baseUrl !== 'string' || typeof result.model !== 'string') {
        throw new Error('Сервер не подтвердил сохранение настроек.')
      }
      saveVersion.current += 1
      setSavedConfig(result as PublicSettings)
      setEditingConfig(false)
      setReplacingKey(false)
      setStatus('idle')
      setMessage('Настройки сохранены для текущего запуска сервера.')
      setSettings((current) => ({ ...current, apiKey: '' }))
      onSaved()
      onClose()
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Не удалось сохранить настройки.')
    }
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
        <p>Настройте модель для Arena. Без подключения AI переговоры не смогут продолжиться.</p>
        {savedConfig && (
          <div className="ai-settings-configured" role="status">
            <strong>AI настроен</strong>
            <span>OpenAI-compatible · {savedConfig.model}</span>
          </div>
        )}
        {savedConfig && !editingConfig && (
          <button className="secondary-action-button ai-settings-edit-button" type="button" onClick={() => {
            setEditingConfig(true)
            setStatus('idle')
            setMessage('')
          }}>Изменить настройки</button>
        )}
        <form className="ai-settings-form" onSubmit={(event) => { void save(event) }}>
          <label htmlFor="ai-provider">Provider</label>
          <select id="ai-provider" value={settings.provider} disabled={!editing || status === 'checking'}
            onChange={(event) => update('provider', event.target.value)}>
            <option value="openai-compatible">OpenAI-compatible</option>
          </select>
          <label htmlFor="ai-base-url">Base URL</label>
          <input id="ai-base-url" type="url" required value={settings.baseUrl} readOnly={!editing || status === 'checking'}
            onChange={(event) => update('baseUrl', event.target.value)} placeholder="https://provider.example/v1" autoComplete="url" />
          {enteringKey ? <label htmlFor="ai-api-key">API Key</label> : <span className="ai-settings-label">API Key</span>}
          {enteringKey ? (
            <input id="ai-api-key" type="password" required value={settings.apiKey} disabled={status === 'checking'}
              onChange={(event) => update('apiKey', event.target.value)} autoComplete="off" />
          ) : (
            <div className="ai-settings-key-saved" role="status" aria-label="API Key сохранён для текущей сессии сервера">
              <span aria-hidden="true">••••••••••••••••</span>
              <span>✓ API Key сохранён для текущей сессии сервера</span>
            </div>
          )}
          {savedConfig && editingConfig && !replacingKey && (
            <button className="secondary-action-button ai-settings-replace-key" type="button" disabled={status === 'checking'} onClick={() => {
              setSettings((current) => ({ ...current, apiKey: '' }))
              setReplacingKey(true)
              setStatus('idle')
              setMessage('')
            }}>Заменить API Key</button>
          )}
          <label htmlFor="ai-model">Model</label>
          <input id="ai-model" type="text" required value={settings.model} readOnly={!editing || status === 'checking'}
            onChange={(event) => update('model', event.target.value)} placeholder="Название модели у провайдера" />
          <div className="ai-settings-actions">
            <button className="secondary-action-button" type="button" disabled={status === 'checking' || !editing} onClick={() => { void check() }}>
              {status === 'checking' ? 'Проверка…' : 'Проверить подключение'}
            </button>
            <button className="primary-button" type="submit" disabled={status !== 'connected'}>Сохранить и закрыть</button>
          </div>
          {message && <p className={`ai-settings-status is-${status}`} role="status">{message}</p>}
        </form>
        <p className="ai-settings-note">Указывайте только доверенный Base URL: ключ будет отправлен этому провайдеру. Ключ хранится только в памяти локального сервера и удаляется при его остановке. Не используйте чужой или публичный компьютер.</p>
      </section>
    </div>
  )
}
