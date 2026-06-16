'use client'

// KPI / 数値カード。件数や数値プロパティの集計値を 1 つ大きく表示する。

import { useMemo } from 'react'
import type { Widget } from '@/lib/dashboard/types'
import { useDashboardData, highlightInViewer } from '@/lib/dashboard/data'
import { groupableProperties, measurableProperties } from '@/lib/aggregate'
import {
  AGGREGATIONS,
  formatMetric,
  shortLabel,
  singleValue,
  type Aggregation
} from '@/lib/dashboard/compute'
import { ConfigBar, Field, NoData, PropertySelect } from './ConfigControls'

type KpiConfig = {
  aggregation?: Aggregation
  measure?: string
  filterKey?: string
  filterValue?: string
  unit?: string
}

type Props = {
  widget: Widget
  editable: boolean
  onConfigChange: (config: Record<string, unknown>) => void
}

export default function KpiWidget({ widget, editable, onConfigChange }: Props) {
  const { payload } = useDashboardData()
  const cfg = widget.config as KpiConfig
  const agg: Aggregation = cfg.aggregation ?? 'count'

  const props = payload?.properties ?? []
  const stringProps = useMemo(() => groupableProperties(props), [props])
  const numProps = useMemo(() => measurableProperties(props), [props])

  const filterProp = stringProps.find((p) => p.key === cfg.filterKey)

  const result = useMemo(() => {
    if (!payload) return null
    return singleValue(props, cfg.measure ?? null, agg, cfg.filterKey, cfg.filterValue)
  }, [payload, props, cfg.measure, agg, cfg.filterKey, cfg.filterValue])

  if (!payload) return <NoData />

  return (
    <div className="kpi-widget">
      {editable && (
        <ConfigBar>
          <Field label="集計">
            <select
              value={agg}
              onChange={(e) => onConfigChange({ aggregation: e.target.value })}
            >
              {AGGREGATIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          {agg !== 'count' && (
            <Field label="対象">
              <PropertySelect
                value={cfg.measure ?? ''}
                options={numProps}
                allowNone
                noneLabel="(数値を選択)"
                onChange={(key) => onConfigChange({ measure: key })}
              />
            </Field>
          )}
          <Field label="絞込">
            <PropertySelect
              value={cfg.filterKey ?? ''}
              options={stringProps}
              allowNone
              noneLabel="(なし)"
              onChange={(key) => onConfigChange({ filterKey: key, filterValue: '' })}
            />
          </Field>
          {filterProp && (
            <Field label="値">
              <select
                value={cfg.filterValue ?? ''}
                onChange={(e) => onConfigChange({ filterValue: e.target.value })}
              >
                <option value="">(すべて)</option>
                {filterProp.valueGroups.map((vg) => (
                  <option key={vg.value} value={vg.value}>
                    {vg.value || '(未設定)'}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="単位">
            <input
              className="card-unit"
              value={cfg.unit ?? ''}
              placeholder="例: m²"
              onChange={(e) => onConfigChange({ unit: e.target.value })}
            />
          </Field>
        </ConfigBar>
      )}

      <div className="kpi-body">
        <div
          className="kpi-value clickable"
          title="クリックで対象要素を 3D ハイライト"
          onClick={() => result && highlightInViewer(payload, result.ids)}
        >
          {result ? formatMetric(result.metric) : '-'}
          {cfg.unit && <span className="kpi-unit">{cfg.unit}</span>}
        </div>
        <div className="kpi-caption">
          {AGGREGATIONS.find((a) => a.value === agg)?.label}
          {cfg.measure && agg !== 'count' ? ` / ${shortLabel(cfg.measure)}` : ''}
          {cfg.filterValue ? ` (${cfg.filterValue})` : ''}
        </div>
      </div>
    </div>
  )
}
