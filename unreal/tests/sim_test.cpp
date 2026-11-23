// g++ -O2 -std=c++17 -I../FM27Match/Source/FM27Match/Sim sim_test.cpp ../FM27Match/Source/FM27Match/Sim/MatchSim.cpp
#include "MatchSim.h"
#include <cstdio>
#include <chrono>
using namespace fm27;
static TeamSetup Team(int id, int ovr, const std::string& f, std::mt19937& r) {
  TeamSetup t; t.id = id; t.formation = f; auto sl = FormationSlots(f);
  for (int i = 0; i < 11; i++) { int o = ovr + (int)(r() % 9) - 4; std::string pos = sl[i].pos; PlayerSetup p; p.id = id * 100 + i; p.name = "P" + std::to_string(i); p.number = i + 1; p.pos = pos; p.ovr = o;
    p.pace = o + (int)(r() % 17) - 8; p.shooting = pos == "ST" ? o + 6 : o - 6; p.passing = o; p.dribbling = o; p.defending = (pos == "IV" || pos == "LV" || pos == "RV") ? o + 6 : o - 8; p.physical = o; p.gk = pos == "TW" ? o + 4 : 25; t.players.push_back(p); }
  return t;
}
int main(int argc, char** argv) {
  int N = argc > 1 ? atoi(argv[1]) : 200; std::mt19937 r(7);
  const char* F[] = {"4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1"};
  double goals = 0, shots = 0, ot = 0, xg = 0, pas = 0, pok = 0, fouls = 0, cor = 0, off = 0; int nil = 0, hw = 0, d = 0, aw = 0, sw = 0, sl = 0, sn = 0, n = 0, stuck = 0;
  auto t0 = std::chrono::steady_clock::now();
  for (int i = 0; i < N; i++) {
    bool mis = i % 2; MatchSetup s; s.seed = 1000 + i; s.home = Team(1, 68, F[i % 6], r); s.away = Team(2, mis ? 58 : 68, F[(i / 2) % 6], r);
    MatchSim m(s); int steps = 0; while (!m.finished && steps < 40000) { m.Step(); steps++; }
    if (!m.finished) { stuck++; continue; }
    auto& S = m.summary; int g = S.homeGoals + S.awayGoals; n++; goals += g; if (!g) nil++;
    if (!mis) { if (S.homeGoals > S.awayGoals) hw++; else if (S.homeGoals == S.awayGoals) d++; else aw++; } else { sn++; if (S.homeGoals > S.awayGoals) sw++; else if (S.homeGoals < S.awayGoals) sl++; }
    for (auto* X : {&S.home, &S.away}) { shots += X->shots; ot += X->onTarget; xg += X->xg; pas += X->passes; pok += X->passesOk; fouls += X->fouls; cor += X->corners; off += X->offsides; }
  }
  double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
  printf("matches %d (stuck %d) in %.0f ms\ngoals/match %.2f  0:0 %.1f%%\nequal: H %d D %d A %d   strong 68v58: W %d L %d of %d\n", n, stuck, ms, goals / n, 100.0 * nil / n, hw, d, aw, sw, sl, sn);
  printf("per team: shots %.1f onT %.1f xG %.2f passes %.0f ok %.0f%% fouls %.1f corners %.1f offside %.2f\n", shots / (2 * n), ot / (2 * n), xg / (2 * n), pas / (2 * n), 100 * pok / pas, fouls / (2 * n), cor / (2 * n), off / (2 * n));
}
