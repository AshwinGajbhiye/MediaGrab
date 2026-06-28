const express = require('express');
const axios = require('axios');
const path = require('path');
const https = require('https');
const http = require('http');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════
// API Routes (Powered by RapidAPI)
// ═══════════════════════════════════════

app.post('/api/fetch-reel', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const rapidApiHost = process.env.RAPIDAPI_HOST;
    const rapidApiEndpoint = process.env.RAPIDAPI_URL;

    if (!rapidApiKey || !rapidApiHost || !rapidApiEndpoint) {
      return res.status(500).json({
        error: 'RAPIDAPI_KEY, RAPIDAPI_HOST, or RAPIDAPI_URL is missing in your .env file!'
      });
    }

    console.log(`\n🔍 Fetching Reel via RapidAPI: ${url}`);

    // Call the RapidAPI endpoint
    const response = await axios.get(rapidApiEndpoint, {
      params: { url: url },
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': rapidApiHost
      }
    });

    const data = response.data;
    
    // The specific API "Instagram Downloader - Scraper" structure
    if (!data || !data.media || data.media.length === 0) {
      return res.status(404).json({ error: 'Failed to extract video data from the API.' });
    }

    const item = data.media[0];
    
    if (!item.is_video) {
        return res.status(404).json({ error: 'This URL points to an image, not a video.' });
    }

    const videos = [{
      url: item.url,
      quality: 'High'
    }];

    const metadata = {
      thumbnail: item.thumb || '',
      description: item.caption || 'Instagram Reel',
      uploader: item.owner?.username || 'Instagram User'
    };

    console.log(`  ✓ Extraction successful!`);
    res.json({ success: true, videos, metadata });

  } catch (err) {
    console.error('  ✗ Error:', err.message);
    if (err.response) {
      console.error('API Response:', err.response.data);
      if (err.response.status === 403) {
         return res.status(403).json({ error: 'RapidAPI Key is invalid or you are not subscribed.' });
      }
    }
    res.status(500).json({ error: 'API Request failed. Check your API key and limits.' });
  }
});

app.post('/api/fetch-youtube', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const rapidApiKey = process.env.RAPIDAPI_YT_KEY || process.env.RAPIDAPI_KEY;
    const rapidApiHost = process.env.RAPIDAPI_YT_HOST;
    const rapidApiEndpoint = process.env.RAPIDAPI_YT_URL;

    if (!rapidApiKey || !rapidApiHost || !rapidApiEndpoint) {
      return res.status(500).json({
        error: 'RAPIDAPI_YT_HOST or RAPIDAPI_YT_URL is missing in your .env file for YouTube support!'
      });
    }

    console.log(`\n🔍 Fetching YouTube Video via RapidAPI: ${url}`);

    // Some APIs use 'url', some use 'id'. We pass both for maximum compatibility.
    // We try to extract ID from URL
    let videoId = url;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) videoId = parsed.pathname.slice(1);
      else if (parsed.hostname.includes('youtube.com')) {
        if (parsed.pathname.includes('/shorts/')) videoId = parsed.pathname.split('/shorts/')[1];
        else videoId = parsed.searchParams.get('v');
      }
    } catch(e) {}

    const response = await axios.get(rapidApiEndpoint, {
      params: { id: videoId, videoId: videoId, url: url },
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': rapidApiHost
      }
    });

    const data = response.data;
    
    // Generic parsing attempting to handle various YouTube APIs
    // e.g. youtube-media-downloader, yt-api, etc.
    let videoUrl = null;
    let quality = 'High';
    let thumb = '';
    let title = 'YouTube Video';
    let author = 'YouTube';

    // 1. youtube-media-downloader format (data.videos.items)
    if (data.videos && data.videos.items && Array.isArray(data.videos.items)) {
      const vidsWithAudio = data.videos.items.filter(v => v.hasAudio);
      if (vidsWithAudio.length > 0) {
        // Find highest quality with audio
        videoUrl = vidsWithAudio[0].url;
        quality = vidsWithAudio[0].quality || 'High';
      } else if (data.videos.items.length > 0) {
        videoUrl = data.videos.items[0].url;
        quality = data.videos.items[0].quality || 'High';
      }
    }
    // 2. Generic format fallback
    else if (data.link) videoUrl = data.link;
    else if (data.url) videoUrl = data.url;
    else if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) videoUrl = data.videos[0].url;
    else if (data.formats && Array.isArray(data.formats) && data.formats.length > 0) {
      const mp4s = data.formats.filter(f => f.ext === 'mp4' || f.mimeType?.includes('mp4')).sort((a,b) => (b.height || 0) - (a.height || 0));
      videoUrl = mp4s.length > 0 ? mp4s[0].url : data.formats[0].url;
      quality = mp4s.length > 0 && mp4s[0].height ? `${mp4s[0].height}p` : 'High';
    }
    
    // Metadata extraction
    if (data.title) title = data.title;
    
    if (data.thumbnails && Array.isArray(data.thumbnails)) {
      // Get the highest resolution thumbnail (usually the last one)
      thumb = data.thumbnails[data.thumbnails.length - 1].url;
    } else if (data.thumbnail) {
      thumb = Array.isArray(data.thumbnail) ? data.thumbnail[0].url : (typeof data.thumbnail === 'string' ? data.thumbnail : '');
    }

    if (data.channel && data.channel.name) author = data.channel.name;
    else if (data.author) author = data.author.name || data.author;
    else if (data.channelTitle) author = data.channelTitle;

    if (!videoUrl) {
      console.error('Data received:', JSON.stringify(data).slice(0,300));
      return res.status(404).json({ error: 'Failed to extract video data. API response format unknown.' });
    }

    const videos = [{ url: videoUrl, quality }];
    const metadata = { thumbnail: thumb, description: title, uploader: author };

    console.log(`  ✓ Extraction successful!`);
    res.json({ success: true, videos, metadata });

  } catch (err) {
    console.error('  ✗ Error:', err.message);
    if (err.response) {
      console.error('API Response:', err.response.data);
      if (err.response.status === 403) return res.status(403).json({ error: 'RapidAPI Key is invalid.' });
    }
    res.status(500).json({ error: 'API Request failed.' });
  }
});

// Proxy download (Instagram CDN requires proxying due to CORS)
app.get('/api/download', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'Video URL is required' });

    const parsedUrl = new URL(videoUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const isYouTube = videoUrl.includes('googlevideo.com') || videoUrl.includes('youtube');
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    if (!isYouTube) {
      headers['Referer'] = 'https://www.instagram.com/';
    }

    const proxyReq = protocol.get(videoUrl, {
      headers: headers
    }, (proxyRes) => {
      if ([301, 302, 303, 307].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        res.redirect(`/api/download?url=${encodeURIComponent(proxyRes.headers.location)}`);
        proxyRes.resume();
        return;
      }

      if (proxyRes.statusCode !== 200) {
        proxyRes.resume();
        if (!res.headersSent) res.status(502).json({ error: 'Failed to download video from CDN', status: proxyRes.statusCode });
        return;
      }

      const contentType = proxyRes.headers['content-type'] || 'video/mp4';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="mediagrab_${isYouTube ? 'youtube' : 'insta'}_${Date.now()}.mp4"`);
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    });
    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).json({ error: 'Download timed out' });
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🎬 Instagram Reel Downloader (RapidAPI Mode)`);
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ℹ  ${process.env.RAPIDAPI_KEY ? '✅ RAPIDAPI_KEY loaded.' : '❌ RAPIDAPI_KEY missing!'}\n`);
});
