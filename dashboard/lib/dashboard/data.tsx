'use client'

// ダッシュボード共有データコンテキスト。
// 3D ビューカードがモデルを読み込むと、その PropertyInfo[] や選択 API を
// ここに公開し、KPI / チャート / テーブルなど他のカードが参照する。
// (仕様書 §3.1「1 ダッシュボード = 1 ビューワ共有」をビューワカード起点で実現)

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ViewerReadyPayload } from '@/components/SpeckleViewer'

type DashboardDataValue = {
  /** ビューワ準備完了時のペイロード (未ロード時 null) */
  payload: ViewerReadyPayload | null
  /** ビューワカードから公開/解除する */
  setPayload: (p: ViewerReadyPayload | null) => void
}

const DashboardDataContext = createContext<DashboardDataValue | null>(null)

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<ViewerReadyPayload | null>(null)
  const value = useMemo(() => ({ payload, setPayload }), [payload])
  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData(): DashboardDataValue {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) throw new Error('useDashboardData は DashboardDataProvider の内側で使用してください')
  return ctx
}

/**
 * 集計プロパティ ID 群を 3D ビューで選択ハイライトする (カード → 3D 連動)。
 * zoom=true で該当要素にズームする。
 */
export function highlightInViewer(
  payload: ViewerReadyPayload | null,
  propertyIds: string[],
  zoom = false
): void {
  if (!payload) return
  const ids = payload.resolveRenderableIds(propertyIds)
  payload.selection.clearSelection()
  if (ids.length === 0) return
  payload.selection.selectObjects(ids)
  if (zoom) payload.camera.setCameraView(ids, true)
}

