// Medienhaus (v5.5): full newspaper articles with their own voice per paper, match reports with grades,
// weekly features (league round-up, column, interview, talent portrait, boulevard, fan poll, team of the week,
// rumour mill), season review, plus Social Media 2.0 (club/player accounts, replies, hashtags, followers,
// manager posts with consequences).
import { clamp } from '../core/rng.js';
import { computeTable } from './season.js';
import { moodChange } from './events.js';

// ------------------------------------------------------------------ papers & people
export const PAPER_INFO = {
  'Der Ballblick': { style: 'boulevard', icon: '🔴', motto: 'Laut. Schnell. Am Ball.', authors: ['Kalle Brenner', 'Jenny Schulz', 'Ronny Wachowiak'] },
  'Sport-Kurier': { style: 'serioes', icon: '📘', motto: 'Fußball mit Haltung seit 1949', authors: ['Dr. Helmut Faber', 'Katrin Roth', 'Philipp Adler'] },
  'Kicker-Express': { style: 'stats', icon: '📊', motto: 'Zahlen, Noten, Fakten', authors: ['Frank Möller', 'Ayşe Demir', 'Lars Ohlsen'] },
  'Abendpost Sport': { style: 'lokal', icon: '🏠', motto: 'Ganz nah an deinem Verein', authors: ['Gisela Hartmann', 'Timo Brückner', 'Murat Yıldız'] },
  'Fußball Heute': { style: 'national', icon: '🌐', motto: 'Das Fußball-Magazin der Nation', authors: ['Nora Albrecht', 'Sebastian Keller', 'Marie Dubois'] },
};
const COLUMNIST = { name: 'Rudi Kaltenbach', title: 'Der Ballflüsterer', paper: 'Fußball Heute' };
const pick = (rng, a) => a[Math.floor(rng.next() * a.length)];
const pickPaper = (rng, styles) => { const names = Object.keys(PAPER_INFO).filter((k) => !styles || styles.includes(PAPER_INFO[k].style)); return pick(rng, names); };
const nm = (p) => (p ? `${p.firstName} ${p.lastName}`.trim() : 'ein Unbekannter');
const ln = (p) => (p ? p.lastName : '?');
const gradeStr = (g) => g.toFixed(1).replace('.', ',');
const seasonLabel = (s) => `${s}/${String((s + 1) % 100).padStart(2, '0')}`;
const POS_WORD = { TW: 'Torhüter', IV: 'Innenverteidiger', LV: 'Linksverteidiger', RV: 'Rechtsverteidiger', DM: 'Sechser', ZM: 'Mittelfeldspieler', OM: 'Spielmacher', LM: 'linke Mittelfeldspieler', RM: 'rechte Mittelfeldspieler', LA: 'Linksaußen', RA: 'Rechtsaußen', ST: 'Stürmer' };
const posWord = (p) => POS_WORD[p?.pos] || 'Spieler';

export function ensureNewsroom(world) {
  const M = (world.media ||= { headlines: [], feed: [], quotes: [] });
  M.articles ||= [];
  M.nextArticle ||= 1;
  if (M.followers == null) { const c = world.clubs[world.userClubId]; M.followers = Math.round(((c?.rep || 50) ** 2.3) * 9 / 100) * 100; }
  return M;
}
function addArticle(world, a) {
  const M = ensureNewsroom(world);
  const art = { id: M.nextArticle++, season: world.season, week: world.week, ...a };
  M.articles.unshift(art);
  if (M.articles.length > 50) M.articles.length = 50;
  return art;
}
const pushFeed = (M, x) => { M.feed.unshift(x); if (M.feed.length > 90) M.feed.length = 90; };
const scaleLikes = (M, rng, lo, hi) => Math.round(rng.int(lo, hi) * clamp(M.followers / 400000, 0.15, 6));

// ------------------------------------------------------------------ match grades (German school grades 1–6)
export function matchGrades(world, m, side, rng) {
  const me = world.clubs[side === 'h' ? m.h : m.a];
  const gf = side === 'h' ? m.hg : m.ag, ga = side === 'h' ? m.ag : m.hg, d = gf - ga;
  const ids = (m.played?.[side] || me.lineup?.xi || []).filter((id) => world.players[id]);
  const avg = ids.reduce((s, id) => s + world.players[id].ovr, 0) / Math.max(1, ids.length);
  const ev = m.events || [];
  return ids.map((id) => {
    const p = world.players[id];
    let g, inv = 0;
    if (m.ratings?.[id] != null) g = 3.5 - (m.ratings[id] - 6.5) * 1.1;
    else {
      g = 3.4 - (p.ovr - avg) * 0.035 - ((p.form ?? 50) - 50) * 0.01 + rng.range(-0.55, 0.55) - (d > 0 ? 0.35 : d < 0 ? -0.45 : 0);
      const goals = ev.filter((e) => e.type === 'goal' && !e.own && e.player === id).length;
      const assists = ev.filter((e) => e.type === 'goal' && e.assist === id).length;
      g -= goals * 0.85 + assists * 0.45;
      if (['TW', 'IV', 'LV', 'RV'].includes(p.pos)) g += ga * 0.3 - (ga === 0 ? 0.55 : 0);
    }
    if (ev.some((e) => e.type === 'red' && e.player === id)) g += 1.5;
    if (ev.some((e) => e.type === 'goal' && e.own && e.player === id)) g += 0.8;
    return { id, p, inv, g: clamp(Math.round(g * 2) / 2, 1, 6) };
  }).sort((a, b) => a.g - b.g || b.inv - a.inv);
}

// ------------------------------------------------------------------ match report
function goalTimeline(m) {
  let h = 0, a = 0;
  return (m.events || []).filter((e) => e.type === 'goal').sort((x, y) => x.minute - y.minute).map((e) => {
    if (e.side === 'h') h++; else a++;
    return { ...e, h, a };
  });
}
function nextOpponent(world) {
  const club = world.clubs[world.userClubId];
  const L = world.leagues.find((l) => l.id === club.leagueId);
  const md = L?.fixtures[world.week + 1];
  const f = md?.find((x) => x.h === club.id || x.a === club.id);
  return f ? { club: world.clubs[f.h === club.id ? f.a : f.h], home: f.h === club.id } : null;
}

export function writeMatchReport(world, m, rng) {
  const me = world.clubs[world.userClubId], side = m.h === me.id ? 'h' : 'a', home = side === 'h';
  const opp = world.clubs[home ? m.a : m.h];
  const gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg, d = gf - ga;
  const paper = pickPaper(rng), P = PAPER_INFO[paper], style = P.style;
  const author = pick(rng, P.authors);
  const tl = goalTimeline(m);
  const mine = (e) => e.side === side;
  const myGoals = tl.filter(mine), theirGoals = tl.filter((e) => !mine(e));
  const grades = matchGrades(world, m, side, rng);
  const motm = grades[0];
  const flop = grades[grades.length - 1];
  const scorers = {};
  for (const e of myGoals) if (!e.own && e.player) scorers[e.player] = (scorers[e.player] || 0) + 1;
  const hat = Object.entries(scorers).find(([, n]) => n >= 3), brace = Object.entries(scorers).find(([, n]) => n === 2);
  const hero = hat ? world.players[hat[0]] : brace ? world.players[brace[0]] : motm && scorers[motm.id] ? motm.p : myGoals.length ? world.players[myGoals[myGoals.length - 1].player] : motm?.p;
  // dramaturgy
  const trailed = tl.some((e) => (side === 'h' ? e.h < e.a : e.a < e.h));
  const led = tl.some((e) => (side === 'h' ? e.h > e.a : e.a > e.h));
  const comeback = d > 0 && trailed, collapse = d < 0 && led;
  const last = tl[tl.length - 1];
  const lateWinner = d !== 0 && last && last.minute >= 85 && mine(last) === d > 0 && Math.abs(last.h - last.a) === 1;
  const lateEqualizer = d === 0 && last && last.minute >= 85 && gf > 0;
  const reds = (m.events || []).filter((e) => e.type === 'red');
  const myRed = reds.find((e) => e.side === side), theirRed = reds.find((e) => e.side !== side);
  const injuries = (m.events || []).filter((e) => e.type === 'injury' && e.side === side).map((e) => world.players[e.player]).filter(Boolean);
  const big = opp.rep >= me.rep + 6, weak = opp.rep <= me.rep - 10;
  const cup = !!m.cup;
  // table
  let rank = null, oppRank = null, leader = null, n = 0;
  if (!cup) {
    const L = world.leagues.find((l) => l.id === me.leagueId), t = computeTable(L);
    rank = t.findIndex((r) => r.id === me.id) + 1; oppRank = t.findIndex((r) => r.id === opp.id) + 1; leader = world.clubs[t[0].id]; n = t.length;
  }
  const run = me.formRun || 0;
  const tone = d >= 3 || (d > 0 && (big || comeback || lateWinner)) ? 'top' : d > 0 ? 'ok' : d === 0 ? (weak ? 'bad' : 'ok') : d <= -3 || (d < 0 && weak) || run <= -3 ? 'crisis' : 'bad';
  const score = `${gf}:${ga}`;
  const where = home ? 'vor heimischem Publikum' : 'auswärts';
  const att = home ? me.stadium?.capacity : opp.stadium?.capacity;
  const crowd = att ? Math.round(att * clamp(0.72 + (world.mood?.fans ?? 60) / 300 + (big ? 0.1 : 0), 0.5, 1)) : null;

  // headline by paper style
  const H = {
    boulevard: d >= 3 ? [`${me.short.toUpperCase()}-GALA! ${opp.short} ZERLEGT`, `TOR-RAUSCH! ${score} GEGEN ${opp.short.toUpperCase()}`, `${ln(hero).toUpperCase()} SCHIESST ${opp.short.toUpperCase()} AB`]
      : lateWinner && d > 0 ? [`WAHNSINN IN DER ${last.minute}.! ${ln(world.players[last.player]).toUpperCase()} ERLÖST ${me.short.toUpperCase()}`, `LAST-MINUTE-JUBEL! ${me.short} DREHT DURCH`]
      : comeback ? [`WAS FÜR EINE AUFHOLJAGD! ${me.short.toUpperCase()} DREHT DAS SPIEL`, `COMEBACK-KÖNIGE! ${score} NACH RÜCKSTAND`]
      : d > 0 && big ? [`SENSATION! ${me.short.toUpperCase()} STÜRZT ${opp.short.toUpperCase()}`, `DAVID HAUT GOLIATH UM!`]
      : d > 0 ? [`${me.short} SIEGT – ${ln(hero).toUpperCase()} MACHT DEN UNTERSCHIED`, `DREIER! ${me.short} BLEIBT DRAN`]
      : d === 0 ? (lateEqualizer ? [`SPÄTER SCHOCK! ${score} IN DER ${last.minute}. MINUTE`] : [`NULLNUMMER IM KOPF – NUR ${score}`, `${me.short} TRITT AUF DER STELLE`])
      : d <= -3 ? [`DEBAKEL! ${me.short.toUpperCase()} GEHT UNTER`, `${ga}:${gf}-KLATSCHE! WIE PEINLICH IST DAS DENN?`, `HORROR-SHOW BEI ${me.short.toUpperCase()}`]
      : collapse ? [`ZUSAMMENBRUCH! ${me.short} VERSPIELT FÜHRUNG`] : weak ? [`BLAMAGE! ${me.short.toUpperCase()} PATZT GEGEN ${opp.short.toUpperCase()}`] : [`PLEITE! ${me.short} VERLIERT ${gf}:${ga}`],
    serioes: d >= 3 ? [`${me.short} spielt ${opp.short} an die Wand`, `Eine Machtdemonstration von ${me.name}`] : comeback ? [`${me.short} beweist Moral und dreht die Partie`] : lateWinner && d > 0 ? [`Spätes Glück für ${me.short}`] : d > 0 && big ? [`${me.short} gelingt der Coup gegen ${opp.short}`] : d > 0 ? [`${me.short} gewinnt ${score} – mit Licht und Schatten`, `Ein verdienter Sieg für ${me.short}`] : d === 0 ? [`${me.short} und ${opp.short} trennen sich ${score}`, `Remis ohne Sieger – ${me.short} lässt Punkte liegen`] : d <= -3 ? [`${me.short} erlebt einen rabenschwarzen Tag`, `Die Defensive von ${me.short} versagt komplett`] : collapse ? [`${me.short} verspielt eine sichere Führung`] : [`${me.short} unterliegt ${opp.short} mit ${gf}:${ga}`],
    stats: [`${score}: ${me.short} ${d > 0 ? 'siegt' : d === 0 ? 'remis' : 'verliert'}${hero && myGoals.length ? ` – ${ln(hero)} ${scorers[hero.id] >= 2 ? `mit ${scorers[hero.id]} Toren` : 'trifft'}` : ''}`, `${me.short} ${score} ${opp.short}: die Analyse in Zahlen`],
    lokal: d > 0 ? [`Unsere ${me.short} jubelt!`, `${me.short} begeistert ${home ? 'die eigenen Fans' : 'die mitgereisten Fans'}`, `Das war ${d >= 2 ? 'ein Fest' : 'ein Kraftakt'}, ${me.short}!`] : d === 0 ? [`Ein Punkt für ${me.short}`, `${me.short} kämpft sich zum Remis`] : [`Kopf hoch, ${me.short}!`, `Bittere ${score}-Niederlage für ${me.short}`],
    national: [d > 0 ? `${me.short} ${big ? 'überrascht die Liga' : 'bleibt in der Spur'}` : d === 0 ? `${me.short} und ${opp.short} ohne Sieger` : `${me.short} ${d <= -3 ? 'im freien Fall' : 'stolpert'}`],
  };
  const title = pick(rng, H[style]);
  const kicker = cup ? `🏆 ${m.cupName || 'Pokal'}` : `${(m.week ?? world.week) + 1}. Spieltag · ${seasonLabel(world.season)}`;

  // lead
  const oppCoach = opp.ai?.coach?.name || `der Trainer von ${opp.short}`;
  const mgr = world.manager?.name || 'der Trainer';
  const leadMap = {
    boulevard: d > 0 ? `Was für ein ${home ? 'Abend' : 'Auftritt'}! ${me.name} schlägt ${opp.name} ${where} mit ${score}${crowd ? ` – und ${crowd.toLocaleString('de-DE')} Zuschauer sind aus dem Häuschen` : ''}. Der Held: ${nm(hero)}!` : d === 0 ? `Mehr war nicht drin? ${me.name} kommt gegen ${opp.name} nicht über ein ${score} hinaus. Die Fans pfeifen, ${mgr} grübelt.` : `Das tut weh! ${me.name} verliert ${where} mit ${gf}:${ga} gegen ${opp.name}. Ballblick weiß: Hinter den Kulissen brodelt es!`,
    serioes: `${me.name} hat ${cup ? 'im Pokal' : 'am Wochenende'} ${where} ${d > 0 ? 'mit' : d === 0 ? 'ein' : 'mit'} ${score} ${d > 0 ? `gegen ${opp.name} gewonnen` : d === 0 ? `gegen ${opp.name} gespielt` : `gegen ${opp.name} verloren`}. ${d > 0 ? 'Der Sieg war das Ergebnis eines klaren Plans' : d === 0 ? 'Beide Teams neutralisierten sich über weite Strecken' : 'Die Niederlage legt strukturelle Probleme offen'}${rank ? ` – nach dem Spieltag steht die Mannschaft auf Rang ${rank}` : ''}.`,
    stats: `${me.short} ${score} ${opp.short}${crowd ? ` vor ${crowd.toLocaleString('de-DE')} Zuschauern` : ''}. ${motm ? `Bester Mann laut Kicker-Express-Note: ${nm(motm.p)} (${gradeStr(motm.g)}).` : ''}${rank ? ` Tabellenplatz nach dem Spiel: ${rank}.` : ''}`,
    lokal: `${d > 0 ? 'Grund zum Feiern' : d === 0 ? 'Gemischte Gefühle' : 'Enttäuschte Gesichter'} ${home ? 'im eigenen Stadion' : 'bei den mitgereisten Anhängern'}: ${me.name} ${d > 0 ? 'gewinnt' : d === 0 ? 'spielt' : 'verliert'} ${score} gegen ${opp.name}. Wir waren für Sie ganz nah dran.`,
    national: `Der ${cup ? 'Pokalabend' : `${(m.week ?? world.week) + 1}. Spieltag`} hatte in ${home ? me.stadium?.name || me.name : opp.stadium?.name || opp.name} einiges zu bieten: ${me.name} ${d > 0 ? 'setzt sich' : d === 0 ? 'trennt sich' : 'unterliegt'} ${d > 0 ? `mit ${score} gegen ${opp.name} durch` : d === 0 ? `${score} von ${opp.name}` : `${opp.name} mit ${gf}:${ga}`}.`,
  };

  // body
  const body = [];
  // 1) course of the game
  if (!tl.length) body.push(pick(rng, [`Torchancen waren Mangelware. ${me.short} und ${opp.short} belauerten sich 90 Minuten lang, ohne dass einer der beiden Keeper ernsthaft geprüft wurde.`, `Ein Spiel zum Vergessen: viele Fouls, wenig Ideen, kein Tor. Nach dem Abpfiff gab es auf beiden Seiten mehr Pfiffe als Applaus.`]));
  else {
    const parts = tl.map((e, i) => {
      const p = world.players[e.player], a = world.players[e.assist];
      const who = e.own ? `${nm(p)} per Eigentor` : nm(p);
      const st = `${e.h}:${e.a}`;
      const leadC = e.h > e.a ? world.clubs[m.h] : e.h < e.a ? world.clubs[m.a] : null;
      const tail = a && !e.own ? pick(rng, [` nach Vorarbeit von ${nm(a)}`, ` – die Vorlage kam von ${ln(a)}`, `, bedient von ${ln(a)}`]) : '';
      if (i === 0) return `In der ${e.minute}. Minute brachte ${who} ${leadC?.short || ''} mit ${st} in Führung${tail}.`;
      if (e.h === e.a) return `In der ${e.minute}. Minute ${pick(rng, ['glich', 'stellte'])} ${who} ${pick(rng, ['zum', 'auf'])} ${st} ${pick(rng, ['aus', ''])}${tail}.`.replace(/\s+\./, '.').replace(/ +/g, ' ').replace('stellte ' + who + ' zum', 'stellte ' + who + ' auf').replace('glich ' + who + ' auf', 'glich ' + who + ' zum');
      return `${pick(rng, ['In der', 'Dann, in der', 'Es folgte die'])} ${e.minute}. Minute: ${who} ${pick(rng, ['traf zum', 'markierte das', 'erzielte das'])} ${st}${tail}.`;
    });
    body.push(parts.slice(0, 4).join(' '));
    if (parts.length > 4) body.push(parts.slice(4).join(' '));
  }
  // 2) the story of the game
  if (comeback) body.push(`Bemerkenswert war die Moral: Nach dem Rückstand ${pick(rng, ['steckte die Mannschaft nicht auf', 'drehte das Team auf', 'zeigte die Elf Charakter'])}. ${mgr} ${pick(rng, ['reagierte mit einer taktischen Umstellung', 'fand in der Kabine offenbar die richtigen Worte', 'brachte frischen Wind von der Bank'])}, und plötzlich lief es.`);
  if (collapse) body.push(`Dabei hatte alles so gut angefangen. Doch nach der Führung ${pick(rng, ['zog sich die Mannschaft zu weit zurück', 'verlor sie völlig den Faden', 'fehlte die Konsequenz im Abschluss'])} – ${opp.short} nutzte das eiskalt.`);
  if (lateWinner) body.push(d > 0 ? `Die Entscheidung fiel spät: ${nm(world.players[last.player])} traf in der ${last.minute}. Minute und ließ ${home ? 'das Stadion' : 'den Gästeblock'} beben.` : `Bitter: In der ${last.minute}. Minute kassierte ${me.short} den entscheidenden Treffer.`);
  if (lateEqualizer) body.push(`Der Ausgleich in der ${last.minute}. Minute ${mine(last) ? `rettete ${me.short} wenigstens einen Punkt` : `traf ${me.short} mitten ins Herz`}.`);
  if (hat) body.push(`Der Mann des Tages hieß ${nm(world.players[hat[0]])}: Hattrick! ${pick(rng, ['Den Spielball nahm er natürlich mit nach Hause.', 'Die Fans skandierten minutenlang seinen Namen.', 'Ein Abend, den er nie vergessen wird.'])}`);
  else if (brace) body.push(`${nm(world.players[brace[0]])} schnürte einen Doppelpack und ${pick(rng, ['unterstrich seine starke Form', 'meldete Ansprüche auf einen Stammplatz an', 'war kaum zu verteidigen'])}.`);
  if (myRed) body.push(`Ein Knackpunkt: ${nm(world.players[myRed.player])} sah in der ${myRed.minute}. Minute Rot. ${style === 'boulevard' ? 'Völlig unnötig!' : 'In Unterzahl wurde es danach deutlich schwerer.'}`);
  if (theirRed) body.push(`${opp.short} musste ab der ${theirRed.minute}. Minute in Unterzahl auskommen – ${nm(world.players[theirRed.player])} hatte die Rote Karte gesehen.`);
  // 3) stats/tactics
  const st = m.stats ? m.stats[home ? 0 : 1] : null, so = m.stats ? m.stats[home ? 1 : 0] : null;
  if (st && so) body.push(`Die Zahlen: ${st.possession} % Ballbesitz, ${st.shots}:${so.shots} Torschüsse (${st.onTarget}:${so.onTarget} aufs Tor), ${st.corners}:${so.corners} Ecken${st.xg != null ? `, Expected Goals ${(st.xg || 0).toFixed(1).replace('.', ',')} zu ${(so.xg || 0).toFixed(1).replace('.', ',')}` : ''}. ${st.possession >= 58 ? `${me.short} hatte das Spiel weitgehend im Griff.` : st.possession <= 42 ? `${me.short} überließ dem Gegner die Initiative.` : 'Ein ausgeglichenes Duell.'}`);
  else {
    const tac = me.tactic || {};
    const ment = tac.mentality ?? 0.5;
    body.push(`Taktisch setzte ${mgr} auf ein ${tac.formation || '4-4-2'}${tac.preset ? ` („${tac.preset}“)` : ''} und eine ${ment > 0.62 ? 'offensive' : ment < 0.4 ? 'abwartende' : 'ausgewogene'} Grundausrichtung. ${d > 0 ? pick(rng, ['Der Plan ging auf.', 'Die Rechnung ging auf.']) : d === 0 ? 'Gegen kompakte Gegner fehlten jedoch die Lösungen.' : pick(rng, ['Der Matchplan wirkte nicht durchdacht.', 'Die Abstimmung zwischen den Reihen stimmte selten.'])}`);
  }
  // 4) players
  if (motm) body.push(`${style === 'boulevard' ? 'Ballblick-Held' : 'Bester Spieler auf dem Platz'}: ${nm(motm.p)} (${posWord(motm.p)}, Note ${gradeStr(motm.g)}). ${pick(rng, ['Er war an fast jeder gefährlichen Aktion beteiligt.', 'Zweikampfstark, ballsicher, immer anspielbar.', 'Eine Leistung, die Lust auf mehr macht.'])}${flop && flop.g >= 4.5 && flop !== motm ? ` Weniger glücklich: ${nm(flop.p)} (Note ${gradeStr(flop.g)}), ${pick(rng, ['dem wenig gelang', 'der nie ins Spiel fand', 'der sich einige Ballverluste leistete'])}.` : ''}`);
  if (injuries.length) body.push(`Sorgen bereitet ${injuries.map(nm).join(' und ')}: ${injuries.length > 1 ? 'Beide mussten' : 'Er musste'} verletzt ${injuries.length > 1 ? 'raus' : 'vom Platz'}. Eine genaue Diagnose steht noch aus.`);
  if (crowd && style !== 'stats') body.push(`${crowd.toLocaleString('de-DE')} Zuschauer ${home ? `sorgten im ${me.stadium?.name || 'Stadion'} für ${tone === 'top' ? 'Gänsehaut-Atmosphäre' : tone === 'crisis' ? 'ein gellendes Pfeifkonzert nach Abpfiff' : 'ordentliche Stimmung'}` : `sahen die Partie, darunter ${rng.int(4, 30) * 100} mitgereiste Anhänger von ${me.short}`}.`);
  // 5) table & outlook
  if (rank) {
    const r = rank <= 1 ? `Tabellenführer! ${me.short} grüßt von ganz oben.` : rank <= 4 ? `Mit Platz ${rank} liegt ${me.short} auf Kurs Europa${leader ? `, ${leader.short} führt die Tabelle an` : ''}.` : rank >= n - 2 ? `Platz ${rank} – die Abstiegszone ist bedrohlich nah. ${style === 'boulevard' ? 'Jetzt wird\'s eng!' : 'Die kommenden Wochen werden richtungsweisend.'}` : `In der Tabelle steht ${me.short} auf Rang ${rank}${oppRank ? `, ${opp.short} ist ${oppRank}.` : '.'}`;
    body.push(r);
  }
  const nx = nextOpponent(world);
  if (nx) body.push(`${pick(rng, ['Weiter geht es', 'Schon nächste Woche wartet die nächste Aufgabe', 'Als Nächstes'])}: ${nx.home ? 'zu Hause gegen' : 'auswärts bei'} ${nx.club.name}. ${nx.club.rep >= me.rep + 5 ? 'Ein echter Prüfstein.' : nx.club.rep <= me.rep - 8 ? 'Dort ist ein Sieg Pflicht.' : 'Ein Duell auf Augenhöhe.'}`);

  // voices
  const mq = d > 0 ? [`Ich bin stolz auf die Jungs. ${comeback ? 'Wie sie nach dem Rückstand zurückgekommen sind – das ist Mentalität.' : 'Wir haben unseren Plan umgesetzt.'}`, 'Drei Punkte, mehr zählt heute nicht. Aber wir können noch besser spielen.', `${hero ? `${ln(hero)} war überragend, ` : ''}aber das war eine Teamleistung.`]
    : d === 0 ? ['Mit dem Punkt kann ich leben – zufrieden bin ich nicht.', 'Wir hatten genug Chancen, um das Spiel zu gewinnen.', 'Am Ende ist es ein gerechtes Ergebnis.']
      : ['Das war zu wenig, da gibt es nichts zu beschönigen.', 'Wir müssen das jetzt schnell aufarbeiten und die richtigen Schlüsse ziehen.', `Ich übernehme die Verantwortung. ${d <= -3 ? 'So dürfen wir nie wieder auftreten.' : 'Wir kommen zurück.'}`];
  const oq = d < 0 ? ['Wir waren heute die bessere Mannschaft.', 'Ein großes Kompliment an mein Team.'] : d === 0 ? ['Ein Punkt, mit dem wir leben können.', 'Am Ende hätten wir das Spiel sogar gewinnen können.'] : ['Wir haben zu einfache Gegentore bekommen.', `Glückwunsch an ${me.short}, sie waren heute effektiver.`];
  const voices = [[`${mgr} (Trainer ${me.short})`, pick(rng, mq)], [`${oppCoach} (${opp.short})`, pick(rng, oq)]];
  const pv = hero || motm?.p;
  if (pv) voices.push([`${nm(pv)} (${me.short})`, d > 0 ? pick(rng, ['Unglaublich, dieses Gefühl! Das ist für die Fans.', 'Ich bin einfach froh, dass ich der Mannschaft helfen konnte.', 'Wir haben hart gearbeitet für diesen Moment.']) : d === 0 ? pick(rng, ['Wir hätten mehr verdient gehabt.', 'Mund abwischen, weiter geht\'s.']) : pick(rng, ['Das tut weh. Wir müssen jetzt zusammenhalten.', 'Wir entschuldigen uns bei den Fans.'])]);

  const statsBox = [['Ergebnis', `${world.clubs[m.h].short} ${m.hg}:${m.ag} ${world.clubs[m.a].short}`], ['Tore', tl.map((e) => `${e.h}:${e.a} ${ln(world.players[e.player])} (${e.minute}.)`).join(', ') || '–']];
  if (crowd) statsBox.push(['Zuschauer', crowd.toLocaleString('de-DE')]);
  if (st && so) statsBox.push(['Ballbesitz', `${st.possession} : ${so.possession} %`], ['Schüsse', `${st.shots} : ${so.shots}`]);
  const yel = (m.events || []).filter((e) => e.type === 'yellow' && e.side === side).map((e) => ln(world.players[e.player]));
  if (yel.length) statsBox.push(['Gelb', yel.join(', ')]);
  if (myRed || theirRed) statsBox.push(['Rot', reds.map((e) => `${ln(world.players[e.player])} (${e.minute}.)`).join(', ')]);

  return addArticle(world, {
    type: 'match', paper, author, style, kicker, title, lead: leadMap[style], body, tone, score: statsBox[0][1], cup,
    grades: grades.slice(0, 14).map((x) => [nm(x.p), x.p.pos, x.g]), stats: statsBox, voices,
    motm: motm ? nm(motm.p) : null, club: me.id, opp: opp.id,
  });
}

// ------------------------------------------------------------------ social media after a match
const HANDLE_PRE = ['', 'echter_', 'immer_', 'ultra_', 'nordkurve_', 'suedtribuene_'];
const HANDLE_POST = ['fan', '_ultra', '_forever', '1904', '_block', '_jung', '_mama', 'liebe', '_ffm', '_ruhrpott', '_kurve'];
const FIRST = ['Ben', 'Lena', 'Kevin', 'Tom', 'Sarah', 'Mehmet', 'Lukas', 'Jana', 'Dennis', 'Nico', 'Anna', 'Marco', 'Paul', 'Sven', 'Elif', 'Jonas', 'Chiara', 'Felix', 'Hannah', 'Can'];
const handleFor = (rng, club) => `${pick(rng, HANDLE_PRE)}${club.short.toLowerCase().replace(/[^a-z0-9äöü]/g, '')}${pick(rng, HANDLE_POST)}${rng.int(1, 99)}`;
const clubHandle = (club) => `@${club.short.toLowerCase().replace(/[^a-z0-9]/g, '')}_official`;
const playerHandle = (p) => `@${(p.firstName[0] || '').toLowerCase()}${p.lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}${p.number || ''}`;
const fan = (world, rng, M, club, text, kind = 'fan', extra = {}) => ({ season: world.season, week: world.week, user: `@${handleFor(rng, club)}`, name: pick(rng, FIRST), text, likes: scaleLikes(M, rng, 10, 1800), kind, club: club.id, ...extra });

export function socialAfterMatch(world, m, rng, art) {
  const M = ensureNewsroom(world);
  const me = world.clubs[world.userClubId], home = m.h === me.id, opp = world.clubs[home ? m.a : m.h];
  const gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg, d = gf - ga;
  const side = home ? 'h' : 'a';
  const tag = `#${me.short.replace(/\W/g, '')}${opp.short.replace(/\W/g, '')}`;
  const tl = goalTimeline(m);
  // followers
  const big = opp.rep >= me.rep + 6;
  const growth = d >= 3 ? 0.012 : d > 0 ? (big ? 0.015 : 0.005) : d === 0 ? 0.001 : -0.002;
  M.followers = Math.max(500, Math.round(M.followers * (1 + growth + rng.range(0, 0.002))));
  // official club account
  const goalsTxt = tl.filter((e) => e.side === side && !e.own).map((e) => `⚽ ${e.minute}' ${ln(world.players[e.player])}`).join('  ');
  pushFeed(M, { season: world.season, week: world.week, user: clubHandle(me), name: me.name, text: `🔚 ABPFIFF | ${world.clubs[m.h].short} ${m.hg}:${m.ag} ${world.clubs[m.a].short}${goalsTxt ? `\n${goalsTxt}` : ''}\n${d > 0 ? 'DREI PUNKTE! 💪' : d === 0 ? 'Ein Punkt. Weiter geht\'s.' : 'Kopf hoch, wir kommen zurück.'} ${tag}`, likes: scaleLikes(M, rng, 800, 9000), shares: scaleLikes(M, rng, 40, 900), kind: 'club', club: me.id, verified: true, tags: [tag] });
  // player accounts
  const scorer = tl.filter((e) => e.side === side && !e.own).map((e) => world.players[e.player]).filter(Boolean);
  const pp = scorer[scorer.length - 1];
  if (pp) pushFeed(M, { season: world.season, week: world.week, user: playerHandle(pp), name: nm(pp), text: pick(rng, d > 0 ? ['Was für ein Abend! 🙏⚽ Danke an alle, die uns supporten!', 'Für euch. Immer. ❤️', 'Tor. Sieg. Gänsehaut. 🔥', 'Hart gearbeitet für diesen Moment. Weiter! 💪'] : d === 0 ? ['Tor ist schön, der Punkt zu wenig. Wir bleiben dran.', 'Weiter arbeiten. 💯'] : ['Mein Tor zählt nichts ohne Punkte. Wir kommen zurück.']), likes: scaleLikes(M, rng, 900, 25000), kind: 'player', club: me.id, verified: true, photo: true });
  const inj = (m.events || []).find((e) => e.type === 'injury' && e.side === side);
  if (inj && world.players[inj.player]) { const p = world.players[inj.player]; pushFeed(M, { season: world.season, week: world.week, user: playerHandle(p), name: nm(p), text: pick(rng, ['Bitter. Aber ich komme stärker zurück. 💪🏻', 'Danke für all die Nachrichten ❤️ Reha startet morgen.', 'Rückschläge gehören dazu. Bis bald auf dem Platz!']), likes: scaleLikes(M, rng, 1500, 20000), kind: 'player', club: me.id, verified: true }); }
  // fans with replies
  const tone = art?.tone || (d > 0 ? 'ok' : d === 0 ? 'ok' : 'bad');
  const mgrLast = (world.manager?.name || 'Trainer').split(' ').slice(-1)[0];
  const raus = `#${mgrLast.replace(/\W/g, '')}Raus`;
  const T = {
    top: ['WAS FÜR EIN SPIEL!!! 🔥🔥', 'Gänsehaut. Einfach nur Gänsehaut. 💪 #Gänsehaut', 'Ich hab geheult. Ehrlich. ❤️', `${art?.motm ? art.motm.split(' ').slice(-1)[0] + ' für die Nationalmannschaft! ' : ''}Wahnsinn heute!`, 'Diese Mannschaft macht wieder Spaß! 🥹', 'Bester Verein der Welt, keine Diskussion.'],
    ok: ['Drei Punkte sind drei Punkte 👍', 'Geht noch besser, aber passt.', 'Nicht schön, aber egal!', 'Arbeitssieg. Nehmen wir mit.', 'Mund abwischen, weiter.'],
    bad: ['Unnötig…', 'Da war heute mehr drin 😤', 'Die Einstellung stimmt nicht.', 'Warum wechselt der so spät?!', 'Nächste Woche bitte mehr!'],
    crisis: ['Ich kann nicht mehr. 😡', 'So steigen wir ab!', `Zeit für Veränderungen. ${raus}`, 'Peinlich. Einfach nur peinlich.', 'Ich will mein Geld zurück.'],
  };
  const R = { top: ['Endlich mal wieder! 😍', 'Genau so! 🔥', 'Unterschreib ich sofort.'], ok: ['Sehe ich genauso.', 'Hauptsache gewonnen.', 'Abwarten…'], bad: ['Ruhig bleiben, Leute.', 'Immer dieses Gejammer hier 🙄', 'Leider wahr.'], crisis: [`Lasst ${mgrLast} doch mal arbeiten!`, 'Unterschreibe jedes Wort.', 'Der Vorstand muss jetzt handeln!'] };
  for (let i = 0; i < 3; i++) {
    const t = pick(rng, T[tone]);
    const replies = [];
    for (let k = 0, kn = rng.int(0, 2); k < kn; k++) replies.push({ user: `@${handleFor(rng, me)}`, name: pick(rng, FIRST), text: pick(rng, R[tone]), likes: scaleLikes(M, rng, 2, 300) });
    if (rng.chance(0.3)) replies.push({ user: `@${handleFor(rng, opp)}`, name: pick(rng, FIRST), text: pick(rng, d > 0 ? ['Glück gehabt.', 'Nächstes Mal sieht\'s anders aus.'] : ['😂😂😂', 'Danke für die Punkte!']), likes: scaleLikes(M, rng, 1, 200), rival: true });
    pushFeed(M, fan(world, rng, M, me, t, 'fan', { replies, tags: t.match(/#[\wÄÖÜäöüß]+/g) || [] }));
  }
  pushFeed(M, fan(world, rng, M, opp, pick(rng, d > 0 ? ['Glückstreffer. Mehr nicht.', 'Schiri hat euch geholfen 🙄', 'Nächstes Mal wieder.'] : d === 0 ? ['Gerechtes Remis.', 'Mehr habt ihr nicht drauf? 😏'] : ['Hahaha 😂', 'Danke für die Punkte!', 'Wie immer 🤷']), 'rival'));
  // the newspaper shares its article
  if (art) pushFeed(M, { season: world.season, week: world.week, user: `@${art.paper.toLowerCase().replace(/[^a-z]/g, '')}`, name: art.paper, text: `${PAPER_INFO[art.paper]?.icon || '📰'} ${art.title}\n👉 Spielbericht, Noten & Stimmen jetzt lesen`, likes: scaleLikes(M, rng, 200, 6000), kind: 'press', verified: true, article: art.id });
  // Kampfansage resolved
  const ch = M.challenge;
  if (ch && ch.week < world.week) M.challenge = null;
  if (ch && M.challenge && ch.opp === opp.id) {
    if (d > 0) { moodChange(world, 1, 4); pushFeed(M, fan(world, rng, M, me, `Er hat es angekündigt, er hat geliefert! 🔥 ${mgrLast} = Legende`, 'fan')); }
    else { moodChange(world, -2, d < 0 ? -5 : -2); pushFeed(M, fan(world, rng, M, opp, `Große Klappe, nichts dahinter 😂 @${mgrLast.toLowerCase()}`, 'rival', { likes: scaleLikes(M, rng, 2000, 15000) })); }
    M.challenge = null;
  }
}

// ------------------------------------------------------------------ manager posts (once per week)
export const MGR_POSTS = [
  { k: 'motivation', icon: '💪', label: 'Motivation', text: (o) => `Neue Woche, neue Chance. Wir arbeiten hart und geben alles${o ? ` gegen ${o.short}` : ''}. Gemeinsam! 💪` },
  { k: 'danke', icon: '❤️', label: 'Danke an die Fans', text: () => 'Danke für eure unglaubliche Unterstützung. Ihr seid der 12. Mann! ❤️' },
  { k: 'demut', icon: '🙏', label: 'Selbstkritik', text: () => 'Das war nicht gut genug. Ich übernehme die Verantwortung – und wir werden reagieren. 🙏' },
  { k: 'kampf', icon: '🔥', label: 'Kampfansage', text: (o) => `${o ? `${o.short}, wir kommen.` : 'Wir kommen.'} Und wir holen uns die drei Punkte. 🔥` },
];
export function canPostThisWeek(world) { const M = ensureNewsroom(world); return M.mgrPostWeek !== `${world.season}-${world.week}`; }
export function managerPost(world, k, rng) {
  const M = ensureNewsroom(world);
  if (!canPostThisWeek(world)) return { ok: false, msg: 'Du hast diese Woche schon gepostet.' };
  const def = MGR_POSTS.find((x) => x.k === k); if (!def) return { ok: false };
  const me = world.clubs[world.userClubId], nx = nextOpponent(world)?.club || null;
  const lostLast = (me.formRun || 0) < 0;
  M.mgrPostWeek = `${world.season}-${world.week}`;
  const name = world.manager?.name || 'Trainer';
  const replies = [];
  const addR = (club, t, rival) => replies.push({ user: `@${handleFor(rng, club)}`, name: pick(rng, FIRST), text: t, likes: scaleLikes(M, rng, 5, 900), rival });
  let msg, viral = 1;
  if (k === 'motivation') { moodChange(world, 0, 1); for (const id of me.squad) { const p = world.players[id]; p.morale = clamp(p.morale + 1, 0, 99); } addR(me, 'Let\'s go! 🔥'); addR(me, 'Genau so, Coach!'); msg = 'Die Mannschaft fühlt sich angesprochen (+ Moral).'; }
  else if (k === 'danke') { const fm = world.mood?.fans ?? 60; moodChange(world, 0, fm < 70 ? 2 : 1); addR(me, 'Wir stehen hinter euch! ❤️'); addR(me, 'Ehrensache, Trainer.'); msg = 'Die Fans freuen sich über die Wertschätzung.'; }
  else if (k === 'demut') { if (lostLast) { moodChange(world, 1, 3); addR(me, 'Respekt für diese Worte.'); addR(me, 'Endlich mal ehrlich. 👏'); msg = 'Ehrliche Worte nach der Niederlage kommen gut an.'; } else { moodChange(world, -1, -1); addR(me, 'Hä? Wir haben doch gar nicht verloren 😅'); addR(me, 'Komischer Post.'); msg = 'Ohne Anlass wirkt die Selbstkritik seltsam.'; viral = 1.6; } }
  else if (k === 'kampf') {
    if (!nx) return { ok: false, msg: 'Kein nächster Gegner in Sicht.' };
    M.challenge = { opp: nx.id, week: world.week + 1 };
    moodChange(world, 0, 2); viral = 3;
    addR(me, 'JAAA! So will ich das hören! 🔥🔥'); addR(nx, 'Wir freuen uns schon 😏', true); addR(nx, 'Screenshot gemacht. 📸', true);
    addArticle(world, { type: 'boulevard', paper: 'Der Ballblick', author: pick(rng, PAPER_INFO['Der Ballblick'].authors), style: 'boulevard', kicker: '🔥 Kampfansage', title: `${name.split(' ').slice(-1)[0].toUpperCase()} PROVOZIERT ${nx.short.toUpperCase()}!`, lead: `Mit einem einzigen Post hat ${name} das Duell gegen ${nx.name} angeheizt.`, body: [`„${def.text(nx)}“ – so schrieb ${name} in den sozialen Netzwerken. Innerhalb weniger Stunden wurde der Beitrag tausendfach geteilt.`, `Im Lager von ${nx.short} kommt das gar nicht gut an. Aus dem Umfeld des Vereins heißt es, man habe die Worte „mit Interesse zur Kenntnis genommen“. Die Spieler sollen den Post in der Kabine aufgehängt haben.`, `Klar ist: Wer so laut ankündigt, muss liefern. Gewinnt ${me.short}, ist ${name} der Held. Verliert die Mannschaft, wird der Spott gewaltig sein.`], tone: 'ok' });
    msg = `Der Post geht viral! Gewinnt ihr gegen ${nx.short}, feiern dich die Fans – sonst gibt es Spott.`;
  }
  pushFeed(M, { season: world.season, week: world.week, user: `@coach_${name.toLowerCase().replace(/[^a-z]/g, '')}`, name, text: def.text(nx), likes: scaleLikes(M, rng, 3000, 30000) * viral, shares: scaleLikes(M, rng, 100, 3000) * viral, kind: 'manager', club: me.id, verified: true, replies, mine: true });
  M.followers = Math.round(M.followers * (1 + 0.003 * viral));
  return { ok: true, msg };
}

// ------------------------------------------------------------------ weekly features
function lastResults(world, L, mdIdx) {
  return (L.fixtures[mdIdx] || []).filter((m) => m.hg != null);
}
function leagueScorers(world, L, n = 5) {
  const ids = new Set(L.clubIds);
  return Object.values(world.players).filter((p) => ids.has(p.clubId) && p.stats?.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals || a.stats.apps - b.stats.apps).slice(0, n);
}

function writeRoundup(world, rng) {
  const me = world.clubs[world.userClubId];
  const L = world.leagues.find((l) => l.id === me.leagueId);
  const mdIdx = world.week - 1;
  const res = lastResults(world, L, mdIdx);
  if (res.length < 2) return null;
  const t = computeTable(L);
  const top = world.clubs[t[0].id], second = world.clubs[t[1]?.id];
  const gap = t[0].pts - (t[1]?.pts || 0);
  const goals = res.reduce((s, m) => s + m.hg + m.ag, 0);
  const wild = res.slice().sort((a, b) => (b.hg + b.ag) - (a.hg + a.ag))[0];
  const upset = res.find((m) => { const H = world.clubs[m.h], A = world.clubs[m.a]; return (m.hg > m.ag && A.rep >= H.rep + 8) || (m.ag > m.hg && H.rep >= A.rep + 8); });
  const bottom = world.clubs[t[t.length - 1].id];
  const sc = leagueScorers(world, L);
  const paper = pickPaper(rng, ['national', 'stats', 'serioes']);
  const body = [
    `${goals} Tore in ${res.length} Spielen – ${goals / res.length >= 3 ? 'ein Spieltag für Feinschmecker' : goals / res.length <= 2 ? 'ein eher zäher Spieltag' : 'solide Kost'}. ${wild ? `Das torreichste Spiel lieferten ${world.clubs[wild.h].short} und ${world.clubs[wild.a].short} (${wild.hg}:${wild.ag}).` : ''}`,
    upset ? `Die Überraschung des Spieltags: ${world.clubs[upset.hg > upset.ag ? upset.h : upset.a].name} ${upset.hg > upset.ag ? 'schlägt' : 'gewinnt bei'} ${world.clubs[upset.hg > upset.ag ? upset.a : upset.h].name} – ${upset.hg}:${upset.ag}. Damit hatte kaum jemand gerechnet.` : 'Große Überraschungen blieben aus – die Favoriten erfüllten weitgehend ihre Pflicht.',
    `An der Spitze ${gap === 0 ? `herrscht Gleichstand: ${top.short} und ${second?.short} haben gleich viele Punkte` : `thront ${top.name} mit ${t[0].pts} Punkten, ${gap} ${gap === 1 ? 'Zähler' : 'Zähler'} vor ${second?.short}`}. Am Tabellenende ${bottom.short === me.short ? 'steckt ausgerechnet' : 'steckt'} ${bottom.name} mit ${t[t.length - 1].pts} Punkten fest.`,
    sc.length ? `Torjägerliste: ${sc.map((p, i) => `${i + 1}. ${nm(p)} (${world.clubs[p.clubId].short}) ${p.stats.goals}`).join(' · ')}.` : '',
  ].filter(Boolean);
  return addArticle(world, { type: 'rundschau', paper, author: pick(rng, PAPER_INFO[paper].authors), style: PAPER_INFO[paper].style, kicker: `📋 ${L.name} · ${mdIdx + 1}. Spieltag`, title: upset ? `Überraschung in ${L.name}: ${world.clubs[upset.hg > upset.ag ? upset.h : upset.a].short} sorgt für den Paukenschlag` : `${top.short} ${gap >= 5 ? 'enteilt der Konkurrenz' : 'bleibt vorn'} – die Liga-Rundschau`, lead: `Alle Ergebnisse, die Tabellenspitze und die besten Torjäger – der ${mdIdx + 1}. Spieltag im Überblick.`, body, results: res.map((m) => [world.clubs[m.h].short, `${m.hg}:${m.ag}`, world.clubs[m.a].short, m.h === me.id || m.a === me.id]), tone: 'ok' });
}

function writeColumn(world, rng) {
  const me = world.clubs[world.userClubId];
  const mood = world.mood || { board: 60, fans: 60 };
  const run = me.formRun || 0, name = world.manager?.name || 'der Trainer';
  const L = world.leagues.find((l) => l.id === me.leagueId), t = computeTable(L), rank = t.findIndex((r) => r.id === me.id) + 1;
  const goal = world.manager?.goal;
  const good = run >= 2 || mood.board >= 70, bad = run <= -2 || mood.board <= 35;
  const title = good ? pick(rng, [`${name} macht ${me.short} zum Gesprächsthema`, `Warum ${me.short} gerade so stark ist`, `Hut ab, ${name}!`]) : bad ? pick(rng, [`${me.short} braucht jetzt Antworten – keine Ausreden`, `Hat ${name} die Kabine noch?`, `Die Uhr tickt für ${name}`]) : pick(rng, [`${me.short} zwischen Anspruch und Wirklichkeit`, `Was ${me.short} jetzt fehlt`, `Der Weg von ${me.short} ist noch lang`]);
  const body = [
    `Ich sitze seit über dreißig Jahren auf Pressetribünen. Und wenn ich mir ${me.name} in diesen Wochen anschaue, dann ${good ? 'sehe ich etwas, das man nicht kaufen kann: eine Mannschaft, die für ihren Trainer läuft' : bad ? 'sehe ich eine Mannschaft, die verunsichert wirkt und nach Orientierung sucht' : 'sehe ich viel Ordentliches – aber wenig Besonderes'}.`,
    `${name} ${good ? 'hat in kurzer Zeit eine klare Handschrift entwickelt' : bad ? 'muss sich die Frage gefallen lassen, ob seine Ideen bei den Spielern noch ankommen' : 'hat Ideen, keine Frage. Aber Ideen allein gewinnen keine Spiele'}. ${me.tactic?.formation ? `Das ${me.tactic.formation} ${good ? 'sitzt' : 'wirkt manchmal wie ein Korsett'}.` : ''} Platz ${rank} ${good ? 'ist der verdiente Lohn' : bad ? 'ist für einen Verein wie diesen zu wenig' : 'spiegelt genau das wider'}.`,
    goal ? `Der Vorstand hat ${typeof goal === 'string' ? `„${goal}“` : 'klare Ziele'} ausgegeben. ${mood.board >= 60 ? 'Dort ist man zufrieden, das hört man aus dem Umfeld.' : mood.board >= 40 ? 'In der Chefetage beobachtet man die Entwicklung genau.' : 'In der Chefetage soll die Geduld bereits merklich geschrumpft sein.'}` : `Im Vorstand ist die Stimmung ${mood.board >= 60 ? 'gut' : mood.board >= 40 ? 'abwartend' : 'angespannt'}.`,
    `Mein Rat: ${good ? 'Nicht abheben. Die Liga ist lang, und die Gegner werden sich auf ' + me.short + ' einstellen.' : bad ? 'Zurück zu den Basics. Kompakt stehen, einfache Bälle spielen, Selbstvertrauen sammeln. Und die Fans mitnehmen – ohne sie geht es nicht.' : 'Mut! Wer oben mitspielen will, muss auch mal ins Risiko gehen.'}`,
    `Bis nächste Woche, Ihr ${COLUMNIST.name}.`,
  ];
  return addArticle(world, { type: 'kolumne', paper: COLUMNIST.paper, author: `${COLUMNIST.name} – ${COLUMNIST.title}`, style: 'national', kicker: '🖋️ Kolumne „Der Ballflüsterer“', title, lead: 'Die Meinung der Woche – pointiert, unbequem, ehrlich.', body, tone: good ? 'top' : bad ? 'crisis' : 'ok' });
}

function writeInterview(world, rng) {
  const me = world.clubs[world.userClubId];
  const ps = me.squad.map((id) => world.players[id]).filter((p) => !p.loan);
  const unhappy = ps.find((p) => p.wantsOut || p.morale < 35);
  const star = ps.slice().sort((a, b) => (b.stats.goals * 2 + b.stats.assists + b.ovr / 10) - (a.stats.goals * 2 + a.stats.assists + a.ovr / 10))[0];
  const p = unhappy && rng.chance(0.6) ? unhappy : star;
  if (!p) return null;
  const paper = pickPaper(rng, ['national', 'boulevard', 'lokal']);
  const sad = p === unhappy;
  const qa = sad ? [
    ['Sie spielen kaum. Wie geht es Ihnen?', pick(rng, ['Ehrlich? Nicht gut. Ich bin hier, um zu spielen – nicht, um auf der Bank zu sitzen.', 'Es ist frustrierend. Ich gebe im Training alles, aber das scheint nicht zu reichen.'])],
    [`Haben Sie mit ${world.manager?.name || 'dem Trainer'} gesprochen?`, pick(rng, ['Ja, aber konkrete Perspektiven habe ich nicht gehört.', 'Wir hatten ein Gespräch. Jetzt muss ich abwarten.'])],
    ['Denken Sie an einen Wechsel?', pick(rng, ['Ich schließe nichts aus. Mein Berater hält die Augen offen.', 'Wenn sich nichts ändert, muss ich mir Gedanken machen.'])],
    ['Was sagen Sie den Fans?', 'Ich liebe diesen Verein. Aber ich bin Profi, und Profis wollen spielen.'],
  ] : [
    [`${p.stats.goals ? `${p.stats.goals} ${p.stats.goals === 1 ? 'Tor' : 'Tore'}` : 'Eine starke Saison'} bisher – was ist Ihr Geheimnis?`, pick(rng, ['Kein Geheimnis. Harte Arbeit, guter Schlaf und eine Mannschaft, die mich findet.', 'Ich fühle mich wohl, das Vertrauen des Trainers ist riesig.'])],
    [`Wie ist die Stimmung in der Kabine?`, (me.formRun || 0) >= 0 ? 'Super. Wir lachen viel, aber im Training geht es zur Sache.' : 'Angespannt, das gebe ich zu. Aber wir halten zusammen.'],
    [`Was halten Sie von ${world.manager?.name || 'Ihrem Trainer'}?`, pick(rng, ['Er ist ehrlich und direkt. Das mögen wir.', 'Taktisch top. Er bereitet uns auf jeden Gegner perfekt vor.', 'Er fordert viel – aber er gibt auch viel zurück.'])],
    ['Ihr Ziel für diese Saison?', pick(rng, ['So viele Spiele gewinnen wie möglich. Und am Ende etwas feiern.', 'Persönlich: Nationalmannschaft. Mit dem Team: ganz nach oben.'])],
    ['Und privat?', pick(rng, ['Ich koche gern – meine Mitspieler sagen, meine Lasagne ist legendär.', 'Viel Zeit mit der Familie. Und ich lerne gerade Gitarre.', 'Ich zocke gern Fußballmanager – rate mal, welchen. 😄'])],
  ];
  if (sad) moodChange(world, -1, -1);
  return addArticle(world, { type: 'interview', paper, author: pick(rng, PAPER_INFO[paper].authors), style: PAPER_INFO[paper].style, kicker: sad ? '🎙️ Exklusiv-Interview · Unruhe' : '🎙️ Exklusiv-Interview', title: sad ? `${p.lastName} packt aus: „Ich will spielen!“` : `${p.lastName}: „${qa[0][1].split('.')[0]}.“`, lead: `${nm(p)} (${p.age}, ${posWord(p)}) im großen Gespräch über ${sad ? 'seine Situation bei ' + me.short : 'Erfolg, Kabine und Ziele'}.`, body: [], qa, tone: sad ? 'bad' : 'top', player: p.id });
}

function writePortrait(world, rng) {
  const me = world.clubs[world.userClubId];
  const ps = me.squad.map((id) => world.players[id]).filter((p) => p.age <= 21 && p.pot >= 70).sort((a, b) => b.pot - a.pot);
  const p = ps[0];
  if (!p || world.media.portraits?.includes(p.id)) return null;
  (world.media.portraits ||= []).push(p.id);
  const paper = pickPaper(rng, ['lokal', 'serioes']);
  const body = [
    `Wer ${p.firstName} ${p.lastName} beim Training beobachtet, versteht schnell, warum man bei ${me.short} so von ihm schwärmt. ${p.age} Jahre jung, ${posWord(p)}, ${p.attrs?.tempo >= 75 ? 'blitzschnell' : p.attrs?.technik >= 72 ? 'technisch beschlagen' : 'körperlich robust'} – und mit einem Ehrgeiz, der selbst erfahrene Profis beeindruckt.`,
    `Aufgewachsen ist er ${pick(rng, ['in einem kleinen Dorf, wo er auf dem Bolzplatz hinter der Kirche kickte', 'in der Stadt, auf Asphaltplätzen zwischen Hochhäusern', 'in einer fußballverrückten Familie – schon der Opa spielte im Verein'])}. ${pick(rng, ['Mit sieben kam er in die Jugend des Vereins', 'Ein Scout entdeckte ihn bei einem Hallenturnier', 'Seine Mutter fuhr ihn jahrelang dreimal pro Woche zum Training'])}.`,
    `Bislang stehen ${p.stats.apps} Einsätze und ${p.stats.goals} Tore in dieser Saison zu Buche. Experten trauen ihm deutlich mehr zu: Das Potenzial reicht für ${p.pot >= 85 ? 'die absolute Weltspitze' : p.pot >= 78 ? 'die Nationalmannschaft' : 'eine lange Profikarriere'}.`,
    `${world.manager?.name || 'Der Trainer'} über ihn: „${pick(rng, ['Er hat etwas Besonderes. Aber wir müssen ihm Zeit geben.', 'Er lernt unglaublich schnell. Ich bin gespannt, wohin sein Weg führt.', 'Wenn er so weitermacht, wird er uns noch viel Freude machen.'])}“`,
  ];
  return addArticle(world, { type: 'portrait', paper, author: pick(rng, PAPER_INFO[paper].authors), style: PAPER_INFO[paper].style, kicker: '🌱 Talent-Porträt', title: `${p.firstName} ${p.lastName}: ${pick(rng, ['Der nächste große Wurf?', 'Ein Juwel aus der eigenen Reihe', 'Das Wunderkind von ' + me.short])}`, lead: `Wir stellen das größte Talent im Kader von ${me.short} vor.`, body, tone: 'top', player: p.id });
}

const GOSSIP = [
  (p) => [`${p.lastName} und der neue Vierbeiner`, `Familienzuwachs bei ${nm(p)}: Der Profi hat sich einen ${['Labrador', 'Mops', 'Golden Retriever', 'Dackel'][p.id % 4]}-Welpen zugelegt. Name? „${['Bolzer', 'Kicker', 'Elfer', 'Tiki'][p.id % 4]}“! Der Kleine soll schon jetzt jeden Ball jagen.`],
  (p) => [`${p.lastName} im Küchen-Duell`, `${nm(p)} hat seine Leidenschaft fürs Kochen entdeckt. Beim Teamabend servierte er eine selbst gemachte Lasagne – die Mitspieler waren begeistert. Gerüchten zufolge soll er bereits für eine TV-Kochshow angefragt worden sein.`],
  (p) => [`Neue Frisur, neues Glück?`, `Ballblick-Leser haben es sofort bemerkt: ${nm(p)} trägt seit dieser Woche einen ${['blondierten', 'knallroten', 'raspelkurzen', 'geflochtenen'][p.id % 4]} Look. „Ich brauchte einfach eine Veränderung“, sagte er lachend.`],
  (p) => [`${p.lastName} spendet für den Nachwuchs`, `Ganz starke Geste: ${nm(p)} hat seinem Heimatverein neue Trikots und Bälle für die Jugendmannschaften spendiert. „Ich weiß, wo ich herkomme“, sagte er bescheiden.`],
  (p) => [`${p.lastName} als Hochzeits-DJ`, `Kurioser Auftritt: Beim Polterabend eines Mitspielers stand ${nm(p)} plötzlich hinter dem DJ-Pult – und brachte die Tanzfläche zum Kochen. Die Videos gingen in den sozialen Netzwerken viral.`],
  (p) => [`${p.lastName} und sein Torjubel-Geheimnis`, `Was steckt hinter dem neuen Jubel von ${nm(p)}? Ballblick weiß es: Er ist seiner kleinen Nichte gewidmet, die sich den Tanz ausgedacht hat.`],
];
function writeBoulevard(world, rng) {
  const me = world.clubs[world.userClubId];
  const p = world.players[pick(rng, me.squad)];
  if (!p) return null;
  const [title, text] = pick(rng, GOSSIP)(p);
  return addArticle(world, { type: 'boulevard', paper: 'Der Ballblick', author: pick(rng, PAPER_INFO['Der Ballblick'].authors), style: 'boulevard', kicker: '⭐ Ballblick-Leute', title: title.toUpperCase(), lead: text.split('. ')[0] + '.', body: [text, `Bei den Fans kommt das gut an: In den sozialen Netzwerken sammelt die Geschichte bereits tausende Likes.`], tone: 'ok', player: p.id });
}

function writePoll(world, rng) {
  const me = world.clubs[world.userClubId];
  const mood = world.mood || { board: 60, fans: 60 };
  const ps = me.squad.map((id) => world.players[id]);
  const kind = pick(rng, ['trainer', 'spieler', 'ziel']);
  let q, opts;
  if (kind === 'trainer') { const yes = clamp(Math.round(mood.fans * 0.9 + rng.int(-6, 6)), 5, 96); q = `Ist ${world.manager?.name || 'der Trainer'} der richtige Mann für ${me.short}?`; opts = [['Ja, auf jeden Fall', yes], ['Noch nicht sicher', clamp(Math.round((100 - yes) * 0.55), 0, 95)], ['Nein', 0]]; opts[2][1] = 100 - opts[0][1] - opts[1][1]; }
  else if (kind === 'spieler') { const top = ps.slice().sort((a, b) => (b.stats.goals * 3 + b.stats.assists * 2 + b.form / 10) - (a.stats.goals * 3 + a.stats.assists * 2 + a.form / 10)).slice(0, 4); const w = top.map((_, i) => [44, 27, 18, 11][i] + rng.int(-5, 5)); const s = w.reduce((a, b) => a + b, 0); q = `Wer ist der wichtigste Spieler von ${me.short}?`; opts = top.map((p, i) => [nm(p), Math.round((w[i] / s) * 100)]); }
  else { const L = world.leagues.find((l) => l.id === me.leagueId), t = computeTable(L), rank = t.findIndex((r) => r.id === me.id) + 1; const hope = clamp(Math.round(60 - rank * 4 + mood.fans / 4), 5, 80); q = `Was schafft ${me.short} in dieser Saison?`; opts = [['Europa / ganz oben', hope], ['Gesichertes Mittelfeld', clamp(Math.round((100 - hope) * 0.65), 0, 90)], ['Abstiegskampf', 0]]; opts[2][1] = 100 - opts[0][1] - opts[1][1]; }
  const votes = Math.round((ensureNewsroom(world).followers / 40) * rng.range(0.5, 1.5));
  return addArticle(world, { type: 'umfrage', paper: 'Abendpost Sport', author: 'Leser-Redaktion', style: 'lokal', kicker: '📊 Fan-Umfrage', title: q, lead: `${votes.toLocaleString('de-DE')} Leserinnen und Leser haben abgestimmt – das Ergebnis ist eindeutig${kind === 'trainer' && opts[0][1] < 40 ? ' – und alarmierend' : ''}.`, body: [], poll: { q, opts, votes }, tone: kind === 'trainer' ? (opts[0][1] >= 55 ? 'top' : opts[0][1] < 35 ? 'crisis' : 'ok') : 'ok' });
}

function writeTeamOfWeek(world, rng) {
  const me = world.clubs[world.userClubId];
  const L = world.leagues.find((l) => l.id === me.leagueId);
  const res = lastResults(world, L, world.week - 1);
  if (res.length < 3) return null;
  const winners = new Set(); for (const m of res) { if (m.hg >= m.ag) winners.add(m.h); if (m.ag >= m.hg) winners.add(m.a); }
  const pool = [...winners].flatMap((id) => world.clubs[id].squad).map((id) => world.players[id]).filter((p) => p && !(p.injury > 0));
  const slots = [['TW', ['TW']], ['RV', ['RV']], ['IV', ['IV']], ['IV', ['IV']], ['LV', ['LV']], ['ZM', ['DM', 'ZM']], ['ZM', ['ZM', 'OM']], ['OM', ['OM', 'ZM', 'LM', 'RM']], ['RA', ['RA', 'RM']], ['ST', ['ST']], ['LA', ['LA', 'LM']]];
  const used = new Set(), xi = [];
  const sc = (p) => p.ovr * 0.5 + (p.form ?? 50) * 0.3 + rng.range(0, 14) + (p.clubId === me.id ? 3 : 0);
  for (const [lab, ok] of slots) { const c = pool.filter((p) => ok.includes(p.pos) && !used.has(p.id)).sort((a, b) => sc(b) - sc(a))[0]; if (c) { used.add(c.id); xi.push([lab, nm(c), world.clubs[c.clubId]?.short || '', c.clubId === me.id]); } }
  if (xi.length < 9) return null;
  const mine = xi.filter((x) => x[3]).length;
  return addArticle(world, { type: 'elf', paper: 'Kicker-Express', author: pick(rng, PAPER_INFO['Kicker-Express'].authors), style: 'stats', kicker: `⭐ Elf des ${world.week}. Spieltags`, title: mine ? `${mine} × ${me.short} in der Elf des Spieltags` : `Die Elf des ${world.week}. Spieltags`, lead: 'Die besten Spieler des Wochenendes – ausgewählt von der Kicker-Express-Redaktion.', body: [], xi, tone: mine ? 'top' : 'ok' });
}

function writeRumourMill(world, rng) {
  const rs = (world.rumours || []).filter((r) => r.season === world.season && world.week - r.week <= 3).slice(0, 5);
  if (rs.length < 2) return null;
  const me = world.clubs[world.userClubId];
  const lines = rs.map((r) => `${r.name}${r.from != null && world.clubs[r.from] ? ` (${world.clubs[r.from].short})` : ''} → ${world.clubs[r.to]?.name || '?'}: ${r.reliability >= 70 ? '🔥 heiße Spur' : r.reliability >= 45 ? '🤔 möglich' : '🧂 mit Vorsicht genießen'}${r.source ? ` – Quelle: ${r.source}` : ''}`);
  const own = rs.find((r) => r.from === me.id || r.to === me.id);
  return addArticle(world, { type: 'geruecht', paper: 'Der Ballblick', author: pick(rng, PAPER_INFO['Der Ballblick'].authors), style: 'boulevard', kicker: '🔎 Gerüchteküche', title: own ? `TRANSFER-HAMMER BEI ${me.short.toUpperCase()}? ${own.name.toUpperCase()} IM VISIER` : 'DIE HEISSESTEN TRANSFER-GERÜCHTE DER WOCHE', lead: 'Wer kommt, wer geht, wer pokert? Unsere Insider haben sich umgehört.', body: lines, tone: 'ok' });
}

// called once a week after the week counter moved on
export function weeklyNewsroom(world, rng) {
  if (world.userClubId == null) return;
  const M = ensureNewsroom(world);
  if (world.week >= 1) writeRoundup(world, rng);
  const wk = world.week;
  const features = [
    [wk % 3 === 0, writeColumn], [wk % 4 === 1, writeInterview], [wk % 5 === 2, writePortrait], [rng.chance(0.25), writeBoulevard],
    [wk % 4 === 3, writePoll], [wk >= 2 && wk % 2 === 0, writeTeamOfWeek], [rng.chance(0.4), writeRumourMill],
  ];
  let n = 0;
  for (const [on, fn] of features) if (on && n < 3 && fn(world, rng)) n++;
  // trending: a sponsor/fan-account post now and then
  if (rng.chance(0.35)) { const me = world.clubs[world.userClubId]; pushFeed(M, fan(world, rng, M, me, pick(rng, ['Wer ist am Wochenende alles im Stadion? 🙋', 'Neues Auswärtstrikot ist 🔥 oder 🗑️?', 'Unpopular opinion: Wir brauchen einen neuen Stürmer.', 'Zeigt eure Fan-Tattoos! 👇', 'Erstes Spiel mit meinem Sohn im Stadion. Gänsehaut ❤️']), 'fan', { replies: [{ user: `@${handleFor(rng, me)}`, name: pick(rng, FIRST), text: pick(rng, ['🙋‍♂️', 'Ich!', 'Sowas von 🔥', 'Bin dabei!']), likes: scaleLikes(M, rng, 2, 120) }] })); }
}

// season review (called from seasonRecords at the end of a season)
export function writeSeasonReview(world, rank, pts) {
  const rng = { next: Math.random, int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), range: (a, b) => a + Math.random() * (b - a), chance: (p) => Math.random() < p };
  const me = world.clubs[world.userClubId];
  const L = world.leagues.find((l) => l.id === me.leagueId);
  const ps = me.squad.map((id) => world.players[id]);
  const top = ps.slice().sort((a, b) => b.stats.goals - a.stats.goals)[0];
  const ast = ps.slice().sort((a, b) => b.stats.assists - a.stats.assists)[0];
  const ever = ps.slice().sort((a, b) => b.stats.apps - a.stats.apps)[0];
  const champ = rank === 1, n = L.clubIds.length, down = rank > n - 2;
  const name = world.manager?.name || 'der Trainer';
  const grade = champ ? 1 : rank <= 4 ? 1.5 : rank <= n / 2 ? 2.5 : down ? 5.5 : 3.5;
  const body = [
    champ ? `Es ist vollbracht: ${me.name} ist Meister der ${L.name}! ${pts} Punkte, Platz eins – eine Saison für die Geschichtsbücher. ${name} hat aus dieser Mannschaft eine Einheit geformt, die am Ende nicht zu stoppen war.` : down ? `Es ist der bitterste Moment der Vereinsgeschichte der letzten Jahre: ${me.name} beendet die Saison auf Rang ${rank}. Mit ${pts} Punkten reichte es nicht. Jetzt beginnt die Aufarbeitung.` : `Platz ${rank} mit ${pts} Punkten – ${rank <= 4 ? 'eine richtig starke Saison' : rank <= n / 2 ? 'eine ordentliche Saison mit Luft nach oben' : 'eine Saison zum Abhaken'} für ${me.name}.`,
    `Die Gesichter der Saison: ${top?.stats.goals ? `${nm(top)} mit ${top.stats.goals} Toren als bester Torschütze` : 'Ein echter Torjäger fehlte'}${ast?.stats.assists ? `, ${nm(ast)} mit ${ast.stats.assists} Vorlagen als bester Vorbereiter` : ''}${ever ? ` und ${nm(ever)}, der mit ${ever.stats.apps} Einsätzen ein Dauerbrenner war` : ''}.`,
    `Unsere Saisonnote für ${name}: ${gradeStr(grade)}. ${grade <= 1.5 ? 'Besser geht es kaum.' : grade <= 2.5 ? 'Gute Arbeit, mit klarer Entwicklung.' : grade <= 3.5 ? 'Licht und Schatten.' : 'Das war zu wenig.'}`,
    `Und jetzt? ${champ ? 'Titel verteidigen – die schwerste Aufgabe im Fußball.' : down ? 'Neuanfang. Die Fans werden genau hinschauen, wer bleibt und wer geht.' : 'Im Sommer muss der Kader gezielt verstärkt werden, um den nächsten Schritt zu machen.'}`,
  ];
  addArticle(world, { type: 'saison', paper: 'Fußball Heute', author: pick(rng, PAPER_INFO['Fußball Heute'].authors), style: 'national', kicker: `📅 Saisonbilanz ${seasonLabel(world.season)}`, title: champ ? `${me.short} IST MEISTER! Die Saison der Superlative` : down ? `Absturz! Die Saisonbilanz von ${me.short}` : `Saisonbilanz: ${me.short} auf Platz ${rank}`, lead: `Die große Analyse: Höhepunkte, Tiefpunkte und die Noten der Saison.`, body, tone: champ ? 'top' : down ? 'crisis' : rank <= 4 ? 'top' : 'ok' });
  const M = ensureNewsroom(world);
  if (champ) M.followers = Math.round(M.followers * 1.15);
}
