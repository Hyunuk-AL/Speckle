// 接続設定 (サーバー URL / Personal Access Token) を localStorage に保持する。
// PoC 用途のため平文保存。本番化時はサーバーサイドのセッション管理に置き換えること。

export type ConnectionSettings = {
  serverUrl: string
  token: string
}

const KEY = 'speckle-poc-settings'

export function loadSettings(): ConnectionSettings | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ConnectionSettings
    if (!parsed.serverUrl || !parsed.token) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSettings(settings: ConnectionSettings): void {
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      ...settings,
      // 末尾スラッシュは URL 組み立て時の事故防止のため取り除く
      serverUrl: settings.serverUrl.replace(/\/+$/, '')
    })
  )
}

export function clearSettings(): void {
  window.localStorage.removeItem(KEY)
}
