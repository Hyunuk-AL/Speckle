# トラブルシュートメモ

PoC 中に遭遇しやすい問題と対処。随時追記する。

## サーバー構築 (Step 1)

### ポート 80 が既に使われている
- Windows では IIS / Skype / 他の開発サーバーが 80 番を掴んでいることがある。
- `netstat -ano | findstr :80` で確認し、`.env` の `HOST_PORT=8080` 等に変更して回避。
- その場合 `CANONICAL_URL=http://localhost:8080` も合わせて変更し、**データ投入前に**確定させること。

### speckle-server が unhealthy / 再起動を繰り返す
```bash
docker compose -f docker-compose-speckle.yml logs speckle-server --tail 100
```
- `SESSION_SECRET を .env に設定してください` → `.env` 未作成か値が空。
- `ECONNREFUSED postgres:5432` → deps 側が未起動。`docker compose -f docker-compose-deps.yml ps` で healthy を確認してから speckle 側を再起動。
- `network speckle not found` → deps を先に起動する(ネットワークは deps 側が作成する)。

### イメージの pull が遅い / 失敗する
- 初回は合計数 GB。社内プロキシ環境では Docker Desktop の Settings → Resources → Proxies を設定。

### フロントエンドは出るがログイン/登録でエラー
- ブラウザの開発者ツールで API リクエスト先を確認。`CANONICAL_URL` とブラウザのアクセス URL が一致していないと CORS / リダイレクトで失敗する。
- `localhost` と `127.0.0.1` は別オリジン扱い。`.env` の `CANONICAL_URL` と同じ方でアクセスする。

### プロジェクトのサムネイル(プレビュー画像)が出ない
- preview-service のログを確認: `docker compose -f docker-compose-speckle.yml logs preview-service`
- メモリ不足で落ちている場合は `.wslconfig` の `memory` を増やす。
- サムネイルは PoC の必須要件ではないので後回しで良い。

### PC 再起動後にコンテナが起動しない
- Docker Desktop の「Start Docker Desktop when you sign in」を有効化。
- コンテナ自体は `restart: always` 指定済みのため、Docker さえ起動すれば自動復帰する。

## Revit コネクタ (Step 2)

### コネクタにローカルサーバーを追加できない
- Speckle Manager / コネクタのアカウント追加画面で「Add account with server URL」を選び `http://localhost` を入力。
- http (非 TLS) のローカルサーバーは警告が出るが PoC では許容する。

### Publish したのにモデルにオブジェクトが無い
- Revit 側の Publish 対象(選択フィルタ / ビュー)を確認。
- サーバーログ(speckle-server)に object 書き込みエラーが無いか確認。
- `FILE_SIZE_LIMIT_MB` 超過の可能性があれば `.env` で引き上げる。

### ALBS 共有パラメータが GraphQL に出てこない
- コネクタ v3 はインスタンス/タイプパラメータを `properties.Parameters` 配下に格納する。
  まず GraphQL Explorer で 1 オブジェクトの `data` を丸ごと取得し、実際のパスを確認する
  ([02-revit-and-graphql.md](./02-revit-and-graphql.md) のクエリ集参照)。
- それでも無い場合は Revit 側のパラメータ定義(共有パラメータがインスタンスに載っているか)と
  コネクタの送信設定を確認する。計画書 §5 のとおり、ここが PoC 最大のリスク項目。

## ダッシュボード (Step 3)

### viewer がモデルを読み込めない (401/403)
- Personal Access Token のスコープに `streams:read` があるか確認。
- ダッシュボードの接続設定のサーバー URL が `CANONICAL_URL` と一致しているか確認。

### CORS エラーが出る
- Speckle Server は GraphQL / REST に CORS を許可しているが、サーバー URL の打ち間違い
  (http/https、ポート番号)で preflight が落ちるケースが多い。URL を再確認。
