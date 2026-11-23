// FM27 match engine 2 – positional football AI. Pure C# (no UnityEngine) so it runs in Unity and in tests.
// Pitch: x 0..105 (length), y 0..68. Home attacks +x in the first half. 10 minutes of real movement = 90 match minutes.
using System;
using System.Collections.Generic;

namespace FM27.Sim
{
    public struct V2
    {
        public float x, y;
        public V2(float x, float y) { this.x = x; this.y = y; }
        public static V2 operator +(V2 a, V2 b) => new V2(a.x + b.x, a.y + b.y);
        public static V2 operator -(V2 a, V2 b) => new V2(a.x - b.x, a.y - b.y);
        public static V2 operator *(V2 a, float s) => new V2(a.x * s, a.y * s);
        public float Len => (float)Math.Sqrt(x * x + y * y);
        public V2 Norm { get { float l = Len; return l > 1e-5f ? new V2(x / l, y / l) : new V2(0, 0); } }
        public static float Dist(V2 a, V2 b) => (a - b).Len;
        public static V2 Lerp(V2 a, V2 b, float t) => new V2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        public static float Dot(V2 a, V2 b) => a.x * b.x + a.y * b.y;
    }

    public enum Phase { Kickoff, Play, ThrowIn, GoalKick, Corner, FreeKick, Penalty, Celebration, HalfTime, FullTime }

    public class Agent
    {
        public int side, slot;
        public PlayerSetup p;
        public V2 pos, vel, target, prev;
        public float prevFacing;
        public float stamina = 1f, facing, decide, cooldown, runTimer, animT, minutes;
        public bool gk, sentOff, running;
        public string anim = "idle";       // idle, run, kick, tackle, dive, celebrate, header
        public float depth, lat;           // formation slot: depth 0 (own goal) .. 1, lateral 0..1
        public string role;                // GK, DEF, MID, FWD
        public float rating = 6.2f;
        public int goals, assists, yellow;
        public float MaxSpeed => (5.7f + p.pace / 100f * 3.3f) * (0.8f + 0.2f * stamina) * (0.94f + 0.06f * (p.fitness / 100f));
    }

    public class Ball
    {
        public V2 pos, vel, prev;
        public float z, vz, prevZ;
        public Agent owner, lastTouch, intended, passer;
        public bool shot;
        public Agent offsideAt; // receiver who was offside when the pass was played
    }

    public class MatchEngine
    {
        public const float FieldX = 105f, FieldY = 68f, GoalHalf = 3.66f, HalfSeconds = 300f, Dt = 0.05f;
        public readonly MatchSetup setup;
        public readonly List<Agent>[] teams = { new List<Agent>(), new List<Agent>() };
        public readonly Ball ball = new Ball();
        public readonly MatchSummary summary = new MatchSummary();
        public Phase phase = Phase.Kickoff;
        public float time;           // physical seconds played (0..600)
        public int half = 1;
        public int[] score = { 0, 0 };
        public int[] mentality = { 0, 0 };
        public float[] pressing = { 0.5f, 0.5f };
        public int restartSide = 0;
        public float phaseTimer;
        public V2 restartPos;
        public Agent taker, lastScorer;
        public bool finished;
        public event Action<MatchEvent> OnEvent;
        // replays (v3.3): last ~14 s of play, clips for goals and big chances
        public readonly Recorder rec = new Recorder(280);
        public readonly List<Clip> clips = new List<Clip>();
        Clip pendingClip; int pendingSteps; float simClock;
        public static readonly Dictionary<string, double> Dbg = new Dictionary<string, double>();
        static void D(string k, double v = 1) { double o; Dbg.TryGetValue(k, out o); Dbg[k] = o + v; }
        readonly Random rng;
        readonly float[] possTime = { 0, 0 };
        float[] str = { 60, 60 };
        int kickoffSide;
        Agent shotKeeper; string shotOutcome; Agent shooter; float shotXg;

        public int Minute => Math.Min(half == 1 ? 45 : 90, (int)(time / HalfSeconds * 45f) + (half == 2 ? 0 : 0));
        public string Clock { get { float m = time / HalfSeconds * 45f; int mi = (int)m, s = (int)((m - mi) * 60); return $"{mi:00}:{s:00}"; } }

        public MatchEngine(MatchSetup s)
        {
            setup = s; rng = new Random(s.seed);
            Build(0, s.home); Build(1, s.away);
            mentality[0] = s.home.mentality; mentality[1] = s.away.mentality;
            pressing[0] = s.home.pressing; pressing[1] = s.away.pressing;
            for (int i = 0; i < 2; i++) { float sum = 0; foreach (var a in teams[i]) sum += a.p.ovr; str[i] = teams[i].Count > 0 ? sum / teams[i].Count : 60; }
            if (!s.neutral) str[0] += s.homeAdvantage * 100f * 0.5f;
            kickoffSide = rng.Next(2);
            SetupKickoff(kickoffSide);
            Emit("kickoff", -1, 0, 0, 0, "Anpfiff");
        }

        // ------------------------------------------------------------------ setup
        TeamSetup T(int side) => side == 0 ? setup.home : setup.away;
        public int Dir(int side) => (side == 0) == (half == 1) ? 1 : -1;      // +1: attacks towards x = 105
        float U(int side, V2 p) => Dir(side) > 0 ? p.x : FieldX - p.x;       // distance from own goal line
        V2 FromTeam(int side, float u, float v) => Dir(side) > 0 ? new V2(u, v) : new V2(FieldX - u, FieldY - v);
        V2 OppGoal(int side) => new V2(Dir(side) > 0 ? FieldX : 0, FieldY / 2);
        V2 OwnGoal(int side) => new V2(Dir(side) > 0 ? 0 : FieldX, FieldY / 2);

        void Build(int side, TeamSetup t)
        {
            var slots = Formation.Slots(t.formation);
            var map = Formation.Assign(t.players, slots);
            for (int i = 0; i < Math.Min(11, t.players.Count); i++)
            {
                var p = t.players[i];
                var s = map[i] >= 0 && map[i] < slots.Count ? slots[map[i]] : new Formation.Slot(0.5f, 0.5f, "MID");
                var a = new Agent { side = side, slot = i, p = p, gk = s.role == "GK" };
                a.depth = s.depth; a.lat = s.lat; a.role = s.role;
                a.stamina = 0.75f + 0.25f * (p.fitness / 100f);
                a.runTimer = (float)rng.NextDouble() * 4f;
                teams[side].Add(a);
            }
        }

        void SetupKickoff(int side)
        {
            phase = Phase.Kickoff; phaseTimer = 2.2f; restartSide = side;
            ball.pos = new V2(FieldX / 2, FieldY / 2); ball.vel = new V2(0, 0); ball.z = 0; ball.vz = 0; ball.owner = null; ball.shot = false;
            for (int s = 0; s < 2; s++) foreach (var a in teams[s])
                {
                    if (a.sentOff) continue;
                    float u = a.gk ? 3f : Math.Min(50f, 8f + a.depth * 44f), v = a.lat * FieldY;
                    a.pos = FromTeam(s, u, v); a.vel = new V2(0, 0); a.anim = "idle"; a.cooldown = 0;
                }
            var att = teams[side];
            taker = Nearest(att, ball.pos, x => !x.gk && x.role == "FWD") ?? Nearest(att, ball.pos, x => !x.gk);
            if (taker != null) taker.pos = ball.pos - new V2(Dir(side) * 0.6f, 0);
        }

        // ------------------------------------------------------------------ public API
        public void Command(MatchCommand c)
        {
            if (c == null) return;
            int s = c.side == 1 ? 1 : 0;
            if (c.type == "mentality") mentality[s] = Math.Max(-2, Math.Min(2, c.value));
            else if (c.type == "pressing") pressing[s] = Math.Max(0f, Math.Min(1f, c.fvalue));
            else if (c.type == "formation" && !string.IsNullOrEmpty(c.text))
            {
                var slots = Formation.Slots(c.text);
                var list = new List<PlayerSetup>(); foreach (var a in teams[s]) list.Add(a.p);
                var map = Formation.Assign(list, slots);
                for (int i = 0; i < teams[s].Count; i++)
                {
                    var a = teams[s][i]; if (a.gk) continue;
                    var sl = map[i] >= 0 && map[i] < slots.Count ? slots[map[i]] : slots[Math.Min(i, slots.Count - 1)];
                    if (sl.role == "GK") continue;
                    a.depth = sl.depth; a.lat = sl.lat; a.role = sl.role;
                }
                T(s).formation = c.text;
                Emit("formation", s, 0, 0, 0, "Neue Formation: " + c.text);
            }
            else if (c.type == "sub" && c.player != null)
            {
                var a = teams[s].Find(x => x.p.id == c.outId && !x.sentOff);
                if (a == null) return;
                Emit("sub", s, c.player.id, a.p.id, 0, $"{c.player.name} für {a.p.name}");
                summary.ratings.Add(new PlayerRating { id = a.p.id, side = s, rating = (float)Math.Round(Clamp(a.rating, 3f, 10f) * 10) / 10f, goals = a.goals, assists = a.assists, minutes = (float)Math.Round(a.minutes) });
                a.p = c.player; a.stamina = 1f; a.rating = 6.2f; a.goals = 0; a.assists = 0; a.yellow = 0; a.minutes = 0;
            }
        }

        /// <summary>Advance by real seconds (Unity: Time.deltaTime * speed). Fixed internal step.</summary>
        float acc;
        public void Advance(float seconds)
        {
            acc += seconds;
            int guard = 0;
            while (acc >= Dt && !finished && guard++ < 4000) { acc -= Dt; Step(); }
        }

        public MatchSummary RunToEnd() { while (!finished) Step(); return summary; }

        // ------------------------------------------------------------------ main step
        /// <summary>0..1 between the last two fixed steps – for smooth rendering.</summary>
        public float Alpha => acc / Dt;
        public void Step()
        {
            if (finished) return;
            foreach (var t in teams) foreach (var a in t) { a.prev = a.pos; a.prevFacing = a.facing; }
            ball.prev = ball.pos; ball.prevZ = ball.z;
            float dt = Dt;
            if (phase == Phase.HalfTime)
            {
                phaseTimer -= dt; MovePlayers(dt); Record();
                if (phaseTimer <= 0) { half = 2; time = HalfSeconds; foreach (var t in teams) foreach (var a in t) a.stamina = Math.Min(1f, a.stamina + 0.12f); SetupKickoff(1 - kickoffSide); Emit("kickoff", -1, 0, 0, 0, "Anpfiff 2. Halbzeit"); }
                return;
            }
            if (phase != Phase.Celebration) time += dt;
            if (ball.owner != null) possTime[ball.owner.side] += dt;
            if (phase != Phase.Celebration) for (int s = 0; s < 2; s++) foreach (var a in teams[s]) if (!a.sentOff) a.minutes += dt / HalfSeconds * 45f;

            if (half == 1 && time >= HalfSeconds && IsDeadOrSafe()) { phase = Phase.HalfTime; phaseTimer = 3f; Emit("halftime", -1, 0, 0, 0, $"Halbzeit {score[0]}:{score[1]}"); return; }
            if (half == 2 && time >= 2 * HalfSeconds && IsDeadOrSafe()) { Finish(); return; }

            switch (phase)
            {
                case Phase.Kickoff: case Phase.ThrowIn: case Phase.GoalKick: case Phase.Corner: case Phase.FreeKick: case Phase.Penalty:
                    RestartTick(dt); break;
                case Phase.Celebration:
                    phaseTimer -= dt;
                    if (phaseTimer <= 0) SetupKickoff(restartSide);
                    break;
                default:
                    PlayTick(dt); break;
            }
            MovePlayers(dt);
            BallTick(dt);
            Record();
        }

        void Record()
        {
            simClock += Dt;
            rec.Push(this, simClock);
            if (pendingClip != null && ++pendingSteps >= 44)
            {
                // the clip ends ~2 s after the moment: ball in the net, first steps of the celebration
                pendingClip.frames = rec.Last(pendingClip.type == "goal" ? 10f : 7f, Dt);
                clips.Add(pendingClip);
                var c = pendingClip; pendingClip = null;
                Emit("clip", c.side, c.player, clips.Count - 1, 0, c.type);
            }
        }

        void MarkClip(string type, int side, int player, string text)
        {
            if (pendingClip != null) return;
            pendingClip = new Clip { type = type, side = side, player = player, text = text, minute = Math.Max(1, (int)Math.Ceiling(time / HalfSeconds * 45f)), goalX = Dir(side) > 0 ? FieldX : 0f };
            pendingSteps = 0;
        }

        bool IsDeadOrSafe() => phase != Phase.Play || ball.owner == null || Math.Abs(ball.pos.x - FieldX / 2) < 30;

        // ------------------------------------------------------------------ decisions
        void PlayTick(float dt)
        {
            var owner = ball.owner;
            tickParity ^= 1; // alternate which team decides first (fairness)
            for (int s2 = 0; s2 < 2; s2++)
            {
                int s = tickParity == 1 ? 1 - s2 : s2;
                bool attacking = owner != null && owner.side == s;
                Agent chaser = owner == null ? BestChaser(s) : null;
                var presser = owner != null && !attacking ? Presser(s, owner) : null;
                var cover = owner != null && !attacking && pressing[s] > 0.45f ? SecondPresser(s, owner, presser) : null;
                foreach (var a in teams[s])
                {
                    if (a.sentOff) continue;
                    a.cooldown -= dt; a.runTimer -= dt;
                    if (a == owner) { CarrierTick(a, dt); continue; }
                    if (a.gk) { KeeperTick(a); continue; }
                    if (a == chaser || ball.intended == a) { a.target = Intercept(a); a.running = true; continue; }
                    if (attacking) a.target = SupportPos(a, owner);
                    else if (a == presser) { a.target = owner.pos + (OwnGoal(s) - owner.pos).Norm * 0.7f; a.running = true; TryTackle(a, owner); }
                    else if (a == cover) a.target = V2.Lerp(owner.pos, NearestOpp(a, owner)?.pos ?? owner.pos, 0.55f);
                    else a.target = DefendPos(a, owner);
                }
            }
        }

        Agent BestChaser(int s)
        {
            Agent best = null; float bt = 1e9f;
            foreach (var a in teams[s])
            {
                if (a.sentOff || a.cooldown > 0) continue;
                if (a.gk && !InOwnBox(a.side, ball.pos)) continue;
                float t = V2.Dist(a.pos, BallLanding()) / a.MaxSpeed;
                if (t < bt) { bt = t; best = a; }
            }
            return best;
        }

        V2 BallLanding()
        {
            // where the ball is roughly catchable (ground) within 0.8 s
            var p = ball.pos; var v = ball.vel; float z = ball.z, vz = ball.vz;
            for (int i = 0; i < 16; i++) { p = p + v * 0.05f; vz -= 9.81f * 0.05f; z += vz * 0.05f; if (z < 0) z = 0; v = v * (z > 0 ? 0.995f : 0.975f); if (z < 1.2f && i > 4) break; }
            return p;
        }

        V2 Intercept(Agent a)
        {
            // run to where the ball will be when we can reach it
            var p = ball.pos; var v = ball.vel;
            for (int i = 1; i <= 40; i++)
            {
                p = p + v * 0.05f; v = v * 0.975f;
                if (V2.Dist(a.pos, p) / a.MaxSpeed <= i * 0.05f) return p;
            }
            return p;
        }

        Agent Presser(int s, Agent carrier)
        {
            float range = 7f + pressing[s] * 16f + (U(s, carrier.pos) < 35 ? 8f : 0f);
            var n = Nearest(teams[s], carrier.pos, x => !x.gk && x.cooldown <= 0);
            return n != null && V2.Dist(n.pos, carrier.pos) < range ? n : null;
        }

        Agent SecondPresser(int s, Agent carrier, Agent first)
        {
            Agent best = null; float bd = 14f;
            foreach (var a in teams[s]) { if (a.sentOff || a.gk || a == first) continue; float d = V2.Dist(a.pos, carrier.pos); if (d < bd) { bd = d; best = a; } }
            return best;
        }

        Agent NearestOpp(Agent a, Agent carrier)
        {
            // the carrier's most dangerous short option, to block the lane
            Agent best = null; float bd = 20f;
            foreach (var o in teams[carrier.side]) { if (o == carrier || o.sentOff || o.gk) continue; float d = V2.Dist(o.pos, carrier.pos); if (d < bd && U(carrier.side, o.pos) > U(carrier.side, carrier.pos) - 4) { bd = d; best = o; } }
            return best;
        }

        // team shape --------------------------------------------------------------
        float OffsideLine(int attSide)
        {
            // second-last defender of the other team, in attacker coordinates
            int d = 1 - attSide; var us = new List<float>();
            foreach (var a in teams[d]) if (!a.sentOff) us.Add(FieldX - U(d, a.pos));
            us.Sort(); us.Reverse();
            float line = us.Count > 1 ? us[1] : FieldX / 2;
            return Math.Max(FieldX / 2, Math.Max(line, U(attSide, ball.pos)));
        }

        V2 SupportPos(Agent a, Agent carrier)
        {
            int s = a.side; var T0 = T(s);
            float bu = U(s, ball.pos), bv = Dir(s) > 0 ? ball.pos.y : FieldY - ball.pos.y;
            float m = mentality[s];
            float center = Clamp(bu + 4f + m * 3f, 30f, 80f);
            float span = 42f + m * 3f;
            float u = center + (a.depth - 0.5f) * span;
            float widthF = 0.82f + T0.width * 0.22f;
            float v = FieldY / 2 + (a.lat - 0.5f) * FieldY * widthF + (bv - FieldY / 2) * 0.18f;
            // full-backs overlap when the ball is on their wing
            if (a.role == "DEF" && (a.lat < 0.2f || a.lat > 0.8f) && Math.Abs(bv - a.lat * FieldY) < 22) u += 10f + m * 3f;
            if (a.role == "DEF" && a.lat >= 0.2f && a.lat <= 0.8f) u = Math.Min(u, bu - 6f);
            float off = OffsideLine(s);
            // forwards time runs in behind the line
            if ((a.role == "FWD" || (a.role == "MID" && a.depth > 0.75f)) && carrier != null && carrier.p.passing > 50)
            {
                if (a.runTimer <= 0 && !a.running && bu > 35) { a.running = true; a.runTimer = 3.2f; }
                else if (a.running && a.runTimer <= 0) { a.running = false; a.runTimer = 3f + (float)rng.NextDouble() * 4f; }
                if (a.running) { u = Math.Min(FieldX - 6f, off + 9f); D("runtick", 0.05); }
                else u = a.role == "FWD" ? off - 0.8f - (float)(a.slot % 2) * 2f : Math.Min(u, off - 0.8f);
            }
            else u = Math.Min(u, off - 0.8f);
            // attack the box when the ball is in the final third
            if (bu > 66 && carrier != null && a != carrier)
            {
                if (a.role == "FWD") { u = Math.Max(u, Math.Min(off - 0.6f, 95f - (a.slot % 3) * 2.5f)); v = v + (FieldY / 2 - v) * 0.65f; }
                else if (a.role == "MID" && (a.lat < 0.25f || a.lat > 0.75f) && Math.Abs(bv - a.lat * FieldY) > 30) { u = Math.Max(u, Math.Min(off - 0.6f, 93f)); v = FieldY / 2 + (a.lat < 0.5f ? -7f : 7f); } // far post
                else if (a.role == "MID" && a.depth > 0.55f) { u = Math.Max(u, Math.Min(off - 0.6f, 87f)); v = v + (FieldY / 2 - v) * 0.35f; }
            }
            // find a pocket: step away from the nearest opponent
            var pos = FromTeam(s, Clamp(u, 6, FieldX - 3), Clamp(v, 2, FieldY - 2));
            var near = Nearest(teams[1 - s], pos, x => !x.sentOff);
            if (near != null && !a.running) { float d = V2.Dist(near.pos, pos); if (d < 5f) { var away = (pos - near.pos).Norm; away = new V2(Dir(s) > 0 ? Math.Min(away.x, 0.2f) : Math.Max(away.x, -0.2f), away.y); pos = pos + away.Norm * (5f - d); } }
            return Clamp(pos);
        }

        V2 DefendPos(Agent a, Agent carrier)
        {
            int s = a.side; var T0 = T(s);
            float bu = U(s, ball.pos), bv = Dir(s) > 0 ? ball.pos.y : FieldY - ball.pos.y;
            float m = mentality[s];
            float lineU = Clamp(bu - 14f + (T0.lineHeight - 0.5f) * 12f + m * 2.5f, 8f, 50f);
            float u;
            if (a.role == "DEF") u = lineU;
            else u = Clamp(lineU + 6f + a.depth * 30f + m * 2f, 12f, bu + 6f);
            float v = FieldY / 2 + (a.lat - 0.5f) * FieldY * 0.72f + (bv - FieldY / 2) * 0.38f;
            var zone = FromTeam(s, u, Clamp(v, 3, FieldY - 3));
            // mark the most dangerous attacker in my zone
            Agent mark = null; float md = 9f;
            foreach (var o in teams[1 - s]) { if (o.sentOff || o.gk || o == carrier) continue; float d = V2.Dist(o.pos, zone); if (d < md) { md = d; mark = o; } }
            if (mark != null)
            {
                var goal = OwnGoal(s);
                var goalSide = mark.pos + (goal - mark.pos).Norm * 1.8f;
                zone = V2.Lerp(zone, goalSide, a.role == "DEF" ? 0.55f : 0.45f);
                if (a.role == "DEF")
                {
                    // hold the line: only follow a runner once he is clearly in behind
                    float mu = U(s, mark.pos);
                    bool inBehind = mu < lineU - 1.5f && mark.running;
                    float zu = inBehind ? Math.Max(mu - 1f, 4f) : lineU;
                    zone = FromTeam(s, zu, Dir(s) > 0 ? zone.y : FieldY - zone.y);
                    if (inBehind) a.running = true;
                }
            }
            return Clamp(zone);
        }

        void KeeperTick(Agent k)
        {
            int s = k.side; var goal = OwnGoal(s);
            float bu = U(s, ball.pos);
            float adv = bu < 25 ? 2.5f : bu < 50 ? 6f : 13f;
            var dirToBall = (ball.pos - goal).Norm;
            k.target = goal + dirToBall * Math.Min(adv, V2.Dist(goal, ball.pos) * 0.4f);
            k.target = new V2(k.target.x, Clamp(k.target.y, FieldY / 2 - GoalHalf - 1.5f, FieldY / 2 + GoalHalf + 1.5f));
            // rush a loose ball in the box
            if (ball.owner == null && !ball.shot && InOwnBox(s, ball.pos) && ball.z < 2.2f) { k.target = ball.pos; k.running = true; }
        }

        // ------------------------------------------------------------------ carrier
        void CarrierTick(Agent a, float dt)
        {
            int s = a.side; a.running = true;
            a.decide -= dt;
            var goal = OppGoal(s);
            float d = V2.Dist(a.pos, goal);
            float pressure = Pressure(a);
            if (a.decide > 0)
            {
                a.target = DribbleTarget(a, pressure);
                return;
            }
            a.decide = 0.22f + (float)rng.NextDouble() * 0.18f;

            if (a.gk) { KeeperDistribute(a); return; }

            float xg = Xg(a.pos, goal, s) * (1f - 0.45f * pressure);
            float m = mentality[s];
            float shootBar = 0.034f - m * 0.007f + (float)rng.NextDouble() * 0.032f - (a.role == "FWD" ? 0.008f : 0f);
            if (d < 31 && (xg > shootBar || (d < 12 && xg > 0.03f)) && !(pressure > 0.9f && d > 20))
            { D("dec.shoot"); Shoot(a, xg, pressure); return; }

            // evaluate passes
            Agent bestR = null; V2 bestPt = new V2(0, 0); float bestV = -1e9f; bool bestLob = false;
            float tempo = T(s).tempo;
            foreach (var r in teams[s])
            {
                if (r == a || r.sentOff) continue;
                if (r.gk && U(s, a.pos) > 30) continue;
                var pt = r.pos + r.vel * (r.running ? 0.85f : 0.3f);
                if (r.running && r.role != "DEF") pt = pt + (goal - pt).Norm * 2.5f;
                pt = Clamp(pt);
                float dist = V2.Dist(a.pos, pt);
                if (dist < 5f || dist > 55f) continue;
                bool offside = U(s, r.pos) > OffsideLine(s) + 0.3f && U(s, r.pos) > FieldX / 2; // judged on the receiver, not on the through-ball spot
                if (offside && rng.NextDouble() < 0.5) continue;
                float lane = LaneSafety(a.pos, pt, s);
                bool lob = lane < 1.6f && dist > 18f && a.p.passing > 55;
                float p = Sigmoid((lob ? 1.6f : lane) * 1.7f - 1.8f + a.p.passing / 40f - dist / 32f - pressure * 0.7f);
                float progress = U(s, pt) - U(s, a.pos);
                float threat = Threat(s, pt);
                float open = OpenSpace(pt, s);
                float v = p * (1.0f + threat * 3.4f + progress / 30f * (0.7f + tempo * 0.8f + m * 0.15f) + Math.Min(open, 8f) / 16f) - (1 - p) * (1.0f + (U(s, a.pos) < 35 ? 1.4f : 0f));
                if (U(s, a.pos) > 68 && progress < -4) v -= 0.5f;   // don't recycle endlessly in the final third
                if (InOppBox(s, pt) && open > 2.5f) v += 0.6f;
                if (r.gk) v -= 0.8f;
                if (v > bestV) { bestV = v; bestR = r; bestPt = pt; bestLob = lob; }
            }
            // cross from a wide position in the final third
            if (U(s, a.pos) > 76 && Math.Abs(a.pos.y - FieldY / 2) > 13 && a.p.passing > 45)
            {
                var inBox = teams[s].FindAll(x => x != a && !x.sentOff && !x.gk && InOppBox(s, x.pos));
                float crossV = 0.8f + inBox.Count * 0.45f + (U(s, a.pos) > 90 ? 0.4f : 0) + m * 0.1f;
                D("cross.zone");
                if (inBox.Count == 0 && SpaceAhead(a) > 3f && U(s, a.pos) < 97) wideHold = true;
                else if (inBox.Count > 0 && (crossV > bestV || rng.NextDouble() < (U(s, a.pos) > 86 ? 0.85 : 0.5)))
                {
                    var tgt = inBox[rng.Next(inBox.Count)];
                    var defs = teams[1 - s].FindAll(x => !x.sentOff && InOwnBox(1 - s, x.pos));
                    var defn = Nearest(defs, tgt.pos, x => true);
                    float atk = tgt.p.physical * 0.5f + tgt.p.shooting * 0.3f + a.p.passing * 0.2f, def = defn != null ? defn.p.defending * 0.5f + defn.p.physical * 0.5f : 25f;
                    bool won = rng.NextDouble() < Clamp(0.30f + (atk - def) / 180f - defs.Count * 0.015f, 0.12f, 0.6f);
                    D("dec.cross"); Pass(a, won ? tgt : (defn ?? tgt), tgt.pos + new V2(0, Gauss()), true);
                    ball.intended = won ? tgt : defn; cornerHeader = won ? tgt : null; clearer = won ? null : defn;
                    return;
                }
            }
            // dribble option
            float space = SpaceAhead(a);
            if (wideHold) { wideHold = false; D("dec.wide"); a.target = Clamp(new V2(OppGoal(s).x - Dir(s) * 3f, a.pos.y + (FieldY / 2 - a.pos.y) * 0.15f)); a.decide = 0.45f; return; }
            float dribbleV = (space > 5f ? 0.75f + Threat(s, a.pos) * 2.6f : space > 2.5f ? 0.1f + Threat(s, a.pos) * 1.6f : -0.4f) + (a.p.dribbling - 60) / 60f - pressure * 0.8f + (U(s, a.pos) > 68 ? 0.45f : 0) + m * 0.08f;
            float holdV = pressure < 0.35f ? 0.25f : -0.6f;
            D("third" + (int)(U(s, a.pos) / 35));
            if (bestR != null && bestV > dribbleV && bestV > holdV) { D("dec.pass"); Pass(a, bestR, bestPt, bestLob); return; }
            if (pressure > 0.8f && bestR != null) { Pass(a, bestR, bestPt, bestLob); return; }
            D(dribbleV > holdV ? "dec.dribble" : "dec.hold");
            a.target = DribbleTarget(a, pressure);
            a.decide *= dribbleV > holdV ? 1.4f : 1f;
        }

        V2 DribbleTarget(Agent a, float pressure)
        {
            int s = a.side; var goal = OppGoal(s);
            var fwd = (goal - a.pos).Norm;
            if (U(s, a.pos) < 75 && Math.Abs(a.pos.y - FieldY / 2) > 15) fwd = new V2(Dir(s), 0); // wide players go down the line
            var opp = Nearest(teams[1 - s], a.pos, x => !x.sentOff);
            if (opp != null)
            {
                var away = (a.pos - opp.pos); float d = away.Len;
                if (d < 6f) fwd = (fwd + new V2(-away.y, away.x).Norm * (Vside(a, opp) * 0.9f) + away.Norm * 0.4f).Norm;
            }
            return Clamp(a.pos + fwd * 6f);
        }
        float Vside(Agent a, Agent opp) => ((a.pos.y - opp.pos.y) >= 0 ? 1f : -1f) * Dir(a.side); // mirror-consistent for both directions

        float Pressure(Agent a)
        {
            float p = 0;
            foreach (var o in teams[1 - a.side]) { if (o.sentOff) continue; float d = V2.Dist(o.pos, a.pos); if (d < 6f) p += (6f - d) / 6f; }
            return Math.Min(1f, p);
        }
        float SpaceAhead(Agent a)
        {
            float best = 30f; var dir = (OppGoal(a.side) - a.pos).Norm;
            foreach (var o in teams[1 - a.side]) { if (o.sentOff) continue; var rel = o.pos - a.pos; float ahead = V2.Dot(rel, dir); if (ahead < 0 || ahead > 30) continue; float side = Math.Abs(rel.x * dir.y - rel.y * dir.x); if (side < 4f) best = Math.Min(best, ahead); }
            return best;
        }
        float OpenSpace(V2 p, int s)
        {
            float best = 30f;
            foreach (var o in teams[1 - s]) if (!o.sentOff) best = Math.Min(best, V2.Dist(o.pos, p));
            return best;
        }
        float LaneSafety(V2 from, V2 to, int s)
        {
            float best = 20f; var d = to - from; float L = d.Len; if (L < 0.1f) return best; var n = d * (1f / L);
            foreach (var o in teams[1 - s])
            {
                if (o.sentOff) continue;
                var rel = o.pos - from; float t = V2.Dot(rel, n);
                if (t < 0 || t > L + 1) continue;
                float perp = Math.Abs(rel.x * n.y - rel.y * n.x);
                float reach = 1f + t / 18f * (o.gk ? 1.8f : 1f); // defenders farther along the line have more time to step in
                best = Math.Min(best, perp - reach + 1.5f);
            }
            return best;
        }
        float Threat(int s, V2 p)
        {
            float u = U(s, p); float v = Math.Abs(p.y - FieldY / 2);
            float t = Math.Max(0, (u - 55f) / 50f);
            if (u > 88 && v < 20) t += 0.35f;
            return t * (1f - Math.Min(0.6f, v / 70f));
        }

        static float Sigmoid(float x) => 1f / (1f + (float)Math.Exp(-x));

        public static float Xg(V2 p, V2 goal, int s)
        {
            float d = V2.Dist(p, goal);
            var l = new V2(goal.x, goal.y - GoalHalf) - p; var r = new V2(goal.x, goal.y + GoalHalf) - p;
            float ang = (float)Math.Abs(Math.Atan2(l.x * r.y - l.y * r.x, l.x * r.x + l.y * r.y));
            float af = Clamp(ang / 0.5f, 0.12f, 1.25f);
            return Clamp(0.95f * (float)Math.Exp(-0.11f * d) * af, 0.005f, 0.8f);
        }

        // ------------------------------------------------------------------ actions
        void Pass(Agent a, Agent r, V2 pt, bool lob)
        {
            var S = Stats(a.side); S.passes++;
            float dist = V2.Dist(a.pos, pt);
            float err = (1.12f - a.p.passing / 100f) * 0.11f * (1f + Pressure(a) * 0.8f) * (lob ? 1.3f : 1f);
            float ang = (float)Math.Atan2(pt.y - a.pos.y, pt.x - a.pos.x) + Gauss() * err;
            float spd = lob ? Clamp(dist * 0.62f + 6f, 12f, 24f) : Clamp(dist * 0.95f + 7f, 9f, 27f);
            ball.owner = null; ball.lastTouch = a; ball.passer = a; ball.intended = r; ball.shot = false;
            ball.offsideAt = null;
            if (phase == Phase.Play || phase == Phase.FreeKick)
                foreach (var t in teams[a.side]) if (t != a && !t.sentOff && !t.gk && U(a.side, t.pos) > FieldX / 2 && U(a.side, t.pos) > OffsideLine(a.side) + 0.5f) { D("offpos"); if (t == r) ball.offsideAt = r; }
            ball.vel = new V2((float)Math.Cos(ang), (float)Math.Sin(ang)) * spd;
            if (lob) { float tFlight = dist / spd; ball.vz = 9.81f * tFlight * 0.5f; ball.z = 0.2f; }
            a.anim = "kick"; a.animT = 0; a.cooldown = 0.35f; a.facing = ang;
        }

        void KeeperDistribute(Agent k)
        {
            int s = k.side;
            Agent best = null; float bv = -1e9f;
            foreach (var r in teams[s])
            {
                if (r == k || r.sentOff) continue;
                float lane = LaneSafety(k.pos, r.pos, s), open = OpenSpace(r.pos, s);
                float v = Math.Min(lane, 6f) + Math.Min(open, 10f) * 0.5f + (r.role == "DEF" ? 1.5f : 0) - V2.Dist(k.pos, r.pos) / 20f;
                if (v > bv) { bv = v; best = r; }
            }
            if (best != null && bv > 4f) Pass(k, best, best.pos, false);
            else
            {
                // long kick towards the forwards
                var fw = Nearest(teams[s], OppGoal(s), x => x.role == "FWD" && !x.sentOff) ?? best;
                if (fw != null) Pass(k, fw, fw.pos, true);
            }
        }

        void Shoot(Agent a, float xg, float pressure)
        {
            int s = a.side; var S = Stats(s); S.shots++; S.xg += xg;
            shooter = a; shotXg = xg;
            var goal = OppGoal(s);
            // decide the outcome with a calibrated model, then let the ball fly accordingly
            float onTarget = Clamp(0.30f + a.p.shooting / 260f - pressure * 0.18f + (xg > 0.25f ? 0.12f : 0f), 0.15f, 0.8f);
            var keeper = teams[1 - s].Find(x => x.gk && !x.sentOff);
            float gkF = keeper != null ? keeper.p.gk / 100f : 0.3f;
            float pGoal = Clamp(xg * (0.86f + a.p.shooting / 170f) * (1.32f - 0.6f * gkF) * (1f + (str[s] - str[1 - s]) / 80f), 0.003f, 0.92f);
            // a defender in the way blocks it
            bool blocked = false;
            foreach (var o in teams[1 - s]) { if (o.sentOff || o.gk) continue; var rel = o.pos - a.pos; var n = (goal - a.pos).Norm; float t = V2.Dot(rel, n); if (t > 0.8f && t < 6f && Math.Abs(rel.x * n.y - rel.y * n.x) < 0.8f && rng.NextDouble() < 0.45) { blocked = true; break; } }
            double r = rng.NextDouble();
            string outcome;
            if (blocked) outcome = "block";
            else if (r < pGoal) outcome = "goal";
            else if (r < onTarget) outcome = "save";
            else outcome = rng.NextDouble() < 0.12 ? "post" : "miss";
            shotOutcome = outcome; shotKeeper = keeper;
            if (outcome == "goal" || outcome == "save") S.onTarget++;
            float aimY = goal.y + (float)(rng.NextDouble() * 2 - 1) * (GoalHalf - 0.45f);
            float aimZ = (float)rng.NextDouble() * 2.0f + 0.1f;
            if (outcome == "miss") { aimY = goal.y + (rng.NextDouble() < 0.5 ? -1 : 1) * (GoalHalf + 0.6f + (float)rng.NextDouble() * 3f); if (rng.NextDouble() < 0.4) aimZ = 2.7f + (float)rng.NextDouble(); }
            if (outcome == "post") aimY = goal.y + (rng.NextDouble() < 0.5 ? -1 : 1) * GoalHalf;
            if (outcome == "save" && keeper != null) aimY = goal.y + (aimY - goal.y) * 0.55f;
            var tgt = new V2(goal.x, aimY);
            float dist = V2.Dist(a.pos, tgt), spd = Clamp(22f + a.p.shooting / 10f, 22f, 33f);
            ball.owner = null; ball.lastTouch = a; ball.passer = null; ball.intended = null; ball.shot = true;
            ball.vel = (tgt - a.pos).Norm * spd; float tf = dist / spd; ball.vz = (aimZ + 4.9f * tf * tf) / tf; ball.z = 0.15f;
            a.anim = "kick"; a.animT = 0; a.cooldown = 0.6f;
            if (outcome == "block") { ball.vel = rng.NextDouble() < 0.4 ? new V2(ball.vel.x * 0.5f, ball.vel.y * 0.5f + Gauss() * 4f) : ball.vel * -0.3f; ball.vz = 2f; ball.shot = false; ball.lastTouch = teams[1 - s].Find(o => !o.sentOff && !o.gk) ?? a; Emit("shot", s, a.p.id, 0, xg, "Schuss geblockt"); }
            else Emit("shot", s, a.p.id, 0, xg, "Schuss");
        }

        void TryTackle(Agent d, Agent c)
        {
            if (d.cooldown > 0 || ball.owner != c || V2.Dist(d.pos, c.pos) > 1.5f) return; // only while he still has the ball
            d.cooldown = 0.45f;
            float pWin = Clamp(0.26f + (d.p.defending - c.p.dribbling) / 160f + pressing[d.side] * 0.06f, 0.07f, 0.6f);
            double r = rng.NextDouble();
            d.anim = "tackle"; d.animT = 0;
            if (r < pWin)
            {
                Stats(d.side).tackles++; d.rating += 0.12f; D("tackle.won");
                ball.owner = rng.NextDouble() < 0.55 ? d : null; ball.lastTouch = d; ball.intended = null;
                if (ball.owner == null) { ball.vel = (c.pos - d.pos).Norm * 4f + new V2(Gauss() * 3, Gauss() * 3); }
                c.cooldown = 0.6f;
            }
            else if (r < pWin + 0.065f + (1f - d.p.defending / 100f) * 0.06f)
            {
                Foul(d, c);
            }
            else { d.cooldown = 0.9f; }
        }

        void Foul(Agent d, Agent c)
        {
            var S = Stats(d.side); S.fouls++; d.rating -= 0.15f;
            Emit("foul", d.side, d.p.id, c.p.id, 0, $"Foul von {d.p.name}");
            double card = rng.NextDouble();
            if (card < 0.005 || (card < 0.15 && d.yellow == 1)) { d.sentOff = true; S.red++; d.rating -= 1f; Emit("red", d.side, d.p.id, 0, 0, $"Rot für {d.p.name}"); d.pos = new V2(FieldX / 2, -3); }
            else if (card < 0.15) { d.yellow++; S.yellow++; Emit("yellow", d.side, d.p.id, 0, 0, $"Gelb für {d.p.name}"); }
            int att = c.side;
            if (InOwnBox(d.side, c.pos)) { StartRestart(Phase.Penalty, att, PenaltySpot(att)); Emit("penalty", att, c.p.id, 0, 0.76f, "Elfmeter!"); }
            else StartRestart(Phase.FreeKick, att, c.pos);
        }

        V2 PenaltySpot(int att) => new V2(Dir(att) > 0 ? FieldX - 11f : 11f, FieldY / 2);

        // ------------------------------------------------------------------ restarts
        void StartRestart(Phase ph, int side, V2 at)
        {
            phase = ph; restartSide = side; restartPos = Clamp(at); phaseTimer = ph == Phase.Penalty ? 3f : ph == Phase.Corner ? 2.4f : ph == Phase.FreeKick ? 2f : 1.4f;
            ball.owner = null; ball.vel = new V2(0, 0); ball.z = 0; ball.vz = 0; ball.pos = restartPos; ball.shot = false; ball.intended = null;
            var team = teams[side];
            if (ph == Phase.GoalKick) taker = team.Find(x => x.gk && !x.sentOff);
            else if (ph == Phase.Penalty) taker = Best(team, x => x.p.shooting);
            else if (ph == Phase.Corner || (ph == Phase.FreeKick && V2.Dist(at, OppGoal(side)) < 30)) taker = Best(team, x => x.p.passing + x.p.shooting * 0.5f);
            else taker = Nearest(team, at, x => !x.gk && !x.sentOff);
        }

        void RestartTick(float dt)
        {
            phaseTimer -= dt;
            int s = restartSide;
            foreach (var t in teams) foreach (var a in t) { if (a.sentOff) continue; a.running = false; a.target = RestartPos(a); }
            if (taker != null) { var behind = restartPos - (OppGoal(s) - restartPos).Norm * 0.7f; taker.target = behind; if (phaseTimer > 0.4f) { } }
            if (phaseTimer > 0) return;
            if (taker == null || taker.sentOff) { phase = Phase.Play; return; }
            taker.pos = restartPos - (OppGoal(s) - restartPos).Norm * 0.6f;
            ball.pos = restartPos;
            var ph = phase; phase = Phase.Play;
            switch (ph)
            {
                case Phase.Penalty:
                    {
                        var S = Stats(s); S.shots++; S.xg += 0.76f; shooter = taker; shotXg = 0.76f;
                        var keeper = teams[1 - s].Find(x => x.gk && !x.sentOff);
                        float pGoal = Clamp(0.78f + (taker.p.shooting - 70) / 300f - ((keeper?.p.gk ?? 50) - 70) / 300f, 0.55f, 0.9f);
                        double r = rng.NextDouble();
                        shotOutcome = r < pGoal ? "goal" : r < pGoal + 0.13f ? "save" : "miss"; shotKeeper = keeper;
                        if (shotOutcome != "miss") S.onTarget++;
                        var goal = OppGoal(s); float y = goal.y + (rng.NextDouble() < 0.5 ? -1 : 1) * (float)(1.2 + rng.NextDouble() * 2.2);
                        if (shotOutcome == "miss") y = goal.y + (rng.NextDouble() < 0.5 ? -1 : 1) * 4.6f;
                        ball.vel = (new V2(goal.x, y) - ball.pos).Norm * 26f; ball.vz = 2.2f; ball.z = 0.1f; ball.shot = true; ball.lastTouch = taker; ball.passer = null;
                        taker.anim = "kick"; taker.animT = 0;
                        Emit("shot", s, taker.p.id, 0, 0.76f, "Elfmeter");
                        break;
                    }
                case Phase.Corner:
                    {
                        Stats(s).corners++;
                        var targets = teams[s].FindAll(x => !x.sentOff && !x.gk && x != taker && InOppBox(s, x.pos));
                        var tgt = targets.Count > 0 ? targets[rng.Next(targets.Count)] : Nearest(teams[s], OppGoal(s), x => x != taker && !x.gk);
                        if (tgt == null) break;
                        // header contest decided here; the ball flies to the spot
                        var defenders = teams[1 - s].FindAll(x => !x.sentOff && InOwnBox(1 - s, x.pos));
                        var defn = Nearest(defenders, tgt.pos, x => true);
                        float atk = tgt.p.physical * 0.6f + tgt.p.shooting * 0.4f, def = defn != null ? defn.p.defending * 0.5f + defn.p.physical * 0.5f : 30f;
                        bool won = rng.NextDouble() < Clamp(0.33f + (atk - def) / 200f + taker.p.passing / 600f, 0.12f, 0.62f);
                        Pass(taker, won ? tgt : (defn ?? tgt), tgt.pos, true);
                        ball.intended = won ? tgt : defn; cornerHeader = won ? tgt : null; clearer = won ? null : defn;
                        break;
                    }
                case Phase.FreeKick:
                    {
                        float d = V2.Dist(restartPos, OppGoal(s));
                        if (d < 28 && Math.Abs(restartPos.y - FieldY / 2) < 18 && rng.NextDouble() < 0.6)
                        {
                            float xg = Clamp(0.09f - (d - 18) * 0.004f + (taker.p.shooting - 70) / 900f, 0.025f, 0.12f);
                            Shoot(taker, xg, 0f);
                        }
                        else { taker.decide = 0; ball.owner = taker; CarrierTick(taker, 0); }
                        break;
                    }
                case Phase.Kickoff:
                    {
                        var mate = Nearest(teams[s], ball.pos, x => x != taker && !x.gk && !x.sentOff);
                        if (mate != null) Pass(taker, mate, mate.pos, false);
                        break;
                    }
                default:
                    {
                        // throw-in / goal kick: short safe option
                        ball.owner = taker; taker.decide = 0;
                        if (ph == Phase.GoalKick) KeeperDistribute(taker); else CarrierTick(taker, 0);
                        if (ball.owner == taker) { taker.decide = 0; CarrierTick(taker, 0); }
                        break;
                    }
            }
        }
        Agent cornerHeader, clearer;
        bool wideHold;
        int tickParity;

        V2 RestartPos(Agent a)
        {
            int s = a.side; bool att = s == restartSide;
            if (phase == Phase.Corner || (phase == Phase.FreeKick && V2.Dist(restartPos, OppGoal(restartSide)) < 32))
            {
                var goal = OppGoal(restartSide);
                if (a.gk) return s == restartSide ? FromTeam(s, Math.Min(40, U(s, a.pos)), FieldY / 2) : OwnGoal(s) + (restartPos - OwnGoal(s)).Norm * 1.2f;
                int i = a.slot;
                if (att && (a.role == "DEF" && a.lat > 0.25f && a.lat < 0.75f || a.role == "FWD" || a.depth > 0.6f))
                    return Clamp(goal + new V2(-Dir(restartSide) * (5f + (i % 3) * 3.5f), (i % 5 - 2) * 3.2f));
                if (!att && a.role != "FWD") return Clamp(goal + new V2(-Dir(restartSide) * (2.5f + (i % 4) * 2.6f), (i % 6 - 2.5f) * 2.6f));
                return a.pos;
            }
            if (phase == Phase.Penalty)
            {
                if (a == taker) return restartPos;
                if (a.gk && s != restartSide) return OwnGoal(s);
                return Clamp(new V2(Dir(restartSide) > 0 ? FieldX - 22f : 22f, FieldY / 2 + (a.slot - 5) * 3f + (s * 1.5f)));
            }
            // otherwise keep the shape around the restart
            return s == restartSide ? SupportPos(a, taker ?? a) : DefendPos(a, null);
        }

        // ------------------------------------------------------------------ physics
        void MovePlayers(float dt)
        {
            for (int s = 0; s < 2; s++) foreach (var a in teams[s])
                {
                    if (a.sentOff) { a.vel = new V2(0, 0); continue; }
                    a.animT += dt;
                    if (phase == Phase.Celebration) { a.target = lastScorer != null && lastScorer.side == s ? lastScorer.pos + new V2((a.slot % 3 - 1) * 1.5f, (a.slot % 2) * 1.5f) : a.target; }
                    var to = a.target - a.pos; float d = to.Len;
                    float max = a.MaxSpeed * (a.running || d > 8 ? 1f : 0.55f);
                    if (a == ball.owner) max *= 0.82f + a.p.dribbling / 1000f;
                    if (phase != Phase.Play && phase != Phase.Celebration) max *= 0.75f;
                    var want = d > 0.25f ? to.Norm * Math.Min(max, d * 2.2f) : new V2(0, 0);
                    float accel = 7f + a.p.pace / 25f;
                    var dv = want - a.vel; float dvl = dv.Len;
                    if (dvl > accel * dt) dv = dv * (accel * dt / dvl);
                    a.vel = a.vel + dv; a.pos = Clamp(a.pos + a.vel * dt, -2f);
                    float sp = a.vel.Len;
                    if (sp > 0.3f) a.facing = (float)Math.Atan2(a.vel.y, a.vel.x);
                    else if (phase == Phase.Play || ball.owner != a) a.facing = (float)Math.Atan2(ball.pos.y - a.pos.y, ball.pos.x - a.pos.x);
                    a.stamina = Math.Max(0.25f, a.stamina - (sp > 6.5f ? 0.0006f : sp > 3f ? 0.00012f : -0.00008f) * (1.4f - a.p.physical / 100f) * dt * 20f);
                    if (a.anim == "kick" && a.animT > 0.45f || a.anim == "tackle" && a.animT > 0.6f || a.anim == "dive" && a.animT > 1.2f || a.anim == "header" && a.animT > 0.6f) a.anim = "run";
                    if (phase == Phase.Celebration && lastScorer != null && a.side == lastScorer.side) a.anim = "celebrate";
                    else if (a.anim == "run" || a.anim == "idle" || a.anim == "celebrate") a.anim = sp > 0.4f ? "run" : "idle";
                }
            // separation so players don't stack
            for (int s = 0; s < 2; s++) foreach (var a in teams[s]) foreach (var b in teams[s])
                    {
                        if (a == b || a.sentOff || b.sentOff) continue;
                        var r = a.pos - b.pos; float d = r.Len;
                        if (d < 1.1f && d > 0.01f) a.pos = a.pos + r.Norm * ((1.1f - d) * 0.5f);
                    }
        }

        void BallTick(float dt)
        {
            if (phase == Phase.Celebration || phase == Phase.HalfTime) { ball.vel = ball.vel * 0.9f; ball.pos = ball.pos + ball.vel * dt; return; }
            if (phase != Phase.Play) { ball.pos = restartPos; ball.z = 0; return; }
            var o = ball.owner;
            if (o != null)
            {
                var dir = new V2((float)Math.Cos(o.facing), (float)Math.Sin(o.facing));
                var want = o.pos + dir * 0.75f;
                ball.vel = (want - ball.pos) * (1f / dt) * 0.5f;
                ball.pos = V2.Lerp(ball.pos, want, 0.5f); ball.z = 0; ball.vz = 0;
                return;
            }
            // free ball
            ball.pos = ball.pos + ball.vel * dt;
            if (ball.z > 0 || ball.vz > 0)
            {
                ball.vz -= 9.81f * dt; ball.z += ball.vz * dt;
                if (ball.z <= 0) { ball.z = 0; if (ball.vz < -2.5f) { ball.vz = -ball.vz * 0.45f; ball.vel = ball.vel * 0.8f; } else ball.vz = 0; }
                ball.vel = ball.vel * (1f - 0.08f * dt);
            }
            else ball.vel = ball.vel * (1f - 0.9f * dt);

            if (CheckGoalOrOut()) return;
            if (ball.shot) { ShotFlight(); return; }

            // first touch / interception
            Agent best = null; float bestD = 9f;
            foreach (var t in teams) foreach (var a in t)
                {
                    if (a.sentOff || a.cooldown > 0 || a == ball.passer && ball.vel.Len > 6f) continue;
                    float d = V2.Dist(a.pos, ball.pos);
                    float reach = (a.gk && InOwnBox(a.side, ball.pos) ? 1.6f : 0.95f) + (ball.vel.Len < 4 ? 0.3f : 0);
                    if (d > reach || ball.z > (a.gk ? 2.6f : 1.9f)) continue;
                    if (d < bestD) { bestD = d; best = a; }
                }
            if (best == null) return;
            float speed = ball.vel.Len;
            bool friendly = ball.lastTouch != null && ball.lastTouch.side == best.side;
            bool intended = best == ball.intended;
            float ctrl = intended ? 0.97f : friendly ? 0.85f : Clamp(0.32f + best.p.defending / 220f - speed / 60f + (best.gk ? 0.4f : 0f), 0.1f, 0.9f);
            if (ball.z > 1.2f && !best.gk) { best.anim = "header"; best.animT = 0; }
            if (cornerHeader != null && best == cornerHeader && ball.z > 0.8f)
            {
                cornerHeader = null; best.anim = "header"; best.animT = 0;
                float xg = Clamp(Xg(best.pos, OppGoal(best.side), best.side) * 0.55f, 0.03f, 0.25f);
                ball.owner = best; Shoot(best, xg, 0.5f); ball.vz = Math.Min(ball.vz, 3f); return;
            }
            cornerHeader = null;
            if (clearer != null && best == clearer && ball.z > 0.6f)
            {
                clearer = null; best.anim = "header"; best.animT = 0; best.rating += 0.08f; D("clear");
                double c = rng.NextDouble();
                if (c < 0.33) { ball.vel = new V2(-Dir(best.side) * -1f * 4f, (best.pos.y < FieldY / 2 ? -1 : 1) * 2f) ; ball.vel = new V2(Dir(best.side) * -9f, (best.pos.y < FieldY / 2 ? -1f : 1f) * 3f); ball.vz = 4f; } // behind for a corner
                else { ball.vel = new V2(Dir(best.side) * (14f + (float)rng.NextDouble() * 8f), Gauss() * 6f); ball.vz = 6f; }
                ball.lastTouch = best; ball.intended = null; ball.passer = null; best.cooldown = 0.3f; return;
            }
            clearer = null;
            if (rng.NextDouble() < ctrl)
            {
                if (ball.passer != null && ball.passer.side == best.side && best != ball.passer)
                {
                    // offside?
                    if (ball.offsideAt != null) D("offrecv" + (ball.offsideAt == best ? "" : ".other"));
                    if (ball.offsideAt == best && passOffsideCheck(best))
                    {
                        Stats(best.side).offsides++; Emit("offside", best.side, best.p.id, 0, 0, "Abseits");
                        StartRestart(Phase.FreeKick, 1 - best.side, best.pos); return;
                    }
                    Stats(best.side).passesOk++; ball.passer.rating += 0.03f; lastPasser[best.side] = ball.passer;
                }
                else if (ball.passer != null && ball.passer.side != best.side) { ball.passer.rating -= 0.06f; best.rating += 0.05f; }
                if (best.side != (ball.lastTouch?.side ?? best.side)) lastPasser[best.side] = null;
                D(ball.lastTouch != null && ball.lastTouch.side != best.side ? "recv.opp" : "recv.own");
                ball.owner = best; ball.lastTouch = best; ball.intended = null; ball.passer = null; best.decide = best.gk ? 0.8f : 0.12f + (float)rng.NextDouble() * 0.15f;
            }
            else
            {
                // deflection
                D("deflect" + (friendly ? ".own" : ".opp"));
                ball.vel = new V2(ball.vel.x * -0.3f + Gauss() * 3f, ball.vel.y * -0.3f + Gauss() * 3f); ball.lastTouch = best; ball.intended = null; best.cooldown = 0.35f;
            }
        }
        readonly Agent[] lastPasser = new Agent[2];
        bool passOffsideCheck(Agent r) => rng.NextDouble() < 0.93; // the linesman misses a few

        void ShotFlight()
        {
            // keeper reaction for saves
            int att = ball.lastTouch?.side ?? 0;
            var k = shotKeeper;
            if (k != null && shotOutcome == "save" && V2.Dist(k.pos, ball.pos) < 3.2f)
            {
                k.anim = "dive"; k.animT = 0; Stats(k.side).saves++; k.rating += 0.35f;
                Emit("save", k.side, k.p.id, shooter?.p.id ?? 0, shotXg, $"Parade von {k.p.name}");
                if (shotXg >= 0.28f) MarkClip("save", 1 - k.side, shooter?.p.id ?? 0, $"Glanzparade {k.p.name}");
                ball.shot = false;
                if (rng.NextDouble() < 0.5) { ball.owner = k; ball.vel = new V2(0, 0); ball.z = 0; ball.vz = 0; ball.lastTouch = k; k.decide = 1.2f; }
                else if (rng.NextDouble() < 0.55) { ball.vel = new V2(Dir(att) * 7f, (ball.pos.y < FieldY / 2 ? -1 : 1) * 6f); ball.vz = 3f; ball.lastTouch = k; } // tipped wide
                else { ball.vel = new V2(-Dir(att) * 6f, Gauss() * 9f); ball.vz = 3f; ball.lastTouch = k; }
                shotOutcome = null;
            }
            else if (k != null && (shotOutcome == "goal" || shotOutcome == "miss" || shotOutcome == "post") && V2.Dist(k.pos, ball.pos) < 4f && k.anim != "dive") { k.anim = "dive"; k.animT = 0; }
        }

        bool CheckGoalOrOut()
        {
            var p = ball.pos;
            if (p.x < 0 || p.x > FieldX)
            {
                int defSide = p.x < 0 ? (Dir(0) > 0 ? 0 : 1) : (Dir(0) > 0 ? 1 : 0); // side defending this goal
                int attSide = 1 - defSide;
                bool inGoal = Math.Abs(p.y - FieldY / 2) < GoalHalf && ball.z < 2.44f;
                if (shotOutcome == "post" && ball.shot) { Emit("post", attSide, shooter?.p.id ?? 0, 0, shotXg, "Aluminium!"); MarkClip("post", attSide, shooter?.p.id ?? 0, "Aluminium!"); ball.vel = new V2(-ball.vel.x * 0.4f, ball.vel.y * 0.6f); ball.pos = new V2(Clamp(p.x, 0.2f, FieldX - 0.2f), p.y); ball.shot = false; shotOutcome = null; return false; }
                if (inGoal && ball.shot && shotOutcome == "goal") { Goal(attSide); return true; }
                if (inGoal && !ball.shot && ball.lastTouch != null && rng.NextDouble() < 0.3) { Goal(attSide); return true; } // own goal / scramble
                if (ball.shot && shotOutcome == "miss") Emit("miss", attSide, shooter?.p.id ?? 0, 0, shotXg, "Vorbei");
                ball.shot = false; shotOutcome = null;
                D("out.goalline");
                bool lastDef = ball.lastTouch != null && ball.lastTouch.side == defSide;
                float x = p.x < 0 ? 0 : FieldX;
                if (lastDef) { StartRestart(Phase.Corner, attSide, new V2(x, p.y < FieldY / 2 ? 0.5f : FieldY - 0.5f)); Emit("corner", attSide, 0, 0, 0, "Ecke"); }
                else StartRestart(Phase.GoalKick, defSide, new V2(x == 0 ? 5.5f : FieldX - 5.5f, FieldY / 2 + (p.y < FieldY / 2 ? -6f : 6f)));
                return true;
            }
            if (p.y < 0 || p.y > FieldY)
            {
                int side = ball.lastTouch != null ? 1 - ball.lastTouch.side : 0;
                D("out.side");
                StartRestart(Phase.ThrowIn, side, new V2(Clamp(p.x, 1, FieldX - 1), p.y < 0 ? 0.2f : FieldY - 0.2f));
                ball.shot = false; shotOutcome = null;
                return true;
            }
            return false;
        }

        void Goal(int side)
        {
            score[side]++; var S = Stats(side); S.goals++;
            var sc = ball.lastTouch != null && ball.lastTouch.side == side ? ball.lastTouch : null;
            var assist = sc != null ? lastPasser[side] : null;
            if (assist == sc) assist = null;
            if (sc != null) { sc.goals++; sc.rating += 1.0f; }
            if (assist != null) { assist.assists++; assist.rating += 0.6f; }
            var keeper = teams[1 - side].Find(x => x.gk); if (keeper != null) keeper.rating -= 0.25f;
            lastScorer = sc ?? ball.lastTouch;
            Emit("goal", side, sc?.p.id ?? 0, assist?.p.id ?? 0, shotXg, sc != null ? $"TOR! {sc.p.name}" : "TOR! (Eigentor)");
            MarkClip("goal", side, sc?.p.id ?? 0, sc != null ? $"TOR! {sc.p.name}" : "Eigentor");
            phase = Phase.Celebration; phaseTimer = 6f; restartSide = 1 - side;
            ball.shot = false; shotOutcome = null; ball.owner = null; ball.vel = ball.vel * 0.15f; ball.intended = null;
            if (lastScorer != null) lastScorer.target = Clamp(new V2(lastScorer.pos.x, lastScorer.pos.y < FieldY / 2 ? 1 : FieldY - 1));
            lastPasser[0] = lastPasser[1] = null;
        }

        void Finish()
        {
            finished = true; phase = Phase.FullTime;
            summary.homeGoals = score[0]; summary.awayGoals = score[1];
            float tot = possTime[0] + possTime[1];
            summary.home.possession = tot > 0 ? (float)Math.Round(possTime[0] / tot * 100f) : 50; summary.away.possession = 100 - summary.home.possession;
            for (int s = 0; s < 2; s++) foreach (var a in teams[s])
                    summary.ratings.Add(new PlayerRating { id = a.p.id, side = s, rating = (float)Math.Round(Clamp(a.rating, 3f, 10f) * 10) / 10f, goals = a.goals, assists = a.assists, minutes = (float)Math.Round(a.minutes) });
            Emit("fulltime", -1, 0, 0, 0, $"Abpfiff {score[0]}:{score[1]}");
        }

        // ------------------------------------------------------------------ helpers
        public SideStats Stats(int s) => s == 0 ? summary.home : summary.away;
        void Emit(string type, int side, int player, int assist, float xg, string text)
        {
            int min = Math.Max(0, Math.Min(half == 1 ? 45 : 90, (int)Math.Ceiling(time / HalfSeconds * 45f)));
            var e = new MatchEvent { type = type, minute = Math.Max(1, min), side = side, player = player, assist = assist, xg = (float)Math.Round(xg * 100) / 100f, text = text };
            if (type == "clip" || type == "formation") { OnEvent?.Invoke(e); return; }
            if (type != "shot" && type != "miss") summary.events.Add(e); else if (type == "shot" && xg > 0.25f) summary.events.Add(e);
            OnEvent?.Invoke(e);
        }
        bool InOwnBox(int side, V2 p) => U(side, p) < 16.5f && Math.Abs(p.y - FieldY / 2) < 20.16f;
        bool InOppBox(int side, V2 p) => U(side, p) > FieldX - 16.5f && Math.Abs(p.y - FieldY / 2) < 20.16f;
        static Agent Nearest(List<Agent> list, V2 p, Func<Agent, bool> ok)
        {
            Agent b = null; float bd = 1e9f;
            foreach (var a in list) { if (a.sentOff || !ok(a)) continue; float d = V2.Dist(a.pos, p); if (d < bd) { bd = d; b = a; } }
            return b;
        }
        static Agent Best(List<Agent> list, Func<Agent, float> score)
        {
            Agent b = null; float bs = -1e9f;
            foreach (var a in list) { if (a.sentOff || a.gk) continue; float s = score(a); if (s > bs) { bs = s; b = a; } }
            return b;
        }
        float Gauss() { double u1 = 1.0 - rng.NextDouble(), u2 = rng.NextDouble(); return (float)(Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2 * Math.PI * u2)); }
        public static float Clamp(float v, float a, float b) => v < a ? a : v > b ? b : v;
        static V2 Clamp(V2 p, float m = 0.5f) => new V2(Clamp(p.x, m, FieldX - m), Clamp(p.y, m, FieldY - m));
    }
}
