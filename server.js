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
    if (!rapidApiKey) {
      return res.status(500).json({
        error: 'RAPIDAPI_KEY is missing in your .env file!'
      });
    }

    const options = {
      method: 'GET',
      url: 'https://instagram-scraper-api2.p.rapidapi.com/v1/post_info',
      params: { code_or_id_or_url: url },
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com'
      }
    };

    console.log(`\n🔍 Fetching Reel via RapidAPI: ${url}`);
    
    const response = await axios.request(options);

    // Parse instagram-scraper-api2 response
    if (response.data && response.data.data && response.data.data.video_url) {
        console.log('  ✓ Extraction successful!');
        return res.json({
          videos: [ { url: response.data.data.video_url, quality: 'HD' } ],
          metadata: {
            thumbnail: response.data.data.thumbnail_url || '',
            description: response.data.data.caption_text || 'Instagram Reel',
            uploader: response.data.data.owner?.username || 'Instagram User'
          }
        });
    } else {
        console.log('  ✗ Video URL not found in RapidAPI response');
        return res.status(500).json({ error: 'Could not extract video URL from RapidAPI response', details: response.data });
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    if (error.response) {
       console.log('API Response:', error.response.data);
       if (error.response.data.message === 'You are not subscribed to this API.') {
          return res.status(403).json({ error: 'API_NOT_SUBSCRIBED', message: 'You must subscribe to instagram-scraper-api2 on RapidAPI.' });
       }
       if (error.response.status === 403) {
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

    console.log(`\n🔍 Fetching YouTube Video via yt-dlp: ${url}`);

    const youtubedl = require('youtube-dl-exec');
    
    // Use yt-dlp to extract the video URL locally. This ensures the CDN URL is tied
    // to the server's IP address, preventing 403 Forbidden errors during proxying.
    const output = await youtubedl(url, {
        dumpJson: true,
        noWarnings: true,
        callHome: false,
        noCheckCertificate: true,
        format: 'best' // get best video/audio combined
    });

    if (output && output.url) {
        console.log('  ✓ Extraction successful!');
        res.json({
          success: true,
          videos: [{ url: output.url, quality: output.resolution || 'HD' }],
          metadata: {
            thumbnail: output.thumbnail || '',
            description: output.title || 'YouTube Short',
            uploader: output.uploader || 'YouTube Channel'
          }
        });
    } else {
        console.log('  ✗ Video URL not found');
        res.status(500).json({ error: 'Could not extract video URL' });
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch YouTube video details.' });
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
