import { drawCover } from './cover.js';
import { captureShot } from './shots.js';

const state = {
  panels: [
    { id: 0, image: null, revoke: null, offsetX: 0, offsetY: 0, zoom: 1, rotation: 0 },
    { id: 1, image: null, revoke: null, offsetX: 0, offsetY: 0, zoom: 1, rotation: 0 },
    { id: 2, image: null, revoke: null, offsetX: 0, offsetY: 0, zoom: 1, rotation: 0 },
    { id: 3, image: null, revoke: null, offsetX: 0, offsetY: 0, zoom: 1, rotation: 0 }
  ],
  caption: 'PALM COAST HEIST',
  size: '1080x1080',
  grade: {
    sunsetIntensity: 85,
    neonGlow: 70,
    vignette: 60,
    grain: 25
  },
  captionStyle: {
    fontSize: 96,
    letterSpacing: 12,
    textColor: '#ffffff',
    outlineThickness: 5,
    alignment: 'center'
  },
  activePanel: 0,
  dragState: null
};

const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d');

const panelsContainer = document.getElementById('panels-container');
const captionInput = document.getElementById('caption-input');
const sizeSelect = document.getElementById('size-select');
const exportBtn = document.getElementById('export-png');
const addPhotoBtn = document.getElementById('add-photo');
const photoInput = document.getElementById('photo-input');

const sunsetIntensity = document.getElementById('sunset-intensity');
const sunsetIntensityVal = document.getElementById('sunset-intensity-val');
const neonGlow = document.getElementById('neon-glow');
const neonGlowVal = document.getElementById('neon-glow-val');
const vignette = document.getElementById('vignette');
const vignetteVal = document.getElementById('vignette-val');
const grain = document.getElementById('grain');
const grainVal = document.getElementById('grain-val');

const fontSize = document.getElementById('font-size');
const fontSizeVal = document.getElementById('font-size-val');
const letterSpacing = document.getElementById('letter-spacing');
const letterSpacingVal = document.getElementById('letter-spacing-val');
const textColor = document.getElementById('text-color');
const outlineThickness = document.getElementById('outline-thickness');
const outlineThicknessVal = document.getElementById('outline-thickness-val');
const captionAlign = document.getElementById('caption-align');

function parseSize(sizeStr) {
  const [w, h] = sizeStr.split('x').map(Number);
  return { width: w, height: h };
}

function setCanvasSize() {
  const { width, height } = parseSize(state.size);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createPanelCards() {
  panelsContainer.innerHTML = '';
  state.panels.forEach((panel, index) => {
    const card = document.createElement('div');
    card.className = 'panel-card';
    card.dataset.panelIndex = index;
    if (index === state.activePanel) card.classList.add('active');
    if (panel.image) card.classList.add('has-image');

    card.innerHTML = `
      <input type="file" class="panel-file-input" accept="image/*" data-panel="${index}" hidden>
      <span class="panel-badge">PANEL ${index + 1}</span>
      ${panel.image
        ? `<img class="panel-preview" src="${panel.image}" alt="Panel ${index + 1} preview">`
        : `<div class="panel-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>EMPTY SLOT</span>
          </div>`
      }
      <div class="panel-controls">
        <div class="panel-control-row">
          <label>Zoom</label>
          <input type="range" class="panel-zoom" min="10" max="300" value="${Math.round(panel.zoom * 100)}" aria-label="Zoom level">
          <output>${Math.round(panel.zoom * 100)}%</output>
        </div>
        <div class="panel-control-row">
          <label>Pos X</label>
          <input type="range" class="panel-offset-x" min="-200" max="200" value="${Math.round(panel.offsetX)}" aria-label="Horizontal position">
          <output>${Math.round(panel.offsetX)}</output>
        </div>
        <div class="panel-control-row">
          <label>Pos Y</label>
          <input type="range" class="panel-offset-y" min="-200" max="200" value="${Math.round(panel.offsetY)}" aria-label="Vertical position">
          <output>${Math.round(panel.offsetY)}</output>
        </div>
        <button type="button" class="panel-btn panel-reset">Reset Crop</button>
      </div>
    `;

    const fileInput = card.querySelector('.panel-file-input');
    fileInput.addEventListener('change', (e) => handlePhotoSelect(e.target.files[0], index));

    const preview = card.querySelector('.panel-preview');
    if (preview) {
      preview.style.transform = `translate(${panel.offsetX}px, ${panel.offsetY}px) scale(${panel.zoom}) rotate(${panel.rotation}deg)`;
    }

    card.addEventListener('click', (e) => {
      if (e.target.closest('.panel-controls')) return;
      if (e.target.closest('.panel-file-input')) return;
      if (!panel.image) {
        fileInput.click();
        return;
      }
      setActivePanel(index);
    });

    const zoomInput = card.querySelector('.panel-zoom');
    const zoomOutput = card.querySelector('.panel-control-row output');
    zoomInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      state.panels[index].zoom = val;
      zoomOutput.textContent = `${e.target.value}%`;
      if (preview) {
        preview.style.transform = `translate(${state.panels[index].offsetX}px, ${state.panels[index].offsetY}px) scale(${val}) rotate(${state.panels[index].rotation}deg)`;
      }
      requestRender();
    });

    const offsetXInput = card.querySelector('.panel-offset-x');
    const offsetXOutput = offsetXInput.parentElement.querySelector('output');
    offsetXInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.panels[index].offsetX = val;
      offsetXOutput.textContent = val;
      if (preview) {
        preview.style.transform = `translate(${val}px, ${state.panels[index].offsetY}px) scale(${state.panels[index].zoom}) rotate(${state.panels[index].rotation}deg)`;
      }
      requestRender();
    });

    const offsetYInput = card.querySelector('.panel-offset-y');
    const offsetYOutput = offsetYInput.parentElement.querySelector('output');
    offsetYInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.panels[index].offsetY = val;
      offsetYOutput.textContent = val;
      if (preview) {
        preview.style.transform = `translate(${state.panels[index].offsetX}px, ${val}px) scale(${state.panels[index].zoom}) rotate(${state.panels[index].rotation}deg)`;
      }
      requestRender();
    });

    const resetBtn = card.querySelector('.panel-reset');
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = state.panels[index];
      if (panel.image && panel.revoke) {
        panel.revoke();
        panel.revoke = null;
      }
      panel.image = null;
      panel.offsetX = 0;
      panel.offsetY = 0;
      panel.zoom = 1;
      panel.rotation = 0;
      offsetXInput.value = 0;
      offsetXOutput.textContent = 0;
      offsetYInput.value = 0;
      offsetYOutput.textContent = 0;
      zoomInput.value = 100;
      zoomOutput.textContent = '100%';
      if (preview) {
        preview.style.transform = 'translate(0, 0) scale(1) rotate(0deg)';
      }
      createPanelCards();
      requestRender();
    });

    panelsContainer.appendChild(card);
  });
}

function setActivePanel(index) {
  state.activePanel = index;
  document.querySelectorAll('.panel-card').forEach((card, i) => {
    card.classList.toggle('active', i === index);
  });
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ url, revoke: () => URL.revokeObjectURL(url) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

async function handlePhotoSelect(file, panelIndex = state.activePanel) {
  if (!file) return;
  try {
    const { url, revoke } = await loadImageFile(file);
    // Revoke previous blob URL if exists
    const prevPanel = state.panels[panelIndex];
    if (prevPanel.image && prevPanel.revoke) {
      prevPanel.revoke();
    }
    state.panels[panelIndex].image = url;
    state.panels[panelIndex].revoke = revoke;
    createPanelCards();
    requestRender();
  } catch (err) {
    console.error('Photo load failed:', err);
  }
}

addPhotoBtn.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', (e) => handlePhotoSelect(e.target.files[0]));

captionInput.addEventListener('input', (e) => {
  state.caption = e.target.value.toUpperCase();
  requestRender();
});

sizeSelect.addEventListener('change', (e) => {
  state.size = e.target.value;
  setCanvasSize();
  requestRender();
});

function bindGradeControl(input, output, key) {
  input.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.grade[key] = val;
    output.textContent = val;
    requestRender();
  });
}

bindGradeControl(sunsetIntensity, sunsetIntensityVal, 'sunsetIntensity');
bindGradeControl(neonGlow, neonGlowVal, 'neonGlow');
bindGradeControl(vignette, vignetteVal, 'vignette');
bindGradeControl(grain, grainVal, 'grain');

function bindCaptionControl(input, output, key, transform = (v) => v) {
  input.addEventListener('input', (e) => {
    const val = transform(e.target.value);
    state.captionStyle[key] = val;
    if (output) output.textContent = val;
    requestRender();
  });
}

bindCaptionControl(fontSize, fontSizeVal, 'fontSize', (v) => parseInt(v, 10));
bindCaptionControl(letterSpacing, letterSpacingVal, 'letterSpacing', (v) => parseInt(v, 10));
bindCaptionControl(textColor, null, 'textColor', (v) => v);
bindCaptionControl(outlineThickness, outlineThicknessVal, 'outlineThickness', (v) => parseInt(v, 10));
bindCaptionControl(captionAlign, null, 'alignment', (v) => v);

exportBtn.addEventListener('click', async () => {
  const { width, height } = parseSize(state.size);
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  await drawCover(exportCanvas, state);
  await captureShot(exportCanvas, `palm-coast-cover-${state.size}.png`);
});

let renderScheduled = false;
function requestRender() {
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  }
}

async function render() {
  const { width, height } = parseSize(state.size);
  await drawCover(canvas, state);
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = parseSize(state.size);
  const scaleX = rect.width / width;
  const scaleY = rect.height / height;
  return {
    x: (e.clientX - rect.left) / scaleX,
    y: (e.clientY - rect.top) / scaleY
  };
}

function getActivePanelRect() {
  const { width, height } = parseSize(state.size);
  const panelRects = computePanelRects(width, height);
  return panelRects[state.activePanel];
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

canvas.addEventListener('pointerdown', (e) => {
  const panel = state.panels[state.activePanel];
  if (!panel.image) return;
  const rect = getActivePanelRect();
  const point = getCanvasPoint(e);
  if (point.x >= rect.x && point.x <= rect.x + rect.width &&
      point.y >= rect.y && point.y <= rect.y + rect.height) {
    state.dragState = {
      startX: point.x,
      startY: point.y,
      startOffsetX: panel.offsetX,
      startOffsetY: panel.offsetY
    };
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.dragState) return;
  const panel = state.panels[state.activePanel];
  if (!panel.image) return;
  const point = getCanvasPoint(e);
  const dx = point.x - state.dragState.startX;
  const dy = point.y - state.dragState.startY;
  panel.offsetX = state.dragState.startOffsetX + dx;
  panel.offsetY = state.dragState.startOffsetY + dy;
  updatePanelControls();
  requestRender();
});

canvas.addEventListener('pointerup', (e) => {
  if (state.dragState) {
    canvas.releasePointerCapture(e.pointerId);
    state.dragState = null;
  }
});

canvas.addEventListener('wheel', (e) => {
  const panel = state.panels[state.activePanel];
  if (!panel.image) return;
  e.preventDefault();
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  panel.zoom = Math.max(0.1, Math.min(5, panel.zoom * zoomFactor));
  updatePanelControls();
  requestRender();
}, { passive: false });

function updatePanelControls() {
  const panel = state.panels[state.activePanel];
  const card = panelsContainer.querySelector(`[data-panel-index="${state.activePanel}"]`);
  if (!card) return;
  const zoomInput = card.querySelector('.panel-zoom');
  const zoomOutput = card.querySelector('.panel-control-row output');
  const offsetXInput = card.querySelector('.panel-offset-x');
  const offsetXOutput = offsetXInput.parentElement.querySelector('output');
  const offsetYInput = card.querySelector('.panel-offset-y');
  const offsetYOutput = offsetYInput.parentElement.querySelector('output');
  const preview = card.querySelector('.panel-preview');
  
  if (zoomInput) {
    zoomInput.value = Math.round(panel.zoom * 100);
    zoomOutput.textContent = `${Math.round(panel.zoom * 100)}%`;
  }
  if (offsetXInput) {
    offsetXInput.value = Math.round(panel.offsetX);
    offsetXOutput.textContent = Math.round(panel.offsetX);
  }
  if (offsetYInput) {
    offsetYInput.value = Math.round(panel.offsetY);
    offsetYOutput.textContent = Math.round(panel.offsetY);
  }
  if (preview) {
    preview.style.transform = `translate(${panel.offsetX}px, ${panel.offsetY}px) scale(${panel.zoom}) rotate(${panel.rotation}deg)`;
  }
}

async function init() {
  setCanvasSize();
  createPanelCards();
  captionInput.value = state.caption;
  sizeSelect.value = state.size;

  sunsetIntensity.value = state.grade.sunsetIntensity;
  sunsetIntensityVal.textContent = state.grade.sunsetIntensity;
  neonGlow.value = state.grade.neonGlow;
  neonGlowVal.textContent = state.grade.neonGlow;
  vignette.value = state.grade.vignette;
  vignetteVal.textContent = state.grade.vignette;
  grain.value = state.grade.grain;
  grainVal.textContent = state.grade.grain;

  fontSize.value = state.captionStyle.fontSize;
  fontSizeVal.textContent = state.captionStyle.fontSize;
  letterSpacing.value = state.captionStyle.letterSpacing;
  letterSpacingVal.textContent = state.captionStyle.letterSpacing;
  textColor.value = state.captionStyle.textColor;
  outlineThickness.value = state.captionStyle.outlineThickness;
  outlineThicknessVal.textContent = state.captionStyle.outlineThickness;
  captionAlign.value = state.captionStyle.alignment;

  // Update panel control ranges to match new defaults
  document.querySelectorAll('.panel-card').forEach((card, i) => {
    const zoomInput = card.querySelector('.panel-zoom');
    const zoomOutput = card.querySelector('.panel-control-row output');
    const offsetXInput = card.querySelector('.panel-offset-x');
    const offsetXOutput = offsetXInput.parentElement.querySelector('output');
    const offsetYInput = card.querySelector('.panel-offset-y');
    const offsetYOutput = offsetYInput.parentElement.querySelector('output');
    const preview = card.querySelector('.panel-preview');
    const panel = state.panels[i];
    
    if (zoomInput) {
      zoomInput.value = Math.round(panel.zoom * 100);
      zoomOutput.textContent = `${Math.round(panel.zoom * 100)}%`;
    }
    if (offsetXInput) {
      offsetXInput.value = Math.round(panel.offsetX);
      offsetXOutput.textContent = Math.round(panel.offsetX);
    }
    if (offsetYInput) {
      offsetYInput.value = Math.round(panel.offsetY);
      offsetYOutput.textContent = Math.round(panel.offsetY);
    }
    if (preview) {
      preview.style.transform = `translate(${panel.offsetX}px, ${panel.offsetY}px) scale(${panel.zoom}) rotate(${panel.rotation}deg)`;
    }
  });

  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    const query = new URLSearchParams(location.search);
    const sample = `samples/${query.get('photo') ?? 'pier'}.jpg`;
    const text = query.get('caption') ?? 'Sunset Heist';
    const response = await fetch(sample);
    const blob = await response.blob();
    const { url, revoke } = await loadImageFile(new File([blob], 'sample.jpg'));
    state.panels[0].image = url;
    state.panels[0].revoke = revoke;
    state.caption = text.toUpperCase();
    captionInput.value = state.caption;
    createPanelCards();
    requestRender();
  } else {
    // Auto-load all 4 panels at startup for 2x2 collage
    const samples = [
      'samples/boulevard.jpg',
      'samples/pier.jpg',
      'samples/boulevard.jpg',
      'samples/pier.jpg'
    ];
    for (let i = 0; i < 4; i++) {
      try {
        const response = await fetch(samples[i]);
        const blob = await response.blob();
        const { url, revoke } = await loadImageFile(new File([blob], samples[i]));
        state.panels[i].image = url;
        state.panels[i].revoke = revoke;
        // Centered cover-fit with only gentle offsets
        state.panels[i].offsetX = 0;
        state.panels[i].offsetY = 0;
        state.panels[i].zoom = 1.0;
      } catch (err) {
        console.error(`Failed to auto-load panel ${i}:`, err);
      }
    }
    createPanelCards();
    await render();
  }
}

init();