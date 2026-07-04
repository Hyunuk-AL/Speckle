// ダッシュボード定義の型 (Speckle Intelligence 相当ビルダー)
// 詳細仕様: docs/04-dashboard-spec.md

export type WidgetType =
  | 'viewer'
  | 'kpi'
  | 'chart'
  | 'table'
  | 'paramCheck'
  | 'finish'
  | 'co2'
  | 'colorize'
  // 旧定義との互換のため残す (パレットには出さない)
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
  /** ウィジェット種別ごとの設定 */
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
  description: string
  category: string
  icon: string
  defaultSize: { w: number; h: number }
  implemented: boolean
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    type: 'viewer',
    label: '3D ビュー',
    description: 'モデル表示・ウォークスルー',
    category: '基本',
    icon: '🧊',
    defaultSize: { w: 6, h: 8 },
    implemented: true
  },
  {
    type: 'kpi',
    label: 'KPI / 数値',
    description: '件数・面積などを1値表示',
    category: '基本',
    icon: '🔢',
    defaultSize: { w: 3, h: 2 },
    implemented: true
  },
  {
    type: 'chart',
    label: 'チャート',
    description: '棒 / 円グラフ',
    category: '基本',
    icon: '📊',
    defaultSize: { w: 6, h: 4 },
    implemented: true
  },
  {
    type: 'table',
    label: 'テーブル',
    description: '要素一覧を表で表示',
    category: '基本',
    icon: '🗂️',
    defaultSize: { w: 6, h: 5 },
    implemented: true
  },
  {
    type: 'paramCheck',
    label: 'パラメータチェック',
    description: '指定パラメータの値あり/なし検査',
    category: '検査',
    icon: '✅',
    defaultSize: { w: 4, h: 4 },
    implemented: true
  },
  {
    type: 'finish',
    label: '仕上表',
    description: '部屋別の床・壁・天井・巾木仕上',
    category: '建築',
    icon: '🚪',
    defaultSize: { w: 8, h: 6 },
    implemented: true
  },
  {
    type: 'co2',
    label: 'CO₂ (原単位)',
    description: 'CSV 原単位から Embodied Carbon 計算',
    category: '分析',
    icon: '🌱',
    defaultSize: { w: 7, h: 6 },
    implemented: true
  },
  {
    type: 'colorize',
    label: '色分け',
    description: 'カテゴリ×パラメータ値で 3D を着色',
    category: '表示',
    icon: '🎨',
    defaultSize: { w: 4, h: 6 },
    implemented: true
  }
]

export function catalogEntry(type: WidgetType): WidgetCatalogEntry {
  return (
    WIDGET_CATALOG.find((c) => c.type === type) ?? {
      type,
      label: type,
      description: '',
      category: 'その他',
      icon: '🧩',
      defaultSize: { w: 4, h: 3 },
      implemented: false
    }
  )
}

/** グリッドの定数 (DashboardGrid と共有) */
export const GRID = {
  cols: 12,
  rowHeight: 40,
  margin: 10
} as const

export function emptyDashboard(name = '新しいダッシュボード'): DashboardDef {
  return { version: 1, name, widgets: [] }
}
