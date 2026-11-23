#include "MatchSim.h"
#include <cstdio>
using namespace fm27;
int main() {
  double hg = 0, ag = 0, hp = 0, hs = 0, as = 0; int n = 1200;
  for (int i = 0; i < n; i++) {
    MatchSetup s; s.seed = 50 + i; s.neutral = true;
    for (auto* t : {&s.home, &s.away}) { t->formation = "4-4-2"; auto sl = FormationSlots("4-4-2"); for (int k = 0; k < 11; k++) { PlayerSetup p; p.id = (t == &s.home ? 0 : 100) + k; p.pos = sl[k].pos; p.ovr = 68; p.pace = 68; p.shooting = 66; p.passing = 68; p.dribbling = 66; p.defending = 64; p.physical = 66; p.gk = k == 0 ? 70 : 20; t->players.push_back(p); } }
    MatchSim m(s); m.RunToEnd(); hg += m.summary.homeGoals; ag += m.summary.awayGoals; hp += m.summary.home.possession; hs += m.summary.home.shots; as += m.summary.away.shots;
  }
  printf("identical teams, neutral: home goals %.2f away %.2f, home poss %.1f, shots %.1f vs %.1f\n", hg / n, ag / n, hp / n, hs / n, as / n);
}
