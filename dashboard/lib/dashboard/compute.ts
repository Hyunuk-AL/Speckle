// カード共通の集計ロジック。ビューワの PropertyInfo[] からクライアント側で計算する。

import type {
  NumericPropertyInfo,
  PropertyInfo,
  StringPropertyInfo
} from '@speckle/viewer'
import { isNumericProperty, isStringProperty, numericValueMap } from '@/lib/aggregate'

export type Aggregation = 'count' | 'sum' | 'avg' | 'min' | 'max'

export const AGGREGATIONS: { value: Aggregation; label: string }[] = [
  { value: 'count', label: '件数' },
  { value: 'sum', label: '合計' },
  { value: 'avg', label: '平均' },
  { value: 'min', label: '最小' },
  { value: 'max', label: '最大' }
]

export type GroupRow = { value: string; ids: string[]; metric: number }

/** 長いプロパティキーを短いラベルにする (表示用) */
export function shortLabel(key: string): string {
  const parts = key.split('.')
  if (parts.length <= 2) return key
  return parts.slice(-2).join('.')
}

export function findString(props: PropertyInfo[], key: string): StringPropertyInfo | null {
  const p = props.find((x) => x.key === key)
  return p && isStringProperty(p) ? p : null
}

export function findNumeric(props: PropertyInfo[], key: string): NumericPropertyInfo | null {
  const p = props.find((x) => x.key === key)
  return p && isNumericProperty(p) ? p : null
}

function applyAgg(values: number[], agg: Aggregation): number {
  if (agg === 'count') return values.length
  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  switch (agg) {
    case 'sum':
      return sum
    case 'avg':
      return sum / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    default:
      return 0
  }
}

/** モデル内の全オブジェクト ID (重複なし) */
export function allObjectIds(props: PropertyInfo[]): string[] {
  const set = new Set<string>()
  for (const p of props) {
    if (isStringProperty(p)) {
      for (const vg of p.valueGroups) for (const id of vg.ids) set.add(id)
    } else if (isNumericProperty(p)) {
      for (const vg of p.valueGroups as { value: number; id?: string; ids?: string[] }[]) {
        if (vg.id) set.add(vg.id)
        else if (vg.ids) for (const id of vg.ids) set.add(id)
      }
    }
  }
  return [...set]
}

/** グループ軸ごとに集計値を計算する (チャート/表用) */
export function groupAndAggregate(
  group: StringPropertyInfo,
  measure: NumericPropertyInfo | null,
  agg: Aggregation
): GroupRow[] {
  const vmap = measure ? numericValueMap(measure) : null
  return group.valueGroups
    .map((vg) => {
      let metric: number
      if (agg === 'count' || !vmap) {
        metric = vg.ids.length
      } else {
        const vals = vg.ids
          .map((id) => vmap.get(id))
          .filter((v): v is number => v !== undefined)
        metric = applyAgg(vals, agg)
      }
      return { value: vg.value, ids: vg.ids, metric }
    })
    .sort((a, b) => b.metric - a.metric)
}

/** 単一の集計値を計算する (KPI 用)。filter で対象を絞れる。 */
export function singleValue(
  props: PropertyInfo[],
  measureKey: string | null,
  agg: Aggregation,
  filterKey?: string,
  filterValue?: string
): { metric: number; ids: string[] } {
  let ids: string[] | null = null
  if (filterKey && filterValue) {
    const sp = findString(props, filterKey)
    const vg = sp?.valueGroups.find((g) => g.value === filterValue)
    ids = vg ? vg.ids : []
  }

  if (agg === 'count') {
    const target = ids ?? allObjectIds(props)
    return { metric: target.length, ids: target }
  }

  const measure = measureKey ? findNumeric(props, measureKey) : null
  if (!measure) return { metric: 0, ids: ids ?? [] }
  const vmap = numericValueMap(measure)
  const targetIds = ids ?? [...vmap.keys()]
  const vals = targetIds
    .map((id) => vmap.get(id))
    .filter((v): v is number => v !== undefined)
  return { metric: applyAgg(vals, agg), ids: targetIds }
}

export type ObjectRow = { id: string; cells: Record<string, string> }

/** 選択した列でオブジェクトごとの行を組み立てる (テーブル用) */
export function buildObjectRows(props: PropertyInfo[], columns: string[]): ObjectRow[] {
  const map = new Map<string, Record<string, string>>()
  const ensure = (id: string) => {
    let r = map.get(id)
    if (!r) {
      r = {}
      map.set(id, r)
    }
    return r
  }
  for (const key of columns) {
    const sp = findString(props, key)
    if (sp) {
      for (const vg of sp.valueGroups) for (const id of vg.ids) ensure(id)[key] = vg.value
      continue
    }
    const np = findNumeric(props, key)
    if (np) {
      numericValueMap(np).forEach((v, id) => {
        ensure(id)[key] = String(v)
      })
    }
  }
  return [...map.entries()].map(([id, cells]) => ({ id, cells }))
}

export function formatMetric(n: number): string {
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
}
