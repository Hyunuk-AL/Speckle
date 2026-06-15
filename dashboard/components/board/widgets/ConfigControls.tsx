'use client'

// カードの設定バーで使う小さな共通コントロール。

import type { ReactNode } from 'react'
import type { PropertyInfo } from '@speckle/viewer'
import { shortLabel } from '@/lib/dashboard/compute'

export function ConfigBar({ children }: { children: ReactNode }) {
  return <div className="card-config">{children}</div>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="card-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

/** プロパティ選択用セレクト */
export function PropertySelect({
  value,
  options,
  onChange,
  allowNone,
  noneLabel = '(なし)'
}: {
  value: string
  options: PropertyInfo[]
  onChange: (key: string) => void
  allowNone?: boolean
  noneLabel?: string
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone && <option value="">{noneLabel}</option>}
      {options.map((p) => (
        <option key={p.key} value={p.key}>
          {shortLabel(p.key)}
        </option>
      ))}
    </select>
  )
}

/** データ未ロード時の案内 */
export function NoData() {
  return (
    <div className="widget-placeholder">
      <div className="placeholder-note">
        3D ビューを追加してモデルを読み込むと
        <br />
        集計が表示されます
      </div>
    </div>
  )
}
