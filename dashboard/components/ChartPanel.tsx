'use client'

// 円グラフ (件数構成比) と棒グラフ (集計値) のウィジェット。
// グラフ要素クリックでも表の行クリックと同じ分離表示を発火する。

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { PieChart, BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, TitleComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { AggregationRow } from '@/lib/aggregate'
import { colorAt } from '@/lib/palette'

echarts.use([PieChart, BarChart, TooltipComponent, GridComponent, TitleComponent, CanvasRenderer])

type Props = {
  rows: AggregationRow[]
  measureLabel: string | null
  onSelectValue: (value: string) => void
}

export default function ChartPanel({ rows, measureLabel, onSelectValue }: Props) {
  const pieRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelectValue)
  onSelectRef.current = onSelectValue

  useEffect(() => {
    if (!pieRef.current) return
    const chart = echarts.init(pieRef.current)
    chart.setOption({
      title: { text: '件数構成比', left: 'center', textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} 件 ({d}%)' },
      series: [
        {
          type: 'pie',
          radius: ['35%', '70%'],
          top: 20,
          label: { fontSize: 10 },
          data: rows.map((r, i) => ({
            name: r.value || '(未設定)',
            value: r.count,
            itemStyle: { color: colorAt(i) }
          }))
        }
      ]
    })
    chart.on('click', (params) => {
      const row = rows[params.dataIndex]
      if (row) onSelectRef.current(row.value)
    })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(pieRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [rows])

  useEffect(() => {
    if (!barRef.current) return
    const chart = echarts.init(barRef.current)
    const hasMeasure = measureLabel != null
    chart.setOption({
      title: {
        text: hasMeasure ? `合計: ${measureLabel}` : '件数',
        left: 'center',
        textStyle: { fontSize: 13 }
      },
      tooltip: { trigger: 'axis' },
      grid: { left: 60, right: 16, top: 40, bottom: 70 },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.value || '(未設定)'),
        axisLabel: { rotate: 40, fontSize: 9 }
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: rows.map((r, i) => ({
            value: hasMeasure ? (r.sum ?? 0) : r.count,
            itemStyle: { color: colorAt(i) }
          }))
        }
      ]
    })
    chart.on('click', (params) => {
      const row = rows[params.dataIndex]
      if (row) onSelectRef.current(row.value)
    })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(barRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [rows, measureLabel])

  return (
    <div className="charts">
      <div ref={pieRef} className="chart" />
      <div ref={barRef} className="chart" />
    </div>
  )
}
