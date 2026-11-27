// v7.0.6: Ultimate-Team-style card tiers – bronze / silver / gold, each normal or rare, plus special cards.
// Thresholds: bronze < 65 ≤ silver < 75 ≤ gold; rare from 60 / 71 / 83. Special: icon (90+),
// in-form (form 85+, at least 65 overall), future star (≤ 21 years, potential 85+).
export const TIERS = [
  ['icon', 'Ikone', '90+ Stärke'],
  ['inform', 'In-Form', 'Formstärke 85+'],
  ['special', 'Future Star', '≤ 21 Jahre, Potenzial 85+'],
  ['gold rare', 'Gold selten', '83–89'],
  ['gold', 'Gold', '75–82'],
  ['silver rare', 'Silber selten', '71–74'],
  ['silver', 'Silber', '65–70'],
  ['bronze rare', 'Bronze selten', '60–64'],
  ['bronze', 'Bronze', 'unter 60'],
];
export function cardTier(ovr, { age = 25, pot = 0, form = 50 } = {}) {
  if (ovr >= 90) return { cls: 'icon', label: 'IKONE' };
  if (form >= 85 && ovr >= 65) return { cls: 'inform', label: 'IN-FORM' };
  if (age <= 21 && pot >= 85) return { cls: 'special', label: 'FUTURE STAR' };
  if (ovr >= 83) return { cls: 'gold rare', label: 'GOLD · SELTEN' };
  if (ovr >= 75) return { cls: 'gold', label: 'GOLD' };
  if (ovr >= 71) return { cls: 'silver rare', label: 'SILBER · SELTEN' };
  if (ovr >= 65) return { cls: 'silver', label: 'SILBER' };
  if (ovr >= 60) return { cls: 'bronze rare', label: 'BRONZE · SELTEN' };
  return { cls: 'bronze', label: 'BRONZE' };
}
export const tierLegend = () => `<div class="tier-legend">${TIERS.map(([c, l, d]) => `<span class="tl ${c}" title="${d}"><i></i>${l}</span>`).join('')}</div>`;
