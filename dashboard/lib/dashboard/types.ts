// ダッシュボード定義の型 (Speckle Intelligence 相当ビルダー)
// 詳細仕様: docs/04-dashboard-spec.md

export type WidgetType =
  | 'viewer'
  | 'kpi'
  | 'chart'
  | 'table'
  | 'filter'
  | 'section'
  | 'text'
  | 'propertyCheck'

/** グリッド上の配置 (単位はグリッドのセル数) */
export type WidgetLayout = { x: number; y: number; w: number; h: number }

export type Widget = {
  id: string
  type: WidgetType
  title: string
  layout: WidgetLayout
  /** ウィジェット種別ごとの設定。M2 以降で各カードが利用する */
  config: Record<string, unknown>
}

export type DashboardDef = {
  version: number
  name: string
  widgets: Widget[]
}

/** パレットに並ぶウィジェットのカタログ定義 */
export type WidgetCatalogEntry = {
  type: WidgetType
  label: string
  category: string
  icon: string
  defaultSize: { w: number; h: number }
  /** M1 時点で本体が実装済みか (未実装はプレースホルダ表示) */
  implemented: boolean
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { type: 'viewer', label: '3D ビュー', category: '基本', icon: '🧊', defaultSize: { w: 6, h: 8 }, implemented: true },
  { type: 'kpi', label: 'KPI / 数値', category: '基本', icon: '🔢', defaultSize: { w: 3, h: 2 }, implemented: true },
  { type: 'chart', label: 'チャート', category: 'チャート', icon: '📊', defaultSize: { w: 6, h: 4 }, implemented: true },
  { type: 'table', label: 'テーブル', category: '表', icon: '🗂️', defaultSize: { w: 6, h: 5 }, implemented: true },
  { type: 'filter', label: 'フィルタ', category: 'フィルタ', icon: '🔎', defaultSize: { w: 3, h: 3 }, implemented: false },
  { type: 'section', label: 'セクション', category: 'レイアウト', icon: '➖', defaultSize: { w: 12, h: 1 }, implemented: false }
]

export function catalogEntry(type: WidgetType): WidgetCatalogEntry {
  return WIDGET_CATALOG.find((c) => c.type === type) ?? WIDGET_CATALOG[0]
}

/** グリッドの定数 (DashboardGrid と共有) */
export const GRID = {
  cols: 12,
  rowHeight: 40,
  margin: 8
} as const

export function emptyDashboard(name = '新しいダッシュボード'): DashboardDef {
  return { version: 1, name, widgets: [] }
}
