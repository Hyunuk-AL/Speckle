'use client'

// チャートカード。グループ軸ごとの集計値を棒/円グラフで表示する。

import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import { PieChart, BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Widget } from '@/lib/dashboard/types'
import { useDashboardData } from '@/lib/dashboard/data'
import { groupableProperties, measurableProperties } from '@/lib/aggregate'
import {
  AGGREGATIONS,
  findNumeric,
  findString,
  groupAndAggregate,
  type Aggregation
} from '@/lib/dashboard/compute'
import { colorAt } from '@/lib/palette'
import { ConfigBar, Field, NoData, PropertySelect } from './ConfigControls'

echarts.use([PieChart, BarChart, TooltipComponent, GridComponent, CanvasRenderer])

type ChartConfig = {
  chartType?: 'bar' | 'pie'
  groupBy?: string
  measure?: string
  aggregation?: Aggregation
}

type Props = {
  widget: Widget
  editable: boolean
  onConfigChange: (config: Record<string, unknown>) => void
}

export default function ChartWidget({ widget, editable, onConfigChange }: Props) {
  const { payload } = useDashboardData()
  const cfg = widget.config as ChartConfig
  const chartType = cfg.chartType ?? 'bar'
  const agg: Aggregation = cfg.aggregation ?? 'count'
  const chartRef = useRef<HTMLDivElement>(null)

  const props = payload?.properties ?? []
  const stringProps = useMemo(() => groupableProperties(props), [props])
  const numProps = useMemo(() => measurableProperties(props), [props])

  // グループ軸の既定値
  const groupKey = cfg.groupBy ?? stringProps[0]?.key ?? ''

  const rows = useMemo(() => {
    if (!payload || !groupKey) return []
    const group = findString(props, groupKey)
    if (!group) return []
    const measure = agg === 'count' ? null : findNumeric(props, cfg.measure ?? '')
    return groupAndAggregate(group, measure, agg)
  }, [payload, props, groupKey, agg, cfg.measure])

  useEffect(() => {
    if (!chartRef.current || rows.length === 0) return
    const chart = echarts.init(chartRef.current)
    const data = rows.map((r, i) => ({
      name: r.value || '(未設定)',
      value: r.metric,
      itemStyle: { color: colorAt(i) }
    }))
    chart.setOption(
      chartType === 'pie'
        ? {
            tooltip: { trigger: 'item' },
            series: [{ type: 'pie', radius: ['35%', '70%'], data, label: { fontSize: 10 } }]
          }
        : {
            tooltip: { trigger: 'axis' },
            grid: { left: 50, right: 16, top: 16, bottom: 60 },
            xAxis: {
              type: 'category',
              data: rows.map((r) => r.value || '(未設定)'),
              axisLabel: { rotate: 40, fontSize: 9 }
            },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data }]
          }
    )
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(chartRef.current)
    return () => {
      ro.disconnect()
      chart.dispose()
    }
  }, [rows, chartType])

  if (!payload) return <NoData />

  return (
    <div className="chart-widget">
      {editable && (
        <ConfigBar>
          <Field label="種類">
            <select
              value={chartType}
              onChange={(e) => onConfigChange({ chartType: e.target.value })}
            >
              <option value="bar">棒グラフ</option>
              <option value="pie">円グラフ</option>
            </select>
          </Field>
          <Field label="軸">
            <PropertySelect
              value={groupKey}
              options={stringProps}
              onChange={(key) => onConfigChange({ groupBy: key })}
            />
          </Field>
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
            <Field label="値">
              <PropertySelect
                value={cfg.measure ?? ''}
                options={numProps}
                allowNone
                noneLabel="(数値を選択)"
                onChange={(key) => onConfigChange({ measure: key })}
              />
            </Field>
          )}
        </ConfigBar>
      )}
      {rows.length > 0 ? (
        <div ref={chartRef} className="chart-canvas" />
      ) : (
        <div className="widget-placeholder">
          <div className="placeholder-note">集計軸を選択してください</div>
        </div>
      )}
    </div>
  )
}
