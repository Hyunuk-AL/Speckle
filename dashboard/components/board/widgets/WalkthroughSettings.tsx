'use client'

// ウォークスルーのキー割当・速度を設定するパネル。
// 「変更」を押してキーを押すと、そのアクションにキーを追加。チップのクリックで削除。

import { useEffect, useState } from 'react'
import {
  ACTION_LABELS,
  DEFAULT_WALK_SETTINGS,
  keyLabel,
  type WalkAction,
  type WalkSettings
} from '@/lib/dashboard/walkthrough'

type Props = {
  settings: WalkSettings
  onChange: (s: WalkSettings) => void
  onClose: () => void
}

const ACTIONS: WalkAction[] = ['forward', 'back', 'left', 'right', 'up', 'down', 'dash', 'crouch']

export default function WalkthroughSettings({ settings, onChange, onClose }: Props) {
  // キー取得待ちのアクション
  const [capturing, setCapturing] = useState<WalkAction | null>(null)

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.code === 'Escape') {
        setCapturing(null)
        return
      }
      const current = settings.bindings[capturing]
      if (!current.includes(e.code)) {
        onChange({
          ...settings,
          bindings: { ...settings.bindings, [capturing]: [...current, e.code] }
        })
      }
      setCapturing(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, settings, onChange])

  const removeKey = (action: WalkAction, code: string) => {
    onChange({
      ...settings,
      bindings: {
        ...settings.bindings,
        [action]: settings.bindings[action].filter((c) => c !== code)
      }
    })
  }

  const setNumber = (key: 'moveSpeed' | 'dashMultiplier' | 'crouchOffset', value: number) => {
    onChange({ ...settings, [key]: value })
  }

  return (
    <div className="walk-settings">
      <div className="walk-settings-head">
        <strong>ウォークスルー設定</strong>
        <button className="walk-close" onClick={onClose} title="閉じる">
          ×
        </button>
      </div>

      <div className="walk-section">
        <label className="walk-row">
          <span>移動速度</span>
          <input
            type="range"
            min={0.5}
            max={50}
            step={0.5}
            value={settings.moveSpeed}
            onChange={(e) => setNumber('moveSpeed', Number(e.target.value))}
          />
          <em>{settings.moveSpeed}</em>
        </label>
        <label className="walk-row">
          <span>ダッシュ倍率</span>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={settings.dashMultiplier}
            onChange={(e) => setNumber('dashMultiplier', Number(e.target.value))}
          />
          <em>×{settings.dashMultiplier}</em>
        </label>
        <label className="walk-row">
          <span>しゃがみ下げ幅</span>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={settings.crouchOffset}
            onChange={(e) => setNumber('crouchOffset', Number(e.target.value))}
          />
          <em>{settings.crouchOffset}</em>
        </label>
      </div>

      <div className="walk-section">
        <div className="walk-subtitle">キー割当</div>
        {ACTIONS.map((action) => (
          <div key={action} className="walk-bind-row">
            <span className="walk-action">{ACTION_LABELS[action]}</span>
            <div className="walk-keys">
              {settings.bindings[action].map((code) => (
                <button
                  key={code}
                  className="walk-key-chip"
                  title="クリックで削除"
                  onClick={() => removeKey(action, code)}
                >
                  {keyLabel(code)} ×
                </button>
              ))}
              <button
                className={'walk-capture' + (capturing === action ? ' capturing' : '')}
                onClick={() => setCapturing(action)}
              >
                {capturing === action ? 'キーを押す...' : '＋追加'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="walk-section walk-footer">
        <span className="walk-hint">マウスドラッグで視点変更</span>
        <button className="ghost" onClick={() => onChange({ ...DEFAULT_WALK_SETTINGS })}>
          初期設定に戻す
        </button>
      </div>
    </div>
  )
}
