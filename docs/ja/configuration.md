# 設定

MultiView が読む設定ファイルは `config/config.yaml` の1つだけです。全項目にコメントを付けた [`config/config.yaml.example`](../../config/config.yaml.example) を元にしてください。

変更はサーバーを再起動すると反映されます。

```bash
docker compose restart
```

🌐 [English](../configuration.md)

## 全項目

| キー | 必須 | 既定値 | 説明 |
|-----|:--------:|---------|-------------|
| `youtube_api_key` | ✅ | — | YouTube Data API v3 のキー。 |
| `twitch_client_id` | ✅ | — | Twitch アプリの Client ID。 |
| `twitch_client_secret` | ✅ | — | Twitch アプリの Client Secret。 |
| `admin_token` | ✅ | — | 管理 API と、非公開時の手動更新を保護する Bearer トークン。十分に長いランダムな文字列にします。 |
| `channels` | | なし | 表示する YouTube と Twitch のチャンネル。[チャンネル](#チャンネル)を参照。 |
| `polling_enabled` | | `true` | `true`: バックグラウンドで定期的に更新する。`false`: 要求があったときだけ更新する。[更新方式](#更新方式)を参照。 |
| `poll_interval_live_youtube_minutes` | | `3` | YouTube のライブ・予定配信を取得する間隔（分）。1回ごとにクォータを使います。 |
| `poll_interval_live_twitch_minutes` | | `1` | Twitch のライブを取得する間隔（分）。Twitch にはクォータがないので短くできます。 |
| `poll_interval_archive_minutes` | | `15` | YouTube のアーカイブを取得する間隔（分）。1回ごとにクォータを使います。 |
| `public_refresh_enabled` | | `false` | `true`: すべての訪問者に手動更新ボタンを出す。`false`: 管理 API からだけ更新できる。 |
| `youtube_quota_limit` | | `10000` | このインスタンスが1日に使ってよい YouTube のクォータ（ユニット）。 |
| `quota_safety_margin` | | `0.95` | 上限の何割で YouTube の呼び出しを止めるか（0.95 = 95%）。 |
| `site_name` | | `MultiView` | サービス名。ブラウザのタイトル、ナビゲーション、設定画面に表示されます。 |
| `site_links` | | なし | ナビゲーションの下部と設定画面に出すリンク。[サイト名とリンク](#サイト名とリンク)を参照。 |

必須の4項目は、値が入っていれば起動します。起動時に YouTube や Twitch へ問い合わせて確かめることはしません。チャンネルを1つも登録しないプラットフォームの認証情報は使われないので、プレースホルダのままで構いません。

ポーリング間隔は、`polling_enabled` が `true` のときだけ使われます。どれも0より大きい値にしてください。0以下だとサーバーは起動しません。

## チャンネル

```yaml
channels:
  youtube:
    - id: "UCxxxxxxxxxxxxxxxxxxxxxx"
      name: "チャンネル名"
      live: true
      video: true
  twitch:
    - id: "some_login_name"
      name: "配信者名"
```

`name` は、このファイルを読む人のための覚え書きです。訪問者に見えるのは、サーバーが YouTube と Twitch から取得した実際のチャンネル名とアイコンです。

**YouTube** — `id` はチャンネル ID で、`UC` で始まる24文字です。YouTube のチャンネルには2つのフラグが両方とも必須で、どちらかが欠けているとサーバーは起動しません。

| フラグ | `true` の意味 | コスト |
|---|---|---|
| `live` | このチャンネルのライブ・予定配信を監視する。 | ライブの取得1回ごとにクォータを使う。 |
| `video` | このチャンネルの動画（アーカイブ、切り抜き）を動画一覧に集める。 | アーカイブの取得1回ごとにクォータを使う。 |

存在しないチャンネル ID や、公開動画がまだ1本もないチャンネルは飛ばされます。サーバーのログに、そのチャンネルが1回だけ出ます。ほかのチャンネルには影響しません。

`live: true` にするのは、実際に YouTube で配信するチャンネルだけにしてください。Twitch で配信して YouTube には切り抜きだけを上げる人なら、YouTube のチャンネルを `live: false, video: true` で登録し、Twitch のチャンネルを別に追加します。

**Twitch** — `id` はログイン名で、チャンネル URL（`twitch.tv/<ログイン名>`）に出てくるものです。大文字と小文字は区別しません。フラグはありません。登録した Twitch のチャンネルはすべてライブを監視します。

## 更新方式

**ポーリング**（`polling_enabled: true`、既定）— サーバーが、設定した間隔で各一覧を更新します。ページは常にサーバーが保存している結果を表示するので、訪問者の操作で API が呼ばれることはありません。

**要求があったときだけ**（`polling_enabled: false`）— サーバーは自分からは一覧を取得しません。更新されるのは、更新ボタン（公開している場合）か管理 API を使ったときだけです。最初の更新までは一覧は空で、一覧のためのクォータは使いません。

どちらの方式でも、最後に取得した結果とその時刻はデータベースに保存されます。再起動後は保存済みの結果をすぐに表示し、ポーリングが有効な場合も、その結果が間隔より古いときだけ取得し直します。

更新はバックグラウンドで実行され、各一覧の最終取得時刻が画面に表示されます。

### 誰が手動更新できるか

| `public_refresh_enabled` | 画面の更新ボタン | 管理 API |
|---|---|---|
| `false`（既定） | 出ない | 使える |
| `true` | すべての訪問者に出る | 使える |

YouTube の更新は1回ごとにクォータを使い、連打を防ぐ待ち時間もありません。訪問者の多いサイトでボタンを公開するかは、その点を踏まえて決めてください。

## 管理トークン

管理用のリクエストには、`Authorization` ヘッダーでトークンを付けます。

```bash
# ライブとアーカイブの一覧を今すぐ更新する（片方だけなら ?target=live か ?target=archive を付ける）
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:3000/api/admin/refresh"

# 全チャンネルの名前とアイコンを取得し直す
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:3000/api/admin/channels/refresh"
```

サーバーがトークンをブラウザに送ることはありません。十分に長いランダムな文字列にして、`config.yaml` を他人に見せないでください。

## YouTube のクォータ

YouTube Data API は、Google Cloud のプロジェクトごとに1日の予算を割り当てます。無料枠は 10,000 ユニットです。MultiView が使うのは1回1ユニットの呼び出しだけですが、ポーリングのたびに呼び出すので、チャンネル数と間隔で消費量が決まります。

### 1回の取得にかかるコスト

`live: true` の YouTube チャンネル数を **L**、`video: true` のチャンネル数を **A** とします。

| 取得 | 実行間隔 | 1回のコスト（最大） |
|---|---|---|
| ライブ・予定 | `poll_interval_live_youtube_minutes` | L + ⌈L / 5⌉ |
| アーカイブ | `poll_interval_archive_minutes` | A + ⌈A / 5⌉ |

⌈ ⌉ は切り上げです。両方のフラグが `true` のチャンネルは、両方の取得で数えます。Twitch にコストはありません。

### 1日にかかるコスト

```
1日のユニット = (1440 / ライブの間隔)     × (L + ⌈L / 5⌉)
              + (1440 / アーカイブの間隔) × (A + ⌈A / 5⌉)
```

これは24時間動かし続けた場合の上限です。既定の間隔（3分と15分）で、両方のフラグを立てたチャンネルが N 個ある場合は次のとおりです。

| N | 1日のユニット |
|---:|---:|
| 5 | 3,456 |
| 10 | 6,912 |
| 13 | 9,216 |
| 14 | 9,792 |

呼び出しは `youtube_quota_limit × quota_safety_margin`（既定で 9,500 ユニット）で止まるので、こうしたチャンネルは13個まで収まり、14個では収まりません。チャンネルを増やしたいときは次のようにします。

- YouTube で配信しないチャンネルを `live: false` にする。これがいちばん効きます。
- `poll_interval_live_youtube_minutes` を長くする。2倍にすればライブの分が半分になります。
- `poll_interval_archive_minutes` を長くする。

たとえば `live: true` が80チャンネルなら、ライブの取得1回で96ユニットです。間隔が15分だと1日96回で 9,216 ユニットになり、アーカイブの分がほとんど残りません。20分なら 6,912 ユニットです。

### 上限に達したとき

サーバーは自分の呼び出しを数えていて、次の呼び出しで上限を超えるところで YouTube への呼び出しを止めます。その後は次のようになります。

- YouTube のライブ一覧は最後に取得した内容のまま、更新が止まります。Twitch は自分の間隔で更新を続けます。
- カウントは太平洋時間の0時（日本時間では16時または17時）にリセットされ、更新は自動で再開します。

現在のカウントは、設定画面の「YouTube API」に表示されます。YouTube の更新が止まっている間は、そこに案内も出ます。

このカウントについて知っておくこと:

- サーバーが自分で数えた概算です。Google は実際の消費量を API では返しません。
- インスタンスごとに別々に数えます。複数のインスタンスやほかのアプリで1つの API キーを共有する場合は、実際の予算を `youtube_quota_limit` で分け合ってください。
- 失敗した呼び出しも数えます。
- 手動更新とチャンネルアイコンの取得も加算されます。アイコンの取得は50チャンネルごとに1ユニットで、通常はチャンネルを初めて登録したときだけ発生します。

## サイト名とリンク

```yaml
site_name: "みんなの MultiView"
site_links:
  - label: "X"
    url: "https://x.com/your_account"
    icon: "mdiTwitter"
  - label: "Discord"
    url: "https://discord.gg/your_invite"
    icon: "mdiDiscord"
```

`icon` は [Material Design Icons](https://pictogrammers.com/library/mdi/) の名前を `mdiXxx` の形で書きます。省略すると汎用のリンクアイコンになります。
