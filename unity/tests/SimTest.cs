using System; using System.Collections.Generic; using System.Linq; using FM27.Sim;
static class SimTest {
  static string[] POS = { "TW", "LV", "IV", "IV", "RV", "LM", "ZM", "ZM", "RM", "ST", "ST" };
  static TeamSetup Team(int id, int ovr, string f, Random r) {
    var t = new TeamSetup { id = id, name = "T" + id, shortName = "T" + id, formation = f };
    var slots = Formation.Slots(f); 
    for (int i = 0; i < 11; i++) { int o = ovr + r.Next(-4, 5); string pos = slots[i].pos;
      t.players.Add(new PlayerSetup { id = id * 100 + i, name = "P" + i, number = i + 1, pos = pos, ovr = o,
        pace = o + r.Next(-8, 9), shooting = pos == "ST" ? o + 6 : o - 6, passing = o, dribbling = o, defending = pos == "IV" || pos=="LV"||pos=="RV" ? o + 6 : o - 8, physical = o, gk = pos == "TW" ? o + 4 : 25 }); }
    return t;
  }
  static void Main(string[] a) {
    int N = a.Length > 0 ? int.Parse(a[0]) : 200; var r = new Random(7);
    string[] F = { "4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1" };
    var goals = new List<int>(); int hw = 0, d = 0, aw = 0, nil = 0; double shots = 0, ot = 0, xg = 0, pas = 0, pok = 0, fouls = 0, cor = 0, yel = 0, red = 0, off = 0, poss = 0, saves = 0;
    var sw = System.Diagnostics.Stopwatch.StartNew(); int strongWin = 0, strongN = 0, strongLoss = 0;
    for (int i = 0; i < N; i++) {
      bool mismatch = i % 2 == 1;
      int oh = 68, oa = mismatch ? 58 : 68;
      var s = new MatchSetup { seed = 1000 + i, home = Team(1, oh, F[i % F.Length], r), away = Team(2, oa, F[(i / 2) % F.Length], r) };
      var e = new MatchEngine(s); int steps = 0;
      while (!e.finished && steps < 40000) { e.Step(); steps++; }
      if (!e.finished) { Console.WriteLine("STUCK match " + i + " phase " + e.phase + " t=" + e.time); continue; }
      var m = e.summary; int g = m.homeGoals + m.awayGoals; goals.Add(g);
      if (!mismatch) { if (m.homeGoals > m.awayGoals) hw++; else if (m.homeGoals == m.awayGoals) d++; else aw++; }
      else { strongN++; if (m.homeGoals > m.awayGoals) strongWin++; else if (m.homeGoals < m.awayGoals) strongLoss++; }
      if (g == 0) nil++;
      foreach (var S in new[] { m.home, m.away }) { shots += S.shots; ot += S.onTarget; xg += S.xg; pas += S.passes; pok += S.passesOk; fouls += S.fouls; cor += S.corners; yel += S.yellow; red += S.red; off += S.offsides; saves += S.saves; }
      poss += m.home.possession;
    }
    int n = goals.Count; double per = 2.0 * n;
    Console.WriteLine($"matches {n} in {sw.ElapsedMilliseconds} ms");
    Console.WriteLine($"goals/match {goals.Average():F2}  0:0 {100.0*nil/n:F1}%  dist " + string.Join(" ", Enumerable.Range(0, 8).Select(k => $"{k}:{goals.Count(x => x == k)}")));
    Console.WriteLine($"equal teams: H {hw} D {d} A {aw}   strong(68 vs 58): W {strongWin} L {strongLoss} of {strongN}");
    foreach (var kv in MatchEngine.Dbg.OrderBy(k=>k.Key)) Console.Write($"{kv.Key}={kv.Value/n:F1} "); Console.WriteLine();
    Console.WriteLine($"per team: shots {shots/per:F1} onT {ot/per:F1} xG {xg/per:F2} saves {saves/per:F1} passes {pas/per:F0} ok {100*pok/Math.Max(1,pas):F0}% fouls {fouls/per:F1} corners {cor/per:F1} yellow {yel/per:F2} red {red/per:F3} offside {off/per:F1} homePoss {poss/n:F0}%");
  }
}
