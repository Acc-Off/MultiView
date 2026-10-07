# Configuration

MultiView reads a single file, `config/config.yaml`. Start from [`config/config.yaml.example`](../config/config.yaml.example), which lists every setting with comments.

Changes take effect when the server restarts:

```bash
docker compose restart
```

🌐 [日本語](./ja/configuration.md)

## All settings

| Key | Required | Default | Description |
|-----|:--------:|---------|-------------|
| `youtube_api_key` | ✅ | — | YouTube Data API v3 key. |
| `twitch_client_id` | ✅ | — | Twitch application Client ID. |
| `twitch_client_secret` | ✅ | — | Twitch application Client Secret. |
| `admin_token` | ✅ | — | Bearer token protecting the admin API and, when it is not public, manual refresh. Use a long random string. |
| `channels` | | none | The YouTube and Twitch channels to show. See [Channels](#channels). |
| `polling_enabled` | | `true` | `true`: refresh in the background on a timer. `false`: refresh only on request. See [Update modes](#update-modes). |
| `poll_interval_live_youtube_minutes` | | `3` | Interval for YouTube live/upcoming polling. Each cycle consumes quota. |
| `poll_interval_live_twitch_minutes` | | `1` | Interval for Twitch live polling. Twitch has no quota, so it can stay short. |
| `poll_interval_archive_minutes` | | `15` | Interval for YouTube archive polling. Each cycle consumes quota. |
| `public_refresh_enabled` | | `false` | `true`: every visitor gets a manual refresh button. `false`: only the admin API can refresh. |
| `youtube_quota_limit` | | `10000` | The daily YouTube quota this instance may use, in units. |
| `quota_safety_margin` | | `0.95` | Fraction of the limit at which YouTube calls stop (0.95 = 95%). |
| `site_name` | | `MultiView` | Service name shown in the browser title, the navigation drawer and on the settings page. |
| `site_links` | | none | Links shown at the bottom of the navigation drawer and on the settings page. See [Site name and links](#site-name-and-links). |

The four required values only have to be present; they are not checked against YouTube or Twitch at start-up. The credentials of a platform you register no channels for are never used, so they can stay as placeholders.

The polling intervals are used only when `polling_enabled` is `true`. Each must be greater than 0; the server refuses to start otherwise.

## Channels

```yaml
channels:
  youtube:
    - id: "UCxxxxxxxxxxxxxxxxxxxxxx"
      name: "Some channel"
      live: true
      video: true
  twitch:
    - id: "some_login_name"
      name: "Some streamer"
```

`name` is a label for your own reference in the file. Visitors see the channel's real name and icon, which the server fetches from YouTube and Twitch.

**YouTube** — `id` is the channel ID, the 24-character string starting with `UC`. Both flags are required for every YouTube channel; the server refuses to start when one is missing.

| Flag | `true` means | Cost |
|---|---|---|
| `live` | Watch this channel for live and upcoming streams. | Consumes quota on every live polling cycle. |
| `video` | Collect this channel's videos (archives, clips) for the video list. | Consumes quota on every archive cycle. |

A channel ID that does not exist, or a channel with no public videos yet, is skipped; the server log names it once. The other channels are not affected.

Set `live: true` only for channels that actually stream on YouTube. For a streamer who goes live on Twitch and only uploads clips to YouTube, register the YouTube channel with `live: false, video: true` and add the Twitch channel separately.

**Twitch** — `id` is the login name, the one in the channel URL (`twitch.tv/<login>`). Upper and lower case do not matter. There are no flags: every registered Twitch channel is watched for live streams.

## Update modes

**Polling** (`polling_enabled: true`, the default) — The server refreshes each list on its configured interval. Pages always show the server's stored result, so visitors never trigger API calls.

**On request only** (`polling_enabled: false`) — The server never fetches lists on its own. Data is refreshed only by the refresh button (when it is public) or the admin API. Until the first refresh the lists are empty and no quota is spent on them.

In both modes the last fetched result and its time are stored in the database. After a restart the server shows the stored result at once, and with polling enabled it fetches again only when that result is older than the interval.

Refreshing runs in the background, and the UI shows when each list was last updated.

### Who can refresh manually

| `public_refresh_enabled` | Refresh button in the UI | Admin API |
|---|---|---|
| `false` (default) | Hidden | Works |
| `true` | Shown to every visitor | Works |

Each YouTube refresh costs quota and there is no cooldown, so think twice before making the button public on a busy site.

## Admin token

Admin requests carry the token in an `Authorization` header:

```bash
# Refresh the live and archive lists now (add ?target=live or ?target=archive to refresh one)
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:3000/api/admin/refresh"

# Fetch every channel's name and icon again
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:3000/api/admin/channels/refresh"
```

The server never sends the token to browsers. Choose a long random string and keep `config.yaml` private.

## YouTube quota

The YouTube Data API gives each Google Cloud project a daily budget, 10,000 units on the free tier. MultiView only makes calls that cost 1 unit each, but it makes them on every polling cycle, so the number of channels and the intervals decide how much you spend.

### What a cycle costs

Let **L** be the number of YouTube channels with `live: true` and **A** the number with `video: true`.

| Cycle | Runs every | Cost per cycle, at most |
|---|---|---|
| Live / upcoming | `poll_interval_live_youtube_minutes` | L + ⌈L / 5⌉ |
| Archive | `poll_interval_archive_minutes` | A + ⌈A / 5⌉ |

⌈ ⌉ means rounding up. A channel with both flags is counted in both cycles. Twitch costs nothing.

### What a day costs

```
units per day = (1440 / live interval)    × (L + ⌈L / 5⌉)
              + (1440 / archive interval) × (A + ⌈A / 5⌉)
```

This is an upper bound for a server running 24 hours. With the default intervals (3 and 15 minutes) and N channels that have both flags set:

| N | Units per day |
|---:|---:|
| 5 | 3,456 |
| 10 | 6,912 |
| 13 | 9,216 |
| 14 | 9,792 |

Calls stop at `youtube_quota_limit × quota_safety_margin`, 9,500 units by default, so 13 such channels fit and 14 do not. To fit more channels:

- Set `live: false` on channels that do not stream on YouTube. This is the biggest lever.
- Lengthen `poll_interval_live_youtube_minutes`. Doubling it halves the live part.
- Lengthen `poll_interval_archive_minutes`.

For example, 80 channels with `live: true` cost 96 units per live cycle. A 15-minute interval gives 96 cycles a day, 9,216 units, which leaves almost nothing for archives; a 20-minute interval gives 6,912.

### At the limit

The server counts its own calls and stops calling YouTube once the next call would pass the limit. Then:

- The YouTube live list stays as last fetched and stops updating. Twitch keeps updating on its own interval.
- Updates resume by themselves when the count resets at midnight Pacific Time (UTC−8 or UTC−7).

The settings page shows the current count under "YouTube API", with a notice while YouTube updates are paused.

Things to know about the count:

- It is the server's own estimate. Google does not report actual consumption through the API.
- It is kept per instance. If several instances, or other applications, share one API key, divide the real budget between them with `youtube_quota_limit`.
- Failed calls count too.
- Manual refreshes and channel icon lookups add to it. Icon lookups cost 1 unit per 50 channels and normally happen only when a channel is first registered.

## Site name and links

```yaml
site_name: "Our MultiView"
site_links:
  - label: "X"
    url: "https://x.com/your_account"
    icon: "mdiTwitter"
  - label: "Discord"
    url: "https://discord.gg/your_invite"
    icon: "mdiDiscord"
```

`icon` is a [Material Design Icons](https://pictogrammers.com/library/mdi/) name in the `mdiXxx` form. It is optional; a generic link icon is used when it is omitted.
