#include "MatchSim.h"
#include <cstdio>
using namespace fm27;
int main() {
  int byDir[2] = {0, 0}, bySide[2] = {0, 0}, byHalfSide[2][2] = {{0, 0}, {0, 0}}; int n = 400;
  for (int i = 0; i < n; i++) {
    MatchSetup s; s.seed = 50 + i; s.neutral = true;
    for (auto* t : {&s.home, &s.away}) { t->formation = "4-4-2"; auto sl = FormationSlots("4-4-2"); for (int k = 0; k < 11; k++) { PlayerSetup p; p.id = (t == &s.home ? 0 : 100) + k; p.pos = sl[k].pos; p.ovr = 68; p.pace = 68; p.shooting = 66; p.passing = 68; p.dribbling = 66; p.defending = 64; p.physical = 66; p.gk = k == 0 ? 70 : 20; t->players.push_back(p); } }
    MatchSim m(s);
    m.onEvent = [&](const MatchEvent& e) { if (e.type == "shot") { byDir[m.Dir(e.side) > 0 ? 0 : 1]++; bySide[e.side]++; byHalfSide[m.half - 1][e.side]++; } };
    m.RunToEnd();
  }
  printf("shots attacking +x: %d  attacking -x: %d | home %d away %d | H1 home %d away %d  H2 home %d away %d\n", byDir[0], byDir[1], bySide[0], bySide[1], byHalfSide[0][0], byHalfSide[0][1], byHalfSide[1][0], byHalfSide[1][1]);
}
