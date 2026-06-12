// 色分け表示・グラフ共通のカラーパレット (ALBS「色分け作成」の Web 再現用)

const BASE_COLORS = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
  '#1f77b4',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2'
]

export function colorAt(index: number): string {
  if (index < BASE_COLORS.length) return BASE_COLORS[index]
  // パレットを使い切ったら黄金角で HSL を回して生成する
  const hue = Math.round((index * 137.508) % 360)
  return `hsl(${hue}, 65%, 55%)`
}
