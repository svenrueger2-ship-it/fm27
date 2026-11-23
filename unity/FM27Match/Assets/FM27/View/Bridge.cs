// Bridge between the manager game (JavaScript, parent window) and the Unity match.
// JS -> Unity: unityInstance.SendMessage("Bridge", "Setup" | "Command", json)
// Unity -> JS: FM27_Post(json) (see Plugins/WebGL/FM27Bridge.jslib) -> window.parent.postMessage
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using FM27.Sim;

namespace FM27.View
{
    [Serializable] public class HostSetup { public MatchSetup match = new MatchSetup(); public float speed = 1f; public string camera = "tv"; public string quality = "hoch"; public bool night = true; public bool replays = true, highlights = true; public int userSide = -1; }
    [Serializable] public class StateMsg { public string clock = "00:00"; public int minute, home, away, half = 1; public string phase = ""; public float homePoss = 50; public float speed = 1; public bool replay; public string replayText = ""; public int hlIndex, hlCount; public string formation = ""; }
    [Serializable] public class OutMsg { public string type; public MatchEvent ev; public StateMsg state; public MatchSummary summary; public string text = ""; }

    public class Bridge : MonoBehaviour
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void FM27_Post(string json);
#else
        static void FM27_Post(string json) { if (json.Length < 400) Debug.Log("[FM27] " + json); }
#endif
        MatchEngine engine;
        HostSetup host;
        StadiumBuilder stadium;
        CameraRig rig;
        BallView ballView;
        readonly List<PlayerView> views = new List<PlayerView>();
        float speed = 1f, stateTimer;
        bool paused, sentSummary;
        Transform world;
        // replays & highlights (v3.3)
        Clip playing, queued; float playT, replayDelay; bool highlightsMode, highlightsDone; readonly List<Clip> hlQueue = new List<Clip>(); int hlIndex, hlCount; string liveCamera = "tv";

        void Awake()
        {
            Application.targetFrameRate = -1;
            Application.runInBackground = true;
            Post(new OutMsg { type = "ready" });
        }

        System.Collections.IEnumerator DemoIfAlone()
        {
            yield return new WaitForSeconds(Application.isEditor ? 0.5f : 4f);
            if (engine == null && Application.isEditor) Setup(JsonUtility.ToJson(Demo()));
        }
        void Start() { StartCoroutine(DemoIfAlone()); }

        static void Post(OutMsg m) { try { FM27_Post(JsonUtility.ToJson(m)); } catch (Exception) { } }

        // ------------------------------------------------------------------ from JS
        public void Setup(string json)
        {
            try { host = JsonUtility.FromJson<HostSetup>(json); }
            catch (Exception ex) { Post(new OutMsg { type = "error", text = "setup: " + ex.Message }); return; }
            if (host?.match?.home?.players == null || host.match.home.players.Count < 11 || host.match.away.players.Count < 11) { Post(new OutMsg { type = "error", text = "setup: 11 Spieler pro Team nötig" }); return; }
            Build();
        }

        public void Command(string json)
        {
            MatchCommand c;
            try { c = JsonUtility.FromJson<MatchCommand>(json); } catch (Exception) { return; }
            if (c == null) return;
            switch (c.type)
            {
                case "speed": speed = Mathf.Clamp(c.fvalue, 0.25f, 16f); break;
                case "pause": paused = true; break;
                case "resume": paused = false; break;
                case "camera": liveCamera = c.text; if (rig != null && playing == null) rig.mode = c.text; break;
                case "skip": SkipReplay(); break;
                case "finish": while (engine != null && !engine.finished) engine.Step(); break;
                default:
                    engine?.Command(c);
                    if (c.type == "sub") foreach (var v in views) if (v.agent.p == c.player) v.Rebuild(v.agent.side == 0 ? host.match.home : host.match.away);
                    break;
            }
        }

        // ------------------------------------------------------------------ build the scene
        void Build()
        {
            if (world != null) Destroy(world.gameObject);
            views.Clear(); sentSummary = false; paused = false; playing = null; queued = null; highlightsMode = false; highlightsDone = false; hlQueue.Clear();
            speed = Mathf.Clamp(host.speed, 0.25f, 16f);
            world = new GameObject("World").transform;
            bool low = host.quality == "niedrig";
            QualitySettings.shadows = low ? ShadowQuality.Disable : ShadowQuality.All;
            QualitySettings.shadowDistance = 120f; QualitySettings.shadowResolution = host.quality == "ultra" ? ShadowResolution.VeryHigh : ShadowResolution.High;
            QualitySettings.shadowCascades = 2; QualitySettings.antiAliasing = low ? 0 : host.quality == "ultra" ? 8 : 4;
            QualitySettings.anisotropicFiltering = AnisotropicFiltering.Enable;

            engine = new MatchEngine(host.match);
            engine.OnEvent += OnEngineEvent;
            var m = host.match;
            stadium = new GameObject("Stadium").AddComponent<StadiumBuilder>(); stadium.transform.SetParent(world, false);
            stadium.Build(Look.Hex(m.home.primary, Color.red), Look.Hex(m.away.primary, Color.blue), host.night || m.weather == "night", m.weather);
            if (rig == null) rig = CameraRig.Create(host.night);
            rig.mode = liveCamera = string.IsNullOrEmpty(host.camera) ? "tv" : host.camera;
            rig.Snap(Vector3.zero);
            for (int s = 0; s < 2; s++) foreach (var a in engine.teams[s]) views.Add(PlayerView.Create(world, a, s == 0 ? m.home : m.away));
            ballView = BallView.Create(world);
            Post(new OutMsg { type = "started" });
        }

        void OnEngineEvent(MatchEvent e)
        {
            Post(new OutMsg { type = "event", ev = e });
            if (e.type == "goal")
            {
                stadium?.Cheer(1f);
                var scorer = views.Find(v => v.agent.p.id == e.player);
                if (scorer != null && rig != null) { rig.focus = scorer.transform; rig.closeUpUntil = Time.time + 4.5f / Mathf.Max(1f, speed * 0.5f); }
            }
            else if (e.type == "clip" && e.text == "goal" && host.replays && e.assist >= 0 && e.assist < engine.clips.Count) { queued = engine.clips[e.assist]; replayDelay = 1.6f; }
            else if (e.type == "save" || e.type == "post") stadium?.Cheer(0.5f);
            else if (e.type == "shot") stadium?.Cheer(0.25f);
        }

        // ------------------------------------------------------------------ loop
        void Update()
        {
            if (engine == null) return;
            float dt = Mathf.Min(Time.deltaTime, 0.1f);
            if (playing == null && queued != null) { replayDelay -= dt; if (replayDelay <= 0) { StartReplay(queued); queued = null; } }
            if (playing != null) { ReplayTick(dt); SendState(dt); return; }
            if (!paused && !engine.finished) engine.Advance(dt * speed);
            float alpha = Mathf.Clamp01(engine.Alpha);
            foreach (var v in views) v.Sync(engine, alpha);
            var b = engine.ball;
            var bp = V2.Lerp(b.prev, b.pos, alpha);
            var ballWorld = Look.World(bp.x, bp.y, Mathf.Lerp(b.prevZ, b.z, alpha));
            ballView.Place(ballWorld);
            int dir = engine.ball.owner != null ? engine.Dir(engine.ball.owner.side) : 1;
            rig.Follow(ballWorld, new Vector3(b.vel.x, 0, b.vel.y), dir, dt);
            SendState(dt);
            if (engine.finished && !highlightsDone && !sentSummary)
            {
                highlightsDone = true;
                if (host.highlights && engine.clips.Count > 0)
                {
                    // goals first in match order, then the best chances – at most 8 clips
                    foreach (var c in engine.clips) if (c.type == "goal") hlQueue.Add(c);
                    foreach (var c in engine.clips) if (c.type != "goal" && hlQueue.Count < 8) hlQueue.Add(c);
                    if (hlQueue.Count > 8) hlQueue.RemoveRange(8, hlQueue.Count - 8);
                    highlightsMode = true; hlIndex = 0; hlCount = hlQueue.Count;
                    StartReplay(hlQueue[0]);
                    return;
                }
            }
            if (engine.finished && !sentSummary && playing == null && !highlightsMode) { sentSummary = true; Post(new OutMsg { type = "summary", summary = engine.summary }); }
        }

        void SendState(float dt)
        {
            stateTimer -= dt;
            if (stateTimer > 0) return;
            stateTimer = 0.25f;
            string ph = playing != null ? (highlightsMode ? "Highlights" : "Replay") : engine.phase.ToString();
            Post(new OutMsg { type = "state", state = new StateMsg { clock = engine.Clock, minute = engine.Minute, home = engine.score[0], away = engine.score[1], half = engine.half, phase = ph, speed = speed,
                replay = playing != null, replayText = playing != null ? $"{playing.minute}' {playing.text}" : "", hlIndex = hlIndex + 1, hlCount = hlCount,
                formation = host.userSide == 1 ? host.match.away.formation : host.match.home.formation } });
        }

        void StartReplay(Clip c)
        {
            if (c == null || c.frames.Count < 2) { EndReplay(); return; }
            playing = c; playT = 0f;
            rig.replayGoalX = c.goalX - 52.5f; rig.mode = "rside"; rig.focus = null;
            stadium?.Cheer(c.type == "goal" ? 0.6f : 0.3f);
        }

        void ReplayTick(float dt)
        {
            var f = playing.frames; float dur = playing.Duration;
            // normal speed, slow motion around the decisive moment (~2.2 s before the clip ends)
            float rate = playT > dur - 4.2f && playT < dur - 1.6f ? 0.42f : 1f;
            playT += dt * rate;
            if (playT >= dur) { EndReplay(); return; }
            if (playT > dur * 0.5f) rig.mode = "rgoal";
            float t = f[0].t + playT;
            int i = 0; while (i < f.Count - 2 && f[i + 1].t <= t) i++;
            var a = f[i]; var b = f[i + 1]; float k = Mathf.Clamp01((t - a.t) / Mathf.Max(1e-4f, b.t - a.t));
            for (int n = 0; n < views.Count && n < 22; n++) views[n].ReplayPose(a.p[n], b.p[n], k);
            var ball = Look.World(Mathf.Lerp(a.bx, b.bx, k), Mathf.Lerp(a.by, b.by, k), Mathf.Lerp(a.bz, b.bz, k));
            ballView.Place(ball);
            rig.Follow(ball, Vector3.zero, 1, dt);
        }

        void EndReplay()
        {
            playing = null;
            if (highlightsMode)
            {
                hlIndex++;
                if (hlIndex < hlQueue.Count) { StartReplay(hlQueue[hlIndex]); return; }
                highlightsMode = false;
            }
            rig.mode = liveCamera;
        }

        void SkipReplay()
        {
            if (playing == null) { queued = null; return; }
            if (highlightsMode) { hlIndex = hlQueue.Count; }
            EndReplay();
        }

        // ------------------------------------------------------------------ demo (editor / standalone test)
        static readonly string[] DemoPos = { "TW", "LV", "IV", "IV", "RV", "LM", "ZM", "ZM", "RM", "ST", "ST" };
        static TeamSetup DemoTeam(int id, string n, string c1, string c2)
        {
            var t = new TeamSetup { id = id, name = n, shortName = n.Substring(0, 3).ToUpper(), primary = c1, secondary = c2, formation = "4-4-2" };
            for (int i = 0; i < 11; i++) t.players.Add(new PlayerSetup { id = id * 100 + i, name = "Spieler " + (i + 1), number = i + 1, pos = DemoPos[i], ovr = 72, pace = 72, shooting = 70, passing = 72, dribbling = 70, defending = 68, physical = 70, gk = i == 0 ? 75 : 20 });
            return t;
        }
        static HostSetup Demo()
        {
            var h = new HostSetup { night = true };
            h.match.home = DemoTeam(1, "Heimteam", "#1e4fd8", "#ffffff"); h.match.away = DemoTeam(2, "Gastteam", "#d81e2a", "#111111");
            h.match.seed = Environment.TickCount;
            return h;
        }
    }
}
