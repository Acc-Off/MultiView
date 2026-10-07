import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load as parseYaml } from "js-yaml";

export interface ChannelConfig {
  id: string;
  name: string;
}

/** For YouTube channels, what to fetch (live streams / videos) is set per channel with flags. */
export interface YouTubeChannelConfig extends ChannelConfig {
  /** Whether to poll for live and scheduled streams (consumes quota). */
  live: boolean;
  /** Whether to fetch videos (archives / clips) and show them in the video list. */
  video: boolean;
}

/** An arbitrary link shown at the bottom of the hamburger menu, etc. The operator adds these freely in config.yaml. */
export interface SiteLink {
  /** Display label (tooltip / text). */
  label: string;
  /** Destination URL. */
  url: string;
  /** mdi icon name (e.g. "mdiTwitter"). If omitted, a substitute such as the first character of the label is shown. */
  icon?: string;
}

export interface AppConfig {
  /** Service name chosen by the operator. If unset, the default "MultiView" is used (handled in the frontend). */
  site_name: string;
  /** Arbitrary links shown at the bottom of the hamburger menu. Hidden if unset. */
  site_links: SiteLink[];
  youtube_api_key: string;
  twitch_client_id: string;
  twitch_client_secret: string;
  admin_token: string;
  polling_enabled: boolean;
  /** Polling interval (minutes) for YouTube live and scheduled streams. This consumes quota, so keep it on the long side. */
  poll_interval_live_youtube_minutes: number;
  /** Polling interval (minutes) for Twitch live streams. There is no quota limit, so it can be shorter. */
  poll_interval_live_twitch_minutes: number;
  poll_interval_archive_minutes: number;
  public_refresh_enabled: boolean;
  youtube_quota_limit: number;
  quota_safety_margin: number;
  channels: {
    youtube: YouTubeChannelConfig[];
    twitch: ChannelConfig[];
  };
}

/** Thrown when config.yaml is missing or invalid. An explicit error used to abort startup. */
export class ConfigError extends Error {}

const DEFAULTS = {
  polling_enabled: true,
  poll_interval_live_youtube_minutes: 3,
  poll_interval_live_twitch_minutes: 1,
  poll_interval_archive_minutes: 15,
  public_refresh_enabled: false,
  youtube_quota_limit: 10000,
  quota_safety_margin: 0.95,
} as const;

/** Default path of config.yaml. Can be overridden with the CONFIG_PATH environment variable (for a Docker volume mount or development). */
export function configPath(): string {
  return process.env.CONFIG_PATH
    ? resolve(process.env.CONFIG_PATH)
    : resolve(process.cwd(), "..", "config", "config.yaml");
}

/** Validates and extracts id / name (common to all platforms). */
function parseIdName(
  entry: Record<string, unknown>,
  platform: string,
  i: number,
): { id: string; name: string } {
  const { id, name } = entry;
  if (typeof id !== "string" || id.trim() === "") {
    throw new ConfigError(`channels.${platform}[${i}].id is required`);
  }
  if (typeof name !== "string" || name.trim() === "") {
    throw new ConfigError(`channels.${platform}[${i}].name is required`);
  }
  return { id: id.trim(), name: name.trim() };
}

/** Extracts a required boolean. A missing or wrongly typed value throws ConfigError (no backward-compatibility default is provided). */
function requireBoolean(
  entry: Record<string, unknown>,
  key: string,
  platform: string,
  i: number,
): boolean {
  const v = entry[key];
  if (typeof v !== "boolean") {
    throw new ConfigError(
      `channels.${platform}[${i}].${key} is required and must be a boolean (true/false)`,
    );
  }
  return v;
}

/** Parses Twitch channels (id / name only). */
function asTwitchChannelList(raw: unknown): ChannelConfig[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new ConfigError("channels.twitch must be an array");
  }
  return raw.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ConfigError(`channels.twitch[${i}] must be an object`);
    }
    const { id, name } = parseIdName(entry as Record<string, unknown>, "twitch", i);
    // Twitch logins are case-insensitive and the API always returns them in lowercase.
    // Normalize here so that lookups by the returned login match however the id was typed.
    return { id: id.toLowerCase(), name };
  });
}

/** Parses YouTube channels (id / name plus the required flags live / video). */
function asYouTubeChannelList(raw: unknown): YouTubeChannelConfig[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new ConfigError("channels.youtube must be an array");
  }
  return raw.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ConfigError(`channels.youtube[${i}] must be an object`);
    }
    const obj = entry as Record<string, unknown>;
    const { id, name } = parseIdName(obj, "youtube", i);
    return {
      id,
      name,
      live: requireBoolean(obj, "live", "youtube", i),
      video: requireBoolean(obj, "video", "youtube", i),
    };
  });
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  if (typeof v !== "string" || v.trim() === "") {
    throw new ConfigError(`config.yaml: required field "${key}" is missing`);
  }
  return v.trim();
}

function optionalString(raw: Record<string, unknown>, key: string, fallback: string): string {
  const v = raw[key];
  if (v == null) return fallback;
  if (typeof v !== "string") {
    throw new ConfigError(`config.yaml: "${key}" must be a string`);
  }
  return v.trim();
}

/** Parses site_links (an array of arbitrary links). Returns an empty array if unspecified. */
function asSiteLinks(raw: unknown): SiteLink[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new ConfigError("config.yaml: site_links must be an array");
  }
  return raw.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ConfigError(`config.yaml: site_links[${i}] must be an object`);
    }
    const obj = entry as Record<string, unknown>;
    const { label, url, icon } = obj;
    if (typeof label !== "string" || label.trim() === "") {
      throw new ConfigError(`config.yaml: site_links[${i}].label is required`);
    }
    if (typeof url !== "string" || url.trim() === "") {
      throw new ConfigError(`config.yaml: site_links[${i}].url is required`);
    }
    if (icon != null && typeof icon !== "string") {
      throw new ConfigError(`config.yaml: site_links[${i}].icon must be a string`);
    }
    return {
      label: label.trim(),
      url: url.trim(),
      ...(icon != null && icon.trim() !== "" ? { icon: icon.trim() } : {}),
    };
  });
}

function optionalNumber(raw: Record<string, unknown>, key: string, fallback: number): number {
  const v = raw[key];
  if (v == null) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ConfigError(`config.yaml: "${key}" must be a number`);
  }
  return v;
}

/** A polling interval in minutes. Zero or a negative value would silently disable the timer, so it is rejected. */
function optionalInterval(raw: Record<string, unknown>, key: string, fallback: number): number {
  const v = optionalNumber(raw, key, fallback);
  if (v <= 0) {
    throw new ConfigError(`config.yaml: "${key}" must be greater than 0`);
  }
  return v;
}

function optionalBoolean(raw: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = raw[key];
  if (v == null) return fallback;
  if (typeof v !== "boolean") {
    throw new ConfigError(`config.yaml: "${key}" must be a boolean`);
  }
  return v;
}

/** Loads config.yaml and returns an AppConfig with defaults filled in. Throws ConfigError on failure. */
export function loadConfig(path: string = configPath()): AppConfig {
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch (err) {
    throw new ConfigError(
      `failed to read config.yaml: ${path}\n` +
        `copy config/config.yaml.example to config/config.yaml.\n` +
        `(cause: ${(err as Error).message})`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (err) {
    throw new ConfigError(`failed to parse config.yaml as YAML: ${(err as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new ConfigError("config.yaml is empty or not an object");
  }
  const raw = parsed as Record<string, unknown>;

  const channelsRaw = (raw.channels ?? {}) as Record<string, unknown>;
  if (typeof channelsRaw !== "object" || channelsRaw === null || Array.isArray(channelsRaw)) {
    throw new ConfigError("config.yaml: channels must be an object");
  }

  const config: AppConfig = {
    site_name: optionalString(raw, "site_name", ""),
    site_links: asSiteLinks(raw.site_links),
    youtube_api_key: requireString(raw, "youtube_api_key"),
    twitch_client_id: requireString(raw, "twitch_client_id"),
    twitch_client_secret: requireString(raw, "twitch_client_secret"),
    admin_token: requireString(raw, "admin_token"),
    polling_enabled: optionalBoolean(raw, "polling_enabled", DEFAULTS.polling_enabled),
    poll_interval_live_youtube_minutes: optionalInterval(
      raw,
      "poll_interval_live_youtube_minutes",
      DEFAULTS.poll_interval_live_youtube_minutes,
    ),
    poll_interval_live_twitch_minutes: optionalInterval(
      raw,
      "poll_interval_live_twitch_minutes",
      DEFAULTS.poll_interval_live_twitch_minutes,
    ),
    poll_interval_archive_minutes: optionalInterval(
      raw,
      "poll_interval_archive_minutes",
      DEFAULTS.poll_interval_archive_minutes,
    ),
    public_refresh_enabled: optionalBoolean(
      raw,
      "public_refresh_enabled",
      DEFAULTS.public_refresh_enabled,
    ),
    youtube_quota_limit: optionalNumber(raw, "youtube_quota_limit", DEFAULTS.youtube_quota_limit),
    quota_safety_margin: optionalNumber(raw, "quota_safety_margin", DEFAULTS.quota_safety_margin),
    channels: {
      youtube: asYouTubeChannelList(channelsRaw.youtube),
      twitch: asTwitchChannelList(channelsRaw.twitch),
    },
  };

  return config;
}
