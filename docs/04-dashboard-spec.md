# ダッシュボードビルダー 仕様書 (Speckle Intelligence 相当 / 自作)

作成日: 2026-06-15
対象: PoC 自作ダッシュボード (`dashboard/`) の再構築
位置づけ: PoC 計画書 Step 3「オリジナルダッシュボードの自作 (Intelligence 相当)」の詳細仕様

---

## 1. 目的と背景

Speckle の **Intelligence / Dashboards** 機能 (ホステッドクラウド専用) に相当する
**ダッシュボードビルダー** を self-host 環境向けに自作する。

ユーザーが **左のウィジェットメニューから部品 (カード) を選んで右のボードに配置**し、
3D ビュー・集計カード・グラフ・表などを自由に組み合わせて、自分専用の
ダッシュボードを構築・保存できるようにする。

### Speckle 公式 Dashboards の主な仕様 (参考・調査結果)

- 左サイドバーのウィジェットパレットから **ドラッグ&ドロップ**でボードに配置
- ウィジェットは **リサイズ・並べ替え**可能、Section でグループ化
- 主なウィジェット: **Model Viewer / Element count / Element table / Property Checker / Chart / Section**
- **ページレベルフィルタ**で全ウィジェットを横断的に絞り込み
- **グラフをインタラクティブなフィルタとして使用**(クロスフィルタ、多段フィルタ)
- テーマ (グラフ色) の選択、表の CSV エクスポート

出典:
- [Get insights (Speckle Dashboards)](https://speckle.systems/dashboards-and-insights/)
- [Common workflows (Speckle Docs)](https://docs.speckle.systems/analytics/dashboards/common-workflows)
- [Get started with Speckle Intelligence](https://speckle.systems/tutorials/design-and-bim-data-analytics-made-easy-get-started-with-speckle-intelligence/)

### self-host 版での制約と方針

| 制約 | 方針 |
|------|------|
| Intelligence のバックエンド (集計エンジン) は非公開 | `@speckle/viewer` の `getObjectProperties()` で取得した全プロパティを使い、**集計はクライアント側**で実施(既存実装を踏襲) |
| ホステッド版のような永続保存基盤がない | ダッシュボード定義 (レイアウト+各カード設定) を **JSON** にシリアライズし、まず localStorage、将来は Speckle のコメント/添付 or 自前 API に保存 |

---

## 2. 全体レイアウト

```
┌──────────────┬─────────────────────────────────────────────┐
│ 左: パレット  │ 右: ダッシュボードボード (グリッド)            │
│              │  ┌─────────┐ ┌──────┐ ┌──────┐               │
│ ▸ 基本        │  │ 3D View │ │ KPI  │ │ KPI  │               │
│   - 3Dビュー  │  │         │ ├──────┴─┴──────┤               │
│   - KPI       │  │         │ │   Bar Chart   │               │
│   - テキスト  │  ├─────────┤ ├───────────────┤               │
│ ▸ チャート    │  │  Table  │ │   Pie Chart   │               │
│   - 棒/円/折線 │  └─────────┘ └───────────────┘               │
│ ▸ 表          │                                              │
│ ▸ フィルタ    │  [編集モード]ドラッグ移動・リサイズ・削除      │
│ ▸ 検証        │  [閲覧モード]操作のみ (クロスフィルタ)         │
└──────────────┴─────────────────────────────────────────────┘
   上部バー: モデル選択 / 保存 / 編集⇄閲覧トグル / テーマ / リセット
```

- **左パレット**: ウィジェットをカテゴリ別に一覧。クリック or ドラッグでボードに追加
- **右ボード**: グリッド (react-grid-layout 想定)。カードを自由配置・リサイズ・並べ替え
- **編集モード / 閲覧モード** を切り替え。閲覧モードではレイアウト固定、操作(フィルタ・選択)のみ
- ダッシュボード定義は **JSON で保存/復元**

---

## 3. データモデル

### 3.1 共通データソース

1 ダッシュボードは **1 つ以上のロード済みモデル**を対象とする。
ビューワにロードしたオブジェクトの `PropertyInfo[]`(`getObjectProperties()` の結果)が
全カードの共通データソース。各カードはここから

- **グループ軸 (group by)**: 文字列プロパティ (category / level.name / family / ALBS パラメータ等)
- **集計値 (measure)**: 数値プロパティ (面積 / 体積 / 長さ等)
- **集計方法 (aggregation)**: `count` / `sum` / `avg` / `min` / `max`
- **フィルタ (filter)**: プロパティ条件 (=, ≠, >, <, contains, 範囲)

を選んで利用する。集計結果の各グループは **オブジェクト ID 群**を保持し、
3D ビューの選択/分離/色分け・クロスフィルタに使う(既存の `aggregate.ts` を拡張)。

> ID は `raw.id`(集計用)→ `model.id`(描画用)への変換を既存の
> `resolveRenderableIds` で吸収する。

### 3.2 ダッシュボード定義 (JSON スキーマ)

```jsonc
{
  "version": 1,
  "name": "ALBS 集計ダッシュボード",
  "dataSource": { "projectId": "...", "modelIds": ["..."] },
  "theme": { "palette": "default" },
  "globalFilters": [
    { "key": "level.name", "op": "=", "value": "1FL" }
  ],
  "widgets": [
    {
      "id": "w1",
      "type": "viewer",
      "title": "3D ビュー",
      "layout": { "x": 0, "y": 0, "w": 6, "h": 8 },
      "config": { "syncMode": "highlight" }   // highlight | isolate
    },
    {
      "id": "w2",
      "type": "kpi",
      "title": "壁の総面積",
      "layout": { "x": 6, "y": 0, "w": 3, "h": 2 },
      "config": {
        "measure": "properties...Area.value",
        "aggregation": "sum",
        "filters": [{ "key": "category", "op": "=", "value": "Walls" }],
        "unit": "m²"
      }
    },
    {
      "id": "w3",
      "type": "chart",
      "title": "カテゴリ別件数",
      "layout": { "x": 6, "y": 2, "w": 6, "h": 4 },
      "config": {
        "chartType": "bar",          // bar | pie | donut | line | hbar
        "groupBy": "category",
        "measure": null,             // null = 件数
        "aggregation": "count",
        "actsAsFilter": true         // クリックで他カードを絞り込む
      }
    },
    {
      "id": "w4",
      "type": "table",
      "title": "要素一覧",
      "layout": { "x": 0, "y": 8, "w": 6, "h": 5 },
      "config": {
        "columns": ["category", "level.name", "type", "properties...Area.value"],
        "sort": { "key": "category", "dir": "asc" }
      }
    }
  ]
}
```

---

## 4. ウィジェット一覧

| # | ウィジェット | 概要 | 主な設定 | Speckle 対応 |
|---|-------------|------|---------|-------------|
| 1 | **3D ビュー (Viewer)** | モデルの 3D 表示。他カードと選択連動 | 同期方式 (ハイライト/分離)、カメラ初期視点 | Model Viewer |
| 2 | **KPI / 数値カード** | 単一の集計値を大きく表示 | measure・集計方法・フィルタ・単位・前提条件 | Element count (Total) |
| 3 | **チャート** | 棒/横棒/円/ドーナツ/折れ線 | chartType・group by・measure・集計方法・フィルタ・クロスフィルタ ON/OFF | Chart |
| 4 | **テーブル (Element table)** | 要素ごとの行 × 選択プロパティ列 | 表示列・ソート・フィルタ・CSV エクスポート | Element table |
| 5 | **フィルタ** | ボード全体に効くスライサー | 対象プロパティ・選択肢 (チェック/スライダー) | ページレベルフィルタ |
| 6 | **セクション** | 見出し付きの区切り(グループ化) | タイトル・折りたたみ | Section |
| 7 | **テキスト** | 説明・注記 (Markdown) | 本文 | (Text) |
| 8 | **プロパティチェッカー (検証)** | ルールで要素を検証し合否を集計 | ルール条件 (複数)・合否表示・該当要素抽出 | Property Checker |

### 4.1 各ウィジェットの動作詳細

#### 1) 3D ビュー
- モデルをロードして表示。複数モデル指定時はすべて重畳ロード
- 他カード(チャート/表/KPI/フィルタ)の選択に連動して `selectObjects`(ハイライト)
  または `isolateObjects`(分離)。`color分け` も対応
- 3D 上のクリック → 選択要素を全カードのハイライト対象に反映(逆方向連動)

#### 2) KPI / 数値カード
- `count`(件数) または `sum/avg/min/max`(数値プロパティ)を 1 値表示
- フィルタで対象を限定(例: category = Walls の総面積)
- 任意で前期比・目標値・単位を表示。クリックで該当要素を 3D 選択

#### 3) チャート
- 種類: **棒 / 横棒 / 円 / ドーナツ / 折れ線**(ECharts)
- group by 軸でグループ化、measure (なければ件数) を集計
- `actsAsFilter: true` のとき、**要素クリックでそのグループを全カードのフィルタに追加**
  (クロスフィルタ)。複数チャートで多段フィルタ可能
- 凡例・データラベル・並び順(値/名前)・上位 N 件表示

#### 4) テーブル
- 行 = 要素、列 = 選択したプロパティ。全プロパティから列を追加可能
- ソート・列フィルタ・行クリックで 3D 選択
- **CSV エクスポート**(合否や絞り込み結果のレポート用)

#### 5) フィルタ
- 文字列: 値のチェックボックス一覧 / 数値: レンジスライダー
- 選択は `globalFilters` に反映され、全カード+3D ビューを横断的に絞り込む

#### 6) セクション
- ボードを意味単位で区切る見出し。折りたたみで整理

#### 7) テキスト
- Markdown を表示。ダッシュボードの説明・凡例・出典など

#### 8) プロパティチェッカー (検証)
- 「category = Walls かつ FireRating が未設定」などのルールを複数定義
- 合格/不合格の件数と割合を表示、不合格要素を 3D で強調 + 表で抽出 → CSV

---

## 5. インタラクション仕様

### 5.1 クロスフィルタ(肝)
- いずれかのカードで値を選択(チャートのバー/円、表の行、フィルタの選択)すると、
  選択が **アクティブフィルタ**としてボード全体に適用される
- 全カードは「globalFilters + 自カードのfilters + アクティブフィルタ」で再集計
- 3D ビューはアクティブフィルタ対象を **ハイライト / 分離**
- フィルタチップ(画面上部)で現在の絞り込みを可視化・個別解除

### 5.2 選択同期
- カード → 3D: 選択グループの ID を `resolveRenderableIds` で変換し
  `selectObjects` / `isolateObjects` / `setUserObjectColors`
- 3D → カード: クリックした要素 ID を含む行/グループをハイライト

### 5.3 編集 / 閲覧モード
- 編集: ドラッグ移動・リサイズ・追加・削除・設定編集
- 閲覧: レイアウト固定。操作(フィルタ・選択・エクスポート)のみ

---

## 6. アーキテクチャ(実装方針)

| レイヤー | 技術 | 備考 |
|---------|------|------|
| グリッドレイアウト | `react-grid-layout` | ドラッグ・リサイズ・レスポンシブ |
| 3D | `@speckle/viewer` (既存) | 1 ダッシュボードで 1 ビューワインスタンスを共有 |
| 集計 | 既存 `lib/aggregate.ts` を拡張 | aggregation 種別・複数フィルタ対応 |
| グラフ | `echarts` (既存) | 種類追加・クロスフィルタイベント |
| 状態管理 | React Context + reducer | ダッシュボード定義・アクティブフィルタを集中管理 |
| 保存 | localStorage (PoC) → 将来 API | JSON シリアライズ |

### 推奨ディレクトリ構成(再構築後)

```
dashboard/
  app/
    dashboard/page.tsx        ← ボード本体 (グリッド + パレット + 上部バー)
  components/
    board/
      DashboardGrid.tsx       グリッドとカード配置
      WidgetPalette.tsx       左パレット
      WidgetFrame.tsx         カードの枠 (タイトル/設定/削除)
      widgets/
        ViewerWidget.tsx
        KpiWidget.tsx
        ChartWidget.tsx
        TableWidget.tsx
        FilterWidget.tsx
        SectionWidget.tsx
        TextWidget.tsx
        PropertyCheckWidget.tsx
    SpeckleViewer.tsx         ← 既存を共有ビューワ化
  lib/
    dashboard/
      types.ts                ダッシュボード定義の型
      store.tsx               Context + reducer (定義/フィルタ)
      persistence.ts          JSON 保存/復元
    aggregate.ts              ← 拡張
```

---

## 7. 段階実装計画(マイルストーン)

| 段階 | 内容 | 完了条件 |
|------|------|---------|
| **M1** 骨組み | グリッド + パレット + 編集/閲覧トグル + JSON 保存/復元 | カードを追加・移動・リサイズして保存→再読込できる |
| **M2** 主要カード | Viewer / KPI / Chart / Table の 4 種をデータ連動で実装 | 各カードがプロパティ設定で集計表示できる |
| **M3** クロスフィルタ | アクティブフィルタ機構 + 全カード連動 + 3D 同期 | チャートクリックで全カード+3D が絞り込まれる |
| **M4** 拡張カード | Filter / Section / Text / PropertyChecker | 検証ルールで合否抽出 + CSV |
| **M5** 仕上げ | テーマ・上位N・レスポンシブ・既定テンプレート | 既定ダッシュボードが 1 クリックで作れる |

> 既存実装(集計・グラフ・色分け・選択同期・テクスチャ)は M2/M3 に取り込んで再利用する。
> テクスチャ適用は当面ツールバー機能として温存。

---

## 8. PoC 評価基準との対応 (計画書 §6)

| Exit Criteria | 本仕様での実現 |
|--------------|---------------|
| 集計表の行クリック → 3D 分離表示 | Table/Chart カード → Viewer の選択同期 (M3) |
| パラメータ値による色分け | Viewer カードの color分けモード (M2/M3) |
| ALBS パラメータでの集計 | group by / measure に全プロパティを選択可能 (M2) |

---

## 9. 未確定事項(要確認)

- **添付画像のウィジェット**: 今回未受領。特定の見た目(例: 特定のチャート/カード)に
  寄せたい場合は再添付いただきたい
- **保存先**: PoC は localStorage で開始。チーム共有が必要なら保存 API を別途検討
- **複数モデル対応**の優先度(まず単一モデルで M1〜M3 を完成させる想定)
