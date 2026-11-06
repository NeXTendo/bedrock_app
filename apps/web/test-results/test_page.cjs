const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch (e) {
    console.error('Failed to launch browser directly, trying with executable path...', e.message);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
  }
  
  const page = await browser.newPage();
  
  // Capture page logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));
  page.on('error', err => console.error('ERROR:', err.toString()));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

  console.log('Navigating to http://localhost:5173/login ...');
  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('Navigation successful!');
    
    // Dump page content info
    const title = await page.title();
    console.log('Page Title:', title);
    const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML);
    console.log('Root element inner HTML length:', rootHtml?.length || 0);
    console.log('Root HTML preview:', rootHtml ? rootHtml.substring(0, 500) : 'null');
  } catch (err) {
    console.error('Failed to navigate:', err.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
