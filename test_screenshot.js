const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const cookiesText = fs.readFileSync('cookies.txt', 'utf8');
  const cookies = [];
  for (const line of cookiesText.split('\n')) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length >= 7) {
      cookies.push({
        domain: parts[0].replace('#HttpOnly_', ''),
        path: parts[2],
        secure: parts[3] === 'TRUE',
        expires: parseInt(parts[4]),
        name: parts[5],
        value: parts[6].trim(),
        httpOnly: line.startsWith('#HttpOnly_')
      });
    }
  }
  
  await page.setCookie(...cookies);
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log('Navigating...');
  await page.goto('https://www.instagram.com/reel/C2WkL2ZIV6y/', { waitUntil: 'networkidle2' });
  
  console.log('Title:', await page.title());
  
  // Take screenshot to see what Instagram is serving
  await page.screenshot({ path: 'instagram_debug.png' });
  console.log('Saved screenshot to instagram_debug.png');
  
  await browser.close();
})();
