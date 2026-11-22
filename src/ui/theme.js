// Club colour theme & light/dark mode (v2.5): the whole interface takes on the colours of your club.
const DEFAULT = { acc: '#9d6bff', acc2: '#c9a2ff', acc3: '#6a3df0' };
const hex2rgb = (h) => { const x = h.replace('#', ''); const n = parseInt(x.length === 3 ? x.split('').map((c) => c + c).join('') : x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function toHsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function fromHsl([h, s, l]) { const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; if (!s) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255]; }

// pick the more colourful club colour and make it readable as an accent
export function clubAccent(colors) {
  const cands = [colors.primary, colors.secondary].filter(Boolean).map((c) => ({ c, hsl: toHsl(hex2rgb(c)) }));
  const best = cands.sort((a, b) => b.hsl[1] * (1 - Math.abs(b.hsl[2] - 0.5)) - a.hsl[1] * (1 - Math.abs(a.hsl[2] - 0.5)))[0];
  if (!best || best.hsl[1] < 0.18) return DEFAULT; // black/white clubs keep the violet accent
  const [h, s] = best.hsl;
  const mk = (l, ss = s) => rgb2hex(...fromHsl([h, Math.min(1, Math.max(0.45, ss)), l]));
  return { acc: mk(0.58), acc2: mk(0.76, s * 0.9), acc3: mk(0.42) };
}

export function applyTheme(settings, club) {
  const rs = document.documentElement.style;
  const A = settings.theme === 'violett' || !club ? DEFAULT : clubAccent(club.colors);
  rs.setProperty('--acc', A.acc); rs.setProperty('--acc2', A.acc2); rs.setProperty('--acc3', A.acc3);
  rs.setProperty('--acc-rgb', hex2rgb(A.acc).join(', '));
  document.body.classList.toggle('light', settings.mode === 'hell');
}
