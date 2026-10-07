# Getting started

This guide takes you from nothing to a running MultiView instance, using the prebuilt Docker image. You do not need to clone the repository or install Node.js.

🌐 [日本語](./ja/getting-started.md)

## What you need

- **Docker** with **Docker Compose** (Docker Desktop, or Docker Engine with the Compose plugin).
- A **YouTube Data API v3** key.
- A **Twitch** application's Client ID and Client Secret.

## 1. Get the API credentials

### YouTube Data API v3 key

1. Open the [Google Cloud Console](https://console.cloud.google.com/) (a Google account is required).
2. From the project selector at the top, **create a new project** (or reuse an existing one).
3. Go to **APIs & Services → Library**, search for "**YouTube Data API v3**", and click **Enable**.
4. Go to **APIs & Services → Credentials → Create Credentials → API key**.
5. Keep the generated key (`AIza...`) for `youtube_api_key`.

> Recommended: under "**Restrict key**", limit the key to **YouTube Data API v3** only.
> The free tier provides **10,000 units per day**. See [Configuration → YouTube quota](./configuration.md#youtube-quota) for how MultiView spends it.

### Twitch Client ID and Client Secret

1. Open the [Twitch Developer Console](https://dev.twitch.tv/console) (a Twitch account with two-factor authentication enabled is required).
2. Click **Applications → Register Your Application**.
3. Fill in the fields:
   - **Name**: any app name (e.g. `MultiView`).
   - **OAuth Redirect URLs**: `http://localhost`. MultiView has no user login, so a dummy value is fine, but the field cannot be empty.
   - **Category**: e.g. `Website Integration`.
4. After registering, open the app to find its **Client ID**, and click **New Secret** to generate a **Client Secret**.
5. Keep them for `twitch_client_id` and `twitch_client_secret`.

MultiView fetches Twitch data with an App Access Token (client credentials flow), so no user authentication or real redirect URL is involved. The Client Secret is used on the server only and never reaches the browser.

If you will only register YouTube channels, you can skip this and leave the Twitch values in the sample config as they are. The same goes for the YouTube key when you only register Twitch channels.

## 2. Prepare the files

Create a folder for the instance and put two files in it: the compose file and your config.

```bash
mkdir multiview && cd multiview
mkdir config

curl -fsSLO https://raw.githubusercontent.com/Acc-Off/MultiView/main/docker-compose.yml
curl -fsSL -o config/config.yaml https://raw.githubusercontent.com/Acc-Off/MultiView/main/config/config.yaml.example
```

You can also download [`docker-compose.yml`](../docker-compose.yml) and [`config/config.yaml.example`](../config/config.yaml.example) from the repository page and save the second one as `config/config.yaml`.

The folder now looks like this:

```
multiview/
├── docker-compose.yml
└── config/
    └── config.yaml
```

## 3. Edit `config/config.yaml`

At minimum, set these:

| Key | What to put |
|---|---|
| `youtube_api_key` | The YouTube key from step 1. |
| `twitch_client_id`, `twitch_client_secret` | The Twitch values from step 1. |
| `admin_token` | A long random string of your own. It protects the admin API. |
| `channels` | The YouTube and Twitch channels to show. |

Channels look like this:

```yaml
channels:
  youtube:
    - id: "UCxxxxxxxxxxxxxxxxxxxxxx"   # channel ID (starts with UC)
      name: "Some channel"
      live: true     # watch for live and upcoming streams (uses YouTube quota)
      video: true    # list this channel's videos
  twitch:
    - id: "some_login_name"            # the name in the channel URL
      name: "Some streamer"
```

Every setting is described in [Configuration](./configuration.md).

## 4. Start it

```bash
docker compose up -d
```

Open **http://localhost:3000**.

To watch the server log:

```bash
docker compose logs -f
```

If the container exits right after starting, the log says which setting in `config.yaml` is missing or invalid.

On the first start, Docker creates a `data/` folder next to `config/`. It holds the database and the downloaded channel icons; keep it when you upgrade.

### Using `docker run` instead of Compose

```bash
docker run -d --name multiview \
  -v ./config:/app/config \
  -v ./data:/app/data \
  -p 3000:3000 \
  --restart unless-stopped \
  ghcr.io/acc-off/multiview:latest
```

## Updating to a new version

```bash
docker compose pull
docker compose up -d
```

The sample compose file uses the `latest` tag, which follows the newest release. To decide yourself when to upgrade, pin a version in `docker-compose.yml` (for example `ghcr.io/acc-off/multiview:1.0.0`) and change it when you are ready.

Your `config/` and `data/` folders are not touched by an update.

## Next steps

- Publishing it on the internet? Read [Operations → HTTPS and domain](./operations.md#https-and-domain) first: Twitch embeds need it.
- Many channels? Read [Configuration → YouTube quota](./configuration.md#youtube-quota) to choose polling intervals.
- Want to build the image yourself or change the code? See [Development](./development.md).
