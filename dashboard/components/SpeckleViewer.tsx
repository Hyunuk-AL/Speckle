'use client'

// @speckle/viewer を埋め込む 3D ビューコンポーネント。
// モデルのロード完了後、親へ Viewer インスタンスとプロパティ一覧を渡す。

import { useEffect, useRef, useState } from 'react'
import {
  Viewer,
  DefaultViewerParams,
  SpeckleLoader,
  UrlHelper,
  ViewerEvent,
  CameraController,
  SelectionExtension,
  FilteringExtension,
  type PropertyInfo,
  type SelectionEvent
} from '@speckle/viewer'

export type ViewerReadyPayload = {
  viewer: Viewer
  filtering: FilteringExtension
  selection: SelectionExtension
  camera: CameraController
  properties: PropertyInfo[]
  /**
   * 集計プロパティの ID (raw.id) を、ビューワが選択/ズームに使う描画可能なノード ID
   * (model.id。インスタンスは複合 ID) に変換する。
   * 描画ジオメトリを持つノードのみ返す。
   */
  resolveRenderableIds: (propertyIds: string[]) => string[]
}

type Props = {
  serverUrl: string
  token: string
  projectId: string
  modelId: string
  onReady: (payload: ViewerReadyPayload) => void
  /** 3D 上のクリック。objectId は未ヒット時 null (表 → 選択解除に使う) */
  onObjectClicked: (objectId: string | null) => void
}

export default function SpeckleViewer({
  serverUrl,
  token,
  projectId,
  modelId,
  onReady,
  onObjectClicked
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<string>('ビューワ初期化中...')
  const [error, setError] = useState<string | null>(null)

  // 最新のコールバックを effect の再実行なしで参照する
  const onReadyRef = useRef(onReady)
  const onClickRef = useRef(onObjectClicked)
  onReadyRef.current = onReady
  onClickRef.current = onObjectClicked

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let viewer: Viewer | null = null

    const run = async () => {
      try {
        viewer = new Viewer(container, {
          ...DefaultViewerParams,
          showStats: false,
          verbose: false
        })
        await viewer.init()
        if (disposed) return

        const camera = viewer.createExtension(CameraController)
        const selection = viewer.createExtension(SelectionExtension)
        const filtering = viewer.createExtension(FilteringExtension)

        viewer.on(ViewerEvent.ObjectClicked, (event: SelectionEvent | null) => {
          const node = event?.hits?.[0]?.node
          const objectId: string | null = node?.model?.raw?.id ?? node?.model?.id ?? null
          onClickRef.current(objectId)
        })

        setStatus('モデルを読み込み中...')
        const modelUrl = `${serverUrl}/projects/${projectId}/models/${modelId}`
        const urls = await UrlHelper.getResourceUrls(modelUrl, token)
        if (urls.length === 0) {
          throw new Error('モデルのリソース URL を解決できません (バージョンが存在するか確認)')
        }
        for (const url of urls) {
          const loader = new SpeckleLoader(viewer.getWorldTree(), url, token)
          await viewer.loadObject(loader, true)
          if (disposed) return
        }

        setStatus('プロパティを解析中...')
        const properties = await viewer.getObjectProperties()
        if (disposed) return

        // raw.id (集計が使う ID) → model.id (選択/カメラが使う ID) の対応表を作る。
        // Revit のファミリインスタンスは model.id が複合 ID になり raw.id と一致しないため、
        // この変換を挟まないと選択・ズームが該当要素を見つけられない。
        const worldTree = viewer.getWorldTree()
        const renderTree = worldTree.getRenderTree()
        const idMap = new Map<string, string[]>()
        worldTree.walk((node) => {
          const rawId: string | undefined = node.model?.raw?.id
          const modelId: string | undefined = node.model?.id
          if (rawId && modelId) {
            const arr = idMap.get(rawId)
            if (arr) arr.push(modelId)
            else idMap.set(rawId, [modelId])
          }
          return true
        })

        const resolveRenderableIds = (propertyIds: string[]): string[] => {
          const result = new Set<string>()
          for (const pid of propertyIds) {
            const candidates = idMap.get(pid) ?? [pid]
            for (const cid of candidates) {
              const nodes = worldTree.findId(cid)
              if (!nodes) continue
              for (const node of nodes) {
                if (renderTree.getRenderViewsForNode(node).length > 0) {
                  result.add(cid)
                  break
                }
              }
            }
          }
          return [...result]
        }

        // モデル全体が画面に収まるようカメラを合わせる。
        // 空配列 [] を渡すと「0個の要素にズーム」と解釈され画面が真っ白になるため、
        // undefined を渡して zoomExtents (全体表示) を発火させる。
        viewer.resize()
        camera.setCameraView(undefined, false)
        setStatus('')
        onReadyRef.current({
          viewer,
          filtering,
          selection,
          camera,
          properties,
          resolveRenderableIds
        })
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void run()

    const handleResize = () => viewer?.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      disposed = true
      window.removeEventListener('resize', handleResize)
      viewer?.dispose()
    }
  }, [serverUrl, token, projectId, modelId])

  return (
    <div className="viewer-wrap">
      <div ref={containerRef} className="viewer-container" />
      {status && !error && <div className="viewer-overlay">{status}</div>}
      {error && <div className="viewer-overlay viewer-error">読み込みエラー: {error}</div>}
    </div>
  )
}
