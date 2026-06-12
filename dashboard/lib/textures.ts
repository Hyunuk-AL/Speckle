// Step 4: マテリアルテクスチャのクライアント側適用モジュール (実験的)
//
// Revit コネクタはテクスチャ画像を転送しないため、マテリアル名をキーにした
// マッピング定義 (public/textures/mapping.json) からテクスチャを取得し、
// ロード済みオブジェクトに three.js マテリアルとして適用する。

import {
  SpeckleStandardMaterial,
  Viewer,
  type TreeNode
} from '@speckle/viewer'
import { TextureLoader, RepeatWrapping, sRGBEncoding, DoubleSide } from 'three'

export type TextureMappingEntry = {
  /** 拡散テクスチャの URL (MinIO / 静的ファイルサーバー / public 配下) */
  map: string
  /** 法線マップの URL (任意) */
  normalMap?: string
  /** UV タイリング (繰り返し回数)。省略時 1 */
  tiling?: { u?: number; v?: number }
  roughness?: number
  metalness?: number
}

export type TextureMapping = {
  /** キー: Revit のマテリアル名 (完全一致 → 部分一致の順で解決) */
  materials: Record<string, TextureMappingEntry>
}

export type ApplyResult = {
  /** マテリアル名 → 適用したオブジェクト数 */
  applied: Record<string, number>
  /** モデル内に存在したがマッピング定義の無かったマテリアル名 */
  unmapped: string[]
}

/**
 * ワールドツリーを走査し、マテリアル名 → ノード ID 群の対応を作る。
 * - v2 系コネクタ: 各オブジェクトの raw.renderMaterial.name
 * - v3 系コネクタ: ルートの raw.renderMaterialProxies (applicationId 参照)
 * の両方に対応する。
 */
export function collectMaterialGroups(viewer: Viewer): Map<string, Set<string>> {
  const tree = viewer.getWorldTree()
  const groups = new Map<string, Set<string>>()
  const appIdToNodeId = new Map<string, string>()

  tree.walk((node: TreeNode) => {
    const raw = node.model?.raw
    if (!raw) return true

    if (raw.applicationId && node.model.id) {
      appIdToNodeId.set(String(raw.applicationId), node.model.id)
    }

    const name: string | undefined = raw.renderMaterial?.name
    if (name) {
      if (!groups.has(name)) groups.set(name, new Set())
      groups.get(name)!.add(node.model.id)
    }
    return true
  })

  // v3 の renderMaterialProxies (ルート付近のノードに載る) を解決する
  tree.walk((node: TreeNode) => {
    const proxies = node.model?.raw?.renderMaterialProxies
    if (Array.isArray(proxies)) {
      for (const proxy of proxies) {
        const name: string | undefined = proxy?.value?.name
        const objects: unknown[] = Array.isArray(proxy?.objects) ? proxy.objects : []
        if (!name || objects.length === 0) continue
        if (!groups.has(name)) groups.set(name, new Set())
        const set = groups.get(name)!
        for (const appId of objects) {
          const nodeId = appIdToNodeId.get(String(appId))
          if (nodeId) set.add(nodeId)
        }
      }
    }
    return true
  })

  return groups
}

function resolveEntry(
  mapping: TextureMapping,
  materialName: string
): TextureMappingEntry | null {
  if (mapping.materials[materialName]) return mapping.materials[materialName]
  const lower = materialName.toLowerCase()
  for (const [key, entry] of Object.entries(mapping.materials)) {
    if (lower.includes(key.toLowerCase())) return entry
  }
  return null
}

/**
 * マッピング定義に従ってテクスチャを適用する。
 * 戻り値で適用結果 (未マッピングのマテリアル一覧含む) を返すので、
 * マッピング定義の拡充に活用する。
 */
export async function applyTextures(
  viewer: Viewer,
  mappingUrl = '/textures/mapping.json'
): Promise<ApplyResult> {
  const res = await fetch(mappingUrl)
  if (!res.ok) throw new Error(`マッピング定義を取得できません: ${mappingUrl} (${res.status})`)
  const mapping = (await res.json()) as TextureMapping

  const groups = collectMaterialGroups(viewer)
  const renderTree = viewer.getWorldTree().getRenderTree()
  const renderer = viewer.getRenderer()
  const loader = new TextureLoader()

  const result: ApplyResult = { applied: {}, unmapped: [] }

  for (const [name, nodeIds] of groups) {
    const entry = resolveEntry(mapping, name)
    if (!entry) {
      result.unmapped.push(name)
      continue
    }

    const texture = await loader.loadAsync(entry.map)
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(entry.tiling?.u ?? 1, entry.tiling?.v ?? 1)
    texture.encoding = sRGBEncoding

    const params: ConstructorParameters<typeof SpeckleStandardMaterial>[0] = {
      map: texture,
      roughness: entry.roughness ?? 0.8,
      metalness: entry.metalness ?? 0,
      side: DoubleSide
    }
    if (entry.normalMap) {
      params.normalMap = await loader.loadAsync(entry.normalMap)
      params.normalMap.wrapS = RepeatWrapping
      params.normalMap.wrapT = RepeatWrapping
      params.normalMap.repeat.copy(texture.repeat)
    }
    // USE_RTE: Speckle viewer は精度確保のため relative-to-eye 描画を行うので必須
    const material = new SpeckleStandardMaterial(params, ['USE_RTE'])

    const rvs = [...nodeIds].flatMap((id) => renderTree.getRenderViewsForNodeId(id) ?? [])
    if (rvs.length === 0) continue
    renderer.setMaterial(rvs, material)
    result.applied[name] = nodeIds.size
  }

  viewer.requestRender()
  return result
}
