// 仕上表の列キー解決の検収テスト。
// ユーザー環境の Revit「部屋」プロパティ (スクリーンショット確認済み) を模した
// フィクスチャで、部屋名 / 床・壁・天井・巾木・廻り縁 の既定解決を検証する。
//   node scripts/test-finish-keys.mjs
// (tsx が無い環境でも動くよう、TS を esbuild-register なしで読むため
//  next build 後ではなく tsc の transpile を直接使う)

import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// --- TS を JS に変換してロード (finish.ts と compute.ts のみ) ---
const out = mkdtempSync(join(tmpdir(), 'finish-test-'))
try {
  execSync(
    `npx tsc lib/dashboard/finish.ts lib/dashboard/compute.ts lib/aggregate.ts ` +
      `--outDir ${out} --rootDir . --module esnext --moduleResolution bundler --target es2020 ` +
      `--skipLibCheck --esModuleInterop --noEmitOnError false`,
    { cwd: root, stdio: 'pipe' }
  )
} catch {
  // 型エラー (viewer の型解決) は無視。noEmitOnError false のため JS は出力される
}
writeFileSync(join(out, 'package.json'), '{"type":"module"}\n')
// 拡張子解決のため import パスを書き換え (シングル/ダブルクォート両対応)
const rewrite = (file, map) => {
  const p = join(out, file)
  let src = readFileSync(p, 'utf8')
  for (const [from, to] of Object.entries(map)) {
    src = src.replaceAll(`'${from}'`, `'${to}'`).replaceAll(`"${from}"`, `"${to}"`)
  }
  writeFileSync(p, src)
}
rewrite('lib/dashboard/finish.js', { './compute': './compute.js', '@speckle/viewer': './stub.js' })
rewrite('lib/dashboard/compute.js', {
  '@/lib/aggregate': '../aggregate.js',
  '@speckle/viewer': './stub.js'
})
rewrite('lib/aggregate.js', { '@speckle/viewer': './dashboard/stub.js' })
writeFileSync(join(out, 'lib/dashboard/stub.js'), 'export {}\n')

const finish = await import(join(out, 'lib/dashboard/finish.js'))

// --- フィクスチャ: ユーザーの Revit プロパティパネルを再現 ---
// 部屋 (ids r1,r2) / 罠: designOption.name, 他カテゴリの name
const P = 'properties.Parameters.Instance Parameters'
const roomIds = ['r1', 'r2']
const str = (key, value, ids) => ({ key, type: 'string', objectCount: ids.length, valueGroups: [{ value, ids }] })

const props = [
  // 罠 1: デザインオプション名 (全要素が持つ)
  str('designOption.name', 'デザイン オプション', ['r1', 'r2', 'w1', 'x1']),
  // 罠 2: ルート name (部屋以外の要素ではタイプ名)
  str('name', '書庫', ['r1']),
  // 部屋のビルトイン「名前」パラメータ
  str(`${P}.識別情報.名前.value`, '書庫', ['r1']),
  str(`${P}.識別情報.名前.value`, '会議室', ['r2']),
  // 部屋番号
  str(`${P}.識別情報.番号.value`, '101', ['r1']),
  // レベル
  str('level.name', '1FL', ['r1', 'r2', 'w1']),
  // TD_ パラメータ群 (スクリーンショットの命名そのまま)
  str(`${P}.文字.TD_共通_備考.value`, '不燃', roomIds),
  str(`${P}.文字.TD_共通_天井高さ.value`, 'CH:2600', roomIds),
  str(`${P}.文字.TD_共通_室名（仕上表）.value`, '書庫', roomIds),
  str(`${P}.文字.TD_共通_床仕上レベル.value`, 'FL+2', roomIds),
  str(`${P}.文字.TD_壁_下地_壁符号.value`, 'W-5', roomIds),
  str(`${P}.文字.TD_壁_仕上_仕様.value`, '仕様A', roomIds),
  str(`${P}.文字.TD_壁_仕上_名称.value`, 'ビニルクロス貼', roomIds),
  str(`${P}.文字.TD_壁_仕上_工法.value`, '工法B', roomIds),
  str(`${P}.文字.TD_床_仕上_名称.value`, 'タイルカーペット', roomIds),
  str(`${P}.文字.TD_天井_仕上_名称.value`, '岩綿吸音板', roomIds),
  str(`${P}.文字.TD_巾木_仕上_名称.value`, 'ソフト巾木', roomIds),
  str(`${P}.文字.TD_廻り縁_仕上_名称.value`, '塩ビ廻り縁', roomIds),
  // 罠 3: 部屋以外 (壁) の TD_ パラメータ → 候補に出てはいけない
  str(`${P}.文字.TD_壁体_専用.value`, 'X', ['w1'])
]

// --- 検証 ---
const roomIdSet = new Set(roomIds)
const roomProps = finish.roomScopedProps(props, roomIdSet)
const nameKey = finish.guessRoomNameKey(roomProps)
const numberKey = finish.guessRoomNumberKey(roomProps)
const levelKey = finish.guessLevelKey(roomProps)
const cols = finish.guessFinishKeys(roomProps)

let failed = 0
const expect = (label, actual, expected) => {
  const ok = actual === expected
  if (!ok) failed++
  console.log(`${ok ? '✅' : '❌'} ${label}: ${actual || '(空)'}${ok ? '' : `  ← 期待: ${expected}`}`)
}

expect('部屋名 (名前パラメータ優先)', nameKey, `${P}.識別情報.名前.value`)
expect('番号', numberKey, `${P}.識別情報.番号.value`)
expect('レベル', levelKey, 'level.name')
expect('床 → TD_床_仕上_名称', cols.floorKey, `${P}.文字.TD_床_仕上_名称.value`)
expect('壁 → TD_壁_仕上_名称', cols.wallKey, `${P}.文字.TD_壁_仕上_名称.value`)
expect('天井 → TD_天井_仕上_名称', cols.ceilingKey, `${P}.文字.TD_天井_仕上_名称.value`)
expect('巾木 → TD_巾木_仕上_名称', cols.skirtingKey, `${P}.文字.TD_巾木_仕上_名称.value`)
expect('廻り縁 → TD_廻り縁_仕上_名称', cols.corniceKey, `${P}.文字.TD_廻り縁_仕上_名称.value`)

// 部屋スコープの TD_ 候補に、部屋以外の TD_ が混ざっていないこと
const tdKeys = roomProps.filter((p) => finish.isTdKey(p.key)).map((p) => p.key)
const leaked = tdKeys.filter((k) => k.includes('TD_壁体_専用'))
expect('部屋以外の TD_ が候補に漏れない', leaked.length, 0)
// 部屋名候補に designOption.name が選ばれていないこと
expect('designOption.name を部屋名に選ばない', nameKey.includes('designOption') ? 'NG' : 'OK', 'OK')

console.log(failed === 0 ? '\n🎉 全テスト合格' : `\n💥 ${failed} 件失敗`)
process.exit(failed === 0 ? 0 : 1)
