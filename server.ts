import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import ytSearch from "yt-search";
import * as cheerio from "cheerio";

async function scrapeUrlForMetadata(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    let title = $('meta[property="og:title"]').attr('content') || $('title').text();
    let description = $('meta[property="og:description"]').attr('content') || '';
    let image = $('meta[property="og:image"]').attr('content') || '';

    let artist = '';

    // Clean up specific platforms
    if (url.includes('spotify.com')) {
      title = title.replace(' - song and lyrics by ', ' ');
      artist = description.split('·')[0].trim();
    } else if (url.includes('apple.com')) {
      title = title.replace(' on Apple Music', '');
      artist = description.split('·')[0].trim();
    }

    return { title, artist, image };
  } catch (error) {
    console.error("Scraping failed:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route to proxy Odesli API requests
  app.get("/api/convert", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      let data: any = null;
      let odesliFailed = false;

      try {
        const response = await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
          odesliFailed = true;
        } else {
          data = await response.json();
        }
      } catch (e) {
        odesliFailed = true;
      }

      // If Odesli failed (e.g. 429 Too Many Requests), fallback to scraping
      if (odesliFailed || !data) {
        console.log("Odesli failed, falling back to scraping...");
        const meta = await scrapeUrlForMetadata(url);
        
        if (!meta || !meta.title) {
          return res.status(404).json({ error: "Failed to find the song. Please check the link and try again." });
        }

        const query = `${meta.title} ${meta.artist}`.trim();
        const searchResult = await ytSearch(query);
        
        if (searchResult && searchResult.videos.length > 0) {
          const firstVideo = searchResult.videos[0];
          
          return res.json({
            entityUniqueId: "SCRAPED_FALLBACK",
            entitiesByUniqueId: {
              "SCRAPED_FALLBACK": {
                title: meta.title,
                artistName: meta.artist,
                thumbnailUrl: meta.image || firstVideo.thumbnail
              }
            },
            linksByPlatform: {
              youtube: { url: firstVideo.url },
              youtubeMusic: { url: firstVideo.url.replace('youtube.com', 'music.youtube.com') }
            }
          });
        } else {
          return res.status(404).json({ error: "Could not find a YouTube link for this track." });
        }
      }

      // If Odesli succeeded, check if YouTube links exist
      const youtubeLink = data.linksByPlatform?.youtube?.url;
      const ytMusicLink = data.linksByPlatform?.youtubeMusic?.url;

      // If no YouTube links in Odesli response, fallback to yt-search
      if (!youtubeLink && !ytMusicLink) {
        const entityId = data.entityUniqueId;
        const entity = data.entitiesByUniqueId[entityId];
        
        if (entity && entity.title && entity.artistName) {
          const query = `${entity.title} ${entity.artistName}`;
          try {
            const searchResult = await ytSearch(query);
            if (searchResult && searchResult.videos.length > 0) {
              const firstVideo = searchResult.videos[0];
              
              if (!data.linksByPlatform) data.linksByPlatform = {};
              data.linksByPlatform.youtube = { url: firstVideo.url };
              data.linksByPlatform.youtubeMusic = { url: firstVideo.url.replace('youtube.com', 'music.youtube.com') };
            }
          } catch (searchError) {
            console.error("YouTube search fallback failed:", searchError);
          }
        }
      }

      res.json(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
