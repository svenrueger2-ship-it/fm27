// v5.2: stock market, difficulty, stadium interior, editor article, scene-free season
import assert from 'node:assert';
import { generateWorld } from '../src/data/generator.js';
import { ensureEconomy } from '../src/manager/economy.js';
import { canIPO, goPublic, issueShares, buyback, setDividend, weeklyStock, payDividend, MAX_FLOAT } from '../src/manager/stock.js';
import { applyDifficulty, diff } from '../src/manager/difficulty.js';
import { interiorOptions, startProject, weeklyConstruction, interiorIncome, standName } from '../src/manager/stadiumBuild.js';
import { askingPrice } from '../src/manager/transfers.js';
import { RNG } from '../src/core/rng.js';

const w = generateWorld();
const L = w.leagues.find((l) => l.id === 'de1');
const club = w.clubs[L.clubIds.find((id) => w.clubs[id].rep > 75)];
w.userClubId = club.id;
for (const l of w.leagues) for (const id of l.clubIds) ensureEconomy(w.clubs[id], l);
// difficulty
const b0 = club.budget; applyDifficulty(w, 'legende');
assert.ok(club.budget < b0 && diff(w).board > 1, 'legend lowers budget');
const other = w.players[w.clubs[L.clubIds.find((id) => id !== club.id)].squad[0]];
const pL = askingPrice(w, other); w.difficulty = 'leicht'; const pE = askingPrice(w, other);
assert.ok(pL > pE, 'transfers cheaper on easy');
// stock
assert.ok(canIPO(w, club, L), 'top club can IPO');
const bb = club.budget; const r = goPublic(w, club, L, 30);
assert.ok(r.ok && club.budget > bb && club.stock.float === 30);
assert.ok(!issueShares(w, club, 40).ok || club.stock.float <= MAX_FLOAT);
assert.ok(club.stock.float <= MAX_FLOAT, '50+1');
const rng = new RNG(5);
for (let i = 0; i < 20; i++) { w.week = i; weeklyStock(w, club, L, 3, rng); }
assert.ok(club.stock.price > 0 && club.stock.history.length > 10);
setDividend(club, 0.2); club.stock.paidSeason = null; club.budget += 5e7; assert.ok(payDividend(w, club) > 0, 'dividend paid');
club.budget += 5e8; const bk = buyback(w, club, club.stock.float); assert.ok(bk.ok && !club.stock.listed, 'full buyback delists');
// interior
const io = interiorOptions(club)[0]; club.budget += 1e8;
assert.ok(startProject(w, club, io.opt, null).ok);
for (let i = 0; i < 10; i++) weeklyConstruction(w, club);
assert.equal(club.stadium.layout.interior.catering, 1); assert.ok(interiorIncome(club) > 0);
club.stadium.layout.stands[2].name = 'Südtribüne'; assert.equal(standName(club, 2), 'Südtribüne'); assert.equal(standName(club, 0), 'Haupttribüne');
console.log('v5.2 tests ok');
