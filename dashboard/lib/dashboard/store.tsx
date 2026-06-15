'use client'

// ダッシュボード定義の状態管理 (useReducer ベース)。
// localStorage から復元し、変更のたびに自動保存する。

import { useEffect, useReducer } from 'react'
import type { DashboardDef, Widget, WidgetLayout, WidgetType } from './types'
import { GRID, catalogEntry, emptyDashboard } from './types'
import { loadDashboard, saveDashboard } from './persistence'

export type DashboardAction =
  | { type: 'load'; def: DashboardDef }
  | { type: 'add'; widgetType: WidgetType }
  | { type: 'remove'; id: string }
  | { type: 'updateLayout'; id: string; layout: WidgetLayout }
  | { type: 'updateTitle'; id: string; title: string }
  | { type: 'updateConfig'; id: string; config: Record<string, unknown> }
  | { type: 'rename'; name: string }
  | { type: 'reset' }

/** 新規ウィジェットを既存カードの下端に積む */
function nextPosition(widgets: Widget[]): number {
  return widgets.reduce((maxY, w) => Math.max(maxY, w.layout.y + w.layout.h), 0)
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function reducer(state: DashboardDef, action: DashboardAction): DashboardDef {
  switch (action.type) {
    case 'load':
      return action.def
    case 'add': {
      const entry = catalogEntry(action.widgetType)
      const widget: Widget = {
        id: newId(),
        type: action.widgetType,
        title: entry.label,
        layout: {
          x: 0,
          y: nextPosition(state.widgets),
          w: Math.min(entry.defaultSize.w, GRID.cols),
          h: entry.defaultSize.h
        },
        config: {}
      }
      return { ...state, widgets: [...state.widgets, widget] }
    }
    case 'remove':
      return { ...state, widgets: state.widgets.filter((w) => w.id !== action.id) }
    case 'updateLayout':
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id ? { ...w, layout: action.layout } : w
        )
      }
    case 'updateTitle':
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id ? { ...w, title: action.title } : w
        )
      }
    case 'updateConfig':
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.id ? { ...w, config: { ...w.config, ...action.config } } : w
        )
      }
    case 'rename':
      return { ...state, name: action.name }
    case 'reset':
      return emptyDashboard(state.name)
    default:
      return state
  }
}

export function useDashboard(projectId: string, modelId: string) {
  const [def, dispatch] = useReducer(
    reducer,
    undefined,
    () => loadDashboard(projectId, modelId) ?? emptyDashboard()
  )

  // 変更を自動保存
  useEffect(() => {
    if (projectId && modelId) saveDashboard(projectId, modelId, def)
  }, [def, projectId, modelId])

  return { def, dispatch }
}
