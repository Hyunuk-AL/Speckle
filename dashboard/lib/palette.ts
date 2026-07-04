// チャート・色分け共通のカテゴリカルパレット。
// design.md のブランド 3 系統 (Blue/Green/Red スケール) から構成し、
// dataviz 検証スクリプトで妥当性確認済み (2026-06-16):
//   Lightness band PASS / Chroma PASS / CVD 11.7 (フロア帯 — 直接ラベル・
//   バー間ギャップ・ツールチップ・表ビュー併設で担保) / #8A90E8 は contrast WARN
//   のため数値ラベル or 表を常に併設する。
// 固定順で割り当てる (系列の増減で塗り替えない)。

const BASE_COLORS = [
  '#414AC7', // blue-2
  '#35A466', // green-1
  '#D54040', // red-2
  '#8A90E8', // blue-2.5 (ramp 内補間)
  '#26824E', // green-0.5 (ramp 内補間)
  '#E46464' // red-3
]

// 7 色目以降 (チャートでは「その他」に畳む想定。3D 色分け等の
// ユーザー指定色の初期値としてのみ淡色・中立色を続ける)
const EXTENDED_COLORS = ['#AFB4F1', '#8CD9AE', '#F0A4AB', '#707070']

export function colorAt(index: number): string {
  const all = [...BASE_COLORS, ...EXTENDED_COLORS]
  if (index < all.length) return all[index]
  // 使い切ったら黄金角で HSL を回して生成 (3D 色分けのみ想定)
  const hue = Math.round((index * 137.508) % 360)
  return `hsl(${hue}, 55%, 55%)`
}

export const CHART_COLORS = BASE_COLORS
