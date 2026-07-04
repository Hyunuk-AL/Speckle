// ウォークスルー (一人称移動) の制御ロジックとキー設定。
//
// ビューワ組み込みの FlyControls はキー割当が固定なので、
// - toggleControls() でフライモードに切替 (滑らかな移動・減衰は組み込みを利用)
// - キー入力は window のキャプチャ段階で横取りして自前管理 (再割当可能)
// - 移動は FlyControls.moveBy() を毎フレーム呼んで反映
// マウスによる視点操作は組み込みの look をそのまま使う。

import type { CameraController } from '@speckle/viewer'

// FlyControls.moveBy は引数の x/y/z を数値として読むだけなので、
// three の Vector3 を取り込まずに軽量な独自型で渡す (バンドル削減)。
type Vec3 = { x: number; y: number; z: number }

export type WalkAction =
  | 'forward'
  | 'back'
  | 'turnLeft'
  | 'turnRight'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'dash'
  | 'crouch'

export type KeyBindings = Record<WalkAction, string[]>

export type WalkSettings = {
  bindings: KeyBindings
  /** 移動速度 (ワールド単位/秒) */
  moveSpeed: number
  /** ダッシュ時の速度倍率 */
  dashMultiplier: number
  /** しゃがみ時に視点を下げる量 */
  crouchOffset: number
  /** 視点回転(見回し)の感度 */
  lookSpeed: number
}

export const ACTION_LABELS: Record<WalkAction, string> = {
  forward: '前進',
  back: '後退',
  turnLeft: '左旋回',
  turnRight: '右旋回',
  left: '左移動',
  right: '右移動',
  up: '上昇',
  down: '下降',
  dash: 'ダッシュ',
  crouch: 'しゃがみ'
}

// ArchiCAD の 3D ウォークスルー操作に準拠:
// 矢印キー = 前進/後退 + 左右旋回、W/S = 前後、A/D = 平行移動、
// E/Q = 上昇/下降、Shift = ダッシュ、C = しゃがみ。すべて再割当可能。
export const DEFAULT_WALK_SETTINGS: WalkSettings = {
  bindings: {
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    turnLeft: ['ArrowLeft'],
    turnRight: ['ArrowRight'],
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyE'],
    down: ['KeyQ'],
    dash: ['ShiftLeft', 'ShiftRight'],
    crouch: ['KeyC']
  },
  moveSpeed: 6,
  dashMultiplier: 3,
  crouchOffset: 1,
  lookSpeed: 1
}

const STORAGE_KEY = 'speckle-poc-walkthrough'

export function loadWalkSettings(): WalkSettings {
  if (typeof window === 'undefined') return DEFAULT_WALK_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WALK_SETTINGS
    const parsed = JSON.parse(raw) as Partial<WalkSettings>
    return {
      ...DEFAULT_WALK_SETTINGS,
      ...parsed,
      bindings: { ...DEFAULT_WALK_SETTINGS.bindings, ...(parsed.bindings ?? {}) }
    }
  } catch {
    return DEFAULT_WALK_SETTINGS
  }
}

export function saveWalkSettings(s: WalkSettings): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

/** e.code を人が読めるラベルにする (表示用) */
export function keyLabel(code: string): string {
  const map: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ShiftLeft: 'Shift(左)',
    ShiftRight: 'Shift(右)',
    Space: 'Space',
    ControlLeft: 'Ctrl(左)',
    ControlRight: 'Ctrl(右)'
  }
  if (map[code]) return map[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

type FlyLikeControls = {
  moveBy: (v: Vec3) => void
  rotateBy: (v: { x: number; y: number }) => void
  options: Record<string, unknown>
}

/**
 * ウォークスルーの実行制御。enable() でフライモード+キー監視を開始、
 * disable() で元のオービットに戻す。
 */
export class WalkthroughController {
  private camera: CameraController
  private settings: WalkSettings
  private active = false
  private fly: FlyLikeControls | null = null
  private pressed = new Set<WalkAction>()
  private crouched = false
  private rafId = 0
  private lastTime = 0
  private readonly tmp: Vec3 = { x: 0, y: 0, z: 0 }

  private vec(x: number, y: number, z: number): Vec3 {
    this.tmp.x = x
    this.tmp.y = y
    this.tmp.z = z
    return this.tmp
  }

  constructor(camera: CameraController, settings: WalkSettings) {
    this.camera = camera
    this.settings = settings
  }

  isActive() {
    return this.active
  }

  updateSettings(s: WalkSettings) {
    this.settings = s
  }

  enable() {
    if (this.active) return
    this.active = true
    // オービット → フライへ切替
    this.camera.toggleControls()
    this.fly = this.camera.controls as unknown as FlyLikeControls
    // 組み込みの look (左ボタン押下中のみ) を無効化し、フリールックを自前で行う
    this.fly.options = { enableLook: false }
    window.addEventListener('keydown', this.onKeyDown, true)
    window.addEventListener('keyup', this.onKeyUp, true)
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  /** フリールック: マウス移動量から視点を回転する (ボタン押下不要) */
  look(movementX: number, movementY: number) {
    if (!this.active || !this.fly) return
    const f = 0.005 * this.settings.lookSpeed
    this.fly.rotateBy({ x: f * movementY, y: f * movementX })
  }

  disable() {
    if (!this.active) return
    this.active = false
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('keydown', this.onKeyDown, true)
    window.removeEventListener('keyup', this.onKeyUp, true)
    this.pressed.clear()
    if (this.crouched) {
      this.fly?.moveBy(this.vec(0, this.settings.crouchOffset, 0))
      this.crouched = false
    }
    // 組み込み look を元に戻す
    if (this.fly) this.fly.options = { enableLook: true }
    // フライ → オービットへ戻す
    this.camera.toggleControls()
    this.fly = null
  }

  /** e.code に対応するアクションを返す */
  private actionFor(code: string): WalkAction | null {
    const b = this.settings.bindings
    for (const action of Object.keys(b) as WalkAction[]) {
      if (b[action].includes(code)) return action
    }
    return null
  }

  private isTypingTarget(): boolean {
    const el = document.activeElement
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (this.isTypingTarget()) return
    const action = this.actionFor(e.code)
    if (!action) return
    // 組み込みの固定キー処理に渡さないよう横取り
    e.preventDefault()
    e.stopImmediatePropagation()
    if (e.repeat) return
    if (action === 'crouch') {
      if (!this.crouched) {
        this.crouched = true
        this.fly?.moveBy(this.vec(0, -this.settings.crouchOffset, 0))
      }
      return
    }
    this.pressed.add(action)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (this.isTypingTarget()) return
    const action = this.actionFor(e.code)
    if (!action) return
    e.preventDefault()
    e.stopImmediatePropagation()
    if (action === 'crouch') {
      if (this.crouched) {
        this.crouched = false
        this.fly?.moveBy(this.vec(0, this.settings.crouchOffset, 0))
      }
      return
    }
    this.pressed.delete(action)
  }

  private tick = () => {
    if (!this.active) return
    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now

    const p = this.pressed
    if (this.fly && p.size > 0) {
      const dash = p.has('dash') ? this.settings.dashMultiplier : 1
      const amount = this.settings.moveSpeed * dash * dt

      // 旋回 (ArchiCAD の ←→ に相当)。ダッシュ中は旋回も速く
      const turnAmount = 1.6 * this.settings.lookSpeed * dash * dt
      const turnY =
        (p.has('turnRight') ? turnAmount : 0) - (p.has('turnLeft') ? turnAmount : 0)
      if (turnY !== 0) this.fly.rotateBy({ x: 0, y: turnY })
      let x = 0
      let y = 0
      let z = 0
      // FlyControls.moveBy: x=右, y=上, z=後方 (カメラは -Z を向く)
      if (p.has('forward')) z -= amount
      if (p.has('back')) z += amount
      if (p.has('right')) x += amount
      if (p.has('left')) x -= amount
      if (p.has('up')) y += amount
      if (p.has('down')) y -= amount
      if (x !== 0 || y !== 0 || z !== 0) {
        this.fly.moveBy(this.vec(x, y, z))
      }
    }
    this.rafId = requestAnimationFrame(this.tick)
  }
}
