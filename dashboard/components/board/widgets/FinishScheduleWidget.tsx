'use client'

// 仕上表カード。
// 部屋 (Rooms) カテゴリの要素から、部屋別に 床/壁/天井/巾木/下地 の
// 仕上パラメータを表にする。フロア絞り込み・部屋検索・3D 連動つき。

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
const FINISH_COLUMNS = [
  { cfgKey: 'floorKey', label: '床', guess: [/床仕上/i, /floor.?finish/i] },
  { cfgKey: 'wallKey', label: '壁', guess: [/壁仕上/i, /wall.?finish/i] },
  { cfgKey: 'ceilingKey', label: '天井', guess: [/天井仕上/i, /ceiling.?finish/i] },
  { cfgKey: 'skirtingKey', label: '巾木', guess: [/巾木/i, /base.?finish/i] },
  { cfgKey: 'underlayKey', label: '下地', guess: [/下地/i, /substrate|backing/i] }
] as const

type FinishConfig = {
  roomCategory?: string
  nameKey?: string
  numberKey?: string
  levelKey?: string
  floorKey?: string
  wallKey?: string
  ceilingKey?: string
  skirtingKey?: string
  underlayKey?: string
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

  const allProps = useMemo(
    () => [...groupableProperties(props), ...measurableProperties(props)],
    [props]
  )
  const catProp = useMemo(() => categoryProperty(props), [props])

  // 部屋カテゴリの既定値: "部屋" / "Rooms" を含む値を自動検出
  const roomCategory = useMemo(() => {
    if (cfg.roomCategory) return cfg.roomCategory
    const hit = catProp?.valueGroups.find((vg) => /room|部屋/i.test(vg.value))
    return hit?.value ?? ''
  }, [cfg.roomCategory, catProp])

  // 各列のプロパティキー (未設定なら名前から推測)
  const keys = useMemo(() => {
    const k: Record<string, string> = {
      nameKey: cfg.nameKey ?? guessKey(props, [/(^|\.)name$/i, /部屋名/i]),
      numberKey: cfg.numberKey ?? guessKey(props, [/(^|\.)number$/i, /部屋番号/i]),
      levelKey: cfg.levelKey ?? guessKey(props, [/^level\.name$/i, /(^|\.)level(\.|$)/i])
    }
    for (const col of FINISH_COLUMNS) {
      k[col.cfgKey] = (cfg[col.cfgKey] as string | undefined) ?? guessKey(props, [...col.guess])
    }
    return k
  }, [cfg, props])

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
      level: String(maps.levelKey?.get(id) ?? ''),
      finishes: FINISH_COLUMNS.map((col) => String(maps[col.cfgKey]?.get(id) ?? ''))
    }))
  }, [payload, props, roomCategory, catProp, keys])

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
          {FINISH_COLUMNS.map((col) => (
            <Field key={col.cfgKey} label={col.label}>
              <PropertySelect
                value={keys[col.cfgKey]}
                options={allProps}
                allowNone
                noneLabel="(なし)"
                onChange={(key) => onConfigChange({ [col.cfgKey]: key })}
              />
            </Field>
          ))}
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
                {FINISH_COLUMNS.map((col) => (
                  <th key={col.cfgKey} title={keys[col.cfgKey] ? shortLabel(keys[col.cfgKey]) : ''}>
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
                      <td colSpan={2 + FINISH_COLUMNS.length}>🏢 {room.level || '(レベル未設定)'}</td>
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
                    {room.finishes.map((f, i) => (
                      <td key={i} className={f ? '' : 'finish-empty'}>
                        {f || '—'}
                      </td>
                    ))}
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
