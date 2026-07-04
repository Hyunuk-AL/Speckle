'use client'

// 色分けカード。
// カテゴリ (壁/床/天井など) を選び、その中のパラメータ値ごとに色を設定して
// 3D ビューに着色する (ALBS「色分け作成」の Web 再現)。
// ルールは複数持て、ON のルールをまとめて適用する。

import { useCallback, useEffect, useMemo } from 'react'
import type { Widget } from '@/lib/dashboard/types'
import { useDashboardData } from '@/lib/dashboard/data'
import { groupableProperties } from '@/lib/aggregate'
import { categoryProperty, findString, shortLabel } from '@/lib/dashboard/compute'
import { colorAt } from '@/lib/palette'
import { NoData, PropertySelect } from './ConfigControls'

type ColorRule = {
  id: string
  category: string
  paramKey: string
  /** 値 → HEX。未指定の値はパレットから自動割当 */
  colors: Record<string, string>
  enabled: boolean
}

type ColorizeConfig = { rules?: ColorRule[] }

type Props = {
  widget: Widget
  editable: boolean
  onConfigChange: (config: Record<string, unknown>) => void
}

export default function ColorizeWidget({ widget, editable, onConfigChange }: Props) {
  const { payload } = useDashboardData()
  const cfg = widget.config as ColorizeConfig
  const rules = useMemo(() => cfg.rules ?? [], [cfg.rules])
  const props = payload?.properties ?? []

  const stringProps = useMemo(() => groupableProperties(props), [props])
  const catProp = useMemo(() => categoryProperty(props), [props])

  const setRules = useCallback(
    (next: ColorRule[]) => onConfigChange({ rules: next }),
    [onConfigChange]
  )

  const addRule = () => {
    const wallish = catProp?.valueGroups.find((vg) => /wall|壁/i.test(vg.value))
    setRules([
      ...rules,
      {
        id: `r-${Date.now()}-${rules.length}`,
        category: wallish?.value ?? catProp?.valueGroups[0]?.value ?? '',
        paramKey: '',
        colors: {},
        enabled: true
      }
    ])
  }

  const updateRule = (id: string, patch: Partial<ColorRule>) =>
    setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const removeRule = (id: string) => setRules(rules.filter((r) => r.id !== id))

  /** ルールの値一覧 (カテゴリ内に存在する値のみ) と色を解決する */
  const resolveRule = useCallback(
    (rule: ColorRule) => {
      if (!catProp || !rule.category || !rule.paramKey) return []
      const catIds = new Set(
        catProp.valueGroups.find((g) => g.value === rule.category)?.ids ?? []
      )
      const prop = findString(props, rule.paramKey)
      if (!prop) return []
      const entries: { value: string; color: string; ids: string[] }[] = []
      prop.valueGroups.forEach((vg) => {
        const ids = vg.ids.filter((id) => catIds.has(id))
        if (ids.length === 0) return
        entries.push({
          value: vg.value,
          color: rule.colors[vg.value] ?? colorAt(entries.length),
          ids
        })
      })
      return entries
    },
    [catProp, props]
  )

  // ON のルールをまとめて 3D に適用 (変更のたび)
  useEffect(() => {
    if (!payload) return
    const groups: { objectIds: string[]; color: string }[] = []
    for (const rule of rules) {
      if (!rule.enabled) continue
      for (const entry of resolveRule(rule)) {
        const ids = payload.resolveRenderableIds(entry.ids)
        if (ids.length > 0) groups.push({ objectIds: ids, color: entry.color })
      }
    }
    if (groups.length > 0) payload.filtering.setUserObjectColors(groups)
    else payload.filtering.removeUserObjectColors()
  }, [payload, rules, resolveRule])

  // カードを消したら色も解除
  useEffect(() => {
    return () => {
      payload?.filtering.removeUserObjectColors()
    }
  }, [payload])

  if (!payload) return <NoData />

  return (
    <div className="colorize-widget">
      <div className="colorize-toolbar">
        <button className="pill primary-pill" onClick={addRule} disabled={!editable}>
          ＋ ルール追加
        </button>
        <button
          className="pill"
          onClick={() => payload.filtering.removeUserObjectColors()}
          title="3D の着色を一時解除 (ルールは残る)"
        >
          着色クリア
        </button>
      </div>

      {rules.length === 0 && (
        <div className="widget-placeholder">
          <div className="placeholder-icon">🎨</div>
          <div className="placeholder-note">
            「ルール追加」でカテゴリとパラメータを選び、
            <br />
            値ごとの色を設定します
          </div>
        </div>
      )}

      <div className="colorize-rules">
        {rules.map((rule) => {
          const entries = resolveRule(rule)
          return (
            <div key={rule.id} className={'colorize-rule' + (rule.enabled ? '' : ' off')}>
              <div className="colorize-rule-head">
                <label className="colorize-switch" title={rule.enabled ? '適用中' : '停止中'}>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                  />
                  <span />
                </label>
                {catProp && (
                  <select
                    value={rule.category}
                    disabled={!editable}
                    onChange={(e) => updateRule(rule.id, { category: e.target.value, colors: {} })}
                  >
                    {catProp.valueGroups.map((vg) => (
                      <option key={vg.value} value={vg.value}>
                        {vg.value || '(未設定)'}
                      </option>
                    ))}
                  </select>
                )}
                <PropertySelect
                  value={rule.paramKey}
                  options={stringProps}
                  allowNone
                  noneLabel="(パラメータ選択)"
                  onChange={(key) => updateRule(rule.id, { paramKey: key, colors: {} })}
                />
                {editable && (
                  <button
                    className="widget-remove"
                    onClick={() => removeRule(rule.id)}
                    title="ルール削除"
                  >
                    ×
                  </button>
                )}
              </div>

              {rule.paramKey && entries.length === 0 && (
                <div className="placeholder-note" style={{ padding: '4px 8px' }}>
                  このカテゴリには {shortLabel(rule.paramKey)} の値がありません
                </div>
              )}

              {entries.length > 0 && (
                <div className="colorize-values">
                  {entries.map((entry) => (
                    <label key={entry.value} className="colorize-value">
                      <input
                        type="color"
                        value={entry.color}
                        onChange={(e) =>
                          updateRule(rule.id, {
                            colors: { ...rule.colors, [entry.value]: e.target.value }
                          })
                        }
                      />
                      <span className="colorize-value-label">{entry.value || '(未設定)'}</span>
                      <span className="colorize-value-count">{entry.ids.length}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
