'use client'

// ウィジェット種別 → 描画コンポーネントの対応。

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { Widget } from '@/lib/dashboard/types'
import ViewerWidget from './ViewerWidget'
import KpiWidget from './KpiWidget'
import TableWidget from './TableWidget'
import ParamCheckWidget from './ParamCheckWidget'
import FinishScheduleWidget from './FinishScheduleWidget'
import Co2Widget from './Co2Widget'
import ColorizeWidget from './ColorizeWidget'
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
  const common = { widget, editable: opts.editable, onConfigChange: opts.onConfigChange }
  switch (widget.type) {
    case 'viewer':
      return <ViewerWidget context={context} />
    case 'kpi':
      return <KpiWidget {...common} />
    case 'chart':
      return <ChartWidget {...common} />
    case 'table':
      return <TableWidget {...common} />
    case 'paramCheck':
      return <ParamCheckWidget {...common} />
    case 'finish':
      return <FinishScheduleWidget {...common} />
    case 'co2':
      return <Co2Widget {...common} />
    case 'colorize':
      return <ColorizeWidget {...common} />
    default:
      return <PlaceholderWidget widget={widget} />
  }
}
