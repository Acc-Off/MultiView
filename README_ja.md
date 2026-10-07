# MultiView

[Holodex](https://github.com/HolodexNet/Holodex) の Multiview を参考にした、複数のライブ配信を同時視聴できるセルフホスト可能な Web アプリケーションです。

Holodex はフロントエンドのみを OSS 公開しており、かつ任意のチャンネルを追加できません。MultiView は**サーバーサイドを自前実装**することで、運用者が任意の YouTube / Twitch チャンネルセットを設定し、特定のコミュニティ向けにカスタマイズした Multiview サービスを公開できます。

🌐 **[English README is here](./README.md)**

---

## 特徴

- **マルチビュー** — 複数の YouTube / Twitch 配信を、カスタマイズ可能なグリッドレイアウトで同時視聴できます（Holodex をフォーク）。
- **ライブ・予定・アーカイブ一覧** — 登録チャンネルのライブ／予定配信、過去アーカイブを閲覧できます。
- **2つの更新方式** — バックグラウンド定期ポーリング、またはユーザートリガによる手動更新（非同期・最終取得日時表示付き）。
- **単一コンテナでデプロイ** — 1つの Docker イメージが API と静的フロントエンドの両方を配信します。

### Holodex にない・強化した点

MultiView は **サーバーサイドを自前実装**したことで、Holodex（フロントのみ OSS・チャンネル固定・ログイン前提）では実現できない以下を提供します。

- **任意のチャンネルセットを運用者が管理** — チャンネルは `config.yaml` で定義します。エンドユーザーは任意のチャンネルを追加できないため、API クォータ消費を運用者がコントロールできます。
- **API キーをサーバーに秘匿** — YouTube / Twitch の認証情報はフロントエンドに露出しません。
- **クォータの見える化と上限抑止** — YouTube クォータの概算消費を計測して UI に表示し、上限に近づくと自動的に API 呼び出しを抑止します。
- **柔軟なグリッドレイアウト** — 内部分割を **横 120 × 縦 60** まで細分化し（動画の 16:9 に合わせて横縦を独立化）、ドラッグ／リサイズ時のスナップ粒度を **8 段階**（粗い〜細かい）のスライダーで選べます。均等格子（最大 6×6 や 8×4・8×6）から「全セル動画＋コメント」「左右非対称」「サイドチャット付き」まで多数のプリセットを同梱します。
- **チャンネル別の音量記憶** — YouTube チャンネル／Twitch ユーザー単位で音量・ミュート状態を記憶・復元します。チャンネルごとに**既定音量**も設定できます。
- **チャンネル一覧ページ** — 登録チャンネルを実チャンネル名・アイコン付きで一覧表示し、**お気に入り**登録／**個別の非表示**（一覧・配信選択から除外）／名前検索ができます。大量チャンネルでも軽快な仮想スクロール対応。
- **サイト名・リンクのカスタマイズ** — `config.yaml` でサービス名（`site_name`）とナビゲーションの任意リンク（`site_links`）を設定でき、コミュニティ固有のブランディングが可能です。
- **ログイン不要・データはローカル完結** — お気に入り・グリッドレイアウト・チャンネル別音量はすべて `localStorage` に保存し、JSON でエクスポート／インポートできます（アカウント・サーバー保存は一切不要）。

---

## クイックスタート

必要なものは、Docker（Docker Compose 付き）、YouTube Data API v3 のキー、Twitch アプリの Client ID と Client Secret です。認証情報の取得方法は[はじめに](./docs/ja/getting-started.md)にあります。

```bash
mkdir multiview && cd multiview
mkdir config

# サンプルの compose ファイルと設定ファイルをダウンロード
curl -fsSLO https://raw.githubusercontent.com/Acc-Off/MultiView/main/docker-compose.yml
curl -fsSL -o config/config.yaml https://raw.githubusercontent.com/Acc-Off/MultiView/main/config/config.yaml.example

# API の認証情報、管理トークン、チャンネルを記入する
#   （config/config.yaml を編集）

docker compose up -d
```

**http://localhost:3000** を開きます。

compose ファイルはビルド済みイメージ `ghcr.io/acc-off/multiview` を使います。設定は `./config/` から読み込み、データベースとチャンネルアイコンは `./data/` に書き込みます。どちらもコンテナの再起動やバージョンアップを越えて保持されます。

---

## ドキュメント

| | 日本語 | English |
|---|---|---|
| ビルド済みイメージでの導入と起動 | [はじめに](./docs/ja/getting-started.md) | [Getting started](./docs/getting-started.md) |
| `config.yaml` の全項目、更新方式、クォータ | [設定](./docs/ja/configuration.md) | [Configuration](./docs/configuration.md) |
| HTTPS、複数インスタンス、バックアップ、バージョンアップ、困ったとき | [運用](./docs/ja/operations.md) | [Operations](./docs/operations.md) |
| 構成、ローカル開発、API リファレンス、リリース | — | [Development](./docs/development.md) |

---

## アーキテクチャ

| レイヤー | 技術スタック |
|-------|-------|
| **フロントエンド** | Vue 3 + Vuetify 3 + Pinia + Vite（Holodex をフォークして不要機能を削減） |
| **バックエンド** | Node.js + [Hono](https://hono.dev/)（TypeScript）。API と静的フロントエンドを1プロセスで配信 |
| **ストレージ** | better-sqlite3（アーカイブ・クォータ消費・ライブ／予定キャッシュ・チャンネル情報）＋ サーバー保有のチャンネルアイコン画像（`data/thumbnails/`） |
| **デプロイ** | マルチステージビルドの単一 Docker イメージ。GitHub Container Registry で配布 |

各部のつながりは [Development](./docs/development.md)（英語）にあります。

---

## クレジット・ライセンス

本プロジェクトは [MIT License](./LICENSE) の下で公開されています。

フロントエンドは [Holodex](https://github.com/HolodexNet/Holodex)（こちらも MIT ライセンス）を基にしています。Holodex のライセンスと著作権表示は [frontend/LICENSE-Holodex](./frontend/LICENSE-Holodex) に収めています。Holodex チームに感謝します。

本プロジェクトは公式の YouTube Data API および Twitch API を利用します。各プラットフォームの利用規約と API クォータポリシーの遵守は利用者の責任です。
