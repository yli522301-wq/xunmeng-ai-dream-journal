import { Router, type IRouter } from "express";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const netease = require("NeteaseCloudMusicApi") as Record<string, (params: Record<string, unknown>) => Promise<{ body?: any }>>;

const router: IRouter = Router();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function pickString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapSong(raw: any) {
  const artists = raw?.artists ?? raw?.ar ?? [];
  const album = raw?.album ?? raw?.al ?? {};
  return {
    id: String(raw?.id ?? ""),
    name: raw?.name ?? "",
    artists: Array.isArray(artists) ? artists.map((a: any) => a?.name).filter(Boolean) : [],
    album: album?.name ?? "",
    cover: album?.picUrl ?? album?.pic_str ?? "",
    duration: raw?.duration ?? raw?.dt ?? 0,
    source: "netease",
  };
}

function audioContentTypeForUrl(url: string, contentType: string | null): string {
  if (contentType && contentType !== "application/octet-stream") return contentType;
  if (/\.flac(?:\?|$)/i.test(url)) return "audio/flac";
  if (/\.m4a(?:\?|$)/i.test(url)) return "audio/mp4";
  if (/\.wav(?:\?|$)/i.test(url)) return "audio/wav";
  return "audio/mpeg";
}

router.get("/music/netease/search", async (req, res): Promise<void> => {
  const keywords = pickString(req.query.keywords).trim();
  const limit = Math.max(1, Math.min(30, Number(req.query.limit) || 12));
  if (!keywords) {
    res.status(400).json({ error: "keywords required", songs: [] });
    return;
  }

  try {
    const api = netease.cloudsearch ?? netease.search;
    const result = await api({ keywords, limit, type: 1, timestamp: Date.now() });
    const rawSongs = result.body?.result?.songs ?? [];
    res.json({ provider: "netease", songs: rawSongs.map(mapSong) });
  } catch (err) {
    req.log.error({ err: String(err) }, "NetEase search failed");
    res.status(502).json({ provider: "netease", error: "NetEase search failed", songs: [] });
  }
});

router.get("/music/netease/song-url", async (req, res): Promise<void> => {
  const id = pickString(req.query.id).trim();
  const level = pickString(req.query.level).trim() || "standard";
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }

  try {
    const api = netease.song_url_v1 ?? netease.song_url;
    const result = await api({ id, ids: id, level, timestamp: Date.now() });
    const item = result.body?.data?.[0] ?? {};
    if (!item.url) {
      res.status(404).json({
        provider: "netease",
        error: "url_unavailable",
        message: "网易云没有返回可播放地址，可能是版权、会员或地区限制。",
        code: item.code,
        fee: item.fee,
      });
      return;
    }
    res.json({
      provider: "netease",
      id,
      url: item.url,
      proxiedUrl: `/api/music/netease/audio?url=${encodeURIComponent(item.url)}`,
      level: item.level ?? level,
      type: item.type ?? "",
      size: item.size ?? 0,
      time: item.time ?? 0,
    });
  } catch (err) {
    req.log.error({ err: String(err) }, "NetEase song url failed");
    res.status(502).json({ provider: "netease", error: "NetEase song url failed" });
  }
});

router.get("/music/netease/lyric", async (req, res): Promise<void> => {
  const id = pickString(req.query.id).trim();
  if (!id) {
    res.status(400).json({ error: "id required", lyric: "" });
    return;
  }

  try {
    let body: any = {};
    let source = "lyric";
    try {
      if (typeof netease.lyric_new === "function") {
        const newer = await netease.lyric_new({ id, timestamp: Date.now() });
        body = newer.body ?? {};
        source = "lyric_new";
      }
    } catch (err) {
      req.log.warn({ err: String(err) }, "NetEase lyric_new failed, falling back");
    }
    if (!body?.lrc?.lyric && typeof netease.lyric === "function") {
      const old = await netease.lyric({ id, timestamp: Date.now() });
      body = old.body ?? body;
      source = "lyric";
    }
    res.json({
      provider: "netease",
      lyric: body?.lrc?.lyric ?? "",
      tlyric: body?.tlyric?.lyric ?? "",
      yrc: body?.yrc?.lyric ?? "",
      source,
    });
  } catch (err) {
    req.log.error({ err: String(err) }, "NetEase lyric failed");
    res.status(502).json({ provider: "netease", error: "NetEase lyric failed", lyric: "" });
  }
});

router.get("/music/netease/cover", async (req, res): Promise<void> => {
  const url = pickString(req.query.url);
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).send("Invalid cover url");
    return;
  }

  try {
    const upstream = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://music.163.com/" } });
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.send(bytes);
  } catch (err) {
    req.log.error({ err: String(err) }, "NetEase cover proxy failed");
    res.status(502).send("Cover proxy failed");
  }
});

router.get("/music/netease/audio", async (req, res): Promise<void> => {
  const url = pickString(req.query.url);
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).send("Invalid audio url");
    return;
  }

  try {
    const headers: Record<string, string> = { "User-Agent": UA, Referer: "https://music.163.com/" };
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(url, { headers });
    res.status(upstream.status);
    res.setHeader("Content-Type", audioContentTypeForUrl(url, upstream.headers.get("content-type")));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Accept-Ranges", "bytes");
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.send(bytes);
  } catch (err) {
    req.log.error({ err: String(err) }, "NetEase audio proxy failed");
    res.status(502).send("Audio proxy failed");
  }
});

export default router;
