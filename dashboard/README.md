# Speckle PoC ダッシュボード (Step 3 / Step 4)

self-host した Speckle Server に接続し、Revit から Publish したモデルに対して
Speckle Intelligence 相当の集計・可視化を行う Web アプリ。

現在、**ダッシュボードビルダー方式へ再構築中**です。仕様は
[../docs/04-dashboard-spec.md](../docs/04-dashboard-spec.md) を参照。

## 実装状況 (マイルストーン)

| 段階 | 内容 | 状態 |
|------|------|------|
| **M1** | ビルダー骨組み (グリッド + パレット + 編集/閲覧 + JSON 保存/復元) | ✅ 実装済み |
| **M2** | 主要カード (Viewer / KPI / Chart / Table) のデータ連動 | ✅ 実装済み |
| M3 | クロスフィルタ + 3D 選択同期 | 一部実装 (カード→3Dハイライト連動) |
| M4 | 拡張カード (Filter / Section / Text / 検証) | 未着手 |
| M5 | テーマ / 上位N / レスポンシブ / 既定テンプレート | 未着手 |

### M2 でできること

- **3D ビューカードがデータ源**になり、読み込んだモデルのプロパティを共有
  (`DashboardDataProvider`)。KPI/チャート/テーブルが同じデータを参照する
- **KPI カード**: 件数 / 合計 / 平均 / 最小 / 最大を 1 値表示。プロパティ値で絞り込み・単位指定
- **チャートカード**: 棒/円グラフ。グループ軸・集計方法・数値プロパティを選択 (ECharts)
- **テーブルカード**: 任意のプロパティを列に選んでオブジェクト一覧を表示
- 各カードは編集モードで設定バーから集計内容を変更でき、設定も自動保存される

> KPI/チャート/テーブルは **3D ビューカードを 1 つ追加**してモデルが読み込まれると
> データが表示される (ビューワがデータ源のため)。

### M1 でできること

- 左パレットからウィジェットを**クリックで追加**(3D ビュー / KPI / チャート / テーブル / フィルタ / セクション / テキスト / 検証)
- グリッド上で**ドラッグ移動・右下ハンドルでリサイズ・削除・名前変更**(編集モード)
- **編集 / 閲覧モード**の切替
- レイアウトと設定を **localStorage に自動保存**(再読込で復元)、JSON 書き出し
- **3D ビューカードは実機能**(モデルを読み込んで表示)。他カードは M2 で実装するため現在はプレースホルダ表示

> 依存追加なしの**自作グリッド (Pointer Events ベース)** で実装。
> `react-grid-layout` は内部依存が React 19 で動かないため不採用。

### 旧実装 (集計表・グラフ・色分け・テクスチャ) について

再構築前の単一画面版で作った機能 (`components/AggregationTable.tsx`,
`ChartPanel.tsx`, `lib/aggregate.ts`, `lib/textures.ts`, `lib/palette.ts`) は
**M2/M3 で各ウィジェットに取り込む**ため残してあります。

## 起動方法

```bash
cd dashboard
npm install
npm run dev      # http://localhost:3000
```

> Speckle Server (`http://localhost`) と同居できるよう、ダッシュボードは 3000 番で動く
> (Next.js のデフォルト)。本番ビルドは `npm run build && npm start`。

## 使い方

1. Speckle のフロントエンド → Developer Settings → Personal Access Token を発行
   (スコープ: `profile:read`, `streams:read` 以上)
2. http://localhost:3000 を開き、サーバー URL (`http://localhost`) とトークンを入力して接続
3. プロジェクト → モデルを選択して「開く」
4. ロード完了後、右パネルで「グループ軸」(カテゴリ / レベル / ALBS パラメータ等) と
   「集計値」(面積 / 体積等の数値パラメータ) を選ぶ

集計はビューワにロードされたオブジェクトの `viewer.getObjectProperties()` を元に
クライアント側で行うため、パラメータパスを事前に知らなくても、存在する全プロパティ
から選択できる (ALBS 共有パラメータのパス調査にも使える)。

## テクスチャ表示 (Step 4)

Revit コネクタはテクスチャ画像を転送しないため、`public/textures/mapping.json` の
マッピング定義 (マテリアル名 → テクスチャ URL + タイリング) を 3D ビューに適用する。

- 「テクスチャ適用 (実験的)」ボタンで実行。適用結果と **未マッピングのマテリアル名一覧**
  が表示されるので、それを元に mapping.json を拡充していく
- サンプルテクスチャは `node scripts/generate-sample-textures.mjs` で生成した
  プレースホルダ。実運用では Arch-LOG 等の実画像 (JPG/PNG) に差し替える
- テクスチャ画像は `public/textures/` 配下のほか、MinIO 等の URL も指定可能
- 既知の制約: Revit 由来ジオメトリの UV 座標は要素種別によって品質が異なるため、
  壁・床などの面要素で見え方の検証が必要 (計画書 §5 参照)

## 実装メモ

- `@speckle/viewer` は **2.28.0 に固定**している。2.31.x は npm に `workspace:^` 依存が
  残ったまま publish されておりインストールできないため (`package.json` の `overrides`
  で `@speckle/shared` / `@speckle/objectloader2` も同様に固定)。修正されたら更新する
- GraphQL は接続確認とプロジェクト/モデル一覧にのみ使用 (`lib/graphql.ts`、fetch ベース)。
  バッチ集計を GraphQL (`children` クエリ) で行う場合は `docs/02-revit-and-graphql.md` 参照
- トークンは PoC 簡略化のため localStorage に平文保存している。本番化時は要見直し
