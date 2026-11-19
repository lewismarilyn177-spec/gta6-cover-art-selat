import { chromium } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

page.on('pageerror', error => {
  pageErrors.push(error.message + '\n' + error.stack);
  console.log('PAGE ERROR DETAIL:', error.message, error.stack);
});

page.on('requestfailed', request => {
  consoleErrors.push(`404/Failed: ${request.url()} - ${request.failure()?.errorText || 'unknown'}`);
});

page.on('response', response => {
  if (response.status() >= 400) {
    consoleErrors.push(`HTTP ${response.status()}: ${response.url()}`);
  }
});

// Listen for unhandled promise rejections
await page.addInitScript(() => {
  window.addEventListener('unhandledrejection', event => {
    console.error('UNHANDLED REJECTION:', event.reason);
  });
  window.addEventListener('error', event => {
    console.error('WINDOW ERROR:', event.message, event.error?.stack);
  });
});

await page.goto('http://localhost:8097', { waitUntil: 'networkidle' });

// Load a photo through the app's own file input
const photoInput = page.locator('#photo-input');
if (await photoInput.count() > 0) {
  await photoInput.setInputFiles('/root/makefun/gta6-cover-art-selat/app/samples/boulevard.jpg');
  await page.waitForTimeout(1500);
} else {
  console.log('No visible file input found (#photo-input)');
}

await page.waitForTimeout(1500);
await page.screenshot({ path: 'shoot-debug.png', fullPage: true });

await browser.close();

console.log('=== CONSOLE ERRORS ===');
consoleErrors.forEach(e => console.log(e));
console.log('=== PAGE ERRORS ===');
pageErrors.forEach(e => console.log(e));

if (consoleErrors.length > 0 || pageErrors.length > 0) {
  process.exit(1);
} else {
  console.log('SUCCESS: No errors found');
  process.exit(0);
}