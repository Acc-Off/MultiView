# MultiView

A self-hostable web app for watching multiple live streams side by side, inspired by [Holodex](https://github.com/HolodexNet/Holodex) Multiview.

Unlike Holodex — which only open-sources its frontend and doesn't let you add arbitrary channels — MultiView ships its **own backend** so that an operator can configure any set of YouTube / Twitch channels and host a Multiview service tailored to a specific community.

🌐 **[日本語版 README はこちら](./README_ja.md)**

---

## Features

- **Multiview** — Watch many YouTube / Twitch streams simultaneously in a customizable grid layout (forked from Holodex).
- **Live, upcoming & archive lists** — Browse live/upcoming streams and past archives of your registered channels.
- **Two update modes** — Background polling, or user-triggered manual refresh (async, with last-updated timestamps).
- **Single-container deploy** — One Docker image serves both the API and the static frontend.

### What's new / improved over Holodex

Because MultiView ships its **own backend**, it offers the following — none of which are possible in Holodex (frontend-only OSS, fixed channel set, login-required):

- **Operator-managed, arbitrary channel set** — Channels are defined in `config.yaml`. End users cannot add arbitrary channels, keeping API quota under the operator's control.
- **API keys stay on the server** — YouTube / Twitch credentials are never exposed to the frontend.
- **Quota-aware** — Approximate YouTube quota usage is tracked, surfaced in the UI, and API calls are automatically throttled once the daily limit is approached.
- **Flexible grid layouts** — The internal grid subdivides down to **120 × 60** (horizontal and vertical resolutions are independent, matching video's 16:9), and you can pick the drag/resize snap granularity from an **8-step** slider (coarse to fine). Many presets are bundled, from even grids (up to 6×6, plus 8×4 / 8×6) to "video + chat per cell", asymmetric splits, and side-chat layouts.
- **Per-channel volume memory** — Volume and mute state are remembered and restored per YouTube channel / Twitch user. You can also set a **default volume** per channel.
- **Channel list page** — Browse all registered channels with their real names and icons, mark **favorites**, **hide** individual channels (excluded from lists and the stream picker), and filter by name. Virtual-scrolled to stay fast even with many channels.
- **Customizable site name & links** — Set the service name (`site_name`) and arbitrary navigation links (`site_links`) in `config.yaml` for community-specific branding.
- **Login-free, fully local data** — Favorites, grid layouts and per-channel volume are all stored in `localStorage`, with JSON export/import (no account or server-side storage at all).

---

## Quick start

You need Docker with Docker Compose, a YouTube Data API v3 key, and a Twitch application's Client ID and Client Secret. [Getting started](./docs/getting-started.md) explains how to obtain the credentials.

```bash
mkdir multiview && cd multiview
mkdir config

# Download the sample compose file and the sample config
curl -fsSLO https://raw.githubusercontent.com/Acc-Off/MultiView/main/docker-compose.yml
curl -fsSL -o config/config.yaml https://raw.githubusercontent.com/Acc-Off/MultiView/main/config/config.yaml.example

# Fill in your API credentials, an admin token and your channels
#   (edit config/config.yaml)

docker compose up -d
```

Open **http://localhost:3000**.

The compose file runs the prebuilt image `ghcr.io/acc-off/multiview`. Your config is read from `./config/`, and the database and channel icons are written to `./data/`. Both survive container restarts and upgrades.

---

## Documentation

| | English | 日本語 |
|---|---|---|
| Install and run with the prebuilt image | [Getting started](./docs/getting-started.md) | [はじめに](./docs/ja/getting-started.md) |
| Every `config.yaml` setting, update modes, quota | [Configuration](./docs/configuration.md) | [設定](./docs/ja/configuration.md) |
| HTTPS, multiple instances, backup, upgrades, troubleshooting | [Operations](./docs/operations.md) | [運用](./docs/ja/operations.md) |
| Architecture, local development, API reference, releases | [Development](./docs/development.md) | — |

---

## Architecture

| Layer | Stack |
|-------|-------|
| **Frontend** | Vue 3 + Vuetify 3 + Pinia + Vite (forked & trimmed from Holodex) |
| **Backend** | Node.js + [Hono](https://hono.dev/) (TypeScript), serving the API **and** the static frontend in one process |
| **Storage** | better-sqlite3 (archives, quota usage, live/upcoming cache, channel info) + server-hosted channel icon images (`data/thumbnails/`) |
| **Deploy** | A single multi-stage Docker image, published to GitHub Container Registry |

See [Development](./docs/development.md) for how the pieces fit together.

---

## Credits & License

This project is licensed under the [MIT License](./LICENSE).

The frontend is derived from [Holodex](https://github.com/HolodexNet/Holodex), which is also MIT-licensed; its license and copyright notice are kept in [frontend/LICENSE-Holodex](./frontend/LICENSE-Holodex). Many thanks to the Holodex team.

This project relies on the official YouTube Data API and Twitch API. You are responsible for complying with each platform's terms of service and API quota policies.
