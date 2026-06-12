// ロード済みオブジェクトのプロパティ情報 (viewer.getObjectProperties() の結果) から
// グループ集計を行う。集計行が 3D オブジェクト ID の配列を持つため、
// 表 ↔ ビューの双方向連携・色分けにそのまま使える。

import type {
  PropertyInfo,
  StringPropertyInfo,
  NumericPropertyInfo
} from '@speckle/viewer'

export type AggregationRow = {
  /** グループの値 (例: "Walls", "Level 1") */
  value: string
  /** グループに属するオブジェクト ID */
  ids: string[]
  count: number
  /** measureKey 指定時の合計値 (面積・体積など) */
  sum: number | null
}

export function isStringProperty(p: PropertyInfo): p is StringPropertyInfo {
  return p.type === 'string'
}

export function isNumericProperty(p: PropertyInfo): p is NumericPropertyInfo {
  return p.type === 'number'
}

/** グループ化に使いやすい文字列プロパティを返す (カーディナリティで足切り) */
export function groupableProperties(
  properties: PropertyInfo[],
  maxGroups = 200
): StringPropertyInfo[] {
  return properties
    .filter(isStringProperty)
    .filter((p) => p.valueGroups.length > 0 && p.valueGroups.length <= maxGroups)
    .sort((a, b) => priorityOf(a.key) - priorityOf(b.key) || a.key.localeCompare(b.key))
}

/** 集計値 (合計) に使える数値プロパティを返す */
export function measurableProperties(properties: PropertyInfo[]): NumericPropertyInfo[] {
  return properties
    .filter(isNumericProperty)
    .sort((a, b) => priorityOf(a.key) - priorityOf(b.key) || a.key.localeCompare(b.key))
}

// Revit でよく使うキーをセレクタの先頭に出す
const PRIORITY_PATTERNS: RegExp[] = [
  /^category$/i,
  /^level\.name$/i,
  /^family$/i,
  /^type$/i,
  /(^|\.)(area|面積)(\.value)?$/i,
  /(^|\.)(volume|体積)(\.value)?$/i,
  /ALBS/i,
  /^properties\.Parameters\./
]

function priorityOf(key: string): number {
  const i = PRIORITY_PATTERNS.findIndex((re) => re.test(key))
  return i === -1 ? PRIORITY_PATTERNS.length : i
}

/** 数値プロパティから objectId → 値 のマップを作る */
export function numericValueMap(prop: NumericPropertyInfo): Map<string, number> {
  const map = new Map<string, number>()
  for (const vg of prop.valueGroups) {
    // NumericPropertyInfo.valueGroups は { value, id } の配列
    const entry = vg as { value: number; id?: string; ids?: string[] }
    if (entry.id) map.set(entry.id, entry.value)
    else if (entry.ids) for (const id of entry.ids) map.set(id, entry.value)
  }
  return map
}

export function aggregate(
  groupProp: StringPropertyInfo,
  measureProp: NumericPropertyInfo | null
): AggregationRow[] {
  const valueMap = measureProp ? numericValueMap(measureProp) : null
  const rows = groupProp.valueGroups.map((vg) => {
    let sum: number | null = null
    if (valueMap) {
      sum = 0
      for (const id of vg.ids) sum += valueMap.get(id) ?? 0
    }
    return { value: vg.value, ids: vg.ids, count: vg.ids.length, sum }
  })
  // 件数の多い順
  rows.sort((a, b) => b.count - a.count)
  return rows
}

export function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
}
