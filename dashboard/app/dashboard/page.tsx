'use client'

// ダッシュボードビルダー本体 (M1: 骨組み)。
// 左パレットからウィジェットを追加し、グリッド上で移動/リサイズ、JSON で自動保存。
// データ連動カード (KPI/Chart/Table) とクロスフィルタは M2/M3 で実装。

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardGrid from '@/components/board/DashboardGrid'
import WidgetPalette from '@/components/board/WidgetPalette'
import { renderWidgetBody, type WidgetContext } from '@/components/board/widgets/registry'
import { useDashboard } from '@/lib/dashboard/store'
import { DashboardDataProvider } from '@/lib/dashboard/data'
import { exportDashboard } from '@/lib/dashboard/persistence'
import { loadSettings, type ConnectionSettings } from '@/lib/settings'
import type { Widget } from '@/lib/dashboard/types'

function BuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') ?? ''
  const modelId = searchParams.get('model') ?? ''

  const [settings, setSettings] = useState<ConnectionSettings | null>(null)
  const [editable, setEditable] = useState(true)

  const { def, dispatch } = useDashboard(projectId, modelId)

  useEffect(() => {
    const saved = loadSettings()
    if (!saved || !projectId || !modelId) {
      router.replace('/')
      return
    }
    setSettings(saved)
  }, [router, projectId, modelId])

  const context: WidgetContext | null = settings
    ? { serverUrl: settings.serverUrl, token: settings.token, projectId, modelId }
    : null

  const renderBody = useCallback(
    (widget: Widget) =>
      context
        ? renderWidgetBody(widget, context, {
            editable,
            onConfigChange: (config) => dispatch({ type: 'updateConfig', id: widget.id, config })
          })
        : null,
    [context, editable, dispatch]
  )

  if (!settings || !context) return null

  return (
    <DashboardDataProvider>
    <div className="builder">
      <WidgetPalette editable={editable} onAdd={(type) => dispatch({ type: 'add', widgetType: type })} />

      <div className="builder-main">
        <div className="builder-topbar">
          <a className="builder-back" href="/">
            ← モデル選択
          </a>
          <input
            className="builder-name"
            value={def.name}
            onChange={(e) => dispatch({ type: 'rename', name: e.target.value })}
            disabled={!editable}
          />
          <div className="builder-actions">
            <span className="builder-saved">自動保存</span>
            <button
              className={'ghost' + (editable ? ' active' : '')}
              onClick={() => setEditable((v) => !v)}
            >
              {editable ? '編集モード' : '閲覧モード'}
            </button>
            <button className="ghost" onClick={() => exportDashboard(def)}>
              JSON 書き出し
            </button>
            <button
              className="ghost"
              disabled={!editable}
              onClick={() => {
                if (confirm('すべてのウィジェットを削除して初期化しますか?')) {
                  dispatch({ type: 'reset' })
                }
              }}
            >
              リセット
            </button>
          </div>
        </div>

        <div className="builder-board">
          <DashboardGrid
            widgets={def.widgets}
            editable={editable}
            renderBody={renderBody}
            onLayoutChange={(id, layout) => dispatch({ type: 'updateLayout', id, layout })}
            onRemove={(id) => dispatch({ type: 'remove', id })}
            onTitleChange={(id, title) => dispatch({ type: 'updateTitle', id, title })}
          />
        </div>
      </div>
    </div>
    </DashboardDataProvider>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <BuilderInner />
    </Suspense>
  )
}
