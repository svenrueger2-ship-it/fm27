// Replay recording: a ring buffer of the last seconds of play, clips for goals and big chances (highlights).
using System;
using System.Collections.Generic;

namespace FM27.Sim
{
    public struct FramePlayer { public float x, y, f, animT; public string anim; public bool off; }

    public class Frame
    {
        public float t, bx, by, bz;
        public FramePlayer[] p = new FramePlayer[22];
        public Frame Copy() { var c = new Frame { t = t, bx = bx, by = by, bz = bz }; Array.Copy(p, c.p, p.Length); return c; }
    }

    public class Clip
    {
        public string type;   // goal, post, save
        public int minute, side, player;
        public string text;
        public float goalX;   // x of the goal it went towards (0 or 105) – for replay cameras
        public List<Frame> frames = new List<Frame>();
        public float Duration => frames.Count > 1 ? frames[frames.Count - 1].t - frames[0].t : 0f;
    }

    public class Recorder
    {
        readonly Frame[] buf; int head, count;
        public Recorder(int capacity) { buf = new Frame[capacity]; for (int i = 0; i < capacity; i++) buf[i] = new Frame(); }

        public void Push(MatchEngine e, float t)
        {
            var f = buf[head]; head = (head + 1) % buf.Length; if (count < buf.Length) count++;
            f.t = t; f.bx = e.ball.pos.x; f.by = e.ball.pos.y; f.bz = e.ball.z;
            int i = 0;
            for (int s = 0; s < 2; s++) foreach (var a in e.teams[s])
                {
                    if (i >= 22) break;
                    f.p[i++] = new FramePlayer { x = a.pos.x, y = a.pos.y, f = a.facing, animT = a.animT, anim = a.anim, off = a.sentOff };
                }
        }

        /// <summary>Copies of the last <paramref name="seconds"/> (oldest first).</summary>
        public List<Frame> Last(float seconds, float dt)
        {
            int n = Math.Min(count, (int)(seconds / dt));
            var res = new List<Frame>(n);
            for (int k = n; k >= 1; k--) res.Add(buf[(head - k + buf.Length * 2) % buf.Length].Copy());
            return res;
        }
    }
}
