# Operations

Notes for running MultiView as a service: publishing it under your own domain, running more than one instance, backing it up, upgrading, and what to check when something looks wrong.

🌐 [日本語](./ja/operations.md)

## HTTPS and domain

The container speaks plain **HTTP** on port 3000. To publish it, put a reverse proxy or tunnel that terminates HTTPS in front of it (Caddy, nginx, Cloudflare, and so on).

HTTPS is not optional if you show Twitch streams. Twitch only lets its player and chat be embedded in pages served over HTTPS; `localhost` is the one exception. MultiView tells Twitch the hostname of the page it is opened on, so there is nothing to configure for this beyond serving the site over HTTPS. YouTube embeds have no such requirement.

A minimal Caddy configuration, for example:

```
multiview.example.com {
    reverse_proxy localhost:3000
}
```

## Running several instances

Each instance needs its own compose file, config folder and data folder. Starting from the sample files:

```bash
cp docker-compose.yml docker-compose_games.yml
mkdir config_games
cp config/config.yaml.example config_games/config.yaml
```

Then edit `docker-compose_games.yml`:

| Setting | Change it to |
|---|---|
| `name` | A unique project name, e.g. `multiview-games` |
| `container_name` | A unique container name, e.g. `multiview-games` |
| `ports` | A free host port, e.g. `"3001:3000"` |
| `volumes` | `./config_games:/app/config` and `./data_games:/app/data` |

Start it with:

```bash
docker compose -f docker-compose_games.yml up -d
```

Give every instance its own top-level `name`. Compose treats files that share a project name as one project, and running `up --remove-orphans` for one of them then removes the containers of the others.

Instances can share the same API credentials. Google then counts all of them against one daily YouTube quota, while each instance only counts its own calls. Divide the budget between them with `youtube_quota_limit`, for example 5,000 each for two instances.

## Data and backup

Everything an instance keeps lives in two folders next to the compose file:

| Folder | Contents |
|---|---|
| `config/` | `config.yaml`: your settings, including the API credentials and the admin token. |
| `data/` | `multiview.db` (SQLite: collected archive videos, the quota count, the last fetched live/upcoming lists, channel names) with its companion files `multiview.db-wal` and `multiview.db-shm`, and `thumbnails/` (downloaded channel icons). |

To back up, stop the container first so the database files are consistent, then copy both folders:

```bash
docker compose stop
cp -r config data /path/to/backup/
docker compose start
```

Restore `data/` as a whole. The database refers to the icon files in `thumbnails/` by name, so a database restored without that folder shows broken icons until you fetch them again (`POST /api/admin/channels/refresh`).

If `data/` is lost, the server starts from empty and fetches again, with two consequences:

- **Older archive entries do not come back.** Each archive cycle reads only the latest uploads of every channel, and the video list is what has accumulated from those cycles over time.
- **Today's quota count restarts from zero**, although the real consumption at Google does not.

What visitors configure in their browsers (favorites, layouts, per-channel volume) is stored in each browser's `localStorage`, not on the server. Visitors can export and import it from the settings page.

## Upgrading

```bash
docker compose pull
docker compose up -d
```

`config/` and `data/` are kept. If the compose file pins a version tag, change the tag first. Release notes are on the repository's [Releases](https://github.com/Acc-Off/MultiView/releases) page.

## Admin operations

The admin API is protected by `admin_token`. See [Configuration → Admin token](./configuration.md#admin-token) for the commands to refresh the lists immediately and to fetch channel names and icons again.

## Troubleshooting

**The container stops right after starting.**
Run `docker compose logs`. A line starting with `[startup] failed:` names the problem, usually a missing or invalid setting in `config.yaml`.

**Twitch players or chats stay blank or show an error.**
Check that the site is opened over HTTPS, or as `localhost`. Twitch refuses to be embedded in a page served over plain HTTP from any other address.

**YouTube live streams stopped updating while Twitch still updates.**
Look at "YouTube API" on the settings page. When the count has reached the limit (95% of `youtube_quota_limit` by default), a notice appears there and YouTube calls are paused until the count resets at midnight Pacific Time. To avoid it, lengthen `poll_interval_live_youtube_minutes` or reduce the number of channels with `live: true`; see [Configuration → YouTube quota](./configuration.md#youtube-quota).

If the count is low, check the log for errors from YouTube, such as an invalid API key.

**The lists are empty.**
With `polling_enabled: false`, nothing is fetched until someone refreshes. Call the admin refresh API, or set `public_refresh_enabled: true` to show a refresh button to visitors.

**One YouTube channel never shows anything.**
Look in the log for `[youtube] skipping channel <id>`. It means the channel ID is wrong, or the channel has no public videos yet.

**A channel's icon or name is out of date.**
Call `POST /api/admin/channels/refresh` with the admin token.
