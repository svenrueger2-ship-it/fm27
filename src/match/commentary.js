// TV commentary (v2.0): turns match events and the run of play into varied German commentary lines.
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

const L = {
  kickoff: ['Und los geht’s! {h} gegen {a} – der Ball rollt.', 'Anpfiff! Wir sind gespannt auf dieses Duell.', 'Der Schiedsrichter gibt das Spiel frei. Viel Spaß!'],
  goal: ['TOOOR! {p} trifft für {t}! {s}', 'Da ist das Ding! {p} – eiskalt! {s}', 'Was für ein Treffer von {p}! {t} jubelt, {s}', 'Drin! {p} lässt dem Keeper keine Chance. {s}', '{p}! TOR! Die Fans von {t} stehen Kopf! {s}'],
  goalLate: ['In der {m}. Minute! {p} – das könnte die Entscheidung sein! {s}', 'Spät, aber nicht zu spät: {p} trifft! {s}'],
  equaliser: ['Der Ausgleich! {p} bringt {t} zurück ins Spiel! {s}', 'Alles wieder offen! {p} gleicht aus. {s}'],
  save: ['Starke Parade! {k} ist auf dem Posten.', 'Was für ein Reflex von {k}!', '{k} pariert – das war knapp!', 'Glanztat von {k}!'],
  miss: ['Knapp vorbei! Da war mehr drin für {p}.', 'Uiii – {p} verzieht!', 'Der Ball streicht am Pfosten vorbei. {p} schlägt die Hände vors Gesicht.', 'Drüber! {p} hatte zu viel Rücklage.'],
  foul: ['Foulspiel – der Schiedsrichter pfeift.', 'Das war zu ungestüm. Freistoß.', 'Da geht {p} rustikal zur Sache.'],
  yellow: ['Gelb für {p}. Vertretbar.', 'Die Gelbe Karte für {p} – er muss jetzt aufpassen.', '{p} sieht Gelb.'],
  red: ['ROT! {p} muss runter! Das verändert alles.', 'Platzverweis für {p}! {t} nur noch zu zehnt.'],
  offside: ['Abseits! Die Fahne geht hoch.', 'Zu früh gestartet – Abseits.'],
  penalty: ['ELFMETER! Der Schiedsrichter zeigt auf den Punkt!', 'Strafstoß! Das ist die große Chance!'],
  sub: ['Wechsel bei {t}: {p} kommt ins Spiel.', 'Frische Kräfte für {t} – {p} ist jetzt dabei.'],
  injury: ['Oh nein, {p} bleibt liegen. Das sieht nicht gut aus.', '{p} hat sich verletzt – die Betreuer eilen aufs Feld.'],
  halftime: ['Halbzeit! {h} {sh}:{sa} {a}. Durchatmen.', 'Pause beim Stand von {sh}:{sa}. Mal sehen, was die Trainer jetzt ändern.'],
  fulltime: ['Abpfiff! {h} {sh}:{sa} {a}.', 'Das Spiel ist aus! Endstand {sh}:{sa}.'],
  var: ['Moment – der VAR schaut sich das noch einmal an …', 'Videobeweis! Alle Augen auf den Schiedsrichter.'],
  varOff: ['Kein Tor! Der VAR nimmt den Treffer zurück.', 'Bitter – das Tor zählt nicht!'],
  varOk: ['Das Tor zählt! Durchatmen bei {t}.', 'Bestätigt! Der Treffer bleibt bestehen.'],
  coach: ['Taktische Reaktion an der Seitenlinie: {x}', 'Der Trainer greift ein – {x}'],
  pressure: ['{t} drückt jetzt richtig.', 'Druckphase von {t}!', '{t} schnürt den Gegner ein.', 'Das Spiel läuft nur noch in eine Richtung – Richtung Tor von {o}.'],
  calm: ['{t} lässt den Ball in den eigenen Reihen laufen.', 'Geduldiger Spielaufbau von {t}.', 'Ruhige Phase im Spiel.', 'Viel Ballbesitz für {t}, aber noch keine zündende Idee.'],
  stat: ['{t} mit {sh} Schüssen bisher – {o} kommt auf {sa}.', 'Ballbesitz {pp} Prozent für {t}.'],
};

export class Commentator {
  constructor(engine) { this.E = engine; this.cool = 0; this.last = ''; }
  line(key, v) { const s = fill(pick(L[key]), v); if (s === this.last) return fill(pick(L[key]), v); this.last = s; return s; }

  onEvent(e) {
    const E = this.E, [A, B] = E.teams;
    const T = e.team != null ? E.teams[e.team] : null, O = e.team != null ? E.teams[1 - e.team] : null;
    const p = T?.players.find((q) => q.id === e.player);
    const name = p ? p.data.lastName : '';
    const v = { h: A.club.name, a: B.club.name, t: T?.club.name, o: O?.club.name, p: name, m: E.minute(), sh: A.score, sa: B.score, s: `${A.score}:${B.score}.` };
    this.cool = 6;
    switch (e.type) {
      case 'goal': {
        const diff = Math.abs(A.score - B.score);
        if (diff === 0) return this.line('equaliser', v);
        if (E.minute() >= 80) return this.line('goalLate', v);
        return this.line('goal', v);
      }
      case 'save': { const k = O?.players.find((q) => q.isGK && !q.offPitch); return this.line('save', { ...v, k: k ? k.data.lastName : 'der Keeper' }); }
      case 'miss': return this.line('miss', v);
      case 'foul': return Math.random() < 0.5 ? this.line('foul', v) : null;
      case 'yellow': return this.line('yellow', v);
      case 'red': return this.line('red', v);
      case 'offside': return Math.random() < 0.6 ? this.line('offside', v) : null;
      case 'penalty': return this.line('penalty', v);
      case 'sub': return this.line('sub', v);
      case 'injury': return this.line('injury', v);
      case 'halftime': return this.line('halftime', v);
      case 'fulltime': return this.line('fulltime', v);
      case 'coach': return this.line('coach', { ...v, x: (e.text || '').replace(/^[^:]+: Trainer /, '').replace(/\.$/, '') });
      case 'var': return e.overturned ? this.line('varOff', v) : e.confirmed ? this.line('varOk', v) : this.line('var', v);
      case 'kickoff2': return 'Weiter geht’s – die zweite Halbzeit läuft.';
      default: return null;
    }
  }

  // periodic lines from the run of play
  tick(dt) {
    const E = this.E;
    if (E.phase !== 'play') return null;
    this.cool -= dt;
    if (this.cool > 0) return null;
    this.cool = 16 + Math.random() * 14;
    const [A, B] = E.teams;
    const own = E.ball.owner ? E.teams[E.ball.owner.team] : null;
    if (!own) return null;
    const opp = E.teams[1 - own.idx];
    const bx = E.ball.pos.x * E.dirOf(own.idx);
    const v = { t: own.club.name, o: opp.club.name, sh: A.stats.shots, sa: B.stats.shots };
    const r = Math.random();
    if (r < 0.2) { const poss = Math.round((E.possession[0] / Math.max(1, E.possession[0] + E.possession[1])) * 100); return this.line('stat', { ...v, t: A.club.name, o: B.club.name, pp: poss }); }
    return Math.abs(E.ball.pos.x) > 25 && bx > 0 ? this.line('pressure', v) : this.line('calm', v);
  }
}
