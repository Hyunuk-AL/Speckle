// ダッシュボード定義の保存/復元。
// PoC では localStorage に保存 (プロジェクト+モデル単位)。将来は保存 API に差し替える。

import type { DashboardDef } from './types'

function keyFor(projectId: string, modelId: string): string {
  return `speckle-poc-dashboard:${projectId}:${modelId}`
}

export function loadDashboard(projectId: string, modelId: string): DashboardDef | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(keyFor(projectId, modelId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DashboardDef
    if (!Array.isArray(parsed.widgets)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDashboard(projectId: string, modelId: string, def: DashboardDef): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(keyFor(projectId, modelId), JSON.stringify(def))
}

export function clearDashboard(projectId: string, modelId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(keyFor(projectId, modelId))
}

/** ダッシュボード定義を JSON ファイルとしてダウンロード (バックアップ/共有用) */
export function exportDashboard(def: DashboardDef): void {
  const blob = new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${def.name || 'dashboard'}.json`
  a.click()
  URL.revokeObjectURL(url)
}
