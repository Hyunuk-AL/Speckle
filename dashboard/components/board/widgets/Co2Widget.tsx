'use client'

// CO₂ (Embodied Carbon) カード。
// 原単位 CSV (key,basis,factor) をインポートし、要素のマッチキー
// (タイプ名等) と突き合わせて、面積/体積/長さ/重量 × 原単位で
// Embodied Carbon を計算・集計する。

import { useMemo, useRef, useState } from 'react'
import type { Widget } from '@/lib/dashboard/types'
import { useDashboardData, highlightInViewer } from '@/lib/dashboard/data'
import { groupableProperties, measurableProperties } from '@/lib/aggregate'
import {
  anyValueMap,
  formatMetric,
  guessKey,
  parseCsv,
  shortLabel
} from '@/lib/dashboard/compute'
import { ConfigBar, Field, NoData, PropertySelect } from './ConfigControls'

// 原単位の数量基準と、対応する数量パラメータの設定キー
const BASES = [
  { basis: 'area', label: '面積', cfgKey: 'areaKey', guess: [/(^|\.)area(\.value)?$/i, /面積/i], unit: 'm²' },
  { basis: 'volume', label: '体積', cfgKey: 'volumeKey', guess: [/(^|\.)volume(\.value)?$/i, /体積/i], unit: 'm³' },
  { basis: 'length', label: '長さ', cfgKey: 'lengthKey', guess: [/(^|\.)length(\.value)?$/i, /長さ/i], unit: 'm' },
  { basis: 'weight', label: '重量', cfgKey: 'weightKey', guess: [/weight|重量|質量/i], unit: 'kg' },
  { basis: 'count', label: '個数', cfgKey: '', guess: [], unit: '個' }
] as const

type CsvRow = { key: string; basis: string; factor: number }

type Co2Config = {
  matchKey?: string
  areaKey?: string
  volumeKey?: string
  lengthKey?: string
  weightKey?: string
  csvName?: string
  csvRows?: CsvRow[]
}

type Props = {
  widget: Widget
  editable: boolean
  onConfigChange: (config: Record<string, unknown>) => void
}

const SAMPLE_CSV = `key,basis,factor
コンクリート,volume,300
鉄筋,weight,1.2
Basic Wall,area,45
木材,volume,120`

export default function Co2Widget({ widget, editable, onConfigChange }: Props) {
  const { payload } = useDashboardData()
  const cfg = widget.config as Co2Config
  const props = payload?.properties ?? []
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  const stringProps = useMemo(() => groupableProperties(props), [props])
  const numProps = useMemo(() => measurableProperties(props), [props])

  // マッチキーの既定値: type / family / speckle_type
  const matchKey = useMemo(
    () =>
      cfg.matchKey ??
      guessKey(props, [/(^|\.)type$/i, /(^|\.)family$/i, /speckle_type/i]),
    [cfg.matchKey, props]
  )

  const qtyKeys = useMemo(() => {
    const k: Record<string, string> = {}
    for (const b of BASES) {
      if (!b.cfgKey) continue
      k[b.basis] = (cfg[b.cfgKey as keyof Co2Config] as string | undefined) ?? guessKey(props, [...b.guess])
    }
    return k
  }, [cfg, props])

  // CSV 取込
  const handleFile = async (file: File) => {
    setCsvError(null)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length === 0) throw new Error('CSV が空です')
      // ヘッダー行 (key,basis,factor) はあってもなくても良い
      const dataRows = /key/i.test(rows[0][0]) ? rows.slice(1) : rows
      const parsed: CsvRow[] = []
      for (const r of dataRows) {
        if (r.length < 3) continue
        const basis = r[1].toLowerCase()
        const factor = Number(r[2])
        if (!BASES.some((b) => b.basis === basis)) {
          throw new Error(`basis が不正です: "${r[1]}" (area/volume/length/weight/count のいずれか)`)
        }
        if (!Number.isFinite(factor)) throw new Error(`factor が数値ではありません: "${r[2]}"`)
        parsed.push({ key: r[0], basis, factor })
      }
      if (parsed.length === 0) throw new Error('有効な行がありません (key,basis,factor)')
      onConfigChange({ csvRows: parsed, csvName: file.name })
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : String(e))
    }
  }

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'co2-factors-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // 計算本体
  const result = useMemo(() => {
    if (!payload || !matchKey || !cfg.csvRows?.length) return null
    const matchMap = anyValueMap(props, matchKey)
    const qtyMaps: Record<string, Map<string, string | number>> = {}
    for (const b of BASES) {
      if (b.basis === 'count') continue
      const key = qtyKeys[b.basis]
      if (key) qtyMaps[b.basis] = anyValueMap(props, key)
    }

    const rows: {
      key: string
      basis: string
      factor: number
      count: number
      qty: number
      co2: number
      ids: string[]
    }[] = []
    const matchedIds = new Set<string>()

    for (const rule of cfg.csvRows) {
      const ids: string[] = []
      let qty = 0
      matchMap.forEach((value, id) => {
        const v = String(value)
        if (v === rule.key || v.includes(rule.key)) {
          ids.push(id)
          matchedIds.add(id)
          if (rule.basis === 'count') {
            qty += 1
          } else {
            const q = qtyMaps[rule.basis]?.get(id)
            if (typeof q === 'number') qty += q
          }
        }
      })
      if (ids.length > 0) {
        rows.push({ ...rule, count: ids.length, qty, co2: qty * rule.factor, ids })
      }
    }

    // 未マッチの値 (CSV に定義がない matchKey の値)
    const unmatched = new Set<string>()
    matchMap.forEach((value, id) => {
      if (!matchedIds.has(id)) unmatched.add(String(value))
    })

    rows.sort((a, b) => b.co2 - a.co2)
    const total = rows.reduce((acc, r) => acc + r.co2, 0)
    return { rows, total, unmatched: [...unmatched].slice(0, 20) }
  }, [payload, props, matchKey, cfg.csvRows, qtyKeys])

  if (!payload) return <NoData />

  return (
    <div className="co2-widget">
      {editable && (
        <ConfigBar>
          <Field label="マッチキー">
            <PropertySelect
              value={matchKey}
              options={stringProps}
              allowNone
              noneLabel="(選択)"
              onChange={(key) => onConfigChange({ matchKey: key })}
            />
          </Field>
          {BASES.filter((b) => b.cfgKey).map((b) => (
            <Field key={b.basis} label={b.label}>
              <PropertySelect
                value={qtyKeys[b.basis]}
                options={numProps}
                allowNone
                noneLabel="(なし)"
                onChange={(key) => onConfigChange({ [b.cfgKey]: key })}
              />
            </Field>
          ))}
        </ConfigBar>
      )}

      <div className="co2-toolbar">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
        <button className="pill primary-pill" onClick={() => fileRef.current?.click()}>
          📄 原単位 CSV を取込
        </button>
        <button className="pill" onClick={downloadSample}>
          サンプル CSV
        </button>
        {cfg.csvName && <span className="co2-file">✓ {cfg.csvName} ({cfg.csvRows?.length} 行)</span>}
      </div>
      {csvError && <div className="co2-error">⚠ {csvError}</div>}

      {!cfg.csvRows?.length ? (
        <div className="widget-placeholder">
          <div className="placeholder-icon">🌱</div>
          <div className="placeholder-note">
            原単位 CSV (key, basis, factor) を取り込むと
            <br />
            Embodied Carbon を計算します
          </div>
        </div>
      ) : result && (
        <>
          <div className="co2-hero">
            <span className="co2-hero-value">{formatMetric(result.total)}</span>
            <span className="co2-hero-unit">kgCO₂e</span>
            <span className="co2-hero-caption">Embodied Carbon 合計</span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>キー</th>
                  <th>基準</th>
                  <th className="num">数量</th>
                  <th className="num">原単位</th>
                  <th className="num">kgCO₂e</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr
                    key={r.key + r.basis}
                    className="data-row"
                    title="クリックで 3D ハイライト"
                    onClick={() => highlightInViewer(payload, r.ids)}
                  >
                    <td>{r.key}</td>
                    <td>{BASES.find((b) => b.basis === r.basis)?.label}</td>
                    <td className="num">
                      {formatMetric(r.qty)} {BASES.find((b) => b.basis === r.basis)?.unit}
                    </td>
                    <td className="num">{r.factor}</td>
                    <td className="num">
                      <strong>{formatMetric(r.co2)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length === 0 && (
              <div className="placeholder-note" style={{ padding: 12 }}>
                CSV のキーとマッチする要素がありません ({shortLabel(matchKey)} の値と照合)
              </div>
            )}
            {result.unmatched.length > 0 && (
              <div className="co2-unmatched">
                未定義: {result.unmatched.join(', ')}
                {result.unmatched.length >= 20 ? ' …' : ''}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
