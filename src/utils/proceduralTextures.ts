import * as THREE from 'three';

// Cache generated textures so we don't recreate them needlessly
const textureCache: Record<string, THREE.CanvasTexture> = {};

function applyStandardTextureProps(texture: THREE.CanvasTexture, repeatX: number = 1, repeatY: number = 1, isColorMap: boolean = true) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  if (isColorMap) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.anisotropy = 8;
  return texture;
}

/**
 * High-fidelity PBR Asphalt Road Texture
 * Realistic aggregate grain, worn vehicle tire tracks, thermo-plastic white borders & yellow center dashes.
 */
export function createRoadTexture(lanes: number = 2, hasCrosswalk: boolean = true): THREE.CanvasTexture {
  const cacheKey = `road_pbr_${lanes}_${hasCrosswalk}`;
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Base dark asphalt with subtle tonal gradient
  const baseGrad = ctx.createLinearGradient(0, 0, 1024, 0);
  baseGrad.addColorStop(0, '#10151f');
  baseGrad.addColorStop(0.2, '#181f2c');
  baseGrad.addColorStop(0.5, '#131923');
  baseGrad.addColorStop(0.8, '#181f2c');
  baseGrad.addColorStop(1, '#10151f');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Aggregate stone speckles and micro-grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let i = 0; i < 18000; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    const size = Math.random() < 0.8 ? 2 : 3;
    ctx.fillRect(rx, ry, size, size);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let i = 0; i < 14000; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // 3. Worn tire tracks (slightly darker, smoother tar path in lanes)
  const trackGradL = ctx.createLinearGradient(160, 0, 360, 0);
  trackGradL.addColorStop(0, 'rgba(10, 14, 20, 0)');
  trackGradL.addColorStop(0.5, 'rgba(10, 14, 20, 0.45)');
  trackGradL.addColorStop(1, 'rgba(10, 14, 20, 0)');
  ctx.fillStyle = trackGradL;
  ctx.fillRect(160, 0, 200, 1024);

  const trackGradR = ctx.createLinearGradient(660, 0, 860, 0);
  trackGradR.addColorStop(0, 'rgba(10, 14, 20, 0)');
  trackGradR.addColorStop(0.5, 'rgba(10, 14, 20, 0.45)');
  trackGradR.addColorStop(1, 'rgba(10, 14, 20, 0)');
  ctx.fillStyle = trackGradR;
  ctx.fillRect(660, 0, 200, 1024);

  // 4. Outer solid white road shoulder lines with realistic paint texture
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(60, 0); ctx.lineTo(60, 1024);
  ctx.moveTo(964, 0); ctx.lineTo(964, 1024);
  ctx.stroke();

  // 5. Center dashed yellow lane dividers
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 14;
  ctx.setLineDash([70, 50]);
  ctx.beginPath();
  ctx.moveTo(512, 0);
  ctx.lineTo(512, 1024);
  ctx.stroke();
  ctx.setLineDash([]);

  // 6. Crosswalk zebra stripes if requested
  if (hasCrosswalk) {
    ctx.fillStyle = '#f8fafc';
    for (let y = 60; y < 280; y += 44) {
      ctx.fillRect(100, y, 824, 24);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  applyStandardTextureProps(texture, 1, 6, true);
  textureCache[cacheKey] = texture;
  return texture;
}

/**
 * PBR Asphalt Roughness & Specular Map
 * Gives wet-look reflectivity to vehicle tracks and tar patches.
 */
export function createRoadRoughnessTexture(): THREE.CanvasTexture {
  const cacheKey = 'road_roughness_pbr';
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base roughness (~0.7 in grayscale = 178)
  ctx.fillStyle = '#b0b0b0';
  ctx.fillRect(0, 0, 512, 512);

  // Tire tracks are glossier (lower roughness = darker in grayscale ~0.35)
  ctx.fillStyle = 'rgba(70, 70, 70, 0.45)';
  ctx.fillRect(80, 0, 100, 512);
  ctx.fillRect(330, 0, 100, 512);

  // Painted road lines are smoother (~0.4)
  ctx.fillStyle = 'rgba(90, 90, 90, 0.5)';
  ctx.fillRect(25, 0, 10, 512);
  ctx.fillRect(475, 0, 10, 512);

  const texture = new THREE.CanvasTexture(canvas);
  applyStandardTextureProps(texture, 1, 6, false);
  textureCache[cacheKey] = texture;
  return texture;
}

/**
 * Architectural Sidewalk Paving Texture
 * Chamfered concrete pavers with micro-relief seams.
 */
export function createSidewalkTexture(): THREE.CanvasTexture {
  const cacheKey = 'sidewalk_paving_pbr';
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm-grey architectural granite/concrete tone
  ctx.fillStyle = '#222d3d';
  ctx.fillRect(0, 0, 512, 512);

  // Stone slab variation
  const tileSize = 64;
  for (let x = 0; x < 512; x += tileSize) {
    for (let y = 0; y < 512; y += tileSize) {
      const shade = Math.floor(Math.random() * 16 - 8);
      const r = Math.min(255, Math.max(0, 36 + shade));
      const g = Math.min(255, Math.max(0, 48 + shade));
      const b = Math.min(255, Math.max(0, 64 + shade));
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
    }
  }

  // Deep shadow joints
  ctx.strokeStyle = '#121922';
  ctx.lineWidth = 4;
  for (let x = 0; x <= 512; x += tileSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }
  for (let y = 0; y <= 512; y += tileSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
  }

  // Fine surface stone stipple
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let i = 0; i < 4000; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillRect(rx, ry, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  applyStandardTextureProps(texture, 4, 4, true);
  textureCache[cacheKey] = texture;
  return texture;
}

/**
 * High-End Architectural Skyscraper Facade Texture
 * Double-glazed dark curtain wall glass with illuminated warm interior office spaces.
 * Tuned for Golden Hour Dusk: predominantly warm amber & soft incandescent interior glows.
 */
export function createBuildingFacadeTexture(
  theme: 'cyber-cyan' | 'corporate-blue' | 'warm-amber' | 'residential',
  litRatio: number = 0.65
): THREE.CanvasTexture {
  const cacheKey = `facade_pbr_${theme}_${litRatio}`;
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark architectural structural frame (anodized bronze / titanium / charcoal)
  ctx.fillStyle = theme === 'cyber-cyan' ? '#091321' : theme === 'corporate-blue' ? '#0b1626' : '#111822';
  ctx.fillRect(0, 0, 512, 512);

  // Window grid layout
  const cols = 8;
  const rows = 14;
  const cellW = 512 / cols;
  const cellH = 512 / rows;
  const marginX = 6;
  const marginY = 5;

  // Golden Hour Dusk interior office illumination: rich warm ambers, incandescents, and select smart displays
  const litPalettes = {
    'cyber-cyan': ['#fed7aa', '#fcd34d', '#38bdf8', '#7dd3fc', '#fef08a'],
    'corporate-blue': ['#fed7aa', '#fde047', '#60a5fa', '#fffbeb', '#f59e0b'],
    'warm-amber': ['#f59e0b', '#fbbf24', '#fcd34d', '#fed7aa', '#fef3c7'],
    'residential': ['#fef3c7', '#fed7aa', '#fde68a', '#fb923c', '#e2e8f0'],
  }[theme];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + marginX;
      const wy = r * cellH + marginY;
      const ww = cellW - marginX * 2;
      const wh = cellH - marginY * 2;

      const isLit = Math.random() < litRatio;
      if (isLit) {
        const color = litPalettes[Math.floor(Math.random() * litPalettes.length)];
        // Window room gradient (brighter at ceiling/interior, softer at sill)
        const winGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
        winGrad.addColorStop(0, color);
        winGrad.addColorStop(1, 'rgba(20, 24, 34, 0.4)');
        ctx.fillStyle = winGrad;
        ctx.fillRect(wx, wy, ww, wh);

        // Architectural blinds / divider effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(wx, wy + wh * 0.4, ww, 2);
        ctx.fillRect(wx + ww * 0.5, wy, 1.5, wh);
      } else {
        // Unlit deep reflective glass with subtle sky reflection gradient
        const unlitGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
        unlitGrad.addColorStop(0, '#0e1726');
        unlitGrad.addColorStop(1, '#050a12');
        ctx.fillStyle = unlitGrad;
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  // Mullion metal highlights
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  for (let c = 0; c <= cols; c++) {
    const x = c * cellW;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  applyStandardTextureProps(texture, 1, 2, true);
  textureCache[cacheKey] = texture;
  return texture;
}

/**
 * High-Efficiency Monocrystalline Photovoltaic Solar Wafer Texture
 */
export function createSolarGridTexture(): THREE.CanvasTexture {
  const cacheKey = 'solar_array_pbr';
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep indigo monocrystalline anti-reflective surface
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#081729');
  grad.addColorStop(0.5, '#0c223c');
  grad.addColorStop(1, '#081729');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Anodized aluminum frame
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 502);

  // Fine silver conductor busbars
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  for (let x = 32; x < 512; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 504); ctx.stroke();
  }
  ctx.lineWidth = 3;
  for (let y = 64; y < 512; y += 64) {
    ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(504, y); ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  applyStandardTextureProps(texture, 1, 1, true);
  textureCache[cacheKey] = texture;
  return texture;
}

/**
 * Concrete Rooftop Membrane & Gravel Texture
 */
export function createRooftopTexture(): THREE.CanvasTexture {
  const cacheKey = 'rooftop_gravel_pbr';
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e2837';
  ctx.fillRect(0, 0, 256, 256);

  // Gravel flecks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < 3000; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 256;
    ctx.fillRect(rx, ry, 2, 2);
  }

  ctx.strokeStyle = '#141d28';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  applyStandardTextureProps(texture, 2, 2, true);
  textureCache[cacheKey] = texture;
  return texture;
}

/**
 * Emergency Hospital Helipad Landing Deck Texture
 */
export function createHelipadTexture(): THREE.CanvasTexture {
  const cacheKey = 'helipad_pbr';
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // High-durability tarmac deck
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 512, 512);

  // Outer safety warning ring (hazard red)
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(256, 256, 215, 0, Math.PI * 2);
  ctx.stroke();

  // White inner circle
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(256, 256, 175, 0, Math.PI * 2);
  ctx.stroke();

  // Bold "H" landing mark
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 180px -apple-system, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  applyStandardTextureProps(texture, 1, 1, true);
  textureCache[cacheKey] = texture;
  return texture;
}

/**
 * Architectural Holographic & Neon Signboard Texture
 */
export function createNeonSignTexture(text: string, colorHex: string = '#28d9ec'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#060b13';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 112);

  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  applyStandardTextureProps(texture, 1, 1, true);
  return texture;
}
