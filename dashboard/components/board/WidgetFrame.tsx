'use client'

// カードの枠。ヘッダー (タイトル/ドラッグ/各ウィジェット用ツールバー) + 本体 + リサイズハンドル。
//
// ヘッダー右側に、各ウィジェットが独自ボタンを差し込める「スロット」を用意する。
// 中身のウィジェット (例: 3D ビュー) は WidgetHeaderSlotContext 経由でこの DOM を取得し、
// React Portal でツールバーをヘッダー (ウィンドウ最上部) に描画・固定する。

import { createContext, useState, type ReactNode } from 'react'
import type { Widget } from '@/lib/dashboard/types'
import { catalogEntry } from '@/lib/dashboard/types'

export const WidgetHeaderSlotContext = createContext<HTMLElement | null>(null)

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
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null)
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

        {/* ウィジェット用ツールバーの差し込み先 (ドラッグ開始を抑止) */}
        <span
          className="widget-header-slot"
          ref={setSlotEl}
          onPointerDown={(e) => e.stopPropagation()}
        />

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

      <WidgetHeaderSlotContext.Provider value={slotEl}>
        <div className="widget-body">{children}</div>
      </WidgetHeaderSlotContext.Provider>

      {editable && (
        <div className="resize-handle" onPointerDown={onResizeStart} title="ドラッグでリサイズ" />
      )}
    </div>
  )
}
