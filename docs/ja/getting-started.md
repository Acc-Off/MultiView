# はじめに

ビルド済みの Docker イメージを使って、MultiView を動かすまでの手順です。リポジトリのクローンや Node.js のインストールは要りません。

🌐 [English](../getting-started.md)

## 必要なもの

- **Docker** と **Docker Compose**（Docker Desktop、または Compose プラグイン入りの Docker Engine）。
- **YouTube Data API v3** のキー。
- **Twitch** アプリの Client ID と Client Secret。

## 1. API の認証情報を取得する

### YouTube Data API v3 キー

1. [Google Cloud Console](https://console.cloud.google.com/) を開きます（Google アカウントが必要です）。
2. 上部のプロジェクトセレクタから**新しいプロジェクトを作成**します（既存のものでも構いません）。
3. **APIとサービス → ライブラリ**で「**YouTube Data API v3**」を検索し、**有効にする**を押します。
4. **APIとサービス → 認証情報 → 認証情報を作成 → APIキー**を選びます。
5. 生成されたキー（`AIza...`）を控えます。`youtube_api_key` に使います。

> 推奨: 「**APIキーを制限**」で、このキーを **YouTube Data API v3 のみ**に制限してください。
> 無料枠は **1日 10,000 ユニット**です。MultiView がどう消費するかは[設定 → YouTube のクォータ](./configuration.md#youtube-のクォータ)にあります。

### Twitch の Client ID と Client Secret

1. [Twitch Developer Console](https://dev.twitch.tv/console) を開きます（二段階認証を有効にした Twitch アカウントが必要です）。
2. **Applications → Register Your Application** を押します。
3. 項目を入力します。
   - **Name**: 任意のアプリ名（例: `MultiView`）。
   - **OAuth Redirect URLs**: `http://localhost`。MultiView にはユーザーログインがないのでダミーで構いませんが、空欄にはできません。
   - **Category**: `Website Integration` など。
4. 登録後、アプリの画面で **Client ID** を確認し、**New Secret** で **Client Secret** を発行します。
5. どちらも控えます。`twitch_client_id` と `twitch_client_secret` に使います。

MultiView は App Access Token（クライアントクレデンシャルフロー）で Twitch の情報を取得します。ユーザー認証や実際のリダイレクト URL は使いません。Client Secret はサーバー側だけで使い、ブラウザには渡りません。

YouTube のチャンネルだけを登録する場合は、この手順を飛ばして、サンプル設定の Twitch の値をそのままにしておけます。Twitch のチャンネルだけを登録する場合の YouTube のキーも同じです。

## 2. ファイルを用意する

インスタンス用のフォルダを作り、compose ファイルと設定ファイルの2つを置きます。

```bash
mkdir multiview && cd multiview
mkdir config

curl -fsSLO https://raw.githubusercontent.com/Acc-Off/MultiView/main/docker-compose.yml
curl -fsSL -o config/config.yaml https://raw.githubusercontent.com/Acc-Off/MultiView/main/config/config.yaml.example
```

リポジトリのページから [`docker-compose.yml`](../../docker-compose.yml) と [`config/config.yaml.example`](../../config/config.yaml.example) をダウンロードし、後者を `config/config.yaml` という名前で保存しても同じです。

フォルダは次のようになります。

```
multiview/
├── docker-compose.yml
└── config/
    └── config.yaml
```

## 3. `config/config.yaml` を編集する

最低限、次の項目を設定します。

| キー | 設定する内容 |
|---|---|
| `youtube_api_key` | 手順1の YouTube のキー。 |
| `twitch_client_id`、`twitch_client_secret` | 手順1の Twitch の値。 |
| `admin_token` | 自分で決めた、十分に長いランダムな文字列。管理 API を保護します。 |
| `channels` | 表示する YouTube と Twitch のチャンネル。 |

チャンネルは次のように書きます。

```yaml
channels:
  youtube:
    - id: "UCxxxxxxxxxxxxxxxxxxxxxx"   # チャンネル ID（UC で始まる）
      name: "チャンネル名"
      live: true     # ライブ・予定配信を監視する（YouTube のクォータを使う）
      video: true    # このチャンネルの動画を一覧に載せる
  twitch:
    - id: "some_login_name"            # チャンネル URL に出てくる名前
      name: "配信者名"
```

すべての項目は[設定](./configuration.md)で説明しています。

## 4. 起動する

```bash
docker compose up -d
```

**http://localhost:3000** を開きます。

サーバーのログを見るには次のようにします。

```bash
docker compose logs -f
```

起動してすぐコンテナが止まる場合は、`config.yaml` のどの項目が足りないか、または正しくないかがログに出ています。

初回の起動時に、Docker が `config/` の隣に `data/` フォルダを作ります。データベースとダウンロードしたチャンネルアイコンが入るので、バージョンアップのときも残してください。

### Compose を使わず `docker run` で起動する

```bash
docker run -d --name multiview \
  -v ./config:/app/config \
  -v ./data:/app/data \
  -p 3000:3000 \
  --restart unless-stopped \
  ghcr.io/acc-off/multiview:latest
```

## 新しいバージョンに更新する

```bash
docker compose pull
docker compose up -d
```

サンプルの compose ファイルは `latest` タグを使っていて、常に最新のリリースを指します。更新の時期を自分で決めたい場合は、`docker-compose.yml` でバージョンを固定し（例: `ghcr.io/acc-off/multiview:1.0.0`）、上げたいときに書き換えてください。

更新しても `config/` と `data/` はそのまま残ります。

## 次に読むもの

- インターネットに公開する場合は、先に[運用 → HTTPS とドメイン](./operations.md#https-とドメイン)を読んでください。Twitch の埋め込みに必要です。
- チャンネルが多い場合は、[設定 → YouTube のクォータ](./configuration.md#youtube-のクォータ)でポーリング間隔を決めてください。
- イメージを自分でビルドしたい、コードを変えたい場合は [Development](../development.md)（英語）を見てください。
