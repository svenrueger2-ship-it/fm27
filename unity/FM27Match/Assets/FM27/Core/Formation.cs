// Formation slots and position-aware assignment of the starting eleven.
using System;
using System.Collections.Generic;

namespace FM27.Sim
{
    public static class Formation
    {
        public struct Slot
        {
            public float depth, lat; public string role, pos;
            public Slot(float d, float l, string r, string p = "") { depth = d; lat = l; role = r; pos = p; }
        }

        static string[] LineLabels(int count, int lineIdx, int lines)
        {
            bool def = lineIdx == 0, fwd = lineIdx == lines - 1 && lines > 1;
            if (def)
            {
                if (count == 5) return new[] { "LV", "IV", "IV", "IV", "RV" };
                if (count == 4) return new[] { "LV", "IV", "IV", "RV" };
                if (count == 3) return new[] { "IV", "IV", "IV" };
                return Repeat("IV", count);
            }
            if (fwd)
            {
                if (count == 3) return new[] { "LA", "ST", "RA" };
                return Repeat("ST", count);
            }
            // midfield lines
            bool deepest = lineIdx == 1 && lines >= 4;
            if (deepest) return Repeat("DM", count);
            bool attacking = lineIdx == lines - 2 && lines >= 4;
            if (attacking && count == 3) return new[] { "LM", "OM", "RM" };
            if (attacking && count == 1) return new[] { "OM" };
            if (count == 5) return new[] { "LM", "ZM", "DM", "ZM", "RM" };
            if (count == 4) return new[] { "LM", "ZM", "ZM", "RM" };
            if (count == 3) return new[] { "ZM", "DM", "ZM" };
            if (count == 2) return new[] { "ZM", "ZM" };
            return new[] { "DM" };
        }
        static string[] Repeat(string s, int n) { var a = new string[n]; for (int i = 0; i < n; i++) a[i] = s; return a; }

        /// <summary>Slot 0 is the keeper, then lines from defence to attack.</summary>
        public static List<Slot> Slots(string formation)
        {
            var parts = new List<int>();
            foreach (var t in (formation ?? "4-4-2").Split('-')) { if (int.TryParse(t.Trim(), out int n) && n > 0) parts.Add(n); }
            int sum = 0; foreach (var n in parts) sum += n;
            if (sum != 10 || parts.Count < 2) parts = new List<int> { 4, 4, 2 };
            var res = new List<Slot> { new Slot(0f, 0.5f, "GK", "TW") };
            int L = parts.Count;
            for (int i = 0; i < L; i++)
            {
                int k = parts[i];
                float depth = 0.08f + i * (0.84f / (L - 1));
                var labels = LineLabels(k, i, L);
                string role = i == 0 ? "DEF" : i == L - 1 ? "FWD" : "MID";
                float spread = i == 0 ? 0.84f : role == "FWD" ? (k == 1 ? 0f : k == 2 ? 0.34f : 0.72f) : 0.8f;
                for (int j = 0; j < k; j++)
                {
                    float lat = k == 1 ? 0.5f : 0.5f - spread / 2 + spread * j / (k - 1);
                    string pos = labels[j];
                    float d = depth;
                    if (pos == "DM") d -= 0.05f; else if (pos == "OM") d += 0.04f; else if ((pos == "LM" || pos == "RM") && L == 3) d += 0.02f;
                    if ((pos == "LV" || pos == "RV")) d += 0.02f;
                    res.Add(new Slot(d, lat, role, pos));
                }
            }
            return res;
        }

        static int Cost(string playerPos, string slotPos)
        {
            if (playerPos == slotPos) return 0;
            string[][] groups = {
                new[] { "IV", "LV", "RV" }, new[] { "DM", "ZM" }, new[] { "ZM", "OM" }, new[] { "LM", "LA", "LV" },
                new[] { "RM", "RA", "RV" }, new[] { "ST", "LA", "RA", "OM" }, new[] { "LM", "RM", "ZM" } };
            foreach (var g in groups) if (Array.IndexOf(g, playerPos) >= 0 && Array.IndexOf(g, slotPos) >= 0) return 2;
            if (playerPos == "TW" || slotPos == "TW") return 50;
            return 6;
        }

        /// <summary>Returns, for every player index (0..10), the slot index.</summary>
        public static int[] Assign(List<PlayerSetup> players, List<Slot> slots)
        {
            int n = Math.Min(11, players.Count);
            var res = new int[n]; for (int i = 0; i < n; i++) res[i] = -1;
            var used = new bool[slots.Count];
            // keeper first
            int gk = players.FindIndex(p => p.pos == "TW"); if (gk < 0 || gk >= n) gk = 0;
            res[gk] = 0; used[0] = true;
            // greedy by cost tier
            for (int tier = 0; tier <= 50; tier++)
                for (int i = 0; i < n; i++)
                {
                    if (res[i] >= 0) continue;
                    for (int s = 1; s < slots.Count; s++)
                        if (!used[s] && Cost(players[i].pos, slots[s].pos) == tier) { res[i] = s; used[s] = true; break; }
                }
            for (int i = 0; i < n; i++) if (res[i] < 0) for (int s = 1; s < slots.Count; s++) if (!used[s]) { res[i] = s; used[s] = true; break; }
            return res;
        }
    }
}
