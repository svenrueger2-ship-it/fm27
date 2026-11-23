// Builds src/data/realSquads.js + src/data/nationsExtra.js from /home/claude/squads/*.txt
import fs from 'fs';
const dir = process.argv[2] || '/home/claude/squads';
// country name -> [code, iso2 or special flag, German name, skin group d=dark m=mixed l=light]
const C = {
  'Germany':['GER','DE','Deutschland','l'],'France':['FRA','FR','Frankreich','m'],'Austria':['AUT','AT','Österreich','l'],'Denmark':['DEN','DK','Dänemark','l'],
  'Japan':['JPN','JP','Japan','a'],'Turkey':['TUR','TR','Türkei','l'],'Switzerland':['SUI','CH','Schweiz','l'],'Croatia':['CRO','HR','Kroatien','l'],
  'Sweden':['SWE','SE','Schweden','l'],'Netherlands':['NED','NL','Niederlande','m'],'United States':['USA','US','USA','m'],'Poland':['POL','PL','Polen','l'],
  'Brazil':['BRA','BR','Brasilien','m'],'Portugal':['POR','PT','Portugal','l'],'Norway':['NOR','NO','Norwegen','l'],'Morocco':['MAR','MA','Marokko','b'],
  'Italy':['ITA','IT','Italien','l'],'Finland':['FIN','FI','Finnland','l'],'Belgium':['BEL','BE','Belgien','m'],'Kosovo':['KOS','XK','Kosovo','l'],
  'South Korea':['KOR','KR','Südkorea','a'],'Nigeria':['NGA','NG','Nigeria','d'],'Ghana':['GHA','GH','Ghana','d'],'England':['ENG','ENG','England','m'],
  'Spain':['ESP','ES','Spanien','l'],'Iceland':['ISL','IS','Island','l'],'Bosnia and Herzegovina':['BIH','BA','Bosnien-Herzegowina','l'],'Suriname':['SUR','SR','Suriname','d'],
  'Serbia':['SRB','RS','Serbien','l'],'Algeria':['ALG','DZ','Algerien','b'],'Tunisia':['TUN','TN','Tunesien','b'],'Hungary':['HUN','HU','Ungarn','l'],
  'Greece':['GRE','GR','Griechenland','l'],'Czech Republic':['CZE','CZ','Tschechien','l'],'Bulgaria':['BUL','BG','Bulgarien','l'],'Slovakia':['SVK','SK','Slowakei','l'],
  'Scotland':['SCO','SCO','Schottland','l'],'Luxembourg':['LUX','LU','Luxemburg','l'],'Ivory Coast':['CIV','CI','Elfenbeinküste','d'],'DR Congo':['COD','CD','DR Kongo','d'],
  'Burkina Faso':['BFA','BF','Burkina Faso','d'],'Australia':['AUS','AU','Australien','l'],'Argentina':['ARG','AR','Argentinien','l'],'Zambia':['ZAM','ZM','Sambia','d'],
  'Ukraine':['UKR','UA','Ukraine','l'],'Togo':['TOG','TG','Togo','d'],'Slovenia':['SVN','SI','Slowenien','l'],'Senegal':['SEN','SN','Senegal','d'],
  'Romania':['ROU','RO','Rumänien','l'],'Philippines':['PHI','PH','Philippinen','a'],'Guinea':['GUI','GN','Guinea','d'],'Georgia':['GEO','GE','Georgien','l'],
  'Gambia':['GAM','GM','Gambia','d'],'Estonia':['EST','EE','Estland','l'],'Cameroon':['CMR','CM','Kamerun','d'],'Albania':['ALB','AL','Albanien','l'],
  'Uruguay':['URU','UY','Uruguay','l'],'Uganda':['UGA','UG','Uganda','d'],'Thailand':['THA','TH','Thailand','a'],'South Africa':['RSA','ZA','Südafrika','d'],
  'Sierra Leone':['SLE','SL','Sierra Leone','d'],'Republic of the Congo':['CGO','CG','Kongo','d'],'Peru':['PER','PE','Peru','b'],'Moldova':['MDA','MD','Moldau','l'],
  'Martinique':['MTQ','MQ','Martinique','d'],'Mali':['MLI','ML','Mali','d'],'Malawi':['MWI','MW','Malawi','d'],'Madagascar':['MAD','MG','Madagaskar','d'],
  'Lebanon':['LBN','LB','Libanon','b'],'Latvia':['LVA','LV','Lettland','l'],'Jamaica':['JAM','JM','Jamaika','d'],'Israel':['ISR','IL','Israel','b'],
  'Ireland':['IRL','IE','Irland','l'],'Indonesia':['IDN','ID','Indonesien','a'],'Haiti':['HAI','HT','Haiti','d'],'Guinea-Bissau':['GNB','GW','Guinea-Bissau','d'],
  'Egypt':['EGY','EG','Ägypten','b'],'Ecuador':['ECU','EC','Ecuador','b'],'Comoros':['COM','KM','Komoren','d'],'Colombia':['COL','CO','Kolumbien','b'],
  'Canada':['CAN','CA','Kanada','m'],'Benin':['BEN','BJ','Benin','d'],'Armenia':['ARM','AM','Armenien','l'],'Angola':['ANG','AO','Angola','d'],
  'Curaçao':['CUW','CW','Curaçao','d'],'Cyprus':['CYP','CY','Zypern','l'],'Eritrea':['ERI','ER','Eritrea','d'],'Honduras':['HON','HN','Honduras','b'],
  'Mexico':['MEX','MX','Mexiko','b'],'New Zealand':['NZL','NZ','Neuseeland','l'],'North Macedonia':['MKD','MK','Nordmazedonien','l'],
  'Northern Ireland':['NIR','GB','Nordirland','l'],'Paraguay':['PAR','PY','Paraguay','b'],'Trinidad and Tobago':['TRI','TT','Trinidad und Tobago','d'],
  'Uzbekistan':['UZB','UZ','Usbekistan','l'],
  'Mozambique':['MOZ','MZ','Mosambik','d'],'Chile':['CHI','CL','Chile','b'],'Venezuela':['VEN','VE','Venezuela','b'],'Zimbabwe':['ZIM','ZW','Simbabwe','d'],
  'Jordan':['JOR','JO','Jordanien','b'],'Panama':['PAN','PA','Panama','b'],'Afghanistan':['AFG','AF','Afghanistan','b'],'Kenya':['KEN','KE','Kenia','d'],
  'Namibia':['NAM','NA','Namibia','d'],'Guadeloupe':['GLP','GP','Guadeloupe','d'],'Gabon':['GAB','GA','Gabun','d'],'Montenegro':['MNE','ME','Montenegro','l'],
  'Singapore':['SGP','SG','Singapur','a'],'Saint Lucia':['LCA','LC','St. Lucia','d'],'Barbados':['BRB','BB','Barbados','d'],'Cape Verde':['CPV','CV','Kap Verde','d'],
  'Russia':['RUS','RU','Russland','l'],'Dominican Republic':['DOM','DO','Dominikanische Republik','b'],'Niger':['NIG','NE','Niger','d'],
  'Equatorial Guinea':['EQG','GQ','Äquatorialguinea','d'],'Lithuania':['LTU','LT','Litauen','l'],'Central African Republic':['CTA','CF','Zentralafrikanische Republik','d'],
  'Saudi Arabia':['KSA','SA','Saudi-Arabien','b'],'Burundi':['BDI','BI','Burundi','d'],'Costa Rica':['CRC','CR','Costa Rica','b'],'Mauritania':['MTN','MR','Mauretanien','d'],
  'Tanzania':['TAN','TZ','Tansania','d'],'Wales':['WAL','WAL','Wales','l'],
  'Iran':['IRN','IR','Iran','b'],'Chad':['CHA','TD','Tschad','d'],'Bolivia':['BOL','BO','Bolivien','b'],'Puerto Rico':['PUR','PR','Puerto Rico','b'],
  'Faroe Islands':['FRO','FO','Färöer','l'],'Grenada':['GRN','GD','Grenada','d'],'Iraq':['IRQ','IQ','Irak','b'],'Syria':['SYR','SY','Syrien','b'],'Liberia':['LBR','LR','Liberia','d'],
};
const SPECIAL = { ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' };
const flagOf = (iso) => SPECIAL[iso] || [...iso].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');
const files = fs.readdirSync(dir).filter((f) => /^b\d+\.txt$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
const seen = new Set(); const out = {}; const info = {}; const usedNat = new Set(); const missing = new Set();
for (const f of files) {
  let cur = null;
  for (const raw of fs.readFileSync(`${dir}/${f}`, 'utf8').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith('#')) { cur = line.slice(1); out[cur] = out[cur] || []; continue; }
    if (line.startsWith('FOUNDED|')) { const [, y, t] = line.split('|'); info[cur] = { founded: +y || null, titles: +t || 0 }; continue; }
    const [num, name, pos, country] = line.split('|').map((s) => s.trim());
    if (!cur || !name || !['GK', 'DF', 'MF', 'FW'].includes(pos)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue; seen.add(key);
    const c = C[country]; if (!c) { missing.add(country); }
    const code = c ? c[0] : 'GER'; usedNat.add(country);
    out[cur].push([parseInt(num) || 0, name, pos[0], code]);
  }
}
if (missing.size) console.warn('MISSING', [...missing]);
const nat = {}; const skin = {};
for (const [, [code, iso, de, s]] of Object.entries(C)) { nat[code] = { name: de, flag: flagOf(iso) }; skin[code] = s; }
fs.writeFileSync('src/data/realSquads.js', `// Real first-team squads (en.wikipedia, Nov 2026). [number, name, G/D/M/F, nation]\nexport const REAL_SQUADS = ${JSON.stringify(out)};\n`);
fs.writeFileSync('src/data/clubInfo.js', `// Real club facts (en.wikipedia infobox, Nov 2026): founding year, top-flight league titles\nexport const CLUB_INFO = ${JSON.stringify(info)};\n`);
fs.writeFileSync('src/data/nationsExtra.js', `// Nations used by real squads: German name, flag, skin group (l light, m mixed, d dark, b tan, a east-asian)\nexport const NATIONS_EXTRA = ${JSON.stringify(nat)};\nexport const NATION_SKIN = ${JSON.stringify(skin)};\n`);
console.log('clubs', Object.keys(out).length, 'players', Object.values(out).reduce((s, a) => s + a.length, 0), Object.entries(out).map(([k, v]) => k + ':' + v.length).join(' '));
