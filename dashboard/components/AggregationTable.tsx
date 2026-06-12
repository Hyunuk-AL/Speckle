'use client'

// 集計表。行クリック → 3D 分離表示、3D クリック → 行ハイライトの双方向連携を担う。

import { useEffect, useRef } from 'react'
import type { AggregationRow } from '@/lib/aggregate'
import { formatNumber } from '@/lib/aggregate'
import { colorAt } from '@/lib/palette'

type Props = {
  rows: AggregationRow[]
  measureLabel: string | null
  /** 行クリックで分離表示中の値 (再クリックで解除) */
  isolatedValue: string | null
  /** 3D クリックでハイライトされた値 */
  highlightedValue: string | null
  colorized: boolean
  onRowClick: (row: AggregationRow) => void
}

export default function AggregationTable({
  rows,
  measureLabel,
  isolatedValue,
  highlightedValue,
  colorized,
  onRowClick
}: Props) {
  const highlightRef = useRef<HTMLTableRowElement>(null)

  // 3D クリック由来のハイライト行までスクロール
  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightedValue])

  const totalCount = rows.reduce((acc, r) => acc + r.count, 0)
  const totalSum = rows.reduce((acc, r) => acc + (r.sum ?? 0), 0)

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>値</th>
            <th className="num">件数</th>
            {measureLabel && <th className="num">合計: {measureLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isIsolated = row.value === isolatedValue
            const isHighlighted = row.value === highlightedValue
            return (
              <tr
                key={row.value}
                ref={isHighlighted ? highlightRef : undefined}
                className={
                  (isIsolated ? 'isolated ' : '') + (isHighlighted ? 'highlighted' : '')
                }
                onClick={() => onRowClick(row)}
                title="クリックで 3D 分離表示 / 再クリックで解除"
              >
                <td>
                  {colorized && (
                    <span className="swatch" style={{ backgroundColor: colorAt(i) }} />
                  )}
                  {row.value || '(未設定)'}
                </td>
                <td className="num">{row.count}</td>
                {measureLabel && (
                  <td className="num">{row.sum != null ? formatNumber(row.sum) : '-'}</td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>合計</td>
            <td className="num">{totalCount}</td>
            {measureLabel && <td className="num">{formatNumber(totalSum)}</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
