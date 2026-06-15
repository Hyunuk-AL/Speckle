'use client'

// 3D ビューウィジェット。既存の SpeckleViewer を埋め込み、
// ツールバー (全画面 / 座標表示 / ナビゲーション) を重ねる。
// M1 では単体表示。他カードとの選択連動は M3 で実装予定。

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { CameraEvent, type CameraController, type Viewer } from '@speckle/viewer'
import type { ViewerReadyPayload } from '@/components/SpeckleViewer'
import type { WidgetContext } from './registry'

const SpeckleViewer = dynamic(() => import('@/components/SpeckleViewer'), { ssr: false })

type Coords = { px: number; py: number; pz: number; tx: number; ty: number; tz: number }

// ナビゲーションの標準視点 (CameraController.setCameraView に渡す)
const VIEWS: { label: string; view: 'top' | 'front' | 'back' | 'left' | 'right' | 'bottom' | '3d' }[] = [
  { label: '上', view: 'top' },
  { label: '前', view: 'front' },
  { label: '右', view: 'right' },
  { label: '後', view: 'back' },
  { label: '左', view: 'left' },
  { label: '下', view: 'bottom' },
  { label: '3D', view: '3d' }
]

export default function ViewerWidget({ context }: { context: WidgetContext }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<CameraController | null>(null)
  const viewerRef = useRef<Viewer | null>(null)

  const [ready, setReady] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCoords, setShowCoords] = useState(false)
  const [showNav, setShowNav] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)

  const handleReady = useCallback((payload: ViewerReadyPayload) => {
    cameraRef.current = payload.camera
    viewerRef.current = payload.viewer
    setReady(true)
  }, [])

  // 全画面状態の同期
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void wrapRef.current?.requestFullscreen()
    }
  }, [])

  // 座標表示 ON の間、カメラ位置を定期取得して更新
  useEffect(() => {
    if (!showCoords || !ready) return
    const read = () => {
      const cam = cameraRef.current
      if (!cam) return
      const p = cam.getPosition()
      const t = cam.getTarget()
      setCoords({ px: p.x, py: p.y, pz: p.z, tx: t.x, ty: t.y, tz: t.z })
    }
    read()
    const timer = window.setInterval(read, 120)
    return () => window.clearInterval(timer)
  }, [showCoords, ready])

  const setView = useCallback((view: (typeof VIEWS)[number]['view']) => {
    cameraRef.current?.setCameraView(view, true)
  }, [])

  const zoomAll = useCallback(() => {
    // undefined を渡すと全体表示 (zoomExtents)
    cameraRef.current?.setCameraView(undefined, true)
  }, [])

  const fmt = (n: number) => n.toFixed(2)

  if (!context.serverUrl || !context.token || !context.projectId || !context.modelId) {
    return <div className="widget-placeholder">接続情報が不足しています</div>
  }

  return (
    <div className="viewer-widget" ref={wrapRef}>
      <SpeckleViewer
        serverUrl={context.serverUrl}
        token={context.token}
        projectId={context.projectId}
        modelId={context.modelId}
        onReady={handleReady}
        onObjectClicked={() => {}}
      />

      {/* ツールバー (右上) */}
      <div className="viewer-toolbar">
        <button title="全体にズーム" onClick={zoomAll} disabled={!ready}>
          ⊹
        </button>
        <button
          title="座標表示 ON/OFF"
          className={showCoords ? 'on' : ''}
          onClick={() => setShowCoords((v) => !v)}
          disabled={!ready}
        >
          📍
        </button>
        <button
          title="ナビゲーション"
          className={showNav ? 'on' : ''}
          onClick={() => setShowNav((v) => !v)}
          disabled={!ready}
        >
          🧭
        </button>
        <button
          title={isFullscreen ? '全画面を終了' : '全画面表示'}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? '🗗' : '⛶'}
        </button>
      </div>

      {/* 座標表示 (左下) */}
      {showCoords && (
        <div className="viewer-coords">
          {coords ? (
            <>
              <div>視点 X {fmt(coords.px)} / Y {fmt(coords.py)} / Z {fmt(coords.pz)}</div>
              <div>注視 X {fmt(coords.tx)} / Y {fmt(coords.ty)} / Z {fmt(coords.tz)}</div>
            </>
          ) : (
            <div>座標取得中...</div>
          )}
        </div>
      )}

      {/* ナビゲーション (右下) */}
      {showNav && (
        <div className="viewer-nav">
          {VIEWS.map((v) => (
            <button key={v.view} onClick={() => setView(v.view)}>
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
