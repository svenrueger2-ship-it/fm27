#include "MatchSim.h"
#include <cstdio>
using namespace fm27;
int main() {
  MatchSetup s; s.seed = 77;
  for (auto* t : {&s.home, &s.away}) { auto sl = FormationSlots("4-4-2"); for (int i = 0; i < 11; i++) { PlayerSetup p; p.id = i + (t == &s.home ? 0 : 100); p.name = "P"; p.pos = sl[i].pos; p.ovr = 70; p.pace = 70; p.shooting = 70; p.passing = 70; p.dribbling = 70; p.defending = 66; p.physical = 68; p.gk = i == 0 ? 70 : 20; t->players.push_back(p); } }
  MatchSim m(s); int clipEv = 0; m.onEvent = [&](const MatchEvent& e) { if (e.type == "clip") clipEv++; };
  while (m.time < 200) m.Step();
  m.SetFormation(0, "4-3-3"); PlayerSetup j; j.id = 50; j.name = "Joker"; j.pos = "ST"; j.ovr = 75; j.pace = 80; j.shooting = 78; m.Substitute(0, 9, j);
  m.RunToEnd();
  float jm = 0, om = 0; for (auto& r : m.summary.ratings) { if (r.id == 50) jm = r.minutes; if (r.id == 9) om = r.minutes; }
  printf("score %d:%d clips %zu events %d first frames %zu dur %.1f | ratings %zu joker %.0f out %.0f\n", m.score[0], m.score[1], m.clips.size(), clipEv, m.clips.empty() ? 0 : m.clips[0].frames.size(), m.clips.empty() ? 0.f : m.clips[0].Duration(), m.summary.ratings.size(), jm, om);
}
