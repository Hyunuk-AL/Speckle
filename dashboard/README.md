# Speckle PoC ダッシュボード (Step 3 / Step 4)

self-host した Speckle Server に接続し、Revit から Publish したモデルに対して
Speckle Intelligence 相当の集計・可視化を行う Web アプリ。

## 機能

| 機能 | 実装 |
|------|------|
| 3D ビューワ埋め込み | `@speckle/viewer` (Three.js ベース) |
| 集計表 | ロード済みオブジェクトの全プロパティから「グループ軸」「集計値 (合計)」を選択して集計 |
| 表 → ビュー連携 | 行クリック → `FilteringExtension.isolateObjects()` で該当要素を分離表示 + ズーム |
| ビュー → 表連携 | 3D 上で要素クリック → 該当する集計行をハイライト + スクロール |
| 色分け表示 | グループごとに `setUserObjectColors()` で着色 (ALBS「色分け作成」の Web 再現) |
| グラフ | 円グラフ (件数構成比) / 棒グラフ (集計値)。クリックで分離表示連動 (ECharts) |
| テクスチャ適用 (実験的) | マテリアル名 → テクスチャのマッピング定義 (`public/textures/mapping.json`) をクライアント側で適用 |

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
