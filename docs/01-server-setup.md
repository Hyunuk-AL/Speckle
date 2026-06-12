# Step 1: Speckle Server ローカル構築手順書

対象: Windows 10/11 デスクトップPC(Revit 同居)
ゴール: `http://localhost` で Speckle が表示され、アカウント作成・プロジェクト作成ができる。

---

## 1. WSL2 + Docker Desktop のセットアップ

### 1-1. WSL2 の有効化

PowerShell(管理者)で:

```powershell
wsl --install
```

再起動後、Ubuntu の初期設定(ユーザー名・パスワード)を済ませる。

### 1-2. メモリ上限の設定

Speckle 一式で 4〜8GB 消費するため、WSL2 に上限を明示する。
`C:\Users\<ユーザー名>\.wslconfig` を作成:

```ini
[wsl2]
memory=8GB
processors=4
swap=4GB
```

設定後、PowerShell で `wsl --shutdown` して反映。

### 1-3. Docker Desktop のインストール

1. [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) をインストール
2. Settings → General:
   - **Use the WSL 2 based engine** が有効であることを確認
   - **Start Docker Desktop when you sign in to your computer** を有効化(デモ中断対策)
3. Windows の電源設定でスリープを「なし」にする(デモ中断対策)

---

## 2. Speckle の起動

このリポジトリの `server/` ディレクトリを使う。PowerShell でも WSL2 シェルでも可。

### 2-1. 環境変数の設定

```bash
cd server
cp .env.example .env
```

`.env` を開き、**`SESSION_SECRET` に一意なランダム文字列を設定**する:

```bash
# WSL2 / Git Bash で生成
openssl rand -hex 32
```

他の値は PoC 中はデフォルトのままで良い(`CANONICAL_URL=http://localhost`)。

> **注意**: `CANONICAL_URL` を後から変更すると既存データの参照が崩れる。
> PoC データは捨てる前提とし、本番移行時に再送信する(計画書 §5 参照)。

### 2-2. 依存サービスの起動(PostgreSQL / Valkey / MinIO)

```bash
docker compose -f docker-compose-deps.yml up -d
docker compose -f docker-compose-deps.yml ps   # 3つとも healthy になるまで待つ
```

### 2-3. Speckle 本体の起動

```bash
docker compose -f docker-compose-speckle.yml up -d
docker compose -f docker-compose-speckle.yml logs -f speckle-server
```

初回はイメージのダウンロード(数GB)と DB マイグレーションで数分かかる。
ログに `Listening on 3000` 等が出て、`ps` で speckle-server が `healthy` になれば OK。

すべてのコンテナに `restart: always` を設定済みのため、PC 再起動後も
Docker Desktop さえ起動すれば自動復帰する。

---

## 3. 動作確認と管理者アカウント作成

| 確認項目 | URL | 期待結果 |
|---------|-----|---------|
| フロントエンド | http://localhost | Speckle のログイン画面が表示される |
| GraphQL Explorer | http://localhost/graphql | API Explorer が開く |
| MinIO コンソール | http://localhost:9001 | minioadmin / minioadmin でログイン可 |

1. http://localhost を開き **Register**(サインアップ)する
2. **最初に登録したユーザーが自動的にサーバー管理者になる**
3. ログイン後、テスト用プロジェクトを1つ作成する
4. 右上メニュー → Developer Settings → **Personal Access Token** を発行しておく
   (Step 2 の GraphQL 調査、Step 3 のダッシュボードで使用。スコープは
   `profile:read` `streams:read` `streams:write` があれば十分)

> メール送信は未設定のため、メンバー招待リンク等は
> `docker compose -f docker-compose-speckle.yml logs speckle-server | grep -i invite`
> でサーバーログから取得する。

---

## 4. 日常運用コマンド

```bash
# 状態確認
docker compose -f docker-compose-deps.yml ps
docker compose -f docker-compose-speckle.yml ps

# 停止 (データは保持される)
docker compose -f docker-compose-speckle.yml down
docker compose -f docker-compose-deps.yml down

# 完全初期化 (データも削除。CANONICAL_URL を変えたいとき等)
docker compose -f docker-compose-speckle.yml down
docker compose -f docker-compose-deps.yml down -v

# バージョン更新 (.env の SPECKLE_VERSION を上げてから)
docker compose -f docker-compose-speckle.yml pull
docker compose -f docker-compose-speckle.yml up -d
```

## 5. チーム公開段階への移行(参考)

社内サーバー / クラウド VM へ移行する場合:

1. `server/` 一式と `.env` をコピー(`CANONICAL_URL` を新 URL に変更)
2. PoC データは原則作り直し。どうしても引き継ぐ場合は
   `docker exec speckle-postgres-1 pg_dump -U speckle speckle > dump.sql` + MinIO の `minio-data` ボリュームを移行
3. TLS 化(リバースプロキシに Caddy / nginx + Let's Encrypt)、バックアップ、認証連携は本番化計画で別途策定

うまくいかない場合は [troubleshooting.md](./troubleshooting.md) を参照。
