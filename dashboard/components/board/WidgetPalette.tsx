'use client'

// 左のウィジェットパレット。クリックでボードにカードを追加する。
// (ドラッグ&ドロップ追加は M2 以降で対応予定。M1 はクリック追加)

import type { WidgetType } from '@/lib/dashboard/types'
import { WIDGET_CATALOG } from '@/lib/dashboard/types'

type Props = {
  editable: boolean
  onAdd: (type: WidgetType) => void
}

export default function WidgetPalette({ editable, onAdd }: Props) {
  // カテゴリごとにグループ化
  const categories = WIDGET_CATALOG.reduce<Record<string, typeof WIDGET_CATALOG>>((acc, entry) => {
    ;(acc[entry.category] ??= []).push(entry)
    return acc
  }, {})

  return (
    <aside className="builder-palette">
      <h2>ウィジェット</h2>
      {!editable && <p className="palette-hint">編集モードで追加できます</p>}
      {Object.entries(categories).map(([category, entries]) => (
        <div key={category} className="palette-group">
          <div className="palette-category">{category}</div>
          {entries.map((entry) => (
            <button
              key={entry.type}
              className="palette-item"
              disabled={!editable}
              onClick={() => onAdd(entry.type)}
              title={entry.implemented ? '' : 'M1 ではプレースホルダ表示 (M2 で実装)'}
            >
              <span className="palette-item-icon">{entry.icon}</span>
              <span className="palette-item-label">{entry.label}</span>
              {!entry.implemented && <span className="palette-badge">準備中</span>}
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}
