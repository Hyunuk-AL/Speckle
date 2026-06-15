'use client'

// M1 用プレースホルダ。未実装ウィジェットの枠だけを表示する。
// M2 以降で各ウィジェットの本体に差し替える。

import type { Widget } from '@/lib/dashboard/types'
import { catalogEntry } from '@/lib/dashboard/types'

export default function PlaceholderWidget({ widget }: { widget: Widget }) {
  const entry = catalogEntry(widget.type)
  return (
    <div className="widget-placeholder">
      <div className="placeholder-icon">{entry.icon}</div>
      <div className="placeholder-label">{entry.label}</div>
      <div className="placeholder-note">M2 で実装予定</div>
    </div>
  )
}
