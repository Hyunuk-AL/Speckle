'use client'

// ウィジェット種別 → 描画コンポーネントの対応。

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { Widget } from '@/lib/dashboard/types'
import ViewerWidget from './ViewerWidget'
import KpiWidget from './KpiWidget'
import TableWidget from './TableWidget'
import PlaceholderWidget from './PlaceholderWidget'

// ECharts を含むため、チャートカード使用時のみ読み込む
const ChartWidget = dynamic(() => import('./ChartWidget'), { ssr: false })

/** カードが共通で必要とする接続/データ情報 */
export type WidgetContext = {
  serverUrl: string
  token: string
  projectId: string
  modelId: string
}

export type WidgetRenderOptions = {
  editable: boolean
  onConfigChange: (config: Record<string, unknown>) => void
}

export function renderWidgetBody(
  widget: Widget,
  context: WidgetContext,
  opts: WidgetRenderOptions
): ReactNode {
  switch (widget.type) {
    case 'viewer':
      return <ViewerWidget context={context} />
    case 'kpi':
      return (
        <KpiWidget widget={widget} editable={opts.editable} onConfigChange={opts.onConfigChange} />
      )
    case 'chart':
      return (
        <ChartWidget widget={widget} editable={opts.editable} onConfigChange={opts.onConfigChange} />
      )
    case 'table':
      return (
        <TableWidget widget={widget} editable={opts.editable} onConfigChange={opts.onConfigChange} />
      )
    default:
      return <PlaceholderWidget widget={widget} />
  }
}
