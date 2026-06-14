# 日常運用ガイド (起動・終了・確認・更新)

このPoC環境の日常的な操作をまとめたチートシートです。
詳しいセットアップは [01-server-setup.md](./01-server-setup.md) を参照してください。

このシステムは **2つの部分** で構成されています。操作対象を意識すると混乱しません。

| 部分 | 中身 | 動かす場所 | アクセス先 |
|------|------|-----------|-----------|
| **① Speckleサーバー** | Docker (PostgreSQL / Valkey / MinIO + Speckle本体) | `server/` フォルダ | http://localhost |
| **② ダッシュボード** | Next.js アプリ (自作) | `dashboard/` フォルダ | http://localhost:3000 |

> **前提**: Docker Desktop が起動していること。PC再起動後は最初に Docker Desktop を立ち上げる。

---

## 1. 起動方法

### ① Speckleサーバーを起動

`server/` フォルダで PowerShell を開いて:

```powershell
# 依存サービス (DB等) → 本体 の順で起動
docker compose -f docker-compose-deps.yml up -d
docker compose -f docker-compose-speckle.yml up -d
```

初回や更新直後はイメージ取得・起動に数分かかります。
→ ブラウザで **http://localhost** が開ければOK。

> **補足**: `restart: always` 設定済みなので、一度起動すれば
> PC再起動後も Docker Desktop さえ立ち上がれば自動で復帰します。
> 通常はこの起動コマンドを毎回打つ必要はありません。

### ② ダッシュボードを起動

`dashboard/` フォルダで別の PowerShell を開いて:

```powershell
npm run dev
```

→ ブラウザで **http://localhost:3000** にアクセス。
このターミナルは**開いたまま**にしておく(閉じるとダッシュボードが止まる)。

---

## 2. 終了方法

### ② ダッシュボードを止める

`npm run dev` を実行しているターミナルで **`Ctrl + C`**
(「バッチ ジョブを終了しますか?」と聞かれたら `Y`)。

### ① Speckleサーバーを止める

`server/` フォルダで:

```powershell
# 本体 → 依存サービス の順で停止 (データは保持される)
docker compose -f docker-compose-speckle.yml down
docker compose -f docker-compose-deps.yml down
```

> Docker Desktop を終了するだけでもコンテナは止まります。
> データはボリュームに残るので、次回 `up -d` で続きから使えます。

---

## 3. 起動中か確認する方法

### ① Speckleサーバーの状態確認

`server/` フォルダで:

```powershell
docker compose -f docker-compose-deps.yml ps
docker compose -f docker-compose-speckle.yml ps
```

- STATUS が **`Up ... (healthy)`** なら正常
- `Restarting` や `Exited` は異常 → ログを確認(下記)

ログを見る(問題調査時):

```powershell
docker compose -f docker-compose-speckle.yml logs -f speckle-server
```

> `Expired 0 pending uploads` などが1分ごとに出続けるのは**正常稼働の証拠**。
> ログ画面から抜けるには **`Ctrl + C`**(サーバーは止まりません、表示を抜けるだけ)。

| 確認したいもの | URL |
|---------------|-----|
| Speckle フロントエンド | http://localhost |
| GraphQL Explorer | http://localhost/graphql |
| MinIO コンソール | http://localhost:9001 (minioadmin / minioadmin) |
| ダッシュボード | http://localhost:3000 |

### ② ダッシュボードの状態確認

`npm run dev` のターミナルに `✓ Ready` や `Local: http://localhost:3000`
と出ていれば起動中。ブラウザで http://localhost:3000 が開ければOK。

---

## 4. Claude Code で更新した後の反映方法

Claude Code はコードを **GitHubのブランチ (`claude/determined-wright-1c06xz`) にpush** します。
手元のPCはそれを `git pull` で取り込みます。**どこを更新したか**で手順が変わります。

### まず: 最新コードを取得 (共通)

`npm run dev` のターミナルで:

```powershell
# いったん Ctrl + C で止めてから
git pull origin claude/determined-wright-1c06xz
```

> `Updating xxxxxxx..yyyyyyy` と出れば更新あり。
> `Already up to date.` なら更新なし(取得済み)。
> どのフォルダ(server/ でも dashboard/ でも)からでも `git pull` は実行できます。

### ケースA: ダッシュボード (`dashboard/`) を更新したとき ← 通常はこちら

```powershell
# dashboard フォルダで
git pull origin claude/determined-wright-1c06xz

# package.json が変わった場合のみ必要 (依存追加時)
npm install

# 再起動
npm run dev
```

→ ブラウザを **Ctrl + F5**(キャッシュを無視して再読み込み)。

> **補足**: `npm run dev` は起動中、ファイル保存を検知して自動リロードします。
> ただし `git pull` で大きく変わったときや、表示が崩れたときは、
> 上記のように一度 `Ctrl + C` → `npm run dev` で再起動するのが確実です。

### ケースB: Speckleサーバー (`server/`) の設定を更新したとき

`docker-compose-*.yml` や `.env`、Speckleのバージョンを変えた場合:

```powershell
# server フォルダで
git pull origin claude/determined-wright-1c06xz

# 新しいイメージがある場合は取得 (バージョン変更時)
docker compose -f docker-compose-speckle.yml pull

# 再作成して反映
docker compose -f docker-compose-speckle.yml up -d
```

> compose ファイルの変更は `up -d` を再実行すれば差分だけ反映されます。
> `.env` の `CANONICAL_URL` を変えた場合はデータ参照が崩れるため、
> データ初期化 (`down -v`) が必要になることがあります(PoC運用ルール参照)。

---

## 5. 困ったときのクイック対処

| 症状 | 対処 |
|------|------|
| http://localhost が 404 / つながらない | Docker Desktop が起動しているか確認 → `server/` で `up -d` |
| ポート80が別アプリに取られている | `.env` の `HOST_PORT` と `CANONICAL_URL` を 8080 等に変更(データ投入前に) |
| ダッシュボードが古いまま | `git pull` → `Ctrl + C` → `npm run dev` → ブラウザ Ctrl + F5 |
| 左の3Dが細い/見えない | DevTools(F12)を閉じて全画面で確認。横幅が戻る |
| コンテナが unhealthy | `docker compose ... logs <サービス名>` でログ確認 → [troubleshooting.md](./troubleshooting.md) |

詳しいトラブル対応は [troubleshooting.md](./troubleshooting.md) を参照してください。
