'use client'

// 仕上表カード。
// 部屋 (Rooms) カテゴリの要素から、部屋別に 床/壁/天井/巾木/廻り縁 の
// 仕上パラメータを表にする。フロア絞り込み・部屋検索・3D 連動つき。
// - 仕上列はヘッダーをドラッグして横並び順を変更できる
// - 各部位のパラメータ候補は「TD_」で始まるパラメータのみ

import { useMemo, useState } from 'react'
import type { Widget } from '@/lib/dashboard/types'
import { useDashboardData, highlightInViewer } from '@/lib/dashboard/data'
import { groupableProperties, measurableProperties } from '@/lib/aggregate'
import {
  anyValueMap,
  categoryProperty,
  guessKey,
  shortLabel
} from '@/lib/dashboard/compute'
import { ConfigBar, Field, NoData, PropertySelect } from './ConfigControls'

// 仕上列の定義 (キーは config 内の設定名)
type FinishColumn = { cfgKey: string; label: string; guess: RegExp[] }

const FINISH_COLUMNS: FinishColumn[] = [
  { cfgKey: 'floorKey', label: '床', guess: [/床仕上/i, /floor.?finish/i, /床/i] },
  { cfgKey: 'wallKey', label: '壁', guess: [/壁仕上/i, /wall.?finish/i, /壁/i] },
  { cfgKey: 'ceilingKey', label: '天井', guess: [/天井仕上/i, /ceiling.?finish/i, /天井/i] },
  { cfgKey: 'skirtingKey', label: '巾木', guess: [/巾木/i, /base.?finish/i] },
  {
    cfgKey: 'corniceKey',
    label: '廻り縁',
    guess: [/廻り縁|廻縁|回り縁|まわり縁/i, /cornice|crown|picture.?rail/i]
  }
]

const DEFAULT_ORDER = FINISH_COLUMNS.map((c) => c.cfgKey)

type FinishConfig = {
  roomCategory?: string
  columnOrder?: string[]
  [key: string]: unknown
}

type Props = {
  widget: Widget
  editable: boolean
  onConfigChange: (config: Record<string, unknown>) => void
}

export default function FinishScheduleWidget({ widget, editable, onConfigChange }: Props) {
  const { payload } = useDashboardData()
  const cfg = widget.config as FinishConfig
  const props = payload?.properties ?? []
  const [levelFilter, setLevelFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dragKey, setDragKey] = useState<string | null>(null)

  const allProps = useMemo(
    () => [...groupableProperties(props), ...measurableProperties(props)],
    [props]
  )
  // 各部位のパラメータ候補は「TD_」で始まるパラメータのみ
  // (キー中のいずれかのセグメントが TD_ で始まるもの)
  const tdProps = useMemo(() => allProps.filter((p) => /(^|\.)TD_/.test(p.key)), [allProps])

  const catProp = useMemo(() => categoryProperty(props), [props])

  // 仕上列の表示順 (config の columnOrder を反映、欠けは末尾補完)
  const orderedColumns = useMemo(() => {
    const order = cfg.columnOrder ?? DEFAULT_ORDER
    const byKey = new Map(FINISH_COLUMNS.map((c) => [c.cfgKey, c]))
    const cols: FinishColumn[] = []
    for (const k of order) {
      const c = byKey.get(k)
      if (c) cols.push(c)
    }
    for (const c of FINISH_COLUMNS) if (!order.includes(c.cfgKey)) cols.push(c)
    return cols
  }, [cfg.columnOrder])

  // 部屋カテゴリの既定値: "部屋" / "Rooms" を含む値を自動検出
  const roomCategory = useMemo(() => {
    if (cfg.roomCategory) return cfg.roomCategory
    const hit = catProp?.valueGroups.find((vg) => /room|部屋/i.test(vg.value))
    return hit?.value ?? ''
  }, [cfg.roomCategory, catProp])

  // 各列のプロパティキー (未設定なら名前から推測)
  const keys = useMemo(() => {
    const k: Record<string, string> = {
      nameKey: (cfg.nameKey as string) ?? guessKey(props, [/(^|\.)name$/i, /部屋名/i]),
      numberKey: (cfg.numberKey as string) ?? guessKey(props, [/(^|\.)number$/i, /部屋番号/i]),
      levelKey: (cfg.levelKey as string) ?? guessKey(props, [/^level\.name$/i, /(^|\.)level(\.|$)/i])
    }
    // 仕上列は TD_ パラメータの中から推測
    for (const col of FINISH_COLUMNS) {
      k[col.cfgKey] = (cfg[col.cfgKey] as string | undefined) ?? guessKey(tdProps, col.guess)
    }
    return k
  }, [cfg, props, tdProps])

  // 部屋の行データ
  const rooms = useMemo(() => {
    if (!payload || !roomCategory || !catProp) return []
    const vg = catProp.valueGroups.find((g) => g.value === roomCategory)
    if (!vg) return []
    const maps: Record<string, Map<string, string | number>> = {}
    for (const [name, key] of Object.entries(keys)) {
      if (key) maps[name] = anyValueMap(props, key)
    }
    return vg.ids.map((id) => ({
      id,
      name: String(maps.nameKey?.get(id) ?? ''),
      number: String(maps.numberKey?.get(id) ?? ''),
      level: String(maps.levelKey?.get(id) ?? '')
    }))
  }, [payload, props, roomCategory, catProp, keys])

  const finishMaps = useMemo(() => {
    const m: Record<string, Map<string, string | number>> = {}
    for (const col of FINISH_COLUMNS) {
      if (keys[col.cfgKey]) m[col.cfgKey] = anyValueMap(props, keys[col.cfgKey])
    }
    return m
  }, [props, keys])

  const levels = useMemo(
    () => [...new Set(rooms.map((r) => r.level).filter(Boolean))].sort(),
    [rooms]
  )

  const filtered = useMemo(() => {
    let list = rooms
    if (levelFilter) list = list.filter((r) => r.level === levelFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.number.toLowerCase().includes(q)
      )
    }
    return [...list].sort(
      (a, b) => a.level.localeCompare(b.level, 'ja') || a.number.localeCompare(b.number, 'ja')
    )
  }, [rooms, levelFilter, search])

  // ヘッダードラッグで列を並べ替え
  const reorder = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return
    const order = orderedColumns.map((c) => c.cfgKey)
    const from = order.indexOf(fromKey)
    const to = order.indexOf(toKey)
    if (from < 0 || to < 0) return
    order.splice(to, 0, order.splice(from, 1)[0])
    onConfigChange({ columnOrder: order })
  }

  if (!payload) return <NoData />

  // フロアごとに区切りヘッダーを挟んで描画
  let lastLevel: string | null = null

  return (
    <div className="finish-widget">
      <div className="finish-toolbar">
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="">全フロア</option>
          {levels.map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>
        <input
          className="finish-search"
          placeholder="部屋名・番号で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="finish-count">{filtered.length} 室</span>
      </div>

      {editable && (
        <ConfigBar>
          {catProp && (
            <Field label="部屋カテゴリ">
              <select
                value={roomCategory}
                onChange={(e) => onConfigChange({ roomCategory: e.target.value })}
              >
                <option value="">(選択)</option>
                {catProp.valueGroups.map((vg) => (
                  <option key={vg.value} value={vg.value}>
                    {vg.value || '(未設定)'}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {orderedColumns.map((col) => (
            <Field key={col.cfgKey} label={col.label}>
              <PropertySelect
                value={keys[col.cfgKey]}
                options={tdProps}
                allowNone
                noneLabel="(なし)"
                onChange={(key) => onConfigChange({ [col.cfgKey]: key })}
              />
            </Field>
          ))}
          {tdProps.length === 0 && (
            <span className="hint">※「TD_」で始まるパラメータが見つかりません</span>
          )}
        </ConfigBar>
      )}

      {rooms.length === 0 ? (
        <div className="widget-placeholder">
          <div className="placeholder-icon">🚪</div>
          <div className="placeholder-note">
            部屋カテゴリが見つかりません。
            <br />
            設定バーで部屋のカテゴリを選択してください
          </div>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table finish-table">
            <thead>
              <tr>
                <th>番号</th>
                <th>部屋名</th>
                {orderedColumns.map((col) => (
                  <th
                    key={col.cfgKey}
                    className={
                      'finish-col-head' +
                      (editable ? ' draggable-col' : '') +
                      (dragKey === col.cfgKey ? ' dragging' : '')
                    }
                    title={
                      editable
                        ? 'ドラッグで並べ替え' +
                          (keys[col.cfgKey] ? ` / ${shortLabel(keys[col.cfgKey])}` : '')
                        : keys[col.cfgKey]
                          ? shortLabel(keys[col.cfgKey])
                          : ''
                    }
                    draggable={editable}
                    onDragStart={() => setDragKey(col.cfgKey)}
                    onDragOver={(e) => editable && e.preventDefault()}
                    onDrop={() => {
                      if (dragKey) reorder(dragKey, col.cfgKey)
                      setDragKey(null)
                    }}
                    onDragEnd={() => setDragKey(null)}
                  >
                    {editable && <span className="col-grip">⋮⋮</span>}
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((room) => {
                const showLevelHeader = !levelFilter && room.level !== lastLevel
                lastLevel = room.level
                return [
                  showLevelHeader && (
                    <tr key={`lv-${room.level}-${room.id}`} className="finish-level-row">
                      <td colSpan={2 + orderedColumns.length}>
                        🏢 {room.level || '(レベル未設定)'}
                      </td>
                    </tr>
                  ),
                  <tr
                    key={room.id}
                    className="data-row"
                    title="クリックで 3D ハイライト"
                    onClick={() => highlightInViewer(payload, [room.id], true)}
                  >
                    <td>{room.number}</td>
                    <td>{room.name || '(名称なし)'}</td>
                    {orderedColumns.map((col) => {
                      const v = String(finishMaps[col.cfgKey]?.get(room.id) ?? '')
                      return (
                        <td key={col.cfgKey} className={v ? '' : 'finish-empty'}>
                          {v || '—'}
                        </td>
                      )
                    })}
                  </tr>
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
