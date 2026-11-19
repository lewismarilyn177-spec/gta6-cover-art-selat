let fontLoaded = false;
let fontFace = null;

async function loadAntonFont() {
  if (fontLoaded) return;
  const response = await fetch('fonts/Anton-Regular.ttf');
  const arrayBuffer = await response.arrayBuffer();
  fontFace = new FontFace('Anton', arrayBuffer);
  await fontFace.load();
  document.fonts.add(fontFace);
  fontLoaded = true;
}

function makeSeededRandom(seed) {
  let state = seed >>> 0;
  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function drawPanelBackground(ctx, panelRect, grade) {
  const { x, y, width, height } = panelRect;
  ctx.fillStyle = '#0d0a0f';
  ctx.fillRect(x, y, width, height);
}

function drawPanelImage(ctx, img, panelRect, panel) {
  const { x, y, width, height } = panelRect;
  const { offsetX, offsetY, zoom, rotation } = panel;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  const baseScale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const scale = baseScale * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.translate(offsetX, offsetY);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

  ctx.restore();
}

function applySunsetGrade(ctx, panelRect, intensity) {
  if (intensity <= 0) return;
  const { x, y, width, height } = panelRect;
  const grad = ctx.createLinearGradient(x, y, x, y + height);
  const i = intensity / 100;
  grad.addColorStop(0, `rgba(255, 160, 60, ${0.25 * i})`);
  grad.addColorStop(0.25, `rgba(255, 120, 80, ${0.45 * i})`);
  grad.addColorStop(0.5, `rgba(232, 62, 140, ${0.65 * i})`);
  grad.addColorStop(0.75, `rgba(188, 19, 254, ${0.75 * i})`);
  grad.addColorStop(1, `rgba(120, 10, 180, ${0.85 * i})`);
  ctx.fillStyle = grad;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillRect(x, y, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function applyNeonGlow(ctx, panelRect, intensity) {
  if (intensity <= 0) return;
  const { x, y, width, height } = panelRect;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const radius = Math.max(width, height) * 0.7;
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
  const ng = intensity / 100;
  grad.addColorStop(0, `rgba(0, 255, 247, ${0.0 * ng})`);
  grad.addColorStop(0.5, `rgba(0, 255, 247, ${0.15 * ng})`);
  grad.addColorStop(0.7, `rgba(232, 62, 140, ${0.35 * ng})`);
  grad.addColorStop(0.85, `rgba(188, 19, 254, ${0.55 * ng})`);
  grad.addColorStop(1, `rgba(120, 10, 180, ${0.75 * ng})`);
  ctx.fillStyle = grad;
  ctx.globalCompositeOperation = 'screen';
  ctx.fillRect(x, y, width, height);
  ctx.globalCompositeOperation = 'source-over';

  const rimGrad = ctx.createLinearGradient(x, y, x + width, y + height);
  rimGrad.addColorStop(0, `rgba(0, 255, 247, ${0.4 * ng})`);
  rimGrad.addColorStop(0.5, `rgba(232, 62, 140, ${0.5 * ng})`);
  rimGrad.addColorStop(1, `rgba(188, 19, 254, ${0.4 * ng})`);
  ctx.strokeStyle = rimGrad;
  ctx.lineWidth = Math.max(2, Math.min(width, height) * 0.015 * ng);
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
}

function applyVignette(ctx, panelRect, intensity) {
  if (intensity <= 0) return;
  const { x, y, width, height } = panelRect;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const radius = Math.max(width, height) * 0.65;
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
  const vg = intensity / 100;
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.5, 'rgba(13, 10, 15, 0)');
  grad.addColorStop(0.75, `rgba(13, 10, 15, ${0.4 * vg})`);
  grad.addColorStop(1, `rgba(13, 10, 15, ${0.9 * vg})`);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, width, height);
}

function applyFilmGrain(ctx, panelRect, intensity, seed) {
  if (intensity <= 0) return;
  const { x, y, width, height } = panelRect;
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  const rand = makeSeededRandom(seed);
  const g = intensity / 100;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (rand() - 0.5) * 40 * g;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, x, y);
}

async function drawCaption(ctx, canvasRect, caption, style) {
  const { width, height } = canvasRect;
  const { fontSize, letterSpacing, textColor, outlineThickness, alignment } = style;
  const text = caption.trim().toUpperCase();
  if (!text) return;

  await loadAntonFont();

  ctx.font = `900 ${fontSize}px 'Anton', sans-serif`;
  ctx.textAlign = alignment;
  ctx.textBaseline = 'bottom';
  ctx.letterSpacing = `${letterSpacing}px`;

  let x;
  if (alignment === 'left') x = width * 0.05;
  else if (alignment === 'right') x = width * 0.95;
  else x = width / 2;

  const y = height - height * 0.04;

  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;

  // Thick dark outline (ink color) - drawn first, wider
  if (outlineThickness > 0) {
    ctx.strokeStyle = '#0d0a0f';
    ctx.lineWidth = outlineThickness * 3;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);
  }

  // Gradient fill: sunset-orange to sunset-magenta - horizontal across text
  const gradient = ctx.createLinearGradient(x - textWidth / 2, y - fontSize, x + textWidth / 2, y);
  gradient.addColorStop(0, '#ff7b2a');
  gradient.addColorStop(0.3, '#ff9f4a');
  gradient.addColorStop(0.7, '#e83e8c');
  gradient.addColorStop(1, '#bc13fe');
  
  ctx.fillStyle = gradient;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = fontSize * 0.2;
  ctx.shadowOffsetY = fontSize * 0.08;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Subtle highlight on top edge
  const highlightGrad = ctx.createLinearGradient(x - textWidth / 2, y - fontSize, x - textWidth / 2, y);
  highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlightGrad;
  ctx.fillText(text, x, y);
}

function computePanelRects(canvasWidth, canvasHeight) {
  const gutter = 4;
  const isLandscape = canvasWidth > canvasHeight;
  const rects = [];

  if (isLandscape) {
    const panelWidth = (canvasWidth - gutter * 2) / 3;
    const panelHeight = canvasHeight;
    for (let i = 0; i < 3; i++) {
      rects.push({
        x: i * (panelWidth + gutter),
        y: 0,
        width: panelWidth,
        height: panelHeight
      });
    }
  } else {
    const panelWidth = (canvasWidth - gutter) / 2;
    const panelHeight = (canvasHeight - gutter) / 2;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        rects.push({
          x: col * (panelWidth + gutter),
          y: row * (panelHeight + gutter),
          width: panelWidth,
          height: panelHeight
        });
      }
    }
  }
  return rects;
}

function drawPanelGutters(ctx, panelRects, canvasWidth, canvasHeight) {
  const gutter = 4;
  ctx.fillStyle = '#0d0a0f';
  
  // Draw horizontal gutter
  const midY = canvasHeight / 2;
  ctx.fillRect(0, midY - gutter / 2, canvasWidth, gutter);
  
  // Draw vertical gutter
  const midX = canvasWidth / 2;
  ctx.fillRect(midX - gutter / 2, 0, gutter, canvasHeight);
  
  // Draw outer border
  ctx.strokeStyle = '#1f1a2a';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);
}

export async function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  const panelRects = computePanelRects(width, height);
  const { panels, grade, caption, captionStyle } = state;

  // Fill entire canvas with ink base first
  ctx.fillStyle = '#0d0a0f';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < panelRects.length; i++) {
    const panelRect = panelRects[i];
    const panel = panels[i];
    drawPanelBackground(ctx, panelRect, grade);

    if (panel && panel.image) {
      const img = await loadImage(panel.image);
      drawPanelImage(ctx, img, panelRect, panel);
    }

    applySunsetGrade(ctx, panelRect, grade.sunsetIntensity);
    applyNeonGlow(ctx, panelRect, grade.neonGlow);
    applyVignette(ctx, panelRect, grade.vignette);
    applyFilmGrain(ctx, panelRect, grade.grain, i * 1000 + 42);
  }

  // Draw panel gutters and outer border
  drawPanelGutters(ctx, panelRects, width, height);

  const canvasRect = { width, height };
  await drawCaption(ctx, canvasRect, caption, captionStyle);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function gradeCanvas(ctx, w, h, grade) {
  const canvasRect = { x: 0, y: 0, width: w, height: h };
  applySunsetGrade(ctx, canvasRect, grade.sunsetIntensity);
  applyNeonGlow(ctx, canvasRect, grade.neonGlow);
  applyVignette(ctx, canvasRect, grade.vignette);
  applyFilmGrain(ctx, canvasRect, grade.grain, 999);
}