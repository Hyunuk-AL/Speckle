# Step 2: Revit データ送信と GraphQL クエリ集

ゴール: ALBS テストモデルのパラメータが GraphQL で取得・集計できることを確認する。

---

## 1. Revit コネクタのセットアップ

1. [Speckle Connector v3 (Revit)](https://docs.speckle.systems/connectors/revit/revit) をインストール
2. Revit → Speckle タブ → アカウント追加 → **サーバー URL に `http://localhost` を指定**してログイン
3. ALBS テストモデル(壁・ドア・窓タイプ、ALBS パラメータ付与済み)を開き、
   対象要素を選択して **Publish**
4. ブラウザで http://localhost のプロジェクトページにバージョンが増えたことを確認

## 2. GraphQL Explorer での調査手順

http://localhost/graphql を開き、右上で Personal Access Token を設定する。

### 2-1. プロジェクト / モデル / バージョン ID の取得

```graphql
query Projects {
  activeUser {
    projects(limit: 10) {
      items {
        id
        name
        models(limit: 10) {
          items {
            id
            name
            versions(limit: 5) {
              items {
                id
                referencedObject   # ← ルートオブジェクト ID (children クエリで使う)
                createdAt
                sourceApplication
              }
            }
          }
        }
      }
    }
  }
}
```

### 2-2. データ構造の確認(最重要)

まず 1〜2 オブジェクトの `data` を丸ごと取得し、**ALBS パラメータの実際のパス**を確認する:

```graphql
query InspectObjects($projectId: String!, $rootObjectId: String!) {
  project(id: $projectId) {
    object(id: $rootObjectId) {
      children(limit: 2, depth: 100) {
        totalCount
        objects {
          id
          data   # 生 JSON。properties.Parameters.* のパスをここで確認する
        }
      }
    }
  }
}
```

Revit Connector v3 の一般的な格納パス(モデルにより異なるため必ず実データで確認):

| 内容 | パス(例) |
|------|----------|
| カテゴリ | `category` |
| レベル | `level.name` |
| ファミリ / タイプ | `family`, `type` |
| インスタンスパラメータ | `properties.Parameters.Instance Parameters.<グループ名>.<パラメータ名>.value` |
| タイプパラメータ | `properties.Parameters.Type Parameters.<グループ名>.<パラメータ名>.value` |
| ALBS 共有パラメータ | 上記 Instance/Type Parameters 配下の該当グループ内(要確認) |
| レンダーマテリアル | `renderMaterial.name`(v3 ではルートの `renderMaterialProxies` の場合あり) |

→ 確認結果は本ファイル末尾の「パラメータパス対応表」に追記していく。

### 2-3. カテゴリで絞った集計クエリ(計画書の試作クエリ)

```graphql
query WallAreas($projectId: String!, $rootObjectId: String!) {
  project(id: $projectId) {
    object(id: $rootObjectId) {
      children(
        limit: 1000
        depth: 100
        query: [{ field: "category", operator: "=", value: "Walls" }]
        select: [
          "category",
          "level.name",
          "properties.Parameters.Instance Parameters.Dimensions.Area.value"
        ]
      ) {
        totalCount
        objects {
          id
          data
        }
      }
    }
  }
}
```

> `children` の `query` / `select` の field はネストパスを `.` 区切りで指定する。
> 件数の合計・面積の合計などの集約は GraphQL 側では行えないため、
> クライアント側(ダッシュボード)で行う。`totalCount` のみサーバー側で取得可能。

### 2-4. カテゴリ別件数を調べる(カテゴリごとに totalCount)

```graphql
query CountByCategory($projectId: String!, $rootObjectId: String!) {
  project(id: $projectId) {
    object(id: $rootObjectId) {
      walls: children(query: [{ field: "category", operator: "=", value: "Walls" }]) { totalCount }
      doors: children(query: [{ field: "category", operator: "=", value: "Doors" }]) { totalCount }
      windows: children(query: [{ field: "category", operator: "=", value: "Windows" }]) { totalCount }
    }
  }
}
```

## 3. パラメータパス対応表(調査結果を記入)

| ALBS パラメータ名 | 種別 (Instance/Type) | GraphQL パス | 備考 |
|------------------|---------------------|--------------|------|
| (例) ALBS_部材コード | Instance | `properties.Parameters.Instance Parameters.ALBS.ALBS_部材コード.value` | 要実測 |
|  |  |  |  |

## 4. 補足: ダッシュボード側での集計方針

ダッシュボード(Step 3)では、Viewer SDK がロード済みオブジェクトの全プロパティを
`viewer.getObjectProperties()` で列挙できるため、**集計はビューワのロード結果から
クライアント側で実施**する。これにより:

- パラメータパスを事前に確定しなくても、存在するプロパティ一覧から選択できる
- 集計行 ↔ 3D オブジェクト ID の対応が自然に取れる(双方向連携に必須)

GraphQL の `children` クエリは、ビューワを介さないバッチ集計
(webhook + PostgreSQL 抽出方式へ移行する場合)の手段として位置づける。
