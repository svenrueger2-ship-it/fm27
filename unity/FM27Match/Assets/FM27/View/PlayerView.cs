// A self-built footballer: primitives on a small bone hierarchy, animated procedurally (run cycle, kick, tackle, dive, header, celebration).
using UnityEngine;
using FM27.Sim;

namespace FM27.View
{
    public class PlayerView : MonoBehaviour
    {
        public Agent agent;
        Transform hips, torso, head, lShoulder, rShoulder, lElbow, rElbow, lHip, rHip, lKnee, rKnee;
        float phase, lastAnimT, jump;
        string lastAnim = "";
        Vector3 lastPos;
        TextMesh number;

        public static PlayerView Create(Transform parent, Agent a, TeamSetup team)
        {
            var go = new GameObject($"P{a.p.number} {a.p.name}");
            go.transform.SetParent(parent, false);
            var v = go.AddComponent<PlayerView>(); v.agent = a; v.Build(team);
            return v;
        }

        public void Rebuild(TeamSetup team)
        {
            foreach (Transform c in transform) Destroy(c.gameObject);
            Build(team);
        }

        void Build(TeamSetup team)
        {
            var p = agent.p;
            Color kit = Look.Hex(agent.gk ? team.keeper : team.primary, agent.gk ? new Color(0.1f, 0.5f, 0.25f) : Color.red);
            Color kit2 = Look.Hex(team.secondary, Color.white);
            Color skin = Look.Hex(p.skin, Look.Skin(p.id)), hair = Look.Hex(p.hair, Look.Hair(p.id));
            var mKit = Look.Mat(kit, 0.35f); var mKit2 = Look.Mat(kit2, 0.3f); var mSkin = Look.Mat(skin, 0.2f); var mHair = Look.Mat(hair, 0.1f);
            var mShorts = Look.Mat(agent.gk ? kit * 0.6f : kit2 * 0.92f + kit * 0.08f, 0.3f);
            var mBoot = Look.Mat(new Color(0.06f, 0.06f, 0.07f), 0.6f);
            float h = 0.96f + ((p.id * 37) % 11) / 100f;   // 1.76 .. 1.98 m
            transform.localScale = Vector3.one * h;

            hips = Look.Pivot(transform, new Vector3(0, 0.93f, 0), "hips");
            Look.Prim(PrimitiveType.Cube, hips, new Vector3(0, -0.02f, 0), new Vector3(0.36f, 0.2f, 0.22f), mShorts, "shorts");
            torso = Look.Pivot(hips, new Vector3(0, 0.08f, 0), "torso");
            Look.Prim(PrimitiveType.Capsule, torso, new Vector3(0, 0.27f, 0), new Vector3(0.4f, 0.3f, 0.24f), mKit, "shirt");
            Look.Prim(PrimitiveType.Cylinder, torso, new Vector3(0, 0.6f, 0), new Vector3(0.1f, 0.05f, 0.1f), mSkin, "neck");
            head = Look.Pivot(torso, new Vector3(0, 0.75f, 0), "head");
            Look.Prim(PrimitiveType.Sphere, head, Vector3.zero, new Vector3(0.21f, 0.25f, 0.23f), mSkin, "face");
            Look.Prim(PrimitiveType.Sphere, head, new Vector3(0, 0.06f, -0.015f), new Vector3(0.225f, 0.17f, 0.235f), mHair, "hair");
            Look.Prim(PrimitiveType.Sphere, head, new Vector3(0.11f, 0f, 0f), new Vector3(0.04f, 0.07f, 0.05f), mSkin, "ear").transform.localPosition = new Vector3(0.1f, -0.01f, 0);
            Look.Prim(PrimitiveType.Sphere, head, new Vector3(-0.1f, -0.01f, 0), new Vector3(0.04f, 0.07f, 0.05f), mSkin, "ear");
            Look.Prim(PrimitiveType.Cube, torso, new Vector3(0, 0.42f, 0.122f), new Vector3(0.34f, 0.02f, 0.005f), mKit2, "trim");

            lShoulder = Arm(torso, -1, mKit, mSkin, out lElbow); rShoulder = Arm(torso, 1, mKit, mSkin, out rElbow);
            lHip = Leg(hips, -1, mSkin, mKit2, mBoot, kit, out lKnee); rHip = Leg(hips, 1, mSkin, mKit2, mBoot, kit, out rKnee);

            // shirt number on the back
            var numGo = new GameObject("number"); numGo.transform.SetParent(torso, false);
            numGo.transform.localPosition = new Vector3(0, 0.33f, -0.125f); numGo.transform.localRotation = Quaternion.identity; // TextMesh reads towards -z = the back
            number = numGo.AddComponent<TextMesh>();
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (font != null) { number.font = font; numGo.GetComponent<MeshRenderer>().sharedMaterial = font.material; }
            number.text = p.number.ToString(); number.anchor = TextAnchor.MiddleCenter; number.characterSize = 0.045f; number.fontSize = 48;
            number.color = (kit.grayscale > 0.6f) ? new Color(0.1f, 0.1f, 0.12f) : Color.white;
        }

        Transform Arm(Transform torso, int side, Material sleeve, Material skin, out Transform elbow)
        {
            var sh = Look.Pivot(torso, new Vector3(0.24f * side, 0.5f, 0), side < 0 ? "lShoulder" : "rShoulder");
            Look.Prim(PrimitiveType.Capsule, sh, new Vector3(0, -0.13f, 0), new Vector3(0.11f, 0.15f, 0.11f), sleeve, "upper");
            elbow = Look.Pivot(sh, new Vector3(0, -0.28f, 0), "elbow");
            Look.Prim(PrimitiveType.Capsule, elbow, new Vector3(0, -0.12f, 0), new Vector3(0.085f, 0.14f, 0.085f), skin, "fore");
            Look.Prim(PrimitiveType.Sphere, elbow, new Vector3(0, -0.27f, 0), new Vector3(0.08f, 0.09f, 0.06f), skin, "hand");
            return sh;
        }

        Transform Leg(Transform hips, int side, Material skin, Material sock2, Material boot, Color kit, out Transform knee)
        {
            var hp = Look.Pivot(hips, new Vector3(0.1f * side, -0.06f, 0), side < 0 ? "lHip" : "rHip");
            Look.Prim(PrimitiveType.Capsule, hp, new Vector3(0, -0.21f, 0), new Vector3(0.15f, 0.22f, 0.15f), skin, "thigh");
            knee = Look.Pivot(hp, new Vector3(0, -0.43f, 0), "knee");
            Look.Prim(PrimitiveType.Capsule, knee, new Vector3(0, -0.2f, 0), new Vector3(0.12f, 0.2f, 0.12f), Look.Mat(kit * 0.95f, 0.2f), "sock");
            Look.Prim(PrimitiveType.Cube, knee, new Vector3(0, -0.44f, 0.04f), new Vector3(0.1f, 0.07f, 0.25f), boot, "boot");
            return hp;
        }

        // ------------------------------------------------------------------ animation
        public void Sync(MatchEngine e, float alpha)
        {
            var a = agent;
            if (a.sentOff) { gameObject.SetActive(false); return; }
            var p = V2.Lerp(a.prev, a.pos, alpha);
            float yaw = -Mathf.LerpAngle(a.prevFacing * Mathf.Rad2Deg, a.facing * Mathf.Rad2Deg, alpha) + 90f;
            Pose(p.x, p.y, yaw, a.anim, a.animT, a.vel.Len);
        }

        /// <summary>Replay: pose from two recorded frames.</summary>
        public void ReplayPose(FramePlayer f0, FramePlayer f1, float k)
        {
            if (f1.off) { gameObject.SetActive(false); return; }
            float x = Mathf.Lerp(f0.x, f1.x, k), y = Mathf.Lerp(f0.y, f1.y, k);
            float yaw = -Mathf.LerpAngle(f0.f * Mathf.Rad2Deg, f1.f * Mathf.Rad2Deg, k) + 90f;
            Pose(x, y, yaw, f1.anim, Mathf.Lerp(f0.animT, f1.animT, k), -1f);
        }

        void Pose(float x, float y, float yaw, string anim, float animT, float simSpeed)
        {
            if (!gameObject.activeSelf) gameObject.SetActive(true);
            var world = Look.World(x, y);
            float dt = Mathf.Max(Time.deltaTime, 1e-4f);
            float speed = (new Vector3(world.x - lastPos.x, 0, world.z - lastPos.z)).magnitude / dt;
            if (speed > 14f) speed = simSpeed >= 0 ? simSpeed : 0f; // teleports (set pieces, replay cuts)
            lastPos = world;
            transform.SetPositionAndRotation(world, Quaternion.Slerp(transform.rotation, Quaternion.Euler(0, yaw, 0), 1f - Mathf.Exp(-dt * 14f)));
            Animate(anim, animT, speed, dt);
        }

        void Animate(string anim, float t, float speed, float dt)
        {
            var a = agent;
            lastAnim = anim; lastAnimT = t;
            float run = Mathf.Clamp01(speed / 8.5f);
            phase += dt * (2.2f + speed * 1.05f);
            float sw = Mathf.Sin(phase), cw = Mathf.Cos(phase);
            float legAmp = Mathf.Lerp(6f, 52f, run), armAmp = Mathf.Lerp(4f, 42f, run);
            float lean = Mathf.Lerp(2f, 14f, run);
            float bob = Mathf.Abs(sw) * 0.05f * run;
            Vector3 hipsPos = new Vector3(0, 0.93f + bob, 0);
            Quaternion hipsRot = Quaternion.identity, torsoRot = Quaternion.Euler(lean, sw * 4f * run, 0);
            float lHipX = sw * legAmp, rHipX = -sw * legAmp;
            float lKneeX = Mathf.Max(0, -cw) * legAmp * 1.6f + 6f, rKneeX = Mathf.Max(0, cw) * legAmp * 1.6f + 6f;
            float lShX = -sw * armAmp, rShX = sw * armAmp, lShZ = -6f, rShZ = 6f, elbowX = -20f - run * 50f;
            switch (anim)
            {
                case "kick":
                    {
                        float k = Mathf.Clamp01(t / 0.42f);
                        float swing = k < 0.45f ? Mathf.Lerp(0, -55f, k / 0.45f) : Mathf.Lerp(-55f, 75f, (k - 0.45f) / 0.55f);
                        rHipX = -swing; rKneeX = k < 0.5f ? 70f * (k / 0.5f) : Mathf.Lerp(70f, 5f, (k - 0.5f) / 0.5f);
                        lHipX = 8f; lKneeX = 15f; lShX = -35f; rShX = 25f; lShZ = -35f; rShZ = 30f; torsoRot = Quaternion.Euler(-6f + k * 12f, 0, 0);
                        break;
                    }
                case "tackle":
                    {
                        float k = Mathf.Clamp01(t / 0.6f), down = Mathf.Sin(k * Mathf.PI);
                        hipsPos = new Vector3(0, 0.93f - 0.55f * down, 0.2f * down);
                        hipsRot = Quaternion.Euler(-55f * down, 0, 0);
                        lHipX = -80f * down; lKneeX = 10f; rHipX = -40f * down; rKneeX = 70f * down; lShX = 40f * down; rShX = 60f * down; lShZ = -40f; rShZ = 40f;
                        break;
                    }
                case "dive":
                    {
                        float k = Mathf.Clamp01(t / 0.9f), up = Mathf.Sin(Mathf.Min(1f, k * 1.4f) * Mathf.PI);
                        float dir = (a.p.id & 1) == 0 ? 1f : -1f;
                        hipsPos = new Vector3(dir * 1.1f * Mathf.Min(1f, k * 1.6f), 0.93f + 0.5f * up - 0.55f * Mathf.Clamp01(k * 1.8f - 0.8f), 0);
                        hipsRot = Quaternion.Euler(0, 0, -dir * 85f * Mathf.Min(1f, k * 1.8f));
                        lShX = -170f; rShX = -170f; lShZ = -10f; rShZ = 10f; elbowX = -5f; lHipX = 10f; rHipX = -10f; lKneeX = 20f; rKneeX = 10f;
                        break;
                    }
                case "header":
                    {
                        float k = Mathf.Clamp01(t / 0.6f); jump = Mathf.Sin(k * Mathf.PI) * 0.55f;
                        hipsPos = new Vector3(0, 0.93f + jump, 0); torsoRot = Quaternion.Euler(-20f + 45f * k, 0, 0);
                        lShX = -60f; rShX = -60f; lShZ = -45f; rShZ = 45f; lKneeX = 50f; rKneeX = 35f; lHipX = -10f; rHipX = 15f;
                        break;
                    }
                case "celebrate":
                    {
                        float j = Mathf.Abs(Mathf.Sin(Time.time * 6f + a.slot));
                        hipsPos = new Vector3(0, 0.93f + j * 0.25f * (1f - run) + bob, 0);
                        lShX = -165f + Mathf.Sin(Time.time * 9f) * 15f; rShX = -165f - Mathf.Sin(Time.time * 9f) * 15f; lShZ = -25f; rShZ = 25f; elbowX = -15f;
                        if (run < 0.3f) { lHipX = -j * 20f; rHipX = j * 10f; lKneeX = j * 40f + 5f; rKneeX = j * 30f + 5f; }
                        break;
                    }
                case "idle":
                    {
                        float br = Mathf.Sin(Time.time * 2f + a.slot) * 1.5f;
                        torsoRot = Quaternion.Euler(3f + br, 0, 0); lShZ = -8f; rShZ = 8f; elbowX = -12f; lHipX = 2f; rHipX = -2f; lKneeX = 6f; rKneeX = 6f;
                        if (a.gk) { lShZ = -30f; rShZ = 30f; elbowX = -40f; lHipX = -12f; rHipX = -12f; lKneeX = 30f; rKneeX = 30f; hipsPos = new Vector3(0, 0.86f, 0); torsoRot = Quaternion.Euler(18f, 0, 0); }
                        break;
                    }
            }
            float s = 1f - Mathf.Exp(-dt * 18f);
            hips.localPosition = Vector3.Lerp(hips.localPosition, hipsPos, s);
            hips.localRotation = Quaternion.Slerp(hips.localRotation, hipsRot, s);
            torso.localRotation = Quaternion.Slerp(torso.localRotation, torsoRot, s);
            lShoulder.localRotation = Quaternion.Slerp(lShoulder.localRotation, Quaternion.Euler(lShX, 0, lShZ), s);
            rShoulder.localRotation = Quaternion.Slerp(rShoulder.localRotation, Quaternion.Euler(rShX, 0, rShZ), s);
            lElbow.localRotation = Quaternion.Slerp(lElbow.localRotation, Quaternion.Euler(elbowX, 0, 0), s);
            rElbow.localRotation = Quaternion.Slerp(rElbow.localRotation, Quaternion.Euler(elbowX, 0, 0), s);
            lHip.localRotation = Quaternion.Slerp(lHip.localRotation, Quaternion.Euler(lHipX, 0, 0), s);
            rHip.localRotation = Quaternion.Slerp(rHip.localRotation, Quaternion.Euler(rHipX, 0, 0), s);
            lKnee.localRotation = Quaternion.Slerp(lKnee.localRotation, Quaternion.Euler(lKneeX, 0, 0), s);
            rKnee.localRotation = Quaternion.Slerp(rKnee.localRotation, Quaternion.Euler(rKneeX, 0, 0), s);
            if (head != null && anim != "dive") head.localRotation = Quaternion.Slerp(head.localRotation, Quaternion.Euler(-lean * 0.6f, 0, 0), s);
        }
    }
}
