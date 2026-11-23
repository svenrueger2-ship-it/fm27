// FM27 match engine 2 – C++ port (see MatchSim.h). Keep in sync with unity/.../Core/MatchEngine.cs.
#include "MatchSim.h"
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <sstream>

namespace fm27 {

// ======================================================================= formations
static std::vector<std::string> Rep(const std::string& s, int n) { return std::vector<std::string>(n, s); }
static std::vector<std::string> LineLabels(int count, int lineIdx, int lines)
{
    bool def = lineIdx == 0, fwd = lineIdx == lines - 1 && lines > 1;
    if (def) { if (count == 5) return {"LV", "IV", "IV", "IV", "RV"}; if (count == 4) return {"LV", "IV", "IV", "RV"}; return Rep("IV", count); }
    if (fwd) { if (count == 3) return {"LA", "ST", "RA"}; return Rep("ST", count); }
    bool deepest = lineIdx == 1 && lines >= 4; if (deepest) return Rep("DM", count);
    bool attacking = lineIdx == lines - 2 && lines >= 4;
    if (attacking && count == 3) return {"LM", "OM", "RM"};
    if (attacking && count == 1) return {"OM"};
    if (count == 5) return {"LM", "ZM", "DM", "ZM", "RM"};
    if (count == 4) return {"LM", "ZM", "ZM", "RM"};
    if (count == 3) return {"ZM", "DM", "ZM"};
    if (count == 2) return {"ZM", "ZM"};
    return {"DM"};
}

std::vector<Slot> FormationSlots(const std::string& formation)
{
    std::vector<int> parts; std::stringstream ss(formation); std::string t;
    while (std::getline(ss, t, '-')) { int n = std::atoi(t.c_str()); if (n > 0) parts.push_back(n); }
    int sum = 0; for (int n : parts) sum += n;
    if (sum != 10 || parts.size() < 2) parts = {4, 4, 2};
    std::vector<Slot> res; res.push_back({0.f, 0.5f, "GK", "TW"});
    int L = (int)parts.size();
    for (int i = 0; i < L; i++)
    {
        int k = parts[i]; float depth = 0.08f + i * (0.84f / (L - 1));
        auto labels = LineLabels(k, i, L);
        std::string role = i == 0 ? "DEF" : i == L - 1 ? "FWD" : "MID";
        float spread = i == 0 ? 0.84f : role == "FWD" ? (k == 1 ? 0.f : k == 2 ? 0.34f : 0.72f) : 0.8f;
        for (int j = 0; j < k; j++)
        {
            float lat = k == 1 ? 0.5f : 0.5f - spread / 2 + spread * j / (k - 1);
            std::string pos = labels[j]; float d = depth;
            if (pos == "DM") d -= 0.05f; else if (pos == "OM") d += 0.04f; else if ((pos == "LM" || pos == "RM") && L == 3) d += 0.02f;
            if (pos == "LV" || pos == "RV") d += 0.02f;
            res.push_back({d, lat, role, pos});
        }
    }
    return res;
}

static int SlotCost(const std::string& p, const std::string& s)
{
    if (p == s) return 0;
    static const std::vector<std::vector<std::string>> groups = {{"IV", "LV", "RV"}, {"DM", "ZM"}, {"ZM", "OM"}, {"LM", "LA", "LV"}, {"RM", "RA", "RV"}, {"ST", "LA", "RA", "OM"}, {"LM", "RM", "ZM"}};
    for (auto& g : groups) if (std::find(g.begin(), g.end(), p) != g.end() && std::find(g.begin(), g.end(), s) != g.end()) return 2;
    if (p == "TW" || s == "TW") return 50;
    return 6;
}

std::vector<int> AssignSlots(const std::vector<PlayerSetup>& players, const std::vector<Slot>& slots)
{
    int n = std::min(11, (int)players.size());
    std::vector<int> res(n, -1); std::vector<bool> used(slots.size(), false);
    int gk = 0; for (int i = 0; i < n; i++) if (players[i].pos == "TW") { gk = i; break; }
    res[gk] = 0; used[0] = true;
    for (int tier = 0; tier <= 50; tier++)
        for (int i = 0; i < n; i++)
        {
            if (res[i] >= 0) continue;
            for (size_t s = 1; s < slots.size(); s++) if (!used[s] && SlotCost(players[i].pos, slots[s].pos) == tier) { res[i] = (int)s; used[s] = true; break; }
        }
    for (int i = 0; i < n; i++) if (res[i] < 0) for (size_t s = 1; s < slots.size(); s++) if (!used[s]) { res[i] = (int)s; used[s] = true; break; }
    return res;
}

// ======================================================================= setup
MatchSim::MatchSim(const MatchSetup& s) : setup(s), rng(s.seed)
{
    Build(0, s.home); Build(1, s.away);
    mentality[0] = s.home.mentality; mentality[1] = s.away.mentality;
    pressing[0] = s.home.pressing; pressing[1] = s.away.pressing;
    for (int i = 0; i < 2; i++) { float sum = 0; for (auto& a : teams[i]) sum += a.p.ovr; str[i] = teams[i].empty() ? 60.f : sum / teams[i].size(); }
    if (!s.neutral) str[0] += s.homeAdvantage * 100.f * 0.5f;
    kickoffSide = RI(2);
    SetupKickoff(kickoffSide);
    Emit("kickoff", -1, 0, 0, 0, "Anpfiff");
}

void MatchSim::Build(int side, const TeamSetup& t)
{
    auto slots = FormationSlots(t.formation);
    auto map = AssignSlots(t.players, slots);
    int n = std::min(11, (int)t.players.size());
    teams[side].reserve(11);
    for (int i = 0; i < n; i++)
    {
        Agent a; a.side = side; a.slot = i; a.p = t.players[i];
        Slot s = (map[i] >= 0 && map[i] < (int)slots.size()) ? slots[map[i]] : Slot{0.5f, 0.5f, "MID", ""};
        a.gk = s.role == "GK"; a.depth = s.depth; a.lat = s.lat; a.role = s.role;
        a.stamina = 0.75f + 0.25f * (a.p.fitness / 100.f);
        a.runTimer = (float)R() * 4.f;
        teams[side].push_back(a);
    }
}

void MatchSim::SetupKickoff(int side)
{
    phase = Phase::Kickoff; phaseTimer = 2.2f; restartSide = side;
    ball.pos = V2(FieldX / 2, FieldY / 2); ball.vel = V2(); ball.z = 0; ball.vz = 0; ball.owner = nullptr; ball.shot = false;
    for (int s = 0; s < 2; s++) for (auto& a : teams[s])
    {
        if (a.sentOff) continue;
        float u = a.gk ? 3.f : std::min(50.f, 8.f + a.depth * 44.f), v = a.lat * FieldY;
        a.pos = FromTeam(s, u, v); a.vel = V2(); a.anim = "idle"; a.cooldown = 0;
    }
    taker = Nearest(side, ball.pos, [](const Agent& x) { return !x.gk && x.role == "FWD"; });
    if (!taker) taker = Nearest(side, ball.pos, [](const Agent& x) { return !x.gk; });
    if (taker) taker->pos = ball.pos - V2(Dir(side) * 0.6f, 0);
}

int MatchSim::Minute() const { return std::min(half == 1 ? 45 : 90, (int)(time / HalfSeconds * 45.f)); }
std::string MatchSim::Clock() const { float m = time / HalfSeconds * 45.f; int mi = (int)m, s = (int)((m - mi) * 60); char b[16]; std::snprintf(b, sizeof b, "%02d:%02d", mi, s); return b; }
void MatchSim::SetMentality(int side, int v) { mentality[side == 1 ? 1 : 0] = std::max(-2, std::min(2, v)); }
void MatchSim::Substitute(int side, int outId, const PlayerSetup& in)
{
    for (auto& a : teams[side == 1 ? 1 : 0])
        if (a.p.id == outId && !a.sentOff)
        {
            Emit("sub", side, in.id, a.p.id, 0, in.name + " für " + a.p.name);
            summary.ratings.push_back(RatingOf(a, side == 1 ? 1 : 0));
            a.passes = a.passesOk = a.shots = a.tackles = a.saves = 0; a.heat.assign(96, 0);
            a.p = in; a.stamina = 1; a.rating = 6.2f; a.goals = a.assists = a.yellow = 0; a.minutes = 0; return;
        }
}

void MatchSim::Advance(float seconds)
{
    acc += seconds; int guard = 0;
    while (acc >= Dt && !finished && guard++ < 4000) { acc -= Dt; Step(); }
}

float MatchSim::Gauss() { double u1 = 1.0 - R(), u2 = R(); return (float)(std::sqrt(-2.0 * std::log(u1)) * std::sin(2 * 3.14159265358979 * u2)); }

// ======================================================================= main step
void MatchSim::Step()
{
    if (finished) return;
    for (auto& t : teams) for (auto& a : t) { a.prev = a.pos; a.prevFacing = a.facing; }
    ball.prev = ball.pos; ball.prevZ = ball.z;
    const float dt = Dt;
    if (phase == Phase::HalfTime)
    {
        phaseTimer -= dt; MovePlayers(dt); Record();
        if (phaseTimer <= 0) { half = 2; time = HalfSeconds; for (auto& t : teams) for (auto& a : t) a.stamina = std::min(1.f, a.stamina + 0.12f); SetupKickoff(1 - kickoffSide); Emit("kickoff", -1, 0, 0, 0, "Anpfiff 2. Halbzeit"); }
        return;
    }
    if (phase != Phase::Celebration) time += dt;
    if (ball.owner) possTime[ball.owner->side] += dt;
    if (phase != Phase::Celebration) for (auto& t : teams) for (auto& a : t) if (!a.sentOff) a.minutes += dt / HalfSeconds * 45.f;
    if (half == 1 && time >= HalfSeconds && IsDeadOrSafe()) { phase = Phase::HalfTime; phaseTimer = 3.f; Emit("halftime", -1, 0, 0, 0, "Halbzeit " + std::to_string(score[0]) + ":" + std::to_string(score[1])); return; }
    if (half == 2 && time >= 2 * HalfSeconds && IsDeadOrSafe()) { Finish(); return; }
    switch (phase)
    {
    case Phase::Kickoff: case Phase::ThrowIn: case Phase::GoalKick: case Phase::Corner: case Phase::FreeKick: case Phase::Penalty: RestartTick(dt); break;
    case Phase::Celebration: phaseTimer -= dt; if (phaseTimer <= 0) SetupKickoff(restartSide); break;
    default: PlayTick(dt); break;
    }
    MovePlayers(dt);
    BallTick(dt);
    Record();
}

// ======================================================================= replays
void MatchSim::Record()
{
    simClock += Dt;
    if (phase == Phase::Play && ++heatTick % 20 == 0)
        for (int s = 0; s < 2; s++) for (auto& a : teams[s])
        {
            if (a.sentOff) continue;
            const float u = U(s, a.pos), v = Dir(s) > 0 ? a.pos.y : FieldY - a.pos.y;
            const int gx = std::min(11, std::max(0, (int)(u / FieldX * 12))), gz = std::min(7, std::max(0, (int)(v / FieldY * 8)));
            a.heat[gz * 12 + gx]++;
        }
    Frame& f = recBuf[recHead]; recHead = (recHead + 1) % (int)recBuf.size(); if (recCount < (int)recBuf.size()) recCount++;
    f.t = simClock; f.bx = ball.pos.x; f.by = ball.pos.y; f.bz = ball.z;
    int i = 0;
    for (auto& t : teams) for (auto& a : t) { if (i >= 22) break; f.p[i++] = FramePlayer{a.pos.x, a.pos.y, a.facing, a.animT, a.anim, a.sentOff}; }
    if (hasPending && ++pendingSteps >= 44)
    {
        pending.frames = LastFrames(pending.type == "goal" ? 10.f : 7.f);
        clips.push_back(pending); hasPending = false;
        Emit("clip", pending.side, pending.player, (int)clips.size() - 1, 0, pending.type);
    }
}

std::vector<Frame> MatchSim::LastFrames(float seconds) const
{
    int n = std::min(recCount, (int)(seconds / Dt)); const int cap = (int)recBuf.size();
    std::vector<Frame> res; res.reserve(n);
    for (int k = n; k >= 1; k--) res.push_back(recBuf[(recHead - k + cap * 2) % cap]);
    return res;
}

void MatchSim::MarkClip(const std::string& type, int side, int player, const std::string& text)
{
    if (hasPending) return;
    pending = Clip(); pending.type = type; pending.side = side; pending.player = player; pending.text = text;
    pending.minute = std::max(1, (int)std::ceil(time / HalfSeconds * 45.f)); pending.goalX = Dir(side) > 0 ? FieldX : 0.f;
    hasPending = true; pendingSteps = 0;
}

void MatchSim::SetFormation(int side, const std::string& formation)
{
    side = side == 1 ? 1 : 0;
    auto slots = FormationSlots(formation);
    std::vector<PlayerSetup> list; for (auto& a : teams[side]) list.push_back(a.p);
    auto map = AssignSlots(list, slots);
    for (size_t i = 0; i < teams[side].size(); i++)
    {
        Agent& a = teams[side][i]; if (a.gk) continue;
        const Slot& sl = (map[i] >= 0 && map[i] < (int)slots.size()) ? slots[map[i]] : slots[std::min(i, slots.size() - 1)];
        if (sl.role == "GK") continue;
        a.depth = sl.depth; a.lat = sl.lat; a.role = sl.role;
    }
    (side == 0 ? setup.home : setup.away).formation = formation;
    Emit("formation", side, 0, 0, 0, "Neue Formation: " + formation);
}

bool MatchSim::IsDeadOrSafe() const { return phase != Phase::Play || !ball.owner || std::fabs(ball.pos.x - FieldX / 2) < 30; }

// ======================================================================= decisions
void MatchSim::PlayTick(float dt)
{
    Agent* owner = ball.owner;
    tickParity ^= 1; // alternate which team decides first – otherwise the second team always reacts one step later in its favour
    for (int s2 = 0; s2 < 2; s2++)
    {
        int s = tickParity ? 1 - s2 : s2;
        bool attacking = owner && owner->side == s;
        Agent* chaser = !owner ? BestChaser(s) : nullptr;
        Agent* presser = owner && !attacking ? Presser(s, owner) : nullptr;
        Agent* cover = owner && !attacking && pressing[s] > 0.45f ? SecondPresser(s, owner, presser) : nullptr;
        for (auto& a : teams[s])
        {
            if (a.sentOff) continue;
            a.cooldown -= dt; a.runTimer -= dt;
            if (&a == owner) { CarrierTick(a, dt); continue; }
            if (a.gk) { KeeperTick(a); continue; }
            if (&a == chaser || ball.intended == &a) { a.target = Intercept(a); a.running = true; continue; }
            if (attacking) a.target = SupportPos(a, owner);
            else if (&a == presser) { a.target = owner->pos + (OwnGoal(s) - owner->pos).Norm() * 0.7f; a.running = true; TryTackle(a, *owner); }
            else if (&a == cover) { Agent* o = NearestOpp(owner); a.target = V2::Lerp(owner->pos, o ? o->pos : owner->pos, 0.55f); }
            else a.target = DefendPos(a, owner);
        }
    }
}

Agent* MatchSim::BestChaser(int s)
{
    Agent* best = nullptr; float bt = 1e9f; V2 land = BallLanding();
    for (auto& a : teams[s])
    {
        if (a.sentOff || a.cooldown > 0) continue;
        if (a.gk && !InOwnBox(a.side, ball.pos)) continue;
        float t = V2::Dist(a.pos, land) / a.MaxSpeed();
        if (t < bt) { bt = t; best = &a; }
    }
    return best;
}

V2 MatchSim::BallLanding() const
{
    V2 p = ball.pos, v = ball.vel; float z = ball.z, vz = ball.vz;
    for (int i = 0; i < 16; i++) { p = p + v * 0.05f; vz -= 9.81f * 0.05f; z += vz * 0.05f; if (z < 0) z = 0; v = v * (z > 0 ? 0.995f : 0.975f); if (z < 1.2f && i > 4) break; }
    return p;
}

V2 MatchSim::Intercept(const Agent& a) const
{
    V2 p = ball.pos, v = ball.vel;
    for (int i = 1; i <= 40; i++) { p = p + v * 0.05f; v = v * 0.975f; if (V2::Dist(a.pos, p) / a.MaxSpeed() <= i * 0.05f) return p; }
    return p;
}

Agent* MatchSim::Presser(int s, Agent* carrier)
{
    float range = 7.f + pressing[s] * 16.f + (U(s, carrier->pos) < 35 ? 8.f : 0.f);
    Agent* n = Nearest(s, carrier->pos, [](const Agent& x) { return !x.gk && x.cooldown <= 0; });
    if (n && n->St("zweikampf")) range *= 1.3f;
    return n && V2::Dist(n->pos, carrier->pos) < range ? n : nullptr;
}

Agent* MatchSim::SecondPresser(int s, Agent* carrier, Agent* first)
{
    Agent* best = nullptr; float bd = 14.f;
    for (auto& a : teams[s]) { if (a.sentOff || a.gk || &a == first) continue; float d = V2::Dist(a.pos, carrier->pos); if (d < bd) { bd = d; best = &a; } }
    return best;
}

Agent* MatchSim::NearestOpp(Agent* carrier)
{
    Agent* best = nullptr; float bd = 20.f;
    for (auto& o : teams[carrier->side]) { if (&o == carrier || o.sentOff || o.gk) continue; float d = V2::Dist(o.pos, carrier->pos); if (d < bd && U(carrier->side, o.pos) > U(carrier->side, carrier->pos) - 4) { bd = d; best = &o; } }
    return best;
}

float MatchSim::OffsideLine(int attSide) const
{
    int d = 1 - attSide; std::vector<float> us;
    for (auto& a : teams[d]) if (!a.sentOff) us.push_back(FieldX - U(d, a.pos));
    std::sort(us.begin(), us.end(), std::greater<float>());
    float line = us.size() > 1 ? us[1] : FieldX / 2;
    return std::max(FieldX / 2, std::max(line, U(attSide, ball.pos)));
}

V2 MatchSim::SupportPos(Agent& a, Agent* carrier)
{
    int s = a.side; const auto& T0 = T(s);
    float bu = U(s, ball.pos), bv = Dir(s) > 0 ? ball.pos.y : FieldY - ball.pos.y;
    float m = (float)mentality[s];
    float center = Clamp(bu + 4.f + m * 3.f, 30.f, 80.f), span = 42.f + m * 3.f;
    float u = center + (a.depth - 0.5f) * span;
    float widthF = 0.82f + T0.width * 0.22f;
    float v = FieldY / 2 + (a.lat - 0.5f) * FieldY * widthF + (bv - FieldY / 2) * 0.18f;
    if (a.role == "DEF" && (a.lat < 0.2f || a.lat > 0.8f) && std::fabs(bv - a.lat * FieldY) < 22) u += 10.f + m * 3.f;
    if (a.role == "DEF" && a.lat >= 0.2f && a.lat <= 0.8f) u = std::min(u, bu - 6.f);
    float off = OffsideLine(s);
    if ((a.role == "FWD" || (a.role == "MID" && a.depth > 0.75f)) && carrier && carrier->p.passing > 50)
    {
        if (a.runTimer <= 0 && !a.running && bu > 35) { a.running = true; a.runTimer = 3.2f; }
        else if (a.running && a.runTimer <= 0) { a.running = false; a.runTimer = 3.f + (float)R() * 4.f; }
        if (a.running) u = std::min(FieldX - 6.f, off + 9.f);
        else u = a.role == "FWD" ? off - 0.8f - (float)(a.slot % 2) * 2.f : std::min(u, off - 0.8f);
    }
    else u = std::min(u, off - 0.8f);
    if (bu > 66 && carrier && &a != carrier)
    {
        if (a.role == "FWD") { u = std::max(u, std::min(off - 0.6f, 95.f - (a.slot % 3) * 2.5f)); v = v + (FieldY / 2 - v) * 0.65f; }
        else if (a.role == "MID" && (a.lat < 0.25f || a.lat > 0.75f) && std::fabs(bv - a.lat * FieldY) > 30) { u = std::max(u, std::min(off - 0.6f, 93.f)); v = FieldY / 2 + (a.lat < 0.5f ? -7.f : 7.f); }
        else if (a.role == "MID" && a.depth > 0.55f) { u = std::max(u, std::min(off - 0.6f, 87.f)); v = v + (FieldY / 2 - v) * 0.35f; }
    }
    V2 pos = FromTeam(s, Clamp(u, 6, FieldX - 3), Clamp(v, 2, FieldY - 2));
    Agent* near = Nearest(1 - s, pos, [](const Agent&) { return true; });
    if (near && !a.running)
    {
        float d = V2::Dist(near->pos, pos);
        if (d < 5.f) { V2 away = (pos - near->pos).Norm(); away = V2(Dir(s) > 0 ? std::min(away.x, 0.2f) : std::max(away.x, -0.2f), away.y); pos = pos + away.Norm() * (5.f - d); }
    }
    return ClampP(pos);
}

V2 MatchSim::DefendPos(Agent& a, Agent* carrier)
{
    int s = a.side; const auto& T0 = T(s);
    float bu = U(s, ball.pos), bv = Dir(s) > 0 ? ball.pos.y : FieldY - ball.pos.y;
    float m = (float)mentality[s];
    float lineU = Clamp(bu - 14.f + (T0.lineHeight - 0.5f) * 12.f + m * 2.5f, 8.f, 50.f);
    float u = a.role == "DEF" ? lineU : Clamp(lineU + 6.f + a.depth * 30.f + m * 2.f, 12.f, bu + 6.f);
    float v = FieldY / 2 + (a.lat - 0.5f) * FieldY * 0.72f + (bv - FieldY / 2) * 0.38f;
    V2 zone = FromTeam(s, u, Clamp(v, 3, FieldY - 3));
    Agent* mark = nullptr; float md = 9.f;
    for (auto& o : teams[1 - s]) { if (o.sentOff || o.gk || &o == carrier) continue; float d = V2::Dist(o.pos, zone); if (d < md) { md = d; mark = &o; } }
    if (mark)
    {
        V2 goal = OwnGoal(s);
        V2 goalSide = mark->pos + (goal - mark->pos).Norm() * 1.8f;
        zone = V2::Lerp(zone, goalSide, a.role == "DEF" ? 0.55f : 0.45f);
        if (a.role == "DEF")
        {
            float mu = U(s, mark->pos);
            bool inBehind = mu < lineU - 1.5f && mark->running;
            float zu = inBehind ? std::max(mu - 1.f, 4.f) : lineU;
            zone = FromTeam(s, zu, Dir(s) > 0 ? zone.y : FieldY - zone.y);
            if (inBehind) a.running = true;
        }
    }
    return ClampP(zone);
}

void MatchSim::KeeperTick(Agent& k)
{
    int s = k.side; V2 goal = OwnGoal(s); float bu = U(s, ball.pos);
    float adv = bu < 25 ? 2.5f : bu < 50 ? 6.f : 13.f;
    V2 dirToBall = (ball.pos - goal).Norm();
    k.target = goal + dirToBall * std::min(adv, V2::Dist(goal, ball.pos) * 0.4f);
    k.target = V2(k.target.x, Clamp(k.target.y, FieldY / 2 - GoalHalf - 1.5f, FieldY / 2 + GoalHalf + 1.5f));
    if (!ball.owner && !ball.shot && InOwnBox(s, ball.pos) && ball.z < 2.2f) { k.target = ball.pos; k.running = true; }
}

// ======================================================================= carrier
void MatchSim::CarrierTick(Agent& a, float dt)
{
    int s = a.side; a.running = true; a.decide -= dt;
    V2 goal = OppGoal(s); float d = V2::Dist(a.pos, goal); float pressure = Pressure(a);
    if (a.decide > 0) { a.target = DribbleTarget(a, pressure); return; }
    a.decide = 0.22f + (float)R() * 0.18f;
    if (a.gk) { KeeperDistribute(a); return; }

    float xg = Xg(a.pos, goal) * (1.f - 0.45f * pressure);
    float m = (float)mentality[s];
    float shootBar = 0.034f - m * 0.007f + (float)R() * 0.032f - (a.role == "FWD" ? 0.008f : 0.f) - (a.St("knipser") ? 0.012f : 0.f);
    if (d < 31 && (xg > shootBar || (d < 12 && xg > 0.03f)) && !(pressure > 0.9f && d > 20)) { Shoot(a, xg, pressure); return; }

    Agent* bestR = nullptr; V2 bestPt; float bestV = -1e9f; bool bestLob = false;
    float tempo = T(s).tempo;
    for (auto& r : teams[s])
    {
        if (&r == &a || r.sentOff) continue;
        if (r.gk && U(s, a.pos) > 30) continue;
        V2 pt = r.pos + r.vel * (r.running ? 0.85f : 0.3f);
        if (r.running && r.role != "DEF") pt = pt + (goal - pt).Norm() * 2.5f;
        pt = ClampP(pt);
        float dist = V2::Dist(a.pos, pt);
        if (dist < 5.f || dist > 55.f) continue;
        bool offside = U(s, r.pos) > OffsideLine(s) + 0.3f && U(s, r.pos) > FieldX / 2;
        if (offside && R() < 0.5) continue;
        float lane = LaneSafety(a.pos, pt, s);
        bool lob = lane < 1.6f && dist > 18.f && a.p.passing > 55;
        float x = (lob ? 1.6f : lane) * 1.7f - 1.8f + a.p.passing / 40.f - dist / 32.f - pressure * 0.7f;
        float p = 1.f / (1.f + std::exp(-x));
        float progress = U(s, pt) - U(s, a.pos), threat = Threat(s, pt), open = OpenSpace(pt, s);
        float v = p * (1.0f + threat * 3.4f + progress / 30.f * (0.7f + tempo * 0.8f + m * 0.15f) * (a.St("spielmacher") && progress > 0 ? 1.6f : 1.f) + std::min(open, 8.f) / 16.f) - (1 - p) * (1.0f + (U(s, a.pos) < 35 ? 1.4f : 0.f)) * (a.St("ballsicher") ? 1.3f : 1.f);
        if (a.St("knipser") && U(s, a.pos) > 70) v -= 0.25f;
        if (U(s, a.pos) > 68 && progress < -4) v -= 0.5f;
        if (InOppBox(s, pt) && open > 2.5f) v += 0.6f;
        if (r.gk) v -= 0.8f;
        if (v > bestV) { bestV = v; bestR = &r; bestPt = pt; bestLob = lob; }
    }
    if (U(s, a.pos) > 76 && std::fabs(a.pos.y - FieldY / 2) > 13 && a.p.passing > 45)
    {
        std::vector<Agent*> inBox;
        for (auto& x : teams[s]) if (&x != &a && !x.sentOff && !x.gk && InOppBox(s, x.pos)) inBox.push_back(&x);
        float crossV = 0.8f + inBox.size() * 0.45f + (U(s, a.pos) > 90 ? 0.4f : 0.f) + m * 0.1f;
        if (inBox.empty() && SpaceAhead(a) > 3.f && U(s, a.pos) < 97) wideHold = true;
        else if (!inBox.empty() && (crossV > bestV || R() < (U(s, a.pos) > 86 ? 0.85 : 0.5) + (a.St("fluegel") ? 0.25 : 0.0)))
        {
            Agent* tgt = inBox[RI((int)inBox.size())];
            int defCount = 0; for (auto& x : teams[1 - s]) if (!x.sentOff && InOwnBox(1 - s, x.pos)) defCount++;
            Agent* defn = Nearest(1 - s, tgt->pos, [&](const Agent& x) { return InOwnBox(1 - s, x.pos); });
            float atk = tgt->p.physical * 0.5f + tgt->p.shooting * 0.3f + a.p.passing * 0.2f, def = defn ? defn->p.defending * 0.5f + defn->p.physical * 0.5f : 25.f;
            bool won = R() < Clamp(0.30f + (atk - def) / 180.f - defCount * 0.015f, 0.12f, 0.6f);
            Pass(a, won ? tgt : (defn ? defn : tgt), tgt->pos + V2(0, Gauss()), true);
            ball.intended = won ? tgt : defn; cornerHeader = won ? tgt : nullptr; clearer = won ? nullptr : defn;
            return;
        }
    }
    float space = SpaceAhead(a);
    if (wideHold) { wideHold = false; a.target = ClampP(V2(OppGoal(s).x - Dir(s) * 3.f, a.pos.y + (FieldY / 2 - a.pos.y) * 0.15f)); a.decide = 0.45f; return; }
    float dribbleV = (space > 5.f ? 0.75f + Threat(s, a.pos) * 2.6f : space > 2.5f ? 0.1f + Threat(s, a.pos) * 1.6f : -0.4f) + (a.p.dribbling - 60) / 60.f - pressure * 0.8f + (U(s, a.pos) > 68 ? 0.45f : 0.f) + m * 0.08f + (a.St("dribbler") ? 0.35f : a.St("fluegel") ? 0.12f : 0.f);
    float holdV = pressure < 0.35f ? 0.25f : -0.6f;
    if (bestR && bestV > dribbleV && bestV > holdV) { Pass(a, bestR, bestPt, bestLob); return; }
    if (pressure > 0.8f && bestR) { Pass(a, bestR, bestPt, bestLob); return; }
    a.target = DribbleTarget(a, pressure);
    a.decide *= dribbleV > holdV ? 1.4f : 1.f;
}

V2 MatchSim::DribbleTarget(Agent& a, float)
{
    int s = a.side; V2 goal = OppGoal(s); V2 fwd = (goal - a.pos).Norm();
    if (U(s, a.pos) < 75 && std::fabs(a.pos.y - FieldY / 2) > 15) fwd = V2((float)Dir(s), 0);
    Agent* opp = Nearest(1 - s, a.pos, [](const Agent&) { return true; });
    if (opp)
    {
        V2 away = a.pos - opp->pos; float d = away.Len();
        float vside = ((a.pos.y - opp->pos.y) >= 0 ? 1.f : -1.f) * (float)Dir(a.side);
        if (d < 6.f) fwd = (fwd + V2(-away.y, away.x).Norm() * (vside * 0.9f) + away.Norm() * 0.4f).Norm();
    }
    return ClampP(a.pos + fwd * 6.f);
}

float MatchSim::Pressure(const Agent& a) const
{
    float p = 0; for (auto& o : teams[1 - a.side]) { if (o.sentOff) continue; float d = V2::Dist(o.pos, a.pos); if (d < 6.f) p += (6.f - d) / 6.f; }
    return std::min(1.f, p);
}
float MatchSim::SpaceAhead(const Agent& a) const
{
    float best = 30.f; V2 dir = (OppGoal(a.side) - a.pos).Norm();
    for (auto& o : teams[1 - a.side]) { if (o.sentOff) continue; V2 rel = o.pos - a.pos; float ahead = V2::Dot(rel, dir); if (ahead < 0 || ahead > 30) continue; float side = std::fabs(rel.x * dir.y - rel.y * dir.x); if (side < 4.f) best = std::min(best, ahead); }
    return best;
}
float MatchSim::OpenSpace(V2 p, int s) const { float best = 30.f; for (auto& o : teams[1 - s]) if (!o.sentOff) best = std::min(best, V2::Dist(o.pos, p)); return best; }
float MatchSim::LaneSafety(V2 from, V2 to, int s) const
{
    float best = 20.f; V2 d = to - from; float L = d.Len(); if (L < 0.1f) return best; V2 n = d * (1.f / L);
    for (auto& o : teams[1 - s])
    {
        if (o.sentOff) continue;
        V2 rel = o.pos - from; float t = V2::Dot(rel, n);
        if (t < 0 || t > L + 1) continue;
        float perp = std::fabs(rel.x * n.y - rel.y * n.x);
        float reach = 1.f + t / 18.f * (o.gk ? 1.8f : 1.f);
        best = std::min(best, perp - reach + 1.5f);
    }
    return best;
}
float MatchSim::Threat(int s, V2 p) const
{
    float u = U(s, p), v = std::fabs(p.y - FieldY / 2);
    float t = std::max(0.f, (u - 55.f) / 50.f);
    if (u > 88 && v < 20) t += 0.35f;
    return t * (1.f - std::min(0.6f, v / 70.f));
}
float MatchSim::Xg(V2 p, V2 goal)
{
    float d = V2::Dist(p, goal);
    V2 l = V2(goal.x, goal.y - GoalHalf) - p, r = V2(goal.x, goal.y + GoalHalf) - p;
    float ang = std::fabs(std::atan2(l.x * r.y - l.y * r.x, l.x * r.x + l.y * r.y));
    float af = Clamp(ang / 0.5f, 0.12f, 1.25f);
    return Clamp(0.95f * std::exp(-0.11f * d) * af, 0.005f, 0.8f);
}

// ======================================================================= actions
void MatchSim::Pass(Agent& a, Agent* r, V2 pt, bool lob)
{
    Stats(a.side).passes++;
    float dist = V2::Dist(a.pos, pt);
    float err = (1.12f - a.p.passing / 100.f) * 0.11f * (1.f + Pressure(a) * 0.8f) * (lob ? 1.3f : 1.f) * (a.St("ballsicher") ? 0.75f : a.St("spielmacher") ? 0.85f : 1.f);
    a.passes++;
    float ang = std::atan2(pt.y - a.pos.y, pt.x - a.pos.x) + Gauss() * err;
    float spd = lob ? Clamp(dist * 0.62f + 6.f, 12.f, 24.f) : Clamp(dist * 0.95f + 7.f, 9.f, 27.f);
    ball.owner = nullptr; ball.lastTouch = &a; ball.passer = &a; ball.intended = r; ball.shot = false; ball.offsideAt = nullptr;
    if (phase == Phase::Play || phase == Phase::FreeKick)
    {
        float off = OffsideLine(a.side);
        for (auto& t : teams[a.side]) if (&t != &a && !t.sentOff && !t.gk && U(a.side, t.pos) > FieldX / 2 && U(a.side, t.pos) > off + 0.5f && &t == r) ball.offsideAt = r;
    }
    ball.vel = V2(std::cos(ang), std::sin(ang)) * spd;
    if (lob) { float tFlight = dist / spd; ball.vz = 9.81f * tFlight * 0.5f; ball.z = 0.2f; }
    a.anim = "kick"; a.animT = 0; a.cooldown = 0.35f; a.facing = ang;
}

void MatchSim::KeeperDistribute(Agent& k)
{
    int s = k.side; Agent* best = nullptr; float bv = -1e9f;
    for (auto& r : teams[s])
    {
        if (&r == &k || r.sentOff) continue;
        float lane = LaneSafety(k.pos, r.pos, s), open = OpenSpace(r.pos, s);
        float v = std::min(lane, 6.f) + std::min(open, 10.f) * 0.5f + (r.role == "DEF" ? 1.5f : 0.f) - V2::Dist(k.pos, r.pos) / 20.f;
        if (v > bv) { bv = v; best = &r; }
    }
    if (best && bv > 4.f) Pass(k, best, best->pos, false);
    else
    {
        Agent* fw = Nearest(s, OppGoal(s), [](const Agent& x) { return x.role == "FWD"; });
        if (!fw) fw = best;
        if (fw) Pass(k, fw, fw->pos, true);
    }
}

Agent* MatchSim::FindGK(int team) { for (auto& x : teams[team]) if (x.gk && !x.sentOff) return &x; return nullptr; }

void MatchSim::Shoot(Agent& a, float xg, float pressure)
{
    int s = a.side; auto& S = Stats(s); S.shots++; S.xg += xg; a.shots++;
    shooter = &a; shotXg = xg;
    V2 goal = OppGoal(s);
    float onTarget = Clamp(0.30f + a.p.shooting / 260.f - pressure * 0.18f + (xg > 0.25f ? 0.12f : 0.f), 0.15f, 0.8f);
    Agent* keeper = FindGK(1 - s);
    float gkF = keeper ? keeper->p.gk / 100.f : 0.3f;
    float pGoal = Clamp(xg * (0.86f + a.p.shooting / 170.f) * (1.32f - 0.6f * gkF) * (1.f + (str[s] - str[1 - s]) / 80.f), 0.003f, 0.92f);
    bool blocked = false;
    for (auto& o : teams[1 - s]) { if (o.sentOff || o.gk) continue; V2 rel = o.pos - a.pos, n = (goal - a.pos).Norm(); float t = V2::Dot(rel, n); if (t > 0.8f && t < 6.f && std::fabs(rel.x * n.y - rel.y * n.x) < 0.8f && R() < 0.45) { blocked = true; break; } }
    double r = R(); std::string outcome;
    if (blocked) outcome = "block"; else if (r < pGoal) outcome = "goal"; else if (r < onTarget) outcome = "save"; else outcome = R() < 0.12 ? "post" : "miss";
    shotOutcome = outcome; shotKeeper = keeper;
    if (outcome == "goal" || outcome == "save") S.onTarget++;
    float aimY = goal.y + (float)(R() * 2 - 1) * (GoalHalf - 0.45f);
    float aimZ = (float)R() * 2.0f + 0.1f;
    if (outcome == "miss") { aimY = goal.y + (R() < 0.5 ? -1.f : 1.f) * (GoalHalf + 0.6f + (float)R() * 3.f); if (R() < 0.4) aimZ = 2.7f + (float)R(); }
    if (outcome == "post") aimY = goal.y + (R() < 0.5 ? -1.f : 1.f) * GoalHalf;
    if (outcome == "save" && keeper) aimY = goal.y + (aimY - goal.y) * 0.55f;
    V2 tgt(goal.x, aimY);
    float dist = V2::Dist(a.pos, tgt), spd = Clamp(22.f + a.p.shooting / 10.f, 22.f, 33.f);
    ball.owner = nullptr; ball.lastTouch = &a; ball.passer = nullptr; ball.intended = nullptr; ball.shot = true;
    ball.vel = (tgt - a.pos).Norm() * spd; float tf = dist / spd; ball.vz = (aimZ + 4.9f * tf * tf) / tf; ball.z = 0.15f;
    a.anim = "kick"; a.animT = 0; a.cooldown = 0.6f;
    if (outcome == "block")
    {
        ball.vel = R() < 0.4 ? V2(ball.vel.x * 0.5f, ball.vel.y * 0.5f + Gauss() * 4.f) : ball.vel * -0.3f; ball.vz = 2.f; ball.shot = false;
        Agent* blk = Nearest(1 - s, a.pos, [](const Agent& x) { return !x.gk; }); ball.lastTouch = blk ? blk : &a;
        Emit("shot", s, a.p.id, 0, xg, "Schuss geblockt");
    }
    else Emit("shot", s, a.p.id, 0, xg, "Schuss");
}

void MatchSim::TryTackle(Agent& d, Agent& c)
{
    if (d.cooldown > 0 || ball.owner != &c || V2::Dist(d.pos, c.pos) > 1.5f) return; // only while he still has the ball
    d.cooldown = 0.45f;
    float pWin = Clamp(0.26f + (d.p.defending - c.p.dribbling) / 160.f + pressing[d.side] * 0.06f + (d.St("zweikampf") ? 0.06f : 0.f), 0.07f, 0.66f);
    double r = R(); d.anim = "tackle"; d.animT = 0;
    if (r < pWin)
    {
        Stats(d.side).tackles++; d.rating += 0.12f; d.tackles++;
        ball.owner = R() < 0.55 ? &d : nullptr; ball.lastTouch = &d; ball.intended = nullptr;
        if (!ball.owner) ball.vel = (c.pos - d.pos).Norm() * 4.f + V2(Gauss() * 3, Gauss() * 3);
        c.cooldown = 0.6f;
    }
    else if (r < pWin + (0.065f + (1.f - d.p.defending / 100.f) * 0.06f) * (d.St("zweikampf") ? 1.25f : 1.f) * (0.8f + d.p.temper * 0.5f)) Foul(d, c);
    else d.cooldown = 0.9f;
}

void MatchSim::Foul(Agent& d, Agent& c)
{
    auto& S = Stats(d.side); S.fouls++; d.rating -= 0.15f;
    Emit("foul", d.side, d.p.id, c.p.id, 0, "Foul von " + d.p.name);
    double card = R();
    if (card < 0.005 || (card < 0.15 && d.yellow == 1)) { d.sentOff = true; S.red++; d.rating -= 1.f; Emit("red", d.side, d.p.id, 0, 0, "Rot für " + d.p.name); d.pos = V2(FieldX / 2, -3); }
    else if (card < 0.15 * (0.75 + d.p.temper * 0.6)) { d.yellow++; S.yellow++; Emit("yellow", d.side, d.p.id, 0, 0, "Gelb für " + d.p.name); }
    int att = c.side;
    if (InOwnBox(d.side, c.pos)) { StartRestart(Phase::Penalty, att, PenaltySpot(att)); Emit("penalty", att, c.p.id, 0, 0.76f, "Elfmeter!"); }
    else StartRestart(Phase::FreeKick, att, c.pos);
}

// ======================================================================= restarts
void MatchSim::StartRestart(Phase ph, int side, V2 at)
{
    phase = ph; restartSide = side; restartPos = ClampP(at);
    phaseTimer = ph == Phase::Penalty ? 3.f : ph == Phase::Corner ? 2.4f : ph == Phase::FreeKick ? 2.f : 1.4f;
    ball.owner = nullptr; ball.vel = V2(); ball.z = 0; ball.vz = 0; ball.pos = restartPos; ball.shot = false; ball.intended = nullptr;
    if (ph == Phase::GoalKick) taker = FindGK(side);
    else if (ph == Phase::Penalty) taker = Best(side, [](const Agent& x) { return (float)x.p.shooting; });
    else if (ph == Phase::Corner || (ph == Phase::FreeKick && V2::Dist(at, OppGoal(side)) < 30)) taker = Best(side, [](const Agent& x) { return x.p.passing + x.p.shooting * 0.5f; });
    else taker = Nearest(side, at, [](const Agent& x) { return !x.gk; });
}

void MatchSim::RestartTick(float dt)
{
    phaseTimer -= dt; int s = restartSide;
    for (auto& t : teams) for (auto& a : t) { if (a.sentOff) continue; a.running = false; a.target = RestartPos(a); }
    if (taker) taker->target = restartPos - (OppGoal(s) - restartPos).Norm() * 0.7f;
    if (phaseTimer > 0) return;
    if (!taker || taker->sentOff) { phase = Phase::Play; return; }
    taker->pos = restartPos - (OppGoal(s) - restartPos).Norm() * 0.6f;
    ball.pos = restartPos;
    Phase ph = phase; phase = Phase::Play;
    switch (ph)
    {
    case Phase::Penalty:
    {
        auto& S = Stats(s); S.shots++; S.xg += 0.76f; shooter = taker; shotXg = 0.76f;
        Agent* keeper = FindGK(1 - s);
        float pGoal = Clamp(0.78f + (taker->p.shooting - 70) / 300.f - ((keeper ? keeper->p.gk : 50) - 70) / 300.f, 0.55f, 0.9f);
        double r = R();
        shotOutcome = r < pGoal ? "goal" : r < pGoal + 0.13f ? "save" : "miss"; shotKeeper = keeper;
        if (shotOutcome != "miss") S.onTarget++;
        V2 goal = OppGoal(s); float y = goal.y + (R() < 0.5 ? -1.f : 1.f) * (float)(1.2 + R() * 2.2);
        if (shotOutcome == "miss") y = goal.y + (R() < 0.5 ? -1.f : 1.f) * 4.6f;
        ball.vel = (V2(goal.x, y) - ball.pos).Norm() * 26.f; ball.vz = 2.2f; ball.z = 0.1f; ball.shot = true; ball.lastTouch = taker; ball.passer = nullptr;
        taker->anim = "kick"; taker->animT = 0;
        Emit("shot", s, taker->p.id, 0, 0.76f, "Elfmeter");
        break;
    }
    case Phase::Corner:
    {
        Stats(s).corners++;
        std::vector<Agent*> targets;
        for (auto& x : teams[s]) if (!x.sentOff && !x.gk && &x != taker && InOppBox(s, x.pos)) targets.push_back(&x);
        Agent* tk = taker;
        Agent* tgt = !targets.empty() ? targets[RI((int)targets.size())] : Nearest(s, OppGoal(s), [tk](const Agent& x) { return &x != tk && !x.gk; });
        if (!tgt) break;
        Agent* defn = Nearest(1 - s, tgt->pos, [&](const Agent& x) { return InOwnBox(1 - s, x.pos); });
        float atk = tgt->p.physical * 0.6f + tgt->p.shooting * 0.4f, def = defn ? defn->p.defending * 0.5f + defn->p.physical * 0.5f : 30.f;
        bool won = R() < Clamp(0.33f + (atk - def) / 200.f + taker->p.passing / 600.f, 0.12f, 0.62f);
        Pass(*taker, won ? tgt : (defn ? defn : tgt), tgt->pos, true);
        ball.intended = won ? tgt : defn; cornerHeader = won ? tgt : nullptr; clearer = won ? nullptr : defn;
        break;
    }
    case Phase::FreeKick:
    {
        float d = V2::Dist(restartPos, OppGoal(s));
        if (d < 28 && std::fabs(restartPos.y - FieldY / 2) < 18 && R() < 0.6)
        {
            float xg = Clamp(0.09f - (d - 18) * 0.004f + (taker->p.shooting - 70) / 900.f, 0.025f, 0.12f);
            Shoot(*taker, xg, 0.f);
        }
        else { taker->decide = 0; ball.owner = taker; CarrierTick(*taker, 0); }
        break;
    }
    case Phase::Kickoff:
    {
        Agent* tk = taker;
        Agent* mate = Nearest(s, ball.pos, [tk](const Agent& x) { return &x != tk && !x.gk; });
        if (mate) Pass(*taker, mate, mate->pos, false);
        break;
    }
    default:
    {
        ball.owner = taker; taker->decide = 0;
        if (ph == Phase::GoalKick) KeeperDistribute(*taker); else CarrierTick(*taker, 0);
        if (ball.owner == taker) { taker->decide = 0; CarrierTick(*taker, 0); }
        break;
    }
    }
}

V2 MatchSim::RestartPos(Agent& a)
{
    int s = a.side; bool att = s == restartSide;
    if (phase == Phase::Corner || (phase == Phase::FreeKick && V2::Dist(restartPos, OppGoal(restartSide)) < 32))
    {
        V2 goal = OppGoal(restartSide);
        if (a.gk) return s == restartSide ? FromTeam(s, std::min(40.f, U(s, a.pos)), FieldY / 2) : OwnGoal(s) + (restartPos - OwnGoal(s)).Norm() * 1.2f;
        int i = a.slot;
        if (att && ((a.role == "DEF" && a.lat > 0.25f && a.lat < 0.75f) || a.role == "FWD" || a.depth > 0.6f))
            return ClampP(goal + V2(-Dir(restartSide) * (5.f + (i % 3) * 3.5f), (i % 5 - 2) * 3.2f));
        if (!att && a.role != "FWD") return ClampP(goal + V2(-Dir(restartSide) * (2.5f + (i % 4) * 2.6f), (i % 6 - 2.5f) * 2.6f));
        return a.pos;
    }
    if (phase == Phase::Penalty)
    {
        if (&a == taker) return restartPos;
        if (a.gk && s != restartSide) return OwnGoal(s);
        return ClampP(V2(Dir(restartSide) > 0 ? FieldX - 22.f : 22.f, FieldY / 2 + (a.slot - 5) * 3.f + s * 1.5f));
    }
    return s == restartSide ? SupportPos(a, taker ? taker : &a) : DefendPos(a, nullptr);
}

// ======================================================================= physics
void MatchSim::MovePlayers(float dt)
{
    for (int s = 0; s < 2; s++) for (auto& a : teams[s])
    {
        if (a.sentOff) { a.vel = V2(); continue; }
        a.animT += dt;
        if (phase == Phase::Celebration && lastScorer && lastScorer->side == s) a.target = lastScorer->pos + V2((a.slot % 3 - 1) * 1.5f, (a.slot % 2) * 1.5f);
        V2 to = a.target - a.pos; float d = to.Len();
        float max = a.MaxSpeed() * (a.running || d > 8 ? 1.f : 0.55f);
        if (&a == ball.owner) max *= 0.82f + a.p.dribbling / 1000.f;
        if (phase != Phase::Play && phase != Phase::Celebration) max *= 0.75f;
        V2 want = d > 0.25f ? to.Norm() * std::min(max, d * 2.2f) : V2();
        float accel = 7.f + a.p.pace / 25.f;
        V2 dv = want - a.vel; float dvl = dv.Len();
        if (dvl > accel * dt) dv = dv * (accel * dt / dvl);
        a.vel = a.vel + dv; a.pos = ClampP(a.pos + a.vel * dt, -2.f);
        float sp = a.vel.Len();
        if (sp > 0.3f) a.facing = std::atan2(a.vel.y, a.vel.x);
        else if (phase == Phase::Play || ball.owner != &a) a.facing = std::atan2(ball.pos.y - a.pos.y, ball.pos.x - a.pos.x);
        a.stamina = std::max(0.25f, a.stamina - (sp > 6.5f ? 0.0006f : sp > 3.f ? 0.00012f : -0.00008f) * (1.4f - a.p.physical / 100.f) * dt * 20.f);
        if ((a.anim == "kick" && a.animT > 0.45f) || (a.anim == "tackle" && a.animT > 0.6f) || (a.anim == "dive" && a.animT > 1.2f) || (a.anim == "header" && a.animT > 0.6f)) a.anim = "run";
        if (phase == Phase::Celebration && lastScorer && a.side == lastScorer->side) a.anim = "celebrate";
        else if (a.anim == "run" || a.anim == "idle" || a.anim == "celebrate") a.anim = sp > 0.4f ? "run" : "idle";
    }
    for (int s = 0; s < 2; s++) for (auto& a : teams[s]) for (auto& b : teams[s])
    {
        if (&a == &b || a.sentOff || b.sentOff) continue;
        V2 r = a.pos - b.pos; float d = r.Len();
        if (d < 1.1f && d > 0.01f) a.pos = a.pos + r.Norm() * ((1.1f - d) * 0.5f);
    }
}

void MatchSim::BallTick(float dt)
{
    if (phase == Phase::Celebration || phase == Phase::HalfTime) { ball.vel = ball.vel * 0.9f; ball.pos = ball.pos + ball.vel * dt; return; }
    if (phase != Phase::Play) { ball.pos = restartPos; ball.z = 0; return; }
    if (Agent* o = ball.owner)
    {
        V2 dir(std::cos(o->facing), std::sin(o->facing));
        V2 want = o->pos + dir * 0.75f;
        ball.vel = (want - ball.pos) * (1.f / dt) * 0.5f;
        ball.pos = V2::Lerp(ball.pos, want, 0.5f); ball.z = 0; ball.vz = 0;
        return;
    }
    ball.pos = ball.pos + ball.vel * dt;
    if (ball.z > 0 || ball.vz > 0)
    {
        ball.vz -= 9.81f * dt; ball.z += ball.vz * dt;
        if (ball.z <= 0) { ball.z = 0; if (ball.vz < -2.5f) { ball.vz = -ball.vz * 0.45f; ball.vel = ball.vel * 0.8f; } else ball.vz = 0; }
        ball.vel = ball.vel * (1.f - 0.08f * dt);
    }
    else ball.vel = ball.vel * (1.f - 0.9f * dt);

    if (CheckGoalOrOut()) return;
    if (ball.shot) { ShotFlight(); return; }

    Agent* best = nullptr; float bestD = 9.f; float bspeed = ball.vel.Len();
    for (auto& t : teams) for (auto& a : t)
    {
        if (a.sentOff || a.cooldown > 0 || (&a == ball.passer && bspeed > 6.f)) continue;
        float d = V2::Dist(a.pos, ball.pos);
        float reach = (a.gk && InOwnBox(a.side, ball.pos) ? 1.6f : 0.95f) + (bspeed < 4 ? 0.3f : 0.f);
        if (d > reach || ball.z > (a.gk ? 2.6f : 1.9f)) continue;
        if (d < bestD) { bestD = d; best = &a; }
    }
    if (!best) return;
    bool friendly = ball.lastTouch && ball.lastTouch->side == best->side;
    bool intended = best == ball.intended;
    float ctrl = intended ? 0.97f : friendly ? 0.85f : Clamp(0.32f + best->p.defending / 220.f - bspeed / 60.f + (best->gk ? 0.4f : 0.f), 0.1f, 0.9f);
    if (ball.z > 1.2f && !best->gk) { best->anim = "header"; best->animT = 0; }
    if (cornerHeader && best == cornerHeader && ball.z > 0.8f)
    {
        cornerHeader = nullptr; best->anim = "header"; best->animT = 0;
        float xg = Clamp(Xg(best->pos, OppGoal(best->side)) * 0.55f, 0.03f, 0.25f);
        ball.owner = best; Shoot(*best, xg, 0.5f); ball.vz = std::min(ball.vz, 3.f); return;
    }
    cornerHeader = nullptr;
    if (clearer && best == clearer && ball.z > 0.6f)
    {
        clearer = nullptr; best->anim = "header"; best->animT = 0; best->rating += 0.08f;
        if (R() < 0.33) { ball.vel = V2(Dir(best->side) * -9.f, (best->pos.y < FieldY / 2 ? -1.f : 1.f) * 3.f); ball.vz = 4.f; }
        else { ball.vel = V2(Dir(best->side) * (14.f + (float)R() * 8.f), Gauss() * 6.f); ball.vz = 6.f; }
        ball.lastTouch = best; ball.intended = nullptr; ball.passer = nullptr; best->cooldown = 0.3f; return;
    }
    clearer = nullptr;
    if (R() < ctrl)
    {
        if (ball.passer && ball.passer->side == best->side && best != ball.passer)
        {
            if (ball.offsideAt == best && R() < 0.93)
            {
                Stats(best->side).offsides++; Emit("offside", best->side, best->p.id, 0, 0, "Abseits");
                StartRestart(Phase::FreeKick, 1 - best->side, best->pos); return;
            }
            Stats(best->side).passesOk++; ball.passer->rating += 0.03f; ball.passer->passesOk++; lastPasser[best->side] = ball.passer;
        }
        else if (ball.passer && ball.passer->side != best->side) { ball.passer->rating -= 0.06f; best->rating += 0.05f; }
        if (best->side != (ball.lastTouch ? ball.lastTouch->side : best->side)) lastPasser[best->side] = nullptr;
        ball.owner = best; ball.lastTouch = best; ball.intended = nullptr; ball.passer = nullptr; best->decide = best->gk ? 0.8f : 0.12f + (float)R() * 0.15f;
    }
    else
    {
        ball.vel = V2(ball.vel.x * -0.3f + Gauss() * 3.f, ball.vel.y * -0.3f + Gauss() * 3.f); ball.lastTouch = best; ball.intended = nullptr; best->cooldown = 0.35f;
    }
}

void MatchSim::ShotFlight()
{
    int att = ball.lastTouch ? ball.lastTouch->side : 0;
    Agent* k = shotKeeper;
    if (k && shotOutcome == "save" && V2::Dist(k->pos, ball.pos) < 3.2f)
    {
        k->anim = "dive"; k->animT = 0; Stats(k->side).saves++; k->rating += 0.35f; k->saves++;
        Emit("save", k->side, k->p.id, shooter ? shooter->p.id : 0, shotXg, "Parade von " + k->p.name);
        if (shotXg >= 0.28f) MarkClip("save", 1 - k->side, shooter ? shooter->p.id : 0, "Glanzparade " + k->p.name);
        ball.shot = false;
        if (R() < 0.5) { ball.owner = k; ball.vel = V2(); ball.z = 0; ball.vz = 0; ball.lastTouch = k; k->decide = 1.2f; }
        else if (R() < 0.55) { ball.vel = V2(Dir(att) * 7.f, (ball.pos.y < FieldY / 2 ? -1.f : 1.f) * 6.f); ball.vz = 3.f; ball.lastTouch = k; }
        else { ball.vel = V2(-Dir(att) * 6.f, Gauss() * 9.f); ball.vz = 3.f; ball.lastTouch = k; }
        shotOutcome.clear();
    }
    else if (k && (shotOutcome == "goal" || shotOutcome == "miss" || shotOutcome == "post") && V2::Dist(k->pos, ball.pos) < 4.f && k->anim != "dive") { k->anim = "dive"; k->animT = 0; }
}

bool MatchSim::CheckGoalOrOut()
{
    V2 p = ball.pos;
    if (p.x < 0 || p.x > FieldX)
    {
        int defSide = p.x < 0 ? (Dir(0) > 0 ? 0 : 1) : (Dir(0) > 0 ? 1 : 0);
        int attSide = 1 - defSide;
        bool inGoal = std::fabs(p.y - FieldY / 2) < GoalHalf && ball.z < 2.44f;
        if (shotOutcome == "post" && ball.shot) { Emit("post", attSide, shooter ? shooter->p.id : 0, 0, shotXg, "Aluminium!"); MarkClip("post", attSide, shooter ? shooter->p.id : 0, "Aluminium!"); ball.vel = V2(-ball.vel.x * 0.4f, ball.vel.y * 0.6f); ball.pos = V2(Clamp(p.x, 0.2f, FieldX - 0.2f), p.y); ball.shot = false; shotOutcome.clear(); return false; }
        if (inGoal && ball.shot && shotOutcome == "goal") { Goal(attSide); return true; }
        if (inGoal && !ball.shot && ball.lastTouch && R() < 0.3) { Goal(attSide); return true; }
        if (ball.shot && shotOutcome == "miss") Emit("miss", attSide, shooter ? shooter->p.id : 0, 0, shotXg, "Vorbei");
        ball.shot = false; shotOutcome.clear();
        bool lastDef = ball.lastTouch && ball.lastTouch->side == defSide;
        float x = p.x < 0 ? 0.f : FieldX;
        if (lastDef) { StartRestart(Phase::Corner, attSide, V2(x, p.y < FieldY / 2 ? 0.5f : FieldY - 0.5f)); Emit("corner", attSide, 0, 0, 0, "Ecke"); }
        else StartRestart(Phase::GoalKick, defSide, V2(x == 0 ? 5.5f : FieldX - 5.5f, FieldY / 2 + (p.y < FieldY / 2 ? -6.f : 6.f)));
        return true;
    }
    if (p.y < 0 || p.y > FieldY)
    {
        int side = ball.lastTouch ? 1 - ball.lastTouch->side : 0;
        StartRestart(Phase::ThrowIn, side, V2(Clamp(p.x, 1, FieldX - 1), p.y < 0 ? 0.2f : FieldY - 0.2f));
        ball.shot = false; shotOutcome.clear();
        return true;
    }
    return false;
}

void MatchSim::Goal(int side)
{
    score[side]++; Stats(side).goals++;
    Agent* sc = ball.lastTouch && ball.lastTouch->side == side ? ball.lastTouch : nullptr;
    Agent* assist = sc ? lastPasser[side] : nullptr;
    if (assist == sc) assist = nullptr;
    if (sc) { sc->goals++; sc->rating += 1.0f; }
    if (assist) { assist->assists++; assist->rating += 0.6f; }
    for (auto& x : teams[1 - side]) if (x.gk) { x.rating -= 0.25f; break; }
    lastScorer = sc ? sc : ball.lastTouch;
    Emit("goal", side, sc ? sc->p.id : 0, assist ? assist->p.id : 0, shotXg, sc ? "TOR! " + sc->p.name : std::string("TOR! (Eigentor)"));
    MarkClip("goal", side, sc ? sc->p.id : 0, sc ? "TOR! " + sc->p.name : std::string("Eigentor"));
    phase = Phase::Celebration; phaseTimer = 6.f; restartSide = 1 - side;
    ball.shot = false; shotOutcome.clear(); ball.owner = nullptr; ball.vel = ball.vel * 0.15f; ball.intended = nullptr;
    if (lastScorer) lastScorer->target = ClampP(V2(lastScorer->pos.x, lastScorer->pos.y < FieldY / 2 ? 1.f : FieldY - 1.f));
    lastPasser[0] = lastPasser[1] = nullptr;
}

PlayerRating MatchSim::RatingOf(const Agent& a, int s)
{
    PlayerRating r; r.id = a.p.id; r.side = s; r.rating = std::round(Clamp(a.rating, 3.f, 10.f) * 10.f) / 10.f; r.goals = a.goals; r.assists = a.assists; r.minutes = std::round(a.minutes);
    r.passes = a.passes; r.passesOk = a.passesOk; r.shots = a.shots; r.tackles = a.tackles; r.saves = a.saves; r.heat = a.heat;
    return r;
}

void MatchSim::Finish()
{
    finished = true; phase = Phase::FullTime;
    summary.homeGoals = score[0]; summary.awayGoals = score[1];
    float tot = possTime[0] + possTime[1];
    summary.home.possession = tot > 0 ? std::round(possTime[0] / tot * 100.f) : 50.f; summary.away.possession = 100.f - summary.home.possession;
    for (int s = 0; s < 2; s++) for (auto& a : teams[s])
        summary.ratings.push_back(RatingOf(a, s));
    Emit("fulltime", -1, 0, 0, 0, "Abpfiff " + std::to_string(score[0]) + ":" + std::to_string(score[1]));
}

void MatchSim::Emit(const std::string& type, int side, int player, int assist, float xg, const std::string& text)
{
    int mn = std::max(0, std::min(half == 1 ? 45 : 90, (int)std::ceil(time / HalfSeconds * 45.f)));
    MatchEvent e{type, std::max(1, mn), side, player, assist, std::round(xg * 100.f) / 100.f, text};
    if (type == "clip" || type == "formation") { if (onEvent) onEvent(e); return; }
    if ((type != "shot" && type != "miss") || (type == "shot" && xg > 0.25f)) summary.events.push_back(e);
    if (onEvent) onEvent(e);
}

Agent* MatchSim::Nearest(int team, V2 p, const std::function<bool(const Agent&)>& ok)
{
    Agent* b = nullptr; float bd = 1e9f;
    for (auto& a : teams[team]) { if (a.sentOff || !ok(a)) continue; float d = V2::Dist(a.pos, p); if (d < bd) { bd = d; b = &a; } }
    return b;
}
Agent* MatchSim::Best(int team, const std::function<float(const Agent&)>& scoreFn)
{
    Agent* b = nullptr; float bs = -1e9f;
    for (auto& a : teams[team]) { if (a.sentOff || a.gk) continue; float sc = scoreFn(a); if (sc > bs) { bs = sc; b = &a; } }
    return b;
}

} // namespace fm27
