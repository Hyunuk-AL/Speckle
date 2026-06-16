'use client'

// テーブルカード。選択した列でオブジェクトごとの一覧を表示する。

import { useMemo } from 'react'
import type { Widget } from '@/lib/dashboard/types'
import { useDashboardData, highlightInViewer } from '@/lib/dashboard/data'
import { groupableProperties, measurableProperties } from '@/lib/aggregate'
import { buildObjectRows, shortLabel } from '@/lib/dashboard/compute'
import { ConfigBar, Field, NoData } from './ConfigControls'

type TableConfig = { columns?: string[] }

type Props = {
  widget: Widget
  editable: boolean
  onConfigChange: (config: Record<string, unknown>) => void
}

export default function TableWidget({ widget, editable, onConfigChange }: Props) {
  const { payload } = useDashboardData()
  const cfg = widget.config as TableConfig
  const props = payload?.properties ?? []

  // 選択候補 (文字列+数値プロパティ)
  const available = useMemo(
    () => [...groupableProperties(props), ...measurableProperties(props)],
    [props]
  )

  // 既定列: category, level.name があれば優先
  const columns = useMemo(() => {
    if (cfg.columns && cfg.columns.length > 0) return cfg.columns
    return available.slice(0, 4).map((p) => p.key)
  }, [cfg.columns, available])

  const rows = useMemo(() => {
    if (!payload) return []
    return buildObjectRows(props, columns).slice(0, 500)
  }, [payload, props, columns])

  const addColumn = (key: string) => {
    if (!key || columns.includes(key)) return
    onConfigChange({ columns: [...columns, key] })
  }
  const removeColumn = (key: string) => {
    onConfigChange({ columns: columns.filter((c) => c !== key) })
  }

  if (!payload) return <NoData />

  return (
    <div className="table-widget">
      {editable && (
        <ConfigBar>
          <Field label="列追加">
            <select value="" onChange={(e) => addColumn(e.target.value)}>
              <option value="">列を選択...</option>
              {available
                .filter((p) => !columns.includes(p.key))
                .map((p) => (
                  <option key={p.key} value={p.key}>
                    {shortLabel(p.key)}
                  </option>
                ))}
            </select>
          </Field>
          <div className="card-chips">
            {columns.map((c) => (
              <button key={c} className="card-chip" onClick={() => removeColumn(c)} title="クリックで削除">
                {shortLabel(c)} ×
              </button>
            ))}
          </div>
        </ConfigBar>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{shortLabel(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="data-row"
                title="クリックで 3D ハイライト"
                onClick={() => highlightInViewer(payload, [row.id], true)}
              >
                {columns.map((c) => (
                  <td key={c}>{row.cells[c] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="placeholder-note">表示する列を選択してください</div>}
        {rows.length >= 500 && <div className="table-note">先頭 500 件を表示</div>}
      </div>
    </div>
  )
}
