'use client'

// ウィジェット種別 → 描画コンポーネントの対応。
// M2 以降、KPI/Chart/Table 等をプレースホルダから本体へ差し替える際はここを更新する。

import type { ReactNode } from 'react'
import type { Widget } from '@/lib/dashboard/types'
import ViewerWidget from './ViewerWidget'
import PlaceholderWidget from './PlaceholderWidget'

/** カードが共通で必要とする接続/データ情報 */
export type WidgetContext = {
  serverUrl: string
  token: string
  projectId: string
  modelId: string
}

export function renderWidgetBody(widget: Widget, context: WidgetContext): ReactNode {
  switch (widget.type) {
    case 'viewer':
      return <ViewerWidget context={context} />
    default:
      return <PlaceholderWidget widget={widget} />
  }
}
