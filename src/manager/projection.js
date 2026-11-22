// Development projection (v2.5): expected strength curve over the next years.
// Mirrors the weekly training growth (room to potential × age factor) and ageing decline.
const GROW = (age) => (age <= 19 ? 0.36 : age <= 21 ? 0.3 : age <= 23 ? 0.22 : age <= 25 ? 0.14 : age <= 27 ? 0.07 : 0);
const DECLINE = (age) => (age < 30 ? 0 : age < 32 ? 1.2 : age < 34 ? 2.2 : 3.4);

/** Returns [{age, mid, lo, hi}] for `years` seasons starting with the current one. */
export function projectPlayer(p, { years = 6, facility = 2, prof = p.professionalism ?? 60 } = {}) {
  const boost = 0.85 + facility * 0.05 + (prof - 50) / 400;
  const out = [{ age: p.age, mid: p.ovr, lo: p.ovr, hi: p.ovr }];
  let mid = p.ovr, lo = p.ovr, hi = p.ovr;
  const potHi = Math.min(97, p.pot + (p.age <= 21 ? 3 : 0)), potLo = Math.max(p.ovr, p.pot - (p.age <= 23 ? 5 : 2));
  for (let y = 1; y <= years; y++) {
    const age = p.age + y - 1;
    mid += Math.max(0, p.pot - mid) * GROW(age) * boost - DECLINE(age + 1);
    hi += Math.max(0, potHi - hi) * GROW(age) * boost * 1.25 - DECLINE(age + 1) * 0.6;
    lo += Math.max(0, potLo - lo) * GROW(age) * boost * 0.6 - DECLINE(age + 1) * 1.35;
    out.push({ age: age + 1, mid: Math.round(mid * 10) / 10, lo: Math.round(Math.min(lo, mid) * 10) / 10, hi: Math.round(Math.max(hi, mid) * 10) / 10 });
  }
  const peak = out.reduce((b, x) => (x.mid > b.mid ? x : b), out[0]);
  return { points: out, peak: { age: peak.age, ovr: Math.round(peak.mid) } };
}

/** Small SVG chart; colours via CSS variables. */
export function projectionSvg(proj, { w = 320, h = 120, mini = false } = {}) {
  const P = proj.points, n = P.length - 1;
  const minV = Math.floor(Math.min(...P.map((x) => x.lo)) - 2), maxV = Math.ceil(Math.max(...P.map((x) => x.hi)) + 2);
  const X = (i) => (i / n) * (w - (mini ? 4 : 34)) + (mini ? 2 : 28), Y = (v) => h - (mini ? 4 : 18) - ((v - minV) / Math.max(1, maxV - minV)) * (h - (mini ? 8 : 26));
  const band = `${P.map((x, i) => `${X(i)},${Y(x.hi)}`).join(' ')} ${P.map((x, i) => `${X(n - i)},${Y(P[n - i].lo)}`).join(' ')}`;
  const line = P.map((x, i) => `${X(i)},${Y(x.mid)}`).join(' ');
  const axis = mini ? '' : `${[minV, Math.round((minV + maxV) / 2), maxV].map((v) => `<text x="22" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="currentColor" opacity=".6">${v}</text>`).join('')}
    ${P.map((x, i) => `<text x="${X(i)}" y="${h - 3}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".6">${x.age}</text>`).join('')}`;
  return `<svg viewBox="0 0 ${w} ${h}" class="proj-svg" width="100%"><polygon points="${band}" fill="rgba(var(--acc-rgb), .18)"/>
    <polyline points="${line}" fill="none" stroke="var(--acc)" stroke-width="${mini ? 2 : 2.5}" stroke-linecap="round" stroke-linejoin="round"/>
    ${mini ? '' : P.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.mid)}" r="3" fill="var(--acc)"><title>${x.age} Jahre: ${Math.round(x.lo)}–${Math.round(x.hi)} (erwartet ${Math.round(x.mid)})</title></circle>`).join('')}${axis}</svg>`;
}
