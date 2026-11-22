// v3.0.1 – all amounts are shown as decimal numbers with two places (German format)
const D2 = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
export const dec2 = (n) => (+n || 0).toLocaleString('de-DE', D2);
export const eur = (v) => (v == null ? '–' : `${dec2(Math.round(+v * 100) / 100)} €`);
export function money(v) {
  if (v == null) return '–';
  const a = Math.abs(v);
  if (a >= 1e9) return dec2(v / 1e9) + ' Mrd. €';
  if (a >= 1e6) return dec2(v / 1e6) + ' Mio. €';
  if (a >= 1e3) return dec2(v / 1e3) + ' Tsd. €';
  return eur(v);
}
