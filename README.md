# Speckle サーバー構築・オリジナルダッシュボード PoC

[speckle-server](https://github.com/specklesystems/speckle-server) (OSS) をローカル PC に構築し、
Revit から Publish したデータのパラメータを使って Speckle Intelligence 相当の
**オリジナルダッシュボード** を自作する PoC。

計画の全体像は [docs/poc-plan.md](./docs/poc-plan.md) を参照。

## リポジトリ構成

```
├── server/        Step 1: Speckle Server 一式 (Docker Compose / 公開イメージ使用)
│   ├── docker-compose-deps.yml      PostgreSQL / Valkey / MinIO
│   ├── docker-compose-speckle.yml   server / frontend-2 / preview / webhook / (fileimport)
│   └── .env.example                 環境変数テンプレート
├── dashboard/     Step 3-4: オリジナルダッシュボード (Next.js + @speckle/viewer)
└── docs/
    ├── poc-plan.md                  PoC 計画書
    ├── 01-server-setup.md           Step 1 起動手順書 (Windows + WSL2 + Docker Desktop)
    ├── 02-revit-and-graphql.md      Step 2 Revit 送信 + GraphQL クエリ集
    ├── 03-operations.md             日常運用ガイド (起動/終了/確認/更新の反映)
    ├── 04-dashboard-spec.md         ダッシュボードビルダー仕様書 (Intelligence 相当)
    └── troubleshooting.md           トラブルシュートメモ
```

## クイックスタート

### 1. Speckle Server を起動 (詳細: [docs/01-server-setup.md](./docs/01-server-setup.md))

```bash
cd server
cp .env.example .env          # SESSION_SECRET を必ず設定 (openssl rand -hex 32)
docker compose -f docker-compose-deps.yml up -d
docker compose -f docker-compose-speckle.yml up -d
```

→ http://localhost でアカウント登録 (最初のユーザーが管理者になる)

### 2. Revit からモデルを Publish (詳細: [docs/02-revit-and-graphql.md](./docs/02-revit-and-graphql.md))

Speckle Connector v3 のアカウント追加でサーバー URL `http://localhost` を指定して Publish。

### 3. ダッシュボードを起動 (詳細: [dashboard/README.md](./dashboard/README.md))

```bash
cd dashboard
npm install
npm run dev                   # → http://localhost:3000
```

Personal Access Token で接続し、モデルを開くと
**集計表・グラフ ↔ 3D ビューの双方向連携 / 色分け / テクスチャ適用** が使える。

## PoC 評価基準との対応

| Exit Criteria (計画書 §6) | 状態 |
|---------------------------|------|
| 1. ALBS パラメータが GraphQL で取得・集計できる | クエリ集を用意 (docs/02)。実モデルでの確認は Revit 環境で実施 |
| 2. 集計行クリック → 3D 分離表示 | ダッシュボード実装済み |
| 3. パラメータ値による色分け表示 | ダッシュボード実装済み |
| 4. マテリアル 5〜10 種のテクスチャ表示 | 適用モジュール + マッピング定義実装済み。実テクスチャでの検証は Step 4 で実施 |
| 5. デスクトップ PC 1台で安定稼働 | restart: always / メモリ上限ガイドを整備。実機検証は Step 1 で実施 |
