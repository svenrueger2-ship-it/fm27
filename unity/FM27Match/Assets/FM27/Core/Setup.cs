// FM27 match core – data the manager game sends in (JSON via the WebGL bridge). Pure C#, no UnityEngine.
using System;
using System.Collections.Generic;

namespace FM27.Sim
{
    [Serializable]
    public class PlayerSetup
    {
        public int id;
        public string name = "";
        public int number;
        public string pos = "ZM";   // TW, IV, LV, RV, DM, ZM, OM, LM, RM, LA, RA, ST
        public int ovr = 60;
        public int pace = 60, shooting = 60, passing = 60, dribbling = 60, defending = 60, physical = 60, gk = 30;
        public float fitness = 100f;  // 0..100
        public float morale = 0.5f;   // 0..1
        public string skin = "";      // hex, optional
        public string hair = "";      // hex, optional
        public string style = "";     // v3.4 playing style: knipser, spielmacher, dribbler, fluegel, zweikampf, ballsicher
        public float temper = 0.4f;   // 0..1 – fouls and cards
    }

    [Serializable]
    public class TeamSetup
    {
        public int id;
        public string name = "Team";
        public string shortName = "TEA";
        public string primary = "#c81e1e";
        public string secondary = "#ffffff";
        public string keeper = "#1f7a3d";
        public string formation = "4-4-2";
        public int mentality;          // -2 (Mauern) .. +2 (Vollangriff)
        public float pressing = 0.5f;  // 0..1
        public float tempo = 0.5f;     // 0..1 (direct play)
        public float width = 0.5f;     // 0..1
        public float lineHeight = 0.5f;// 0..1 defensive line
        public List<PlayerSetup> players = new List<PlayerSetup>(); // first 11 = starting eleven
        public List<PlayerSetup> bench = new List<PlayerSetup>();
    }

    [Serializable]
    public class MatchSetup
    {
        public TeamSetup home = new TeamSetup();
        public TeamSetup away = new TeamSetup();
        public int seed = 1;
        public bool neutral;
        public string weather = "clear"; // clear, rain, snow, night
        public float homeAdvantage = 0.03f;
    }

    /// <summary>Things that happened, sent to the manager game.</summary>
    [Serializable]
    public class MatchEvent
    {
        public string type;   // kickoff, goal, shot, save, miss, post, foul, yellow, red, corner, offside, freekick, penalty, halftime, fulltime, sub
        public int minute;
        public int side;      // 0 home, 1 away, -1 none
        public int player;    // player id
        public int assist;    // player id or 0
        public float xg;
        public string text = "";
    }

    [Serializable]
    public class SideStats
    {
        public int goals, shots, onTarget, passes, passesOk, tackles, fouls, corners, offsides, yellow, red, saves;
        public float xg, possession;
    }

    [Serializable]
    public class MatchSummary
    {
        public int homeGoals, awayGoals;
        public SideStats home = new SideStats();
        public SideStats away = new SideStats();
        public List<MatchEvent> events = new List<MatchEvent>();
        public List<PlayerRating> ratings = new List<PlayerRating>();
    }

    [Serializable]
    public class PlayerRating { public int id; public int side; public float rating; public int goals, assists; public float minutes; public int passes, passesOk, shots, tackles, saves; public int[] heat = new int[0]; }

    [Serializable]
    public class MatchCommand
    {
        public string type;   // mentality, sub, pressing, speed, camera, pause
        public int side;
        public int value;
        public float fvalue;
        public int outId;
        public PlayerSetup player;
        public string text = "";
    }
}
