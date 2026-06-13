'use client'

// ダッシュボード本体: 3D ビュー + 集計表 + グラフ + 色分け + テクスチャ適用。
// - 表/グラフのクリック → FilteringExtension.isolateObjects() で 3D 分離表示
// - 3D クリック → 該当する集計行をハイライト
// - 色分け → FilteringExtension.setUserObjectColors()

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { ViewerReadyPayload } from '@/components/SpeckleViewer'
import AggregationTable from '@/components/AggregationTable'
import ChartPanel from '@/components/ChartPanel'
import {
  aggregate,
  groupableProperties,
  measurableProperties,
  type AggregationRow
} from '@/lib/aggregate'
import { colorAt } from '@/lib/palette'
import { applyTextures } from '@/lib/textures'
import { loadSettings, type ConnectionSettings } from '@/lib/settings'

// viewer は WebGL 前提のため SSR を無効化して読み込む
const SpeckleViewer = dynamic(() => import('@/components/SpeckleViewer'), { ssr: false })

function DashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') ?? ''
  const modelId = searchParams.get('model') ?? ''

  const [settings, setSettings] = useState<ConnectionSettings | null>(null)
  const [ctx, setCtx] = useState<ViewerReadyPayload | null>(null)
  const [groupKey, setGroupKey] = useState('')
  const [measureKey, setMeasureKey] = useState('')
  const [isolatedValue, setIsolatedValue] = useState<string | null>(null)
  const [highlightedValue, setHighlightedValue] = useState<string | null>(null)
  const [colorized, setColorized] = useState(false)
  // false: Speckle cloud 同様、全体表示のまま選択ハイライト / true: 該当要素のみ分離表示
  const [isolateMode, setIsolateMode] = useState(false)
  const [textureResult, setTextureResult] = useState<string | null>(null)
  const [textureBusy, setTextureBusy] = useState(false)

  useEffect(() => {
    const saved = loadSettings()
    if (!saved || !projectId || !modelId) {
      router.replace('/')
      return
    }
    setSettings(saved)
  }, [router, projectId, modelId])

  const groupProps = useMemo(
    () => (ctx ? groupableProperties(ctx.properties) : []),
    [ctx]
  )
  const measureProps = useMemo(
    () => (ctx ? measurableProperties(ctx.properties) : []),
    [ctx]
  )
  const groupProp = useMemo(
    () => groupProps.find((p) => p.key === groupKey) ?? null,
    [groupProps, groupKey]
  )
  const measureProp = useMemo(
    () => measureProps.find((p) => p.key === measureKey) ?? null,
    [measureProps, measureKey]
  )
  const rows = useMemo(
    () => (groupProp ? aggregate(groupProp, measureProp) : []),
    [groupProp, measureProp]
  )

  const handleReady = useCallback((payload: ViewerReadyPayload) => {
    setCtx(payload)
    // 既定のグループ軸: category があれば優先
    const groups = groupableProperties(payload.properties)
    const def =
      groups.find((p) => /^category$/i.test(p.key)) ??
      groups.find((p) => /speckle_type/i.test(p.key)) ??
      groups[0]
    if (def) setGroupKey(def.key)
  }, [])

  // 色分けの適用/解除 (分離表示の切替後にも再適用する)
  useEffect(() => {
    if (!ctx) return
    if (colorized && rows.length > 0) {
      ctx.filtering.setUserObjectColors(
        rows.map((r, i) => ({
          objectIds: ctx.resolveRenderableIds(r.ids),
          color: colorAt(i)
        }))
      )
    } else {
      ctx.filtering.removeUserObjectColors()
    }
  }, [ctx, colorized, rows, isolatedValue])

  const selectRow = useCallback(
    (value: string) => {
      if (!ctx) return
      const row = rows.find((r) => r.value === value)
      if (!row) return
      // いったん前回の選択/分離を解除
      ctx.filtering.resetFilters()
      ctx.selection.clearSelection()
      if (isolatedValue === value) {
        // 同じ行の再クリックで解除し、全体表示に戻す
        setIsolatedValue(null)
        ctx.camera.setCameraView(undefined, true)
        return
      }
      // 集計の ID を、ビューワが選択/ズームに使える描画可能なノード ID に変換する
      const renderableIds = ctx.resolveRenderableIds(row.ids)
      if (isolateMode) {
        // 分離表示: 他要素を隠す
        ctx.filtering.isolateObjects(renderableIds, 'dashboard', true, true)
      } else {
        // Speckle cloud 同様: 全体は表示したまま該当要素を選択ハイライト
        ctx.selection.selectObjects(renderableIds)
      }
      setIsolatedValue(value)
      // 描画可能な要素が無い場合はカメラ移動しない (空の範囲エラーを避ける)
      if (renderableIds.length > 0) {
        ctx.camera.setCameraView(renderableIds, true)
      }
    },
    [ctx, rows, isolatedValue, isolateMode]
  )

  const handleRowClick = useCallback(
    (row: AggregationRow) => selectRow(row.value),
    [selectRow]
  )

  // 3D クリック → 該当行のハイライト
  const handleObjectClicked = useCallback(
    (objectId: string | null) => {
      if (!objectId) {
        setHighlightedValue(null)
        return
      }
      const row = rows.find((r) => r.ids.includes(objectId))
      setHighlightedValue(row ? row.value : null)
    },
    [rows]
  )

  const resetAll = useCallback(() => {
    if (!ctx) return
    ctx.filtering.resetFilters()
    ctx.selection.clearSelection()
    setIsolatedValue(null)
    setHighlightedValue(null)
    setColorized(false)
    ctx.camera.setCameraView(undefined, true)
  }, [ctx])

  const handleApplyTextures = useCallback(async () => {
    if (!ctx) return
    setTextureBusy(true)
    setTextureResult(null)
    try {
      const result = await applyTextures(ctx.viewer)
      const appliedLines = Object.entries(result.applied).map(
        ([name, count]) => `✔ ${name}: ${count} オブジェクト`
      )
      const unmappedLine =
        result.unmapped.length > 0
          ? `\n未マッピング: ${result.unmapped.slice(0, 10).join(', ')}${result.unmapped.length > 10 ? ' ...' : ''}`
          : ''
      setTextureResult(
        (appliedLines.length > 0 ? appliedLines.join('\n') : '適用対象なし') + unmappedLine
      )
    } catch (e) {
      setTextureResult(`エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTextureBusy(false)
    }
  }, [ctx])

  if (!settings) return null

  return (
    <div className="dashboard">
      <div className="viewer-pane">
        <SpeckleViewer
          serverUrl={settings.serverUrl}
          token={settings.token}
          projectId={projectId}
          modelId={modelId}
          onReady={handleReady}
          onObjectClicked={handleObjectClicked}
        />
      </div>

      <aside className="side-pane">
        <h1>
          集計ダッシュボード <a href="/">← モデル選択へ</a>
        </h1>

        <div className="controls">
          <label>
            グループ軸
            <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
              {groupProps.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.key} ({p.valueGroups.length})
                </option>
              ))}
            </select>
          </label>
          <label>
            集計値
            <select value={measureKey} onChange={(e) => setMeasureKey(e.target.value)}>
              <option value="">(件数のみ)</option>
              {measureProps.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.key}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button
              className={'ghost' + (isolateMode ? ' active' : '')}
              disabled={!ctx}
              onClick={() => setIsolateMode((v) => !v)}
              title="OFF: 全体表示のままハイライト (Speckle cloud と同様) / ON: 該当要素のみ分離表示"
            >
              {isolateMode ? '分離表示: ON' : '分離表示: OFF'}
            </button>
            <button
              className={'ghost' + (colorized ? ' active' : '')}
              disabled={!ctx}
              onClick={() => setColorized((v) => !v)}
            >
              色分け表示
            </button>
            <button className="ghost" disabled={!ctx} onClick={resetAll}>
              表示リセット
            </button>
            <button
              className="ghost"
              disabled={!ctx || textureBusy}
              onClick={() => void handleApplyTextures()}
            >
              {textureBusy ? 'テクスチャ適用中...' : 'テクスチャ適用 (実験的)'}
            </button>
          </div>
        </div>

        {!ctx && <p className="hint">モデルの読み込み完了後に集計が表示されます。</p>}

        {ctx && rows.length > 0 && (
          <>
            <AggregationTable
              rows={rows}
              measureLabel={measureProp ? measureProp.key.split('.').slice(-2)[0] : null}
              isolatedValue={isolatedValue}
              highlightedValue={highlightedValue}
              colorized={colorized}
              onRowClick={handleRowClick}
            />
            <ChartPanel
              rows={rows}
              measureLabel={measureProp ? measureProp.key.split('.').slice(-2)[0] : null}
              onSelectValue={selectRow}
            />
          </>
        )}

        {textureResult && <pre className="texture-result">{textureResult}</pre>}
      </aside>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  )
}
