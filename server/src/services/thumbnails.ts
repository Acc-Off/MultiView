import { createHash } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import { writeFile, rename, readdir, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { dbPath } from "../db.js";

/**
 * Module that saves channel icons on the server and serves them from this server.
 *
 * Background: YouTube's icon CDN (yt3.ggpht.com) is strict about bursts of many parallel requests from
 * a browser, and returns 429 Too Many Requests for a channel list (hundreds of entries). To avoid this,
 * each icon image is downloaded just once on the server side and saved under data/thumbnails, and
 * channels.thumbnail holds a relative path on this server (/thumbnails/<file>) instead of the external URL.
 * Browsers then only hit this server; direct requests to the external CDN disappear, and so do the 429s.
 *
 * Cache policy (cache busting): the saved file name includes a hash of the image content (<id>.<hash>.<ext>).
 * When an icon changes, the hash (= URL) changes too, so the change shows up reliably even though the files
 * are served with Cache-Control: public, max-age=1 year, immutable. On a revisit the URL is the same, so the browser
 * makes no network request at all (this also prevents re-fetching on every visit, a separate issue from the 429s).
 */

/** Directory where icons are saved. Placed under data/, the same as the DB (so it is persisted on the same volume). */
export function thumbnailsDir(): string {
  // dbPath() points to data/multiview.db, so thumbnails/ is created under its parent, data/.
  return resolve(dirname(dbPath()), "thumbnails");
}

/** Base path of the static serving returned to browsers (must match the serveStatic mount in index.ts). */
export const THUMBNAILS_URL_BASE = "/thumbnails";

/** Picks a file extension from the Content-Type (for the saved file name). Defaults to jpg if unknown. */
function extFromContentType(contentType: string | null): string {
  if (!contentType) return "jpg";
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("svg")) return "svg";
  return "jpg";
}

/** Normalizes an id into a form usable in a file name (anything other than alphanumerics, hyphens, and underscores becomes _). */
function safeFileBase(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "_");
}

/** Removes old files (with a different hash) for the same id. keepFile is the current file name to keep. */
async function pruneOldFiles(dir: string, base: string, keepFile: string): Promise<void> {
  try {
    const entries = await readdir(dir);
    // Only files of the form <base>.<hash>.<ext> with a matching base (the "." is part of the prefix check so that ids sharing a prefix do not match).
    const prefix = `${base}.`;
    await Promise.all(
      entries
        .filter((f) => f.startsWith(prefix) && f !== keepFile)
        .map((f) => unlink(resolve(dir, f)).catch(() => undefined)),
    );
  } catch {
    // A cleanup failure is not fatal (it only uses a little more disk space). Ignore it.
  }
}

/**
 * Downloads an image URL, saves it as data/thumbnails/<id>.<hash>.<ext>, and returns
 * the relative path for serving (/thumbnails/<id>.<hash>.<ext>). Returns null on failure.
 *
 * The file name includes a content hash, so when the icon changes the URL changes too (cache busting).
 * The write is atomic (temp file, then rename) so that a partially written file is never served.
 * After saving, files with an old hash for the same id are removed.
 */
export async function downloadThumbnail(id: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;

    const ext = extFromContentType(res.headers.get("content-type"));
    const base = safeFileBase(id);
    const hash = createHash("sha256").update(buf).digest("hex").slice(0, 8);
    const file = `${base}.${hash}.${ext}`;
    const dir = thumbnailsDir();
    mkdirSync(dir, { recursive: true });

    const finalPath = resolve(dir, file);
    const tmpPath = `${finalPath}.tmp`;
    await writeFile(tmpPath, buf);
    await rename(tmpPath, finalPath);
    await pruneOldFiles(dir, base, file);

    return `${THUMBNAILS_URL_BASE}/${file}`;
  } catch {
    return null;
  }
}

/** Creates the thumbnails directory if it does not exist (called at startup, before the static serving is mounted). */
export function ensureThumbnailsDir(): void {
  const dir = thumbnailsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
