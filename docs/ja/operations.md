# 運用

MultiView をサービスとして動かすときの覚え書きです。自分のドメインでの公開、複数インスタンス、バックアップ、バージョンアップ、うまく動かないときに見るところをまとめています。

🌐 [English](../operations.md)

## HTTPS とドメイン

コンテナはポート 3000 で **HTTP** を話します。公開するときは、HTTPS を受け持つリバースプロキシやトンネル（Caddy、nginx、Cloudflare など）を前に置いてください。

Twitch の配信を表示するなら、HTTPS は必須です。Twitch は、HTTPS で配信されているページにしかプレイヤーとチャットの埋め込みを許可しません。例外は `localhost` だけです。MultiView は、開かれているページのホスト名をそのまま Twitch に伝えるので、サイトを HTTPS で公開する以外に設定することはありません。YouTube の埋め込みにこの制約はありません。

Caddy の最小構成の例です。

```
multiview.example.com {
    reverse_proxy localhost:3000
}
```

## 複数のインスタンスを動かす

インスタンスごとに、compose ファイル、設定フォルダ、データフォルダを分けます。サンプルから始める場合は次のようにします。

```bash
cp docker-compose.yml docker-compose_games.yml
mkdir config_games
cp config/config.yaml.example config_games/config.yaml
```

続いて `docker-compose_games.yml` を編集します。

| 項目 | 変更後 |
|---|---|
| `name` | ほかと重ならないプロジェクト名。例: `multiview-games` |
| `container_name` | ほかと重ならないコンテナ名。例: `multiview-games` |
| `ports` | 空いているホスト側のポート。例: `"3001:3000"` |
| `volumes` | `./config_games:/app/config` と `./data_games:/app/data` |

起動は次のとおりです。

```bash
docker compose -f docker-compose_games.yml up -d
```

最上位の `name` は、インスタンスごとに必ず変えてください。Compose はプロジェクト名が同じファイルを1つのプロジェクトとして扱うので、片方で `up --remove-orphans` を実行すると、もう片方のコンテナが削除されます。

API の認証情報は、インスタンス間で共有できます。その場合、Google は全インスタンスをまとめて1日分の YouTube クォータとして数えますが、各インスタンスは自分の呼び出ししか数えません。`youtube_quota_limit` で予算を分け合ってください。2つなら 5,000 ずつ、という具合です。

## データとバックアップ

インスタンスが保持するものは、compose ファイルの隣の2つのフォルダにすべて入っています。

| フォルダ | 中身 |
|---|---|
| `config/` | `config.yaml`。API の認証情報と管理トークンを含む設定です。 |
| `data/` | `multiview.db`（SQLite。集めたアーカイブ動画、クォータのカウント、最後に取得したライブ・予定の一覧、チャンネル名）と、付随する `multiview.db-wal`・`multiview.db-shm`、それに `thumbnails/`（ダウンロードしたチャンネルアイコン）。 |

バックアップするときは、データベースのファイルが食い違わないよう、先にコンテナを止めてから両方のフォルダをコピーします。

```bash
docker compose stop
cp -r config data /path/to/backup/
docker compose start
```

`data/` は丸ごと戻してください。データベースは `thumbnails/` のアイコンをファイル名で参照しているので、データベースだけを戻すと、取得し直す（`POST /api/admin/channels/refresh`）までアイコンが表示されません。

`data/` を失った場合、サーバーは空の状態から取得し直します。その結果、次の2つが起きます。

- **古いアーカイブは戻りません。** アーカイブの取得は、毎回各チャンネルの最新の投稿だけを読みます。動画一覧は、その積み重ねでできています。
- **その日のクォータのカウントが0に戻ります。** Google 側の実際の消費量は戻りません。

訪問者がブラウザで設定したもの（お気に入り、レイアウト、チャンネル別の音量）は、サーバーではなく各ブラウザの `localStorage` に保存されます。設定画面からエクスポートとインポートができます。

## バージョンアップ

```bash
docker compose pull
docker compose up -d
```

`config/` と `data/` はそのまま残ります。compose ファイルでバージョンのタグを固定している場合は、先にタグを書き換えてください。変更内容はリポジトリの [Releases](https://github.com/Acc-Off/MultiView/releases) ページにあります。

## 管理操作

管理 API は `admin_token` で保護されています。一覧を今すぐ更新するコマンドと、チャンネルの名前とアイコンを取得し直すコマンドは、[設定 → 管理トークン](./configuration.md#管理トークン)にあります。

## 困ったとき

**起動してすぐコンテナが止まる。**
`docker compose logs` を実行してください。`[startup] failed:` で始まる行に原因が出ています。多くは `config.yaml` の項目の不足か誤りです。

**Twitch のプレイヤーやチャットが空のまま、またはエラーになる。**
サイトを HTTPS で、または `localhost` として開いているか確認してください。Twitch は、それ以外のアドレスから HTTP で配信されているページへの埋め込みを拒否します。

**YouTube のライブが更新されなくなった。Twitch は更新されている。**
設定画面の「YouTube API」を見てください。カウントが上限（既定では `youtube_quota_limit` の 95%）に達していると、そこに案内が出て、太平洋時間の0時にリセットされるまで YouTube の呼び出しが止まります。避けるには、`poll_interval_live_youtube_minutes` を長くするか、`live: true` のチャンネルを減らします。[設定 → YouTube のクォータ](./configuration.md#youtube-のクォータ)を参照してください。

カウントが少ない場合は、ログに YouTube からのエラー（API キーが無効、など）が出ていないか確認してください。

**一覧が空。**
`polling_enabled: false` のときは、誰かが更新するまで何も取得されません。管理 API で更新するか、`public_refresh_enabled: true` にして訪問者に更新ボタンを出してください。

**YouTube の特定のチャンネルだけ何も出ない。**
ログに `[youtube] skipping channel <id>` が出ていないか確認してください。チャンネル ID が間違っているか、公開動画がまだ1本もないチャンネルです。

**チャンネルのアイコンや名前が古い。**
管理トークンを付けて `POST /api/admin/channels/refresh` を呼んでください。
