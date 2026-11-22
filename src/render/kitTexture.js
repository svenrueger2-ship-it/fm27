// Canvas-generated kit textures: club pattern (stripes, hoops, halves, sash, chevron, pinstripes),
// collar, sleeve trims, chest sponsor, name + number on the back, socks with bands.
import * as THREE from 'three';
import { SPONSORS } from '../data/leagues.js';
import { crestImage } from './crestImages.js';
import { KIT_OVERRIDES } from '../data/customRegistry.js';

export const KIT_STYLES = ['plain', 'stripes', 'hoops', 'halves', 'sash', 'pinstripe', 'chevron', 'plain'];
const cache = new Map();

export function kitStyleFor(short = '') {
  if (KIT_OVERRIDES[short]) return KIT_OVERRIDES[short];
  let h = 0; for (const c of short) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return KIT_STYLES[h % KIT_STYLES.length];
}
function sponsorFor(short = '') { let h = 7; for (const c of short) h = (h * 17 + c.charCodeAt(0)) >>> 0; return SPONSORS[h % SPONSORS.length]; }

export function contrast(hex) {
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#111111' : '#ffffff';
}

// Base pattern for a whole team (shared), drawn on a 512x256 canvas: u = around the torso (front at u=0/1, back at 0.5)
export function drawPattern(g, W, H, kit, style) {
  g.fillStyle = kit.primary; g.fillRect(0, 0, W, H);
  g.fillStyle = kit.secondary;
  if (style === 'stripes') for (let x = 0; x < W; x += 64) g.fillRect(x + 32, 0, 22, H);
  else if (style === 'pinstripe') for (let x = 0; x < W; x += 24) g.fillRect(x, 0, 3, H);
  else if (style === 'hoops') for (let y = 20; y < H; y += 56) g.fillRect(0, y, W, 24);
  else if (style === 'halves') { g.fillRect(0, 0, W / 4, H); g.fillRect((W * 3) / 4, 0, W / 4, H); g.fillRect(W / 2, 0, W / 4, H); g.fillStyle = kit.primary; g.fillRect(W / 4, 0, W / 4, H); }
  else if (style === 'sash') { g.save(); g.translate(0, H); g.rotate(-0.55); g.fillRect(-40, -30, W * 0.35, 46); g.fillRect(W * 0.95, -30 - W * 0.37, W * 0.35, 46); g.restore(); }
  else if (style === 'chevron') { g.beginPath(); g.moveTo(-60, H * 0.42); g.lineTo(0, H * 0.58); g.lineTo(60, H * 0.42); g.lineTo(60, H * 0.52); g.lineTo(0, H * 0.68); g.lineTo(-60, H * 0.52); g.fill(); g.save(); g.translate(W, 0); g.fill(); g.restore(); }
  // subtle fabric shading
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(255,255,255,.08)'); grad.addColorStop(0.25, 'rgba(0,0,0,.12)'); grad.addColorStop(0.5, 'rgba(255,255,255,.05)'); grad.addColorStop(0.75, 'rgba(0,0,0,.12)'); grad.addColorStop(1, 'rgba(255,255,255,.08)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.035)`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  // collar & hem trims
  g.fillStyle = kit.secondary === kit.primary ? contrast(kit.primary) : kit.secondary;
  g.fillRect(0, H - 10, W, 10); g.fillRect(0, 0, W, 5);
  g.beginPath(); g.moveTo(-34, H); g.lineTo(0, H - 42); g.lineTo(34, H); g.fill();
  g.beginPath(); g.moveTo(W - 34, H); g.lineTo(W, H - 42); g.lineTo(W + 34, H); g.fill();
}

export function shirtTexture({ kit, style, short, number, name, isGK }) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  drawPattern(g, W, H, kit, isGK ? 'plain' : style);
  const txt = contrast(kit.primary);
  // chest sponsor (front = u 0 / 1, wraps the seam)
  const sp = sponsorFor(short);
  g.font = 'bold 26px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = txt; g.globalAlpha = 0.92;
  for (const x of [0, W]) g.fillText(sp, x, H * 0.5);
  g.globalAlpha = 1;
  // small badge on the left chest + front number
  const ci = crestImage(short);
  if (ci) g.drawImage(ci, W - 64, H * 0.27 - 18, 36, 36);
  else { g.fillStyle = kit.secondary; g.beginPath(); g.arc(W - 46, H * 0.27, 11, 0, Math.PI * 2); g.fill(); }
  g.font = 'bold 30px Arial'; g.fillStyle = txt; g.fillText(String(number), 44, H * 0.28);
  // back: name + big number
  g.font = 'bold 30px "Arial Narrow", Arial, sans-serif';
  g.lineWidth = 6; g.strokeStyle = kit.primary === txt ? '#000' : kit.primary;
  g.strokeText(name.toUpperCase(), W / 2, H * 0.24); g.fillText(name.toUpperCase(), W / 2, H * 0.24);
  g.font = 'bold 128px Arial, sans-serif';
  g.lineWidth = 10; g.strokeText(String(number), W / 2, H * 0.6); g.fillText(String(number), W / 2, H * 0.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function sockTexture(kit) {
  const key = 'sock' + kit.socks + kit.secondary;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = kit.socks; g.fillRect(0, 0, 64, 128);
  g.fillStyle = kit.secondary === kit.socks ? contrast(kit.socks) : kit.secondary;
  g.fillRect(0, 104, 64, 8); g.fillRect(0, 116, 64, 5);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 64, 26); // shin pad shadow/boot top
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function shortsTexture(kit, number) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = kit.shorts; g.fillRect(0, 0, 128, 64);
  g.fillStyle = kit.secondary === kit.shorts ? contrast(kit.shorts) : kit.secondary;
  g.fillRect(0, 54, 128, 4); g.fillRect(28, 0, 4, 64); g.fillRect(96, 0, 4, 64);
  g.font = 'bold 18px Arial'; g.fillStyle = contrast(kit.shorts); g.textAlign = 'center'; g.fillText(String(number), 14, 30);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
