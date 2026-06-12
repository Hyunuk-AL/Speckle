# Speckle サーバー構築・オリジナルダッシュボード PoC 計画書

作成日: 2026-06-12
対象: デスクトップPC上での PoC（概念実証）
方針: **Speckle で未提供の機能（Intelligence 相当のダッシュボード、テクスチャ表示）は自作する**

---

## 1. 背景と目的

[speckle-server](https://github.com/specklesystems/speckle-server)（OSS）を自社環境に構築し、
Revit からアップロードしたデータのパラメータを活用して、Speckle cloud の
Intelligence 機能に相当する **オリジナルダッシュボード** を構築する。

ダッシュボードでは以下を実現する。

- Revit データ（rvt）の 3D ビューと各種集計表の **双方向連携**
- パラメータ値による色分け・フィルタ表示
- マテリアルテクスチャの Speckle ビューワ上での表示

### 前提となる制約（調査結果）

| # | 制約 | 対応方針 |
|---|------|---------|
| 1 | Speckle Intelligence / Workspaces はホステッドクラウド専用で、self-host 版には未提供 | GraphQL API + Viewer SDK で **ダッシュボードを自作** |
| 2 | Revit コネクタは画像テクスチャ（JPG/PNG）を転送しない（RenderMaterial の PBR 数値のみ） | マテリアル名をキーにした **テクスチャライブラリをクライアント側で適用**（自作） |

---

## 2. PoC 実施環境

| 項目 | 内容 |
|------|------|
| マシン | 一般デスクトップPC（Revit が動作する Windows 機を想定） |
| OS | Windows 10/11 + WSL2 + Docker Desktop |
| RAM | 16GB 推奨（Speckle 一式で 4〜8GB 消費。`.wslconfig` で `memory=8GB` 程度を明示） |
| ディスク | 20〜30GB 以上の空き |
| Revit | Autodesk Revit 2024（ALBS 環境）+ Speckle Connector v3 |
| サーバーURL | `http://localhost`（PoC 中は同一PC内で完結） |

> **補足**: 同じPCで Revit → Publish → ブラウザ確認の最短ループが組める。
> チーム公開段階で社内サーバー / クラウドVMへ docker compose 一式と DB ダンプを移行する二段構えとする。

---

## 3. PoC ステップ

### Step 1: speckle-server の構築（ローカル）

**ゴール**: `http://localhost` で Speckle フロントエンドが表示され、アカウント作成・プロジェクト作成ができる。

1. Docker Desktop（WSL2 バックエンド）をセットアップ
   - 「Start Docker Desktop when you sign in」を有効化
   - `.wslconfig` でメモリ上限を設定
2. `specklesystems/speckle-server` リポジトリの compose ファイルで起動
   - `docker-compose-deps.yml` … PostgreSQL / Valkey / MinIO
   - `docker-compose-speckle.yml` … server / frontend-2 / preview-service / webhook-service / fileimport-service
   - 各コンテナに `restart: always` を設定
3. 環境変数の設定
   - `CANONICAL_URL=http://localhost`
   - 管理者アカウントの作成
4. 動作確認
   - ブラウザでフロントエンド表示・ログイン
   - `http://localhost/explorer` で GraphQL Explorer が開くこと

**成果物**: 起動手順書（compose ファイル一式 + `.env`）、トラブルシュートメモ

---

### Step 2: Revit データの送信とパラメータ構造の確認

**ゴール**: ALBS テストモデルのパラメータが GraphQL で取得・集計できることを確認する。

1. Revit に Speckle Connector v3 をインストール
2. コネクタのアカウント追加でサーバーURL `http://localhost` を指定
3. ALBS テストモデル（壁・ドア・窓タイプ、ALBS パラメータ付与済み）を Publish
4. GraphQL Explorer でデータ構造を調査
   - カテゴリ / レベル / タイプ・インスタンスパラメータの `properties` 内のパス
   - ALBS 固有パラメータ（共有パラメータ）の格納位置
5. 集計クエリの試作

```graphql
query {
  project(id: "...") {
    object(id: "...") {
      children(
        query: [{ field: "category", operator: "=", value: "Walls" }]
        select: ["category", "level.name",
                 "properties.Parameters.Instance Parameters.Dimensions.Area.value"]
      ) { totalCount objects { data } }
    }
  }
}
```

**成果物**: パラメータパス一覧（ALBS パラメータ → GraphQL パスの対応表）、集計クエリ集

---

### Step 3: オリジナルダッシュボードの自作（Intelligence 相当）

**ゴール**: 3D ビューと集計表が双方向に連携する Web ダッシュボードのα版。

#### アーキテクチャ

| レイヤー | 技術 | 備考 |
|---------|------|------|
| 3D ビュー | `@speckle/viewer`（Three.js ベース） | 自作アプリに埋め込み |
| データ取得 | GraphQL API + Personal Access Token | Apollo Client 等 |
| フロントエンド | Next.js または Nuxt + グラフライブラリ（ECharts / Chart.js） | |
| 集計の高速化（任意） | webhook で新バージョン検知 → パラメータを PostgreSQL に抽出 | PoC 後半で判断 |

#### 実装する機能

1. **ビューワ埋め込み**: プロジェクト / モデル / バージョンを指定して 3D 表示
2. **集計表**: カテゴリ別・レベル別・ALBS パラメータ別の件数 / 面積 / 体積集計
3. **表 → ビュー連携**: 行クリック → 該当要素を `FilteringExtension.isolateObjects()` で分離表示
4. **ビュー → 表連携**: 3D 上で要素クリック → 表側の該当行をハイライト
5. **色分け表示**: パラメータ値ごとの `setUserObjectColors()`（ALBS「色分け作成」の Web 再現）
6. **グラフウィジェット**: 円グラフ / 棒グラフ（要素数、面積構成比 等）

**成果物**: ダッシュボード Web アプリ（ローカル起動）、機能デモ動画 or スクリーンショット

---

### Step 4: マテリアルテクスチャ表示の自作

**ゴール**: Revit のマテリアルに対応したテクスチャが Speckle ビューワ上に表示される。

> Speckle はテクスチャ完全対応をロードマップに載せているが現時点で未提供のため、**クライアント側適用方式で自作**する。

1. **テクスチャライブラリの整備**
   - Revit のマテリアル名（または Arch-LOG ファミリのマテリアルパラメータ）をキーに、
     テクスチャ画像（JPG/PNG）+ タイリング情報（UVスケール等）を管理
   - 置き場所: MinIO（Speckle と同居）または静的ファイルサーバー
   - マッピング定義: JSON（`マテリアル名 → { textureUrl, tiling, ... }`）から開始し、
     将来的に Arch-LOG 建材DBとの API 連携を視野に入れる
2. **ビューワ側の適用処理**
   - ロード完了後、各オブジェクトの RenderMaterial 名 / マテリアルパラメータを読み取り
   - Viewer SDK のマテリアル API（内部は Three.js `MeshStandardMaterial`）で
     テクスチャマップ（map / normalMap 等）を適用
3. **検証項目**
   - UV 座標の品質（壁・床など面要素でのタイリングの見え方）
   - パフォーマンス（テクスチャ数・解像度とフレームレート）

**成果物**: テクスチャマッピング定義（JSON スキーマ）、適用モジュール、検証レポート

---

## 4. スケジュール目安

| 週 | 内容 |
|----|------|
| 1週目 | Step 1: サーバー構築・動作確認 |
| 1〜2週目 | Step 2: Revit 送信・パラメータ構造調査・クエリ試作 |
| 3〜5週目 | Step 3: ダッシュボードα版（ビューワ埋め込み → 集計表 → 双方向連携 → 色分け） |
| 6〜7週目 | Step 4: テクスチャライブラリ + 適用モジュール |
| 8週目 | 全体デモ・評価・本番化（サーバー移行）の判断 |

---

## 5. リスクと対応

| リスク | 影響 | 対応 |
|--------|------|------|
| ALBS 共有パラメータがコネクタで送信されない / パスが深く扱いにくい | 集計表が組めない | Step 2 で最優先に確認。必要なら Revit 側でパラメータマッピング設定を調整 |
| 大規模モデルでビューワ / 集計が重い | UX 低下 | モデル分割送信、webhook + DB 抽出方式へ切替 |
| UV 座標が貧弱でテクスチャが綺麗に貼れない | 見た目品質 | 面要素はボックスマッピング等のフォールバックを実装。要素種別ごとに方式を検証 |
| `CANONICAL_URL` を後から変更するとデータ参照が崩れる | 移行コスト | PoC データは捨てる前提とし、本番移行時に再送信する運用にする |
| デスクトップPCのスリープ / 再起動でコンテナ停止 | デモ中断 | 電源設定の見直し + `restart: always` |

---

## 6. PoC の評価基準（Exit Criteria)

1. Revit から Publish した ALBS モデルのパラメータが GraphQL で取得・集計できる
2. ダッシュボード上で「集計表の行クリック → 3D で該当要素が分離表示」が動作する
3. パラメータ値による色分け表示が動作する
4. 代表的なマテリアル 5〜10 種についてテクスチャ表示が成立する
5. 上記が一般デスクトップPC 1台で安定稼働する

達成後、本番環境（社内サーバー / クラウドVM、TLS、バックアップ、認証連携）への移行計画を別途策定する。

---

## 7. 参考リンク

- [speckle-server（GitHub）](https://github.com/specklesystems/speckle-server)
- [Hosting Your Own Speckle Server](https://docs.speckle.systems/developers/server/introduction)
- [Getting Started（Docker Compose）](https://docs.speckle.systems/developers/server/getting-started)
- [GraphQL API reference](https://docs.speckle.systems/developers/api/graphql)
- [Revit Connector](https://docs.speckle.systems/connectors/revit/revit)
- [Workspaces FAQ（self-host での Intelligence 未提供について）](https://speckle.guide/workspaces/faqs.html)
- [Dashboards & Insights（機能イメージの参考）](https://speckle.systems/dashboards-and-insights/)
