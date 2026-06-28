const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Set the cookie
  let sessionId = '77968152300%3A1K7OMzx0RRIHLi%3A11%3AAYjZW15Z1Bs1Hucf6EwoHmADS6OYmNSxItKh7NVyRw';
  if (sessionId.includes('%3A')) sessionId = decodeURIComponent(sessionId);
  
  await page.setCookie({
    name: 'sessionid',
    value: sessionId,
    domain: '.instagram.com',
    path: '/',
    secure: true,
    httpOnly: true,
  });

  console.log('Navigating to Reel...');
  await page.goto('https://www.instagram.com/reel/DY7DHmBu8s/', { waitUntil: 'networkidle2' });

  console.log('Waiting for video tag...');
  try {
    await page.waitForSelector('video', { timeout: 10000 });
    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video ? video.src : null;
    });

    console.log('Video Source:', videoSrc);
  } catch (err) {
    console.error('Video tag not found within 10s', err.message);
  }

  await browser.close();
})();
