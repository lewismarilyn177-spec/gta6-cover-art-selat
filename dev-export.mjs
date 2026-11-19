import { chromium } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const screenshotsDir = '/root/makefun/gta6-cover-art-selat/screenshots';

function cleanupOldScreenshots() {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  const files = fs.readdirSync(screenshotsDir);
  for (const file of files) {
    const filePath = path.join(screenshotsDir, file);
    fs.unlinkSync(filePath);
    console.log(`Deleted old: ${file}`);
  }
}

async function getImageDimensions(page, filePath) {
  return await page.evaluate(async (filePath) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = filePath;
    });
  }, filePath);
}

async function saveJpegWithConstraints(page, dataUrl, filePath, maxSizeKB = 256, maxLongSide = 1280, minShortSide = 480) {
  const base64 = dataUrl.split(',')[1];
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(filePath, buffer);
  
  let quality = 85;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const stats = fs.statSync(filePath);
    const sizeKB = stats.size / 1024;
    
    const fileUrl = `file://${filePath}`;
    await page.goto(fileUrl, { waitUntil: 'load' });
    const dims = await getImageDimensions(page, fileUrl);
    
    const longSide = Math.max(dims.width, dims.height);
    const shortSide = Math.min(dims.width, dims.height);
    
    console.log(`  Attempt ${attempts + 1}: ${path.basename(filePath)} - ${sizeKB.toFixed(1)} KB, ${dims.width}x${dims.height} (long: ${longSide}, short: ${shortSide}), quality: ${quality}`);
    
    if (sizeKB <= maxSizeKB && longSide <= maxLongSide && shortSide >= minShortSide) {
      console.log(`  ✓ PASS: ${filePath}`);
      return true;
    }
    
    if (sizeKB > maxSizeKB) {
      quality = Math.max(10, quality - 10);
    }
    if (longSide > maxLongSide || shortSide < minShortSide) {
      quality = Math.max(10, quality - 15);
    }
    
    await page.evaluate(async ({ dataUrl, quality, targetLongSide, targetShortSide }) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const srcW = img.naturalWidth;
          const srcH = img.naturalHeight;
          const srcAspect = srcW / srcH;
          
          let dstW, dstH;
          if (srcAspect >= 1) {
            dstW = targetLongSide;
            dstH = Math.round(targetLongSide / srcAspect);
          } else {
            dstH = targetLongSide;
            dstW = Math.round(targetLongSide * srcAspect);
          }
          
          if (dstH < targetShortSide) {
            dstH = targetShortSide;
            dstW = Math.round(targetShortSide * srcAspect);
          }
          if (dstW < targetShortSide) {
            dstW = targetShortSide;
            dstH = Math.round(targetShortSide / srcAspect);
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = dstW;
          canvas.height = dstH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, dstW, dstH);
          
          canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'temp.jpg';
            a.click();
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', quality / 100));
          }, 'image/jpeg', quality / 100);
        };
        img.src = dataUrl;
      });
    }, { dataUrl, quality, targetLongSide: maxLongSide, targetShortSide: minShortSide });
    
    attempts++;
  }
  
  console.log(`  ✗ FAIL: Could not meet constraints for ${filePath} after ${maxAttempts} attempts`);
  return false;
}

async function captureCanvasAsJpeg(page, canvasSelector, targetLongSide, targetShortSide, quality = 85) {
  return await page.evaluate(async ({ canvasSelector, targetLongSide, targetShortSide, quality }) => {
    const canvas = document.querySelector(canvasSelector);
    if (!canvas) throw new Error(`Canvas not found: ${canvasSelector}`);
    
    const srcW = canvas.width;
    const srcH = canvas.height;
    const srcAspect = srcW / srcH;
    
    let dstW, dstH;
    if (srcAspect >= 1) {
      dstW = targetLongSide;
      dstH = Math.round(targetLongSide / srcAspect);
    } else {
      dstH = targetLongSide;
      dstW = Math.round(targetLongSide * srcAspect);
    }
    
    if (dstH < targetShortSide) {
      dstH = targetShortSide;
      dstW = Math.round(targetShortSide * srcAspect);
    }
    if (dstW < targetShortSide) {
      dstW = targetShortSide;
      dstH = Math.round(targetShortSide / srcAspect);
    }
    
    const offscreen = document.createElement('canvas');
    offscreen.width = dstW;
    offscreen.height = dstH;
    const octx = offscreen.getContext('2d');
    octx.drawImage(canvas, 0, 0, dstW, dstH);
    
    return new Promise((resolve) => {
      offscreen.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality / 100);
    });
  }, { canvasSelector, targetLongSide, targetShortSide, quality });
}

async function main() {
  cleanupOldScreenshots();
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const consoleErrors = [];
  const pageErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => {
    pageErrors.push(error.message + '\n' + error.stack);
  });
  page.on('requestfailed', request => {
    consoleErrors.push(`404/Failed: ${request.url()} - ${request.failure()?.errorText || 'unknown'}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) consoleErrors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', event => console.error('UNHANDLED REJECTION:', event.reason));
    window.addEventListener('error', event => console.error('WINDOW ERROR:', event.message, event.error?.stack));
  });
  
  console.log('Loading app...');
  await page.goto('http://localhost:8097', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  console.log('Loading photo...');
  const photoInput = page.locator('#photo-input');
  if (await photoInput.count() > 0) {
    await photoInput.setInputFiles('/root/makefun/gta6-cover-art-selat/app/samples/boulevard.jpg');
    await page.waitForTimeout(2000);
  }
  
  console.log('Waiting for render...');
  await page.waitForTimeout(1000);
  
  await page.waitForSelector('#size-select', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('#preview-canvas', { state: 'visible', timeout: 10000 });
  
  // 2. Editor screenshot (full page at viewport 1280x800)
  console.log('\n=== Capturing editor screenshot (2-editor.jpg) ===');
  const editorPath = path.join(screenshotsDir, '2-editor.jpg');
  await page.screenshot({ path: editorPath, type: 'jpeg', quality: 85, fullPage: false });
  
  // Verify editor screenshot constraints
  let quality = 85;
  for (let attempt = 0; attempt < 10; attempt++) {
    const stats = fs.statSync(editorPath);
    const sizeKB = stats.size / 1024;
    const fileUrl = `file://${editorPath}`;
    await page.goto(fileUrl, { waitUntil: 'load' });
    const dims = await getImageDimensions(page, fileUrl);
    const longSide = Math.max(dims.width, dims.height);
    const shortSide = Math.min(dims.width, dims.height);
    console.log(`  Attempt ${attempt + 1}: 2-editor.jpg - ${sizeKB.toFixed(1)} KB, ${dims.width}x${dims.height} (long: ${longSide}, short: ${shortSide}), quality: ${quality}`);
    if (sizeKB <= 256 && longSide <= 1280 && shortSide >= 480) {
      console.log(`  ✓ PASS: ${editorPath}`);
      break;
    }
    if (sizeKB > 256 || longSide > 1280) {
      quality = Math.max(10, quality - 10);
      await page.screenshot({ path: editorPath, type: 'jpeg', quality, fullPage: false });
    }
  }
  
  // 3. Cover screenshots for each size
  const sizes = [
    { value: '1080x1080', file: '1-cover-square.jpg', targetLong: 1024, targetShort: 1024 },
    { value: '1080x1350', file: '3-cover-portrait.jpg', targetLong: 1280, targetShort: 1024 },
    { value: '1920x1080', file: '4-cover-wide.jpg', targetLong: 1280, targetShort: 720 }
  ];
  
  for (const size of sizes) {
    console.log(`\n=== Capturing ${size.value} cover (${size.file}) ===`);
    await page.goto('http://localhost:8097', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.evaluate((value) => {
      const select = document.querySelector('#size-select');
      if (select) {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, size.value);
    await page.waitForTimeout(2000);
    
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#preview-canvas');
      return canvas && canvas.width > 0 && canvas.height > 0 && canvas.offsetWidth > 0 && canvas.offsetHeight > 0;
    }, { timeout: 10000 });
    
    const dataUrl = await captureCanvasAsJpeg(page, '#preview-canvas', size.targetLong, size.targetShort, 85);
    const filePath = path.join(screenshotsDir, size.file);
    
    await saveJpegWithConstraints(page, dataUrl, filePath, 256, size.targetLong, size.targetShort);
  }
  
  await browser.close();
  
  console.log('\n=== CONSOLE ERRORS ===');
  consoleErrors.forEach(e => console.log(e));
  console.log('=== PAGE ERRORS ===');
  pageErrors.forEach(e => console.log(e));
  
  // Final verification
  console.log('\n=== FINAL FILE LIST ===');
  const finalFiles = ['1-cover-square.jpg', '2-editor.jpg', '3-cover-portrait.jpg', '4-cover-wide.jpg'];
  const browser2 = await chromium.launch({ headless: true });
  const page2 = await browser2.newPage();
  
  for (const file of finalFiles) {
    const filePath = path.join(screenshotsDir, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeKB = stats.size / 1024;
      
      const fileUrl = `file://${filePath}`;
      await page2.goto(fileUrl, { waitUntil: 'load' });
      const dims = await getImageDimensions(page2, fileUrl);
      
      const longSide = Math.max(dims.width, dims.height);
      const shortSide = Math.min(dims.width, dims.height);
      const pass = sizeKB <= 256 && longSide <= 1280 && shortSide >= 480;
      console.log(`${file}: ${sizeKB.toFixed(1)} KB, ${dims.width}x${dims.height} ${pass ? '✓' : '✗'}`);
    } else {
      console.log(`${file}: MISSING ✗`);
    }
  }
  
  await browser2.close();
  
  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    process.exit(1);
  } else {
    console.log('\nSUCCESS: All exports completed');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});