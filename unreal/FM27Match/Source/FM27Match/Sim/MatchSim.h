// FM27 match engine 2 – C++ port of the positional football AI (same rules as the Unity/C# version).
// Pure C++17, no Unreal types: runs inside Unreal and in plain unit tests.
// Pitch: x 0..105, y 0..68. Home attacks +x in the first half. 10 real minutes of movement = 90 match minutes.
#pragma once
#include <cmath>
#include <functional>
#include <random>
#include <string>
#include <vector>

namespace fm27 {

struct V2 {
    float x = 0, y = 0;
    V2() = default;
    V2(float x_, float y_) : x(x_), y(y_) {}
    V2 operator+(const V2& b) const { return {x + b.x, y + b.y}; }
    V2 operator-(const V2& b) const { return {x - b.x, y - b.y}; }
    V2 operator*(float s) const { return {x * s, y * s}; }
    float Len() const { return std::sqrt(x * x + y * y); }
    V2 Norm() const { float l = Len(); return l > 1e-5f ? V2(x / l, y / l) : V2(0, 0); }
    static float Dist(const V2& a, const V2& b) { return (a - b).Len(); }
    static V2 Lerp(const V2& a, const V2& b, float t) { return {a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t}; }
    static float Dot(const V2& a, const V2& b) { return a.x * b.x + a.y * b.y; }
};

struct PlayerSetup {
    int id = 0; std::string name; int number = 0; std::string pos = "ZM";
    int ovr = 60, pace = 60, shooting = 60, passing = 60, dribbling = 60, defending = 60, physical = 60, gk = 30;
    float fitness = 100.f, morale = 0.5f; std::string skin, hair;
};

struct TeamSetup {
    int id = 0; std::string name = "Team", shortName = "TEA", primary = "#c81e1e", secondary = "#ffffff", keeper = "#1f7a3d", formation = "4-4-2";
    int mentality = 0; float pressing = 0.5f, tempo = 0.5f, width = 0.5f, lineHeight = 0.5f;
    std::vector<PlayerSetup> players, bench;
};

struct MatchSetup { TeamSetup home, away; unsigned seed = 1; bool neutral = false; std::string weather = "clear"; float homeAdvantage = 0.03f; };

struct MatchEvent { std::string type; int minute = 0, side = -1, player = 0, assist = 0; float xg = 0; std::string text; };
struct SideStats { int goals = 0, shots = 0, onTarget = 0, passes = 0, passesOk = 0, tackles = 0, fouls = 0, corners = 0, offsides = 0, yellow = 0, red = 0, saves = 0; float xg = 0, possession = 50; };
struct PlayerRating { int id = 0, side = 0; float rating = 6; int goals = 0, assists = 0; float minutes = 0; };
struct MatchSummary { int homeGoals = 0, awayGoals = 0; SideStats home, away; std::vector<MatchEvent> events; std::vector<PlayerRating> ratings; };

enum class Phase { Kickoff, Play, ThrowIn, GoalKick, Corner, FreeKick, Penalty, Celebration, HalfTime, FullTime };

struct Slot { float depth = 0.5f, lat = 0.5f; std::string role = "MID", pos; };
std::vector<Slot> FormationSlots(const std::string& formation);
std::vector<int> AssignSlots(const std::vector<PlayerSetup>& players, const std::vector<Slot>& slots);

struct Agent {
    int side = 0, slot = 0; PlayerSetup p;
    V2 pos, vel, target, prev; float prevFacing = 0;
    float stamina = 1, facing = 0, decide = 0, cooldown = 0, runTimer = 0, animT = 0, minutes = 0;
    bool gk = false, sentOff = false, running = false;
    std::string anim = "idle"; float depth = 0.5f, lat = 0.5f; std::string role = "MID";
    float rating = 6.2f; int goals = 0, assists = 0, yellow = 0;
    float MaxSpeed() const { return (5.7f + p.pace / 100.f * 3.3f) * (0.8f + 0.2f * stamina) * (0.94f + 0.06f * (p.fitness / 100.f)); }
};

struct Ball { V2 pos, vel, prev; float z = 0, vz = 0, prevZ = 0; Agent *owner = nullptr, *lastTouch = nullptr, *intended = nullptr, *passer = nullptr, *offsideAt = nullptr; bool shot = false; };

class MatchSim {
public:
    static constexpr float FieldX = 105.f, FieldY = 68.f, GoalHalf = 3.66f, HalfSeconds = 300.f, Dt = 0.05f;
    explicit MatchSim(const MatchSetup& s);

    void Step();
    void Advance(float seconds);
    const MatchSummary& RunToEnd() { while (!finished) Step(); return summary; }
    float Alpha() const { return acc / Dt; }
    int Dir(int side) const { return ((side == 0) == (half == 1)) ? 1 : -1; }
    int Minute() const;
    std::string Clock() const;
    void SetMentality(int side, int v);
    void Substitute(int side, int outId, const PlayerSetup& in);

    MatchSetup setup;
    std::vector<Agent> teams[2];
    Ball ball;
    MatchSummary summary;
    Phase phase = Phase::Kickoff;
    float time = 0; int half = 1; int score[2] = {0, 0}; int mentality[2] = {0, 0}; float pressing[2] = {0.5f, 0.5f};
    bool finished = false;
    std::function<void(const MatchEvent&)> onEvent;

private:
    std::mt19937 rng; std::uniform_real_distribution<double> uni{0.0, 1.0};
    double R() { return uni(rng); }
    int RI(int n) { return n <= 1 ? 0 : std::uniform_int_distribution<int>(0, n - 1)(rng); }
    float Gauss();

    float acc = 0, phaseTimer = 0, possTime[2] = {0, 0}, str[2] = {60, 60}, shotXg = 0;
    int restartSide = 0, kickoffSide = 0;
    V2 restartPos;
    Agent *taker = nullptr, *lastScorer = nullptr, *shotKeeper = nullptr, *shooter = nullptr, *cornerHeader = nullptr, *clearer = nullptr, *lastPasser[2] = {nullptr, nullptr};
    std::string shotOutcome; bool wideHold = false; int tickParity = 0;

    const TeamSetup& T(int s) const { return s == 0 ? setup.home : setup.away; }
    float U(int side, V2 p) const { return Dir(side) > 0 ? p.x : FieldX - p.x; }
    V2 FromTeam(int side, float u, float v) const { return Dir(side) > 0 ? V2(u, v) : V2(FieldX - u, FieldY - v); }
    V2 OppGoal(int side) const { return V2(Dir(side) > 0 ? FieldX : 0, FieldY / 2); }
    V2 OwnGoal(int side) const { return V2(Dir(side) > 0 ? 0 : FieldX, FieldY / 2); }

    void Build(int side, const TeamSetup& t);
    void SetupKickoff(int side);
    bool IsDeadOrSafe() const;
    void PlayTick(float dt);
    Agent* BestChaser(int s);
    V2 BallLanding() const;
    V2 Intercept(const Agent& a) const;
    Agent* Presser(int s, Agent* carrier);
    Agent* SecondPresser(int s, Agent* carrier, Agent* first);
    Agent* NearestOpp(Agent* carrier);
    float OffsideLine(int attSide) const;
    V2 SupportPos(Agent& a, Agent* carrier);
    V2 DefendPos(Agent& a, Agent* carrier);
    void KeeperTick(Agent& k);
    void CarrierTick(Agent& a, float dt);
    V2 DribbleTarget(Agent& a, float pressure);
    float Pressure(const Agent& a) const;
    float SpaceAhead(const Agent& a) const;
    float OpenSpace(V2 p, int s) const;
    float LaneSafety(V2 from, V2 to, int s) const;
    float Threat(int s, V2 p) const;
    void Pass(Agent& a, Agent* r, V2 pt, bool lob);
    void KeeperDistribute(Agent& k);
    void Shoot(Agent& a, float xg, float pressure);
    void TryTackle(Agent& d, Agent& c);
    void Foul(Agent& d, Agent& c);
    V2 PenaltySpot(int att) const { return V2(Dir(att) > 0 ? FieldX - 11.f : 11.f, FieldY / 2); }
    void StartRestart(Phase ph, int side, V2 at);
    void RestartTick(float dt);
    V2 RestartPos(Agent& a);
    void MovePlayers(float dt);
    void BallTick(float dt);
    void ShotFlight();
    bool CheckGoalOrOut();
    void Goal(int side);
    void Finish();
    SideStats& Stats(int s) { return s == 0 ? summary.home : summary.away; }
    void Emit(const std::string& type, int side, int player, int assist, float xg, const std::string& text);
    bool InOwnBox(int side, V2 p) const { return U(side, p) < 16.5f && std::fabs(p.y - FieldY / 2) < 20.16f; }
    bool InOppBox(int side, V2 p) const { return U(side, p) > FieldX - 16.5f && std::fabs(p.y - FieldY / 2) < 20.16f; }
    Agent* Nearest(int team, V2 p, const std::function<bool(const Agent&)>& ok);
    Agent* Best(int team, const std::function<float(const Agent&)>& scoreFn);
    Agent* FindGK(int team);
public:
    static float Xg(V2 p, V2 goal);
    static float Clamp(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
    static V2 ClampP(V2 p, float m = 0.5f) { return V2(Clamp(p.x, m, FieldX - m), Clamp(p.y, m, FieldY - m)); }
};

} // namespace fm27
