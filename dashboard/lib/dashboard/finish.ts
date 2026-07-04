// 仕上表の列キー解決 (純粋ロジック)。
// UI から分離し、実データを模したフィクスチャで検証できるようにする。
// パラメータ命名規約 (実モデル確認済み): TD_<部位>_仕上_名称 (例: TD_壁_仕上_名称)

import type { PropertyInfo } from '@speckle/viewer'
import { guessKey, propOnIds, shortLabel } from './compute'

export type FinishColumn = { cfgKey: string; label: string; guess: RegExp[] }

export const FINISH_COLUMNS: FinishColumn[] = [
  {
    cfgKey: 'floorKey',
    label: '床',
    guess: [/TD_床_仕上_名称/, /TD_床.*名称/, /TD_床_仕上/, /床.*仕上.*名称/]
  },
  {
    cfgKey: 'wallKey',
    label: '壁',
    guess: [/TD_壁_仕上_名称/, /TD_壁.*名称/, /TD_壁_仕上/, /壁.*仕上.*名称/]
  },
  {
    cfgKey: 'ceilingKey',
    label: '天井',
    guess: [/TD_天井_仕上_名称/, /TD_天井.*名称/, /TD_天井_仕上/, /天井.*仕上.*名称/]
  },
  {
    cfgKey: 'skirtingKey',
    label: '巾木',
    guess: [/TD_巾木_仕上_名称/, /TD_巾木.*名称/, /TD_巾木/, /巾木.*名称/]
  },
  {
    cfgKey: 'corniceKey',
    label: '廻り縁',
    guess: [/TD_(廻り縁|廻縁|回り縁)_仕上_名称/, /TD_(廻り縁|廻縁|回り縁).*名称/, /TD_(廻り縁|廻縁|回り縁)/, /(廻り縁|廻縁|回り縁)/]
  }
]

export const DEFAULT_COLUMN_ORDER = FINISH_COLUMNS.map((c) => c.cfgKey)

/** 「TD_」で始まるパラメータか (キーのいずれかのセグメントが TD_ 始まり) */
export function isTdKey(key: string): boolean {
  return /(^|\.)TD_/.test(key)
}

/**
 * 部屋カテゴリの要素が値を持つプロパティ一覧 (名前順)。
 * roomIds が空のときは全プロパティを返す (カテゴリ未確定時のフォールバック)。
 */
export function roomScopedProps(allProps: PropertyInfo[], roomIds: Set<string>): PropertyInfo[] {
  const scoped = roomIds.size > 0 ? allProps.filter((p) => propOnIds(p, roomIds)) : allProps
  return [...scoped].sort((a, b) => shortLabel(a.key).localeCompare(shortLabel(b.key), 'ja'))
}

/**
 * 部屋名パラメータの既定キー。
 * Revit「部屋」の「名前」パラメータ (…\.名前.value 等) を最優先し、
 * 次にルートの name。designOption.name などの誤検出を避けるため、
 * 「.name で終わる任意のキー」への汎用フォールバックはしない。
 */
export function guessRoomNameKey(roomProps: PropertyInfo[]): string {
  return guessKey(roomProps, [
    /(^|\.)名前\.value$/,
    /(^|\.)名前$/,
    /(^|\.)部屋名(\.value)?$/,
    /^name$/
  ])
}

export function guessRoomNumberKey(roomProps: PropertyInfo[]): string {
  return guessKey(roomProps, [
    /(^|\.)番号\.value$/,
    /(^|\.)番号$/,
    /(^|\.)部屋番号(\.value)?$/,
    /^number$/
  ])
}

export function guessLevelKey(roomProps: PropertyInfo[]): string {
  return guessKey(roomProps, [
    /^level\.name$/i,
    /(^|\.)レベル(\.value)?$/,
    /(^|\.)level(\.|$)/i
  ])
}

/** 仕上列 (床/壁/…) の既定キーを部屋スコープの TD_ パラメータから解決する */
export function guessFinishKeys(roomProps: PropertyInfo[]): Record<string, string> {
  const tdProps = roomProps.filter((p) => isTdKey(p.key))
  const keys: Record<string, string> = {}
  for (const col of FINISH_COLUMNS) {
    keys[col.cfgKey] = guessKey(tdProps, col.guess)
  }
  return keys
}
