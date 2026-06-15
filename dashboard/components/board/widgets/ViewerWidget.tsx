'use client'

// 3D ビューウィジェット。既存の SpeckleViewer を埋め込む。
// M1 では単体表示のみ。他カードとの選択連動は M3 で実装予定。

import dynamic from 'next/dynamic'
import type { WidgetContext } from './registry'

const SpeckleViewer = dynamic(() => import('@/components/SpeckleViewer'), { ssr: false })

export default function ViewerWidget({ context }: { context: WidgetContext }) {
  if (!context.serverUrl || !context.token || !context.projectId || !context.modelId) {
    return <div className="widget-placeholder">接続情報が不足しています</div>
  }
  return (
    <SpeckleViewer
      serverUrl={context.serverUrl}
      token={context.token}
      projectId={context.projectId}
      modelId={context.modelId}
      onReady={() => {}}
      onObjectClicked={() => {}}
    />
  )
}
