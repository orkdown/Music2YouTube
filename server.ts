import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import ytSearch from "yt-search";
import * as cheerio from "cheerio";

dotenv.config();

// Follow redirects for shortened links (spotify.link, youtu.be, etc.)
async function followRedirects(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    return res.url || url;
  } catch {
    return url;
  }
}

// Direct YouTube HTML search fallback (with EU consent bypass)
async function directYoutubeSearch(query: string) {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+478",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s);
    if (!match) return null;

    const data = JSON.parse(match[1]);
    const contents =
      data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    const itemSection = contents?.find((c: any) => c.itemSectionRenderer)?.itemSectionRenderer?.contents;
    const video = itemSection?.find((i: any) => i.videoRenderer)?.videoRenderer;
    if (video && video.videoId) {
      return {
        url: `https://youtube.com/watch?v=${video.videoId}`,
        title: video.title?.runs?.[0]?.text || "",
        thumbnail:
          video.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
          `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
      };
    }
  } catch (e) {
    console.error("Direct YouTube search error:", e);
  }
  return null;
}

// Search YouTube with primary and secondary methods
async function searchYouTubeVideo(query: string) {
  try {
    const searchResult = await ytSearch(query);
    if (searchResult && searchResult.videos && searchResult.videos.length > 0) {
      const v = searchResult.videos[0];
      return {
        url: v.url,
        title: v.title,
        thumbnail: v.thumbnail,
      };
    }
  } catch (e) {
    console.warn("ytSearch failed, trying direct search fallback:", e);
  }

  return await directYoutubeSearch(query);
}

interface TrackMetadata {
  title: string;
  artist: string;
  image?: string;
  youtubeUrl?: string;
  youtubeMusicUrl?: string;
}

// Multi-provider metadata extractor
async function getTrackMetadata(rawUrl: string): Promise<TrackMetadata | null> {
  let url = rawUrl;
  if (
    url.includes("spotify.link") ||
    url.includes("page.link") ||
    url.includes("youtu.be") ||
    url.includes("vk.cc")
  ) {
    url = await followRedirects(url);
  }

  // 1. YouTube direct link
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    let videoId = "";
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.slice(1).split("?")[0];
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }
    } catch {}

    if (videoId) {
      let title = "YouTube Video";
      let artist = "";
      let image = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (oembedRes.ok) {
          const oe = await oembedRes.json();
          title = oe.title || title;
          artist = oe.author_name || "";
          image = oe.thumbnail_url || image;
        }
      } catch {}

      return {
        title,
        artist,
        image,
        youtubeUrl: `https://youtube.com/watch?v=${videoId}`,
        youtubeMusicUrl: `https://music.youtube.com/watch?v=${videoId}`,
      };
    }
  }

  // 2. Yandex Music API
  if (url.includes("music.yandex.")) {
    const trackMatch = url.match(/track\/(\d+)/);
    if (trackMatch) {
      try {
        const res = await fetch(`https://api.music.yandex.net/tracks/${trackMatch[1]}`, {
          headers: { "User-Agent": "Yandex-Music-API" },
        });
        if (res.ok) {
          const data = await res.json();
          const tr = data.result?.[0];
          if (tr) {
            const title = tr.title;
            const artist = tr.artists?.map((a: any) => a.name).join(", ") || "";
            const rawCover = tr.coverUri || tr.albums?.[0]?.coverUri || tr.artists?.[0]?.cover?.uri;
            const image = rawCover ? `https://${rawCover.replace("%%", "400x400")}` : "";
            return { title, artist, image };
          }
        }
      } catch (e) {
        console.warn("Yandex API failed:", e);
      }
    }
  }

  // 3. Deezer API
  if (url.includes("deezer.com")) {
    const trackMatch = url.match(/track\/(\d+)/);
    if (trackMatch) {
      try {
        const res = await fetch(`https://api.deezer.com/track/${trackMatch[1]}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.title) {
            return {
              title: data.title,
              artist: data.artist?.name || "",
              image: data.album?.cover_medium || "",
            };
          }
        }
      } catch (e) {
        console.warn("Deezer API failed:", e);
      }
    }
  }

  // 4. SoundCloud oEmbed
  if (url.includes("soundcloud.com")) {
    try {
      const res = await fetch(
        `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title || "",
          artist: data.author_name || "",
          image: data.thumbnail_url || "",
        };
      }
    } catch (e) {
      console.warn("SoundCloud oEmbed failed:", e);
    }
  }

  // 5. Apple Music / iTunes Lookup API
  if (url.includes("music.apple.com")) {
    const trackIdMatch =
      url.match(/[?&]i=(\d+)/) ||
      url.match(/\/album\/[^\/]+\/(\d+)/) ||
      url.match(/\/id(\d+)/);
    if (trackIdMatch) {
      try {
        const res = await fetch(`https://itunes.apple.com/lookup?id=${trackIdMatch[1]}`);
        if (res.ok) {
          const data = await res.json();
          const item = data.results?.[0];
          if (item) {
            return {
              title: item.trackName || item.collectionName || "",
              artist: item.artistName || "",
              image: item.artworkUrl100?.replace("100x100bb", "600x600bb") || "",
            };
          }
        }
      } catch (e) {
        console.warn("iTunes API failed:", e);
      }
    }
  }

  // 6. Songlink (Odesli) web page scraping (__NEXT_DATA__)
  try {
    const res = await fetch(`https://song.link/${encodeURIComponent(url)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        const pageData = data.props?.pageProps?.pageData;
        const artSection = pageData?.sections?.find(
          (s: any) => s.sectionId === "section|auto|albumArt"
        );
        if (artSection && artSection.title) {
          const listenSection = pageData?.sections?.find(
            (s: any) => s.sectionId === "section|auto|links|listen"
          );
          const ytLink = listenSection?.links?.find((l: any) => l.platform === "youtube")?.url;
          const ytMusicLink = listenSection?.links?.find(
            (l: any) => l.platform === "youtubeMusic"
          )?.url;

          return {
            title: artSection.title,
            artist: artSection.artistName || "",
            image: artSection.thumbnailUrl || "",
            youtubeUrl: ytLink,
            youtubeMusicUrl: ytMusicLink,
          };
        }
      }
    }
  } catch (e) {
    console.warn("Songlink page parsing failed:", e);
  }

  // 7. Spotify oEmbed
  if (url.includes("spotify.com")) {
    try {
      const res = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.title) {
          return {
            title: data.title,
            artist: "",
            image: data.thumbnail_url || "",
          };
        }
      }
    } catch (e) {
      console.warn("Spotify oEmbed failed:", e);
    }
  }

  // 8. Generic Open Graph scraper (Cheerio)
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    let title = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
    let description = $('meta[property="og:description"]').attr("content") || "";
    let image = $('meta[property="og:image"]').attr("content") || "";
    let artist = "";

    if (url.includes("spotify.com")) {
      title = title.replace(" - song and lyrics by ", " ");
      artist = description.split("·")[0].trim();
    } else if (url.includes("apple.com")) {
      title = title.replace(" on Apple Music", "");
      artist = description.split("·")[0].trim();
    }

    if (title && !title.includes("Listening is everything")) {
      return { title, artist, image };
    }
  } catch (e) {
    console.warn("Generic scraper failed:", e);
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API route to convert music links to YouTube
  app.get("/api/convert", async (req, res) => {
    try {
      let { url } = req.query;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      url = url.trim();

      // If user pasted a domain without scheme (e.g. open.spotify.com/track/...)
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        if (
          url.includes("spotify.com") ||
          url.includes("apple.com") ||
          url.includes("yandex.") ||
          url.includes("deezer.com") ||
          url.includes("youtube.com") ||
          url.includes("youtu.be") ||
          url.includes("soundcloud.com")
        ) {
          url = `https://${url}`;
        }
      }

      // If user provided an Odesli API key in environment, try official API first
      const odesliApiKey = process.env.ODESLI_API_KEY || process.env.SONGLINK_API_KEY;
      if (odesliApiKey) {
        try {
          const apiRes = await fetch(
            `https://api.song.link/v1-alpha.1/links?key=${encodeURIComponent(odesliApiKey)}&url=${encodeURIComponent(url)}`
          );
          if (apiRes.ok) {
            const data = await apiRes.json();
            const yt = data.linksByPlatform?.youtube?.url;
            const ytm = data.linksByPlatform?.youtubeMusic?.url;
            if (yt || ytm) {
              return res.json(data);
            }
          }
        } catch (e) {
          console.warn("Odesli API with key failed:", e);
        }
      }

      // Resolve metadata using our unified multi-provider engine
      const meta = await getTrackMetadata(url);

      // If URL could not be parsed as a music track, check if it's plain text query
      const query = meta
        ? `${meta.title} ${meta.artist}`.trim()
        : !url.startsWith("http://") && !url.startsWith("https://")
          ? url
          : "";

      if (!query && !meta?.youtubeUrl) {
        return res
          .status(404)
          .json({ error: "Failed to find the song. Please check the link and try again." });
      }

      let youtubeUrl = meta?.youtubeUrl;
      let youtubeMusicUrl = meta?.youtubeMusicUrl;
      let thumbnail = meta?.image;

      // If direct YouTube link was not present, search YouTube
      if (!youtubeUrl) {
        const ytVideo = await searchYouTubeVideo(query);
        if (ytVideo) {
          youtubeUrl = ytVideo.url;
          youtubeMusicUrl = ytVideo.url.replace("youtube.com", "music.youtube.com");
          if (!thumbnail) {
            thumbnail = ytVideo.thumbnail;
          }
        }
      }

      if (!youtubeUrl) {
        return res
          .status(404)
          .json({ error: "Could not find a YouTube link for this track." });
      }

      return res.json({
        entityUniqueId: "RESOLVED_TRACK",
        entitiesByUniqueId: {
          RESOLVED_TRACK: {
            title: meta?.title || query,
            artistName: meta?.artist || "",
            thumbnailUrl: thumbnail || "",
          },
        },
        linksByPlatform: {
          youtube: { url: youtubeUrl },
          youtubeMusic: {
            url: youtubeMusicUrl || youtubeUrl.replace("youtube.com", "music.youtube.com"),
          },
        },
      });
    } catch (error) {
      console.error("Conversion error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development vs static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, safely resolve dist folder
    const distPath = fs.existsSync(path.join(__dirname, "index.html"))
      ? __dirname
      : fs.existsSync(path.join(process.cwd(), "dist"))
        ? path.join(process.cwd(), "dist")
        : path.join(__dirname, "dist");

    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
