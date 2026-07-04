'use client'

// パラメータチェックカード。
// 指定パラメータに値が入っているか / いないかを集計し、
// それぞれを 3D ビューでハイライトして確認できる。

import { useMemo } from 'react'
import type { Widget } from '@/lib/dashboard/types'
import { useDashboardData, highlightInViewer } from '@/lib/dashboard/data'
import { groupableProperties, measurableProperties } from '@/lib/aggregate'
import { categoryProperty, idsWithValue, shortLabel } from '@/lib/dashboard/compute'
import { ConfigBar, Field, NoData, PropertySelect } from './ConfigControls'

type ParamCheckConfig = {
  paramKey?: string
  categoryValue?: string
}

type Props = {
  widget: Widget
  editable: boolean
  onConfigChange: (config: Record<string, unknown>) => void
}

export default function ParamCheckWidget({ widget, editable, onConfigChange }: Props) {
  const { payload } = useDashboardData()
  const cfg = widget.config as ParamCheckConfig
  const props = payload?.properties ?? []

  const allProps = useMemo(
    () => [...groupableProperties(props), ...measurableProperties(props)],
    [props]
  )
  const catProp = useMemo(() => categoryProperty(props), [props])

  const result = useMemo(() => {
    if (!payload || !cfg.paramKey) return null
    // 対象範囲: カテゴリ指定があればそのカテゴリ、なければ全オブジェクト
    let target: Set<string>
    if (cfg.categoryValue && catProp) {
      const vg = catProp.valueGroups.find((g) => g.value === cfg.categoryValue)
      target = new Set(vg?.ids ?? [])
    } else if (catProp) {
      target = new Set(catProp.valueGroups.flatMap((g) => g.ids))
    } else {
      target = new Set<string>()
    }
    const has = idsWithValue(props, cfg.paramKey)
    const withIds: string[] = []
    const withoutIds: string[] = []
    target.forEach((id) => (has.has(id) ? withIds.push(id) : withoutIds.push(id)))
    return { withIds, withoutIds, total: target.size }
  }, [payload, props, cfg.paramKey, cfg.categoryValue, catProp])

  if (!payload) return <NoData />

  const okRate = result && result.total > 0 ? result.withIds.length / result.total : 0

  return (
    <div className="pcheck-widget">
      {editable && (
        <ConfigBar>
          <Field label="パラメータ">
            <PropertySelect
              value={cfg.paramKey ?? ''}
              options={allProps}
              allowNone
              noneLabel="(選択してください)"
              onChange={(key) => onConfigChange({ paramKey: key })}
            />
          </Field>
          {catProp && (
            <Field label="カテゴリ">
              <select
                value={cfg.categoryValue ?? ''}
                onChange={(e) => onConfigChange({ categoryValue: e.target.value })}
              >
                <option value="">(すべて)</option>
                {catProp.valueGroups.map((vg) => (
                  <option key={vg.value} value={vg.value}>
                    {vg.value || '(未設定)'}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </ConfigBar>
      )}

      {!cfg.paramKey && (
        <div className="widget-placeholder">
          <div className="placeholder-icon">✅</div>
          <div className="placeholder-note">チェックするパラメータを選択してください</div>
        </div>
      )}

      {cfg.paramKey && result && (
        <div className="pcheck-body">
          <div className="pcheck-target">
            対象: {cfg.categoryValue || 'すべて'} / {shortLabel(cfg.paramKey)}
          </div>

          <div className="pcheck-meter" role="img" aria-label={`入力率 ${Math.round(okRate * 100)}%`}>
            <div className="pcheck-meter-fill" style={{ width: `${okRate * 100}%` }} />
          </div>
          <div className="pcheck-rate">
            入力率 <strong>{Math.round(okRate * 100)}%</strong>
            <span className="pcheck-total">({result.total} 要素)</span>
          </div>

          <div className="pcheck-tiles">
            <button
              className="pcheck-tile ok"
              onClick={() => highlightInViewer(payload, result.withIds)}
              title="クリックで 3D ハイライト"
            >
              <span className="pcheck-count">{result.withIds.length}</span>
              <span className="pcheck-label">値あり</span>
            </button>
            <button
              className="pcheck-tile ng"
              onClick={() => highlightInViewer(payload, result.withoutIds)}
              title="クリックで 3D ハイライト"
            >
              <span className="pcheck-count">{result.withoutIds.length}</span>
              <span className="pcheck-label">値なし</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
