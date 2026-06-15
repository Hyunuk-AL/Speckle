'use client'

// カードの枠。ヘッダー (タイトル/ドラッグ) + 本体 + リサイズハンドル。

import { useState, type ReactNode } from 'react'
import type { Widget } from '@/lib/dashboard/types'
import { catalogEntry } from '@/lib/dashboard/types'

type Props = {
  widget: Widget
  editable: boolean
  onDragStart: (e: React.PointerEvent) => void
  onResizeStart: (e: React.PointerEvent) => void
  onRemove: () => void
  onTitleChange: (title: string) => void
  children: ReactNode
}

export default function WidgetFrame({
  widget,
  editable,
  onDragStart,
  onResizeStart,
  onRemove,
  onTitleChange,
  children
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false)
  const entry = catalogEntry(widget.type)

  return (
    <div className="widget-frame">
      <div
        className={'widget-header' + (editable ? ' draggable' : '')}
        onPointerDown={editable && !editingTitle ? onDragStart : undefined}
      >
        <span className="widget-icon">{entry.icon}</span>
        {editingTitle ? (
          <input
            className="widget-title-input"
            autoFocus
            defaultValue={widget.title}
            onBlur={(e) => {
              onTitleChange(e.target.value || entry.label)
              setEditingTitle(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="widget-title"
            onDoubleClick={() => editable && setEditingTitle(true)}
            title={editable ? 'ダブルクリックで名前変更' : undefined}
          >
            {widget.title}
          </span>
        )}
        {editable && (
          <button
            className="widget-remove"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            title="削除"
          >
            ×
          </button>
        )}
      </div>

      <div className="widget-body">{children}</div>

      {editable && (
        <div className="resize-handle" onPointerDown={onResizeStart} title="ドラッグでリサイズ" />
      )}
    </div>
  )
}
