'use client'

// 依存ライブラリなしの自作グリッド (React 19 対応)。
// 編集モードではヘッダードラッグで移動、右下ハンドルでリサイズできる。

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Widget, WidgetLayout } from '@/lib/dashboard/types'
import { GRID } from '@/lib/dashboard/types'
import WidgetFrame from './WidgetFrame'

type Props = {
  widgets: Widget[]
  editable: boolean
  renderBody: (widget: Widget) => ReactNode
  onLayoutChange: (id: string, layout: WidgetLayout) => void
  onRemove: (id: string) => void
  onTitleChange: (id: string, title: string) => void
}

type Op = {
  id: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  startLayout: WidgetLayout
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export default function DashboardGrid({
  widgets,
  editable,
  renderBody,
  onLayoutChange,
  onRemove,
  onTitleChange
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [op, setOp] = useState<Op | null>(null)
  const [preview, setPreview] = useState<WidgetLayout | null>(null)
  const previewRef = useRef<WidgetLayout | null>(null)

  // コンテナ幅を監視して列幅を算出
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const { cols, rowHeight, margin } = GRID
  const unitW = width > 0 ? (width - margin * (cols + 1)) / cols : 0

  const xPx = (x: number) => margin + x * (unitW + margin)
  const yPx = (y: number) => margin + y * (rowHeight + margin)
  const wPx = (w: number) => w * unitW + (w - 1) * margin
  const hPx = (h: number) => h * rowHeight + (h - 1) * margin

  // ドラッグ/リサイズ中のグローバルポインタ処理
  useEffect(() => {
    if (!op) return
    const onMove = (e: PointerEvent) => {
      const dCol = Math.round((e.clientX - op.startX) / (unitW + margin))
      const dRow = Math.round((e.clientY - op.startY) / (rowHeight + margin))
      const s = op.startLayout
      let next: WidgetLayout
      if (op.mode === 'move') {
        next = {
          ...s,
          x: clamp(s.x + dCol, 0, cols - s.w),
          y: Math.max(0, s.y + dRow)
        }
      } else {
        next = {
          ...s,
          w: clamp(s.w + dCol, 1, cols - s.x),
          h: Math.max(1, s.h + dRow)
        }
      }
      previewRef.current = next
      setPreview(next)
    }
    const onUp = () => {
      if (previewRef.current) onLayoutChange(op.id, previewRef.current)
      previewRef.current = null
      setPreview(null)
      setOp(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [op, unitW, margin, rowHeight, cols, onLayoutChange])

  const startOp = (
    id: string,
    layout: WidgetLayout,
    mode: 'move' | 'resize',
    e: React.PointerEvent
  ) => {
    if (!editable) return
    e.preventDefault()
    setOp({ id, mode, startX: e.clientX, startY: e.clientY, startLayout: layout })
  }

  const boardRows =
    widgets.reduce((max, w) => {
      const l = op?.id === w.id && preview ? preview : w.layout
      return Math.max(max, l.y + l.h)
    }, 0) + (editable ? 2 : 0)
  const boardHeight = yPx(boardRows)

  return (
    <div
      ref={containerRef}
      className="grid-container"
      style={{ height: boardHeight > 0 ? boardHeight : undefined }}
    >
      {width > 0 &&
        widgets.map((widget) => {
          const layout = op?.id === widget.id && preview ? preview : widget.layout
          const active = op?.id === widget.id
          return (
            <div
              key={widget.id}
              className={'grid-item' + (active ? ' grid-item-active' : '')}
              style={{
                left: xPx(layout.x),
                top: yPx(layout.y),
                width: wPx(layout.w),
                height: hPx(layout.h)
              }}
            >
              <WidgetFrame
                widget={widget}
                editable={editable}
                onDragStart={(e) => startOp(widget.id, widget.layout, 'move', e)}
                onResizeStart={(e) => startOp(widget.id, widget.layout, 'resize', e)}
                onRemove={() => onRemove(widget.id)}
                onTitleChange={(title) => onTitleChange(widget.id, title)}
              >
                {renderBody(widget)}
              </WidgetFrame>
            </div>
          )
        })}

      {widgets.length === 0 && (
        <div className="grid-empty">
          左のメニューからウィジェットを追加してダッシュボードを作成します
        </div>
      )}
    </div>
  )
}
