// Procedural stadium: striped pitch with painted lines, goals with nets, four stands with a vertex-coloured crowd,
// advertising boards, roof and floodlights. Everything is generated at runtime – no imported assets.
using System.Collections.Generic;
using UnityEngine;

namespace FM27.View
{
    public class StadiumBuilder : MonoBehaviour
    {
        public Mesh crowdMesh;
        Vector3[] crowdBase; Vector3[] crowdVerts; float[] crowdPhase; float cheer;
        public Light sun;

        public void Build(Color home, Color away, bool night, string weather)
        {
            Pitch();
            Goal(-1); Goal(1);
            Stands(home, away);
            Boards(home);
            Lights(night);
            RenderSettings.fog = true; RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = weather == "rain" ? 60 : 140; RenderSettings.fogEndDistance = weather == "rain" ? 230 : 420;
            RenderSettings.fogColor = night ? new Color(0.04f, 0.05f, 0.1f) : new Color(0.62f, 0.72f, 0.86f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = night ? new Color(0.22f, 0.25f, 0.36f) : new Color(0.62f, 0.68f, 0.8f);
            RenderSettings.ambientEquatorColor = night ? new Color(0.14f, 0.16f, 0.2f) : new Color(0.42f, 0.46f, 0.44f);
            RenderSettings.ambientGroundColor = new Color(0.08f, 0.12f, 0.07f);
        }

        // ------------------------------------------------------------------ pitch
        void Pitch()
        {
            const int W = 1024, H = 700; // texture covers 115 x 78 m (pitch + 5 m run-off)
            var tex = new Texture2D(W, H, TextureFormat.RGB24, true) { wrapMode = TextureWrapMode.Clamp, anisoLevel = 8, filterMode = FilterMode.Trilinear };
            var px = new Color32[W * H];
            var rnd = new System.Random(4);
            Color a = new Color(0.16f, 0.44f, 0.16f), b = new Color(0.2f, 0.52f, 0.19f);
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float mx = x / (float)W * 115f - 5f, my = y / (float)H * 78f - 5f;
                    bool stripe = ((int)Mathf.Floor((mx) / 5.25f) & 1) == 0;
                    Color c = stripe ? a : b;
                    float n = (float)rnd.NextDouble() * 0.05f - 0.025f;
                    float wear = Mathf.Exp(-Mathf.Pow((mx - 52.5f) / 30f, 2)) * Mathf.Exp(-Mathf.Pow((my - 34f) / 14f, 2)) * 0.05f; // worn centre
                    c = new Color(c.r + n + wear, c.g + n - wear * 0.5f, c.b + n * 0.5f);
                    if (mx < 0 || mx > 105 || my < 0 || my > 68) c *= 0.9f;
                    px[y * W + x] = c;
                }
            System.Action<float, float> dot = (mx, my) =>
            {
                int cx = Mathf.RoundToInt((mx + 5f) / 115f * W), cy = Mathf.RoundToInt((my + 5f) / 78f * H);
                for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++)
                    {
                        int xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                        px[yy * W + xx] = new Color32(236, 240, 236, 255);
                    }
            };
            System.Action<float, float, float, float> line = (x0, y0, x1, y1) =>
            {
                float len = Mathf.Sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)); int n = Mathf.CeilToInt(len * 12);
                for (int i = 0; i <= n; i++) { float t = i / (float)Mathf.Max(1, n); dot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); }
            };
            System.Action<float, float, float, float, float> arc = (cx, cy, rad, a0, a1) =>
            {
                int n = Mathf.CeilToInt(rad * 14 * (a1 - a0));
                for (int i = 0; i <= n; i++) { float t = a0 + (a1 - a0) * i / n; dot(cx + Mathf.Cos(t) * rad, cy + Mathf.Sin(t) * rad); }
            };
            line(0, 0, 105, 0); line(0, 68, 105, 68); line(0, 0, 0, 68); line(105, 0, 105, 68); line(52.5f, 0, 52.5f, 68);
            arc(52.5f, 34, 9.15f, 0, Mathf.PI * 2); dot(52.5f, 34); dot(11, 34); dot(94, 34);
            foreach (int s in new[] { 0, 1 })
            {
                float gx = s == 0 ? 0 : 105, d = s == 0 ? 1 : -1;
                line(gx, 34 - 20.16f, gx + d * 16.5f, 34 - 20.16f); line(gx + d * 16.5f, 34 - 20.16f, gx + d * 16.5f, 34 + 20.16f); line(gx, 34 + 20.16f, gx + d * 16.5f, 34 + 20.16f);
                line(gx, 34 - 9.16f, gx + d * 5.5f, 34 - 9.16f); line(gx + d * 5.5f, 34 - 9.16f, gx + d * 5.5f, 34 + 9.16f); line(gx, 34 + 9.16f, gx + d * 5.5f, 34 + 9.16f);
                float px0 = s == 0 ? 11 : 94; float ang = Mathf.Acos(5.5f / 9.15f);
                if (s == 0) arc(px0, 34, 9.15f, -ang, ang); else arc(px0, 34, 9.15f, Mathf.PI - ang, Mathf.PI + ang);
                arc(gx, 0, 1, s == 0 ? 0 : Mathf.PI / 2, s == 0 ? Mathf.PI / 2 : Mathf.PI); arc(gx, 68, 1, s == 0 ? -Mathf.PI / 2 : Mathf.PI, s == 0 ? 0 : Mathf.PI * 1.5f);
            }
            tex.SetPixels32(px); tex.Apply(true);
            var pitch = Look.NewPrim(PrimitiveType.Plane, "Pitch");
            pitch.transform.SetParent(transform, false);
            pitch.transform.localScale = new Vector3(11.5f, 1, 7.8f); pitch.transform.localRotation = Quaternion.Euler(0, 180, 0);
            var m = new Material(Look.Lit) { mainTexture = tex, color = Color.white }; if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.12f);
            var r = pitch.GetComponent<MeshRenderer>(); r.sharedMaterial = m; r.receiveShadows = true; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            // outer ground
            var apron = Look.Prim(PrimitiveType.Plane, transform, new Vector3(0, -0.02f, 0), new Vector3(16, 1, 12), Look.Mat(new Color(0.12f, 0.3f, 0.13f), 0.05f), "Apron", false);
            apron.GetComponent<MeshRenderer>().receiveShadows = true;
            // corner flags
            foreach (var c in new[] { new Vector2(0, 0), new Vector2(0, 68), new Vector2(105, 0), new Vector2(105, 68) })
            {
                var pole = Look.Prim(PrimitiveType.Cylinder, transform, Look.World(c.x, c.y, 0.75f), new Vector3(0.03f, 0.75f, 0.03f), Look.Mat(Color.white), "flag");
                Look.Prim(PrimitiveType.Cube, pole.transform, new Vector3(0.0f, 0.85f, 0.6f), new Vector3(0.3f, 0.25f, 18f), Look.Mat(new Color(1f, 0.85f, 0.1f)), "cloth", false);
            }
        }

        void Goal(int side)
        {
            float x = side < 0 ? 0 : 105, d = side < 0 ? -1 : 1;
            var g = new GameObject(side < 0 ? "GoalW" : "GoalE").transform; g.SetParent(transform, false);
            var post = Look.Mat(Color.white, 0.7f);
            Look.Prim(PrimitiveType.Cylinder, g, Look.World(x, 34 - 3.66f, 1.22f), new Vector3(0.12f, 1.22f, 0.12f), post, "post");
            Look.Prim(PrimitiveType.Cylinder, g, Look.World(x, 34 + 3.66f, 1.22f), new Vector3(0.12f, 1.22f, 0.12f), post, "post");
            var bar = Look.Prim(PrimitiveType.Cylinder, g, Look.World(x, 34, 2.44f), new Vector3(0.12f, 3.72f, 0.12f), post, "bar");
            bar.transform.localRotation = Quaternion.Euler(90, 0, 0);
            // net: a box of transparent quads with a generated mesh texture
            var netTex = new Texture2D(64, 64, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat };
            var c = new Color32[64 * 64];
            for (int i = 0; i < 64; i++) for (int j = 0; j < 64; j++) c[i * 64 + j] = (i % 16 < 2 || j % 16 < 2) ? new Color32(245, 245, 245, 210) : new Color32(255, 255, 255, 0);
            netTex.SetPixels32(c); netTex.Apply(true);
            var nm = new Material(Look.Transparent) { mainTexture = netTex }; nm.mainTextureScale = new Vector2(8, 3);
            float depth = 2.2f;
            Quad(g, Look.World(x + d * depth, 34, 1.22f), new Vector3(0, 90, 0), new Vector2(7.32f, 2.44f), nm);
            Quad(g, Look.World(x + d * depth / 2, 34 - 3.66f, 1.22f), new Vector3(0, 0, 0), new Vector2(depth, 2.44f), nm);
            Quad(g, Look.World(x + d * depth / 2, 34 + 3.66f, 1.22f), new Vector3(0, 0, 0), new Vector2(depth, 2.44f), nm);
            Quad(g, Look.World(x + d * depth / 2, 34, 2.44f), new Vector3(90, 90, 0), new Vector2(7.32f, depth), nm);
        }

        void Quad(Transform parent, Vector3 pos, Vector3 euler, Vector2 size, Material m)
        {
            var q = Look.NewPrim(PrimitiveType.Quad, "net");
            q.transform.SetParent(parent, false); q.transform.localPosition = pos; q.transform.localRotation = Quaternion.Euler(euler); q.transform.localScale = new Vector3(size.x, size.y, 1);
            var r = q.GetComponent<MeshRenderer>(); r.sharedMaterial = m; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            // double sided: a second quad facing the other way
            var q2 = Instantiate(q, parent); q2.transform.localRotation = Quaternion.Euler(euler) * Quaternion.Euler(0, 180, 0);
        }

        // ------------------------------------------------------------------ stands + crowd
        void Stands(Color home, Color away)
        {
            var concrete = Look.Mat(new Color(0.32f, 0.32f, 0.36f), 0.1f);
            var roof = Look.Mat(new Color(0.16f, 0.16f, 0.2f), 0.3f);
            var verts = new List<Vector3>(); var cols = new List<Color32>(); var tris = new List<int>();
            var rnd = new System.Random(9);
            // (centre, length, facing yaw, distance from pitch line)
            var centres = new[] { new Vector3(0, 0, -34f - 9f), new Vector3(0, 0, 34f + 9f), new Vector3(-52.5f - 9f, 0, 0), new Vector3(52.5f + 9f, 0, 0) };
            var lens = new[] { 122f, 122f, 84f, 84f }; var yaws = new[] { 0f, 180f, 90f, -90f };
            for (int sIdx = 0; sIdx < 4; sIdx++)
            {
                Vector3 c = centres[sIdx]; float len = lens[sIdx], yaw = yaws[sIdx];
                var st = new GameObject("Stand" + sIdx).transform; st.SetParent(transform, false); st.localPosition = c; st.localRotation = Quaternion.Euler(0, yaw, 0);
                const int rows = 22; const float rowH = 0.55f, rowD = 0.85f;
                for (int r = 0; r < rows; r++)
                    Look.Prim(PrimitiveType.Cube, st, new Vector3(0, (r + 1) * rowH / 2f, -(r + 0.5f) * rowD), new Vector3(len, (r + 1) * rowH, rowD), concrete, "row", false);
                Look.Prim(PrimitiveType.Cube, st, new Vector3(0, rows * rowH / 2f + 3f, -rows * rowD - 0.5f), new Vector3(len + 2f, rows * rowH + 6f, 1f), concrete, "back", false);
                var rf = Look.Prim(PrimitiveType.Cube, st, new Vector3(0, rows * rowH + 7.5f, -rows * rowD / 2f - 1f), new Vector3(len + 4f, 0.4f, rows * rowD + 6f), roof, "roof", true);
                rf.transform.localRotation = Quaternion.Euler(-6f, 0, 0);
                // fans: small coloured quads facing the pitch
                var m = st.localToWorldMatrix;
                Color fanBase = sIdx == 3 ? away : home;
                for (int r = 0; r < rows; r++)
                    for (float x = -len / 2 + 0.4f; x < len / 2 - 0.4f; x += 0.62f)
                    {
                        if (rnd.NextDouble() < 0.08) continue;
                        float jitter = (float)rnd.NextDouble() * 0.12f;
                        var p = new Vector3(x + jitter, (r + 1) * rowH, -(r + 0.5f) * rowD + 0.12f);
                        Color col = rnd.NextDouble() < 0.55 ? fanBase * (0.75f + (float)rnd.NextDouble() * 0.35f) : rnd.NextDouble() < 0.5 ? new Color(0.9f, 0.9f, 0.92f) : new Color(0.12f, 0.12f, 0.16f);
                        Color skin = Look.Skin(rnd.Next(1000));
                        AddFan(verts, cols, tris, m, p, col, skin);
                    }
            }
            crowdMesh = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            crowdMesh.SetVertices(verts); crowdMesh.SetColors(cols); crowdMesh.SetTriangles(tris, 0); crowdMesh.RecalculateBounds();
            var go = new GameObject("Crowd"); go.transform.SetParent(transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = crowdMesh; var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = Look.VertexColor; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            crowdBase = verts.ToArray(); crowdVerts = verts.ToArray();
            crowdPhase = new float[crowdBase.Length / 8];
            for (int i = 0; i < crowdPhase.Length; i++) crowdPhase[i] = (float)rnd.NextDouble() * 6.28f;
        }

        static void AddFan(List<Vector3> v, List<Color32> c, List<int> t, Matrix4x4 m, Vector3 p, Color body, Color skin)
        {
            // body quad + head quad (8 vertices), facing local +z (towards the pitch)
            int i = v.Count;
            v.Add(m.MultiplyPoint3x4(p + new Vector3(-0.22f, 0, 0))); v.Add(m.MultiplyPoint3x4(p + new Vector3(0.22f, 0, 0)));
            v.Add(m.MultiplyPoint3x4(p + new Vector3(0.2f, 0.55f, 0))); v.Add(m.MultiplyPoint3x4(p + new Vector3(-0.2f, 0.55f, 0)));
            v.Add(m.MultiplyPoint3x4(p + new Vector3(-0.1f, 0.58f, 0.01f))); v.Add(m.MultiplyPoint3x4(p + new Vector3(0.1f, 0.58f, 0.01f)));
            v.Add(m.MultiplyPoint3x4(p + new Vector3(0.1f, 0.82f, 0.01f))); v.Add(m.MultiplyPoint3x4(p + new Vector3(-0.1f, 0.82f, 0.01f)));
            for (int k = 0; k < 4; k++) c.Add(body);
            for (int k = 0; k < 4; k++) c.Add(skin);
            t.AddRange(new[] { i, i + 2, i + 1, i, i + 3, i + 2, i + 4, i + 6, i + 5, i + 4, i + 7, i + 6 });
            t.AddRange(new[] { i, i + 1, i + 2, i, i + 2, i + 3, i + 4, i + 5, i + 6, i + 4, i + 6, i + 7 }); // back faces
        }

        public void Cheer(float amount) { cheer = Mathf.Max(cheer, amount); }

        void Update()
        {
            if (crowdMesh == null) return;
            cheer = Mathf.MoveTowards(cheer, 0.08f, Time.deltaTime * 0.12f);
            if (cheer <= 0.1f && Time.frameCount % 4 != 0) return; // idle crowd: cheap updates
            float t = Time.time;
            for (int f = 0; f < crowdPhase.Length; f++)
            {
                float h = Mathf.Max(0, Mathf.Sin(t * (5f + (f % 7)) + crowdPhase[f])) * 0.35f * cheer;
                int i = f * 8;
                for (int k = 0; k < 8; k++) { var b = crowdBase[i + k]; crowdVerts[i + k] = new Vector3(b.x, b.y + h, b.z); }
            }
            crowdMesh.SetVertices(crowdVerts);
        }

        void Boards(Color home)
        {
            var colors = new[] { new Color(0.1f, 0.1f, 0.14f), home * 0.85f, new Color(0.1f, 0.35f, 0.85f) };
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            string[] words = { "FUSSBALL MANAGER 2027", "BAKUSA", "LIVE 3D", "FM27" };
            int n = 0;
            for (float x = -50; x <= 50; x += 12.5f)
                foreach (float z in new[] { -34f - 3.2f, 34f + 3.2f })
                {
                    var b = Look.Prim(PrimitiveType.Cube, transform, new Vector3(x, 0.45f, z), new Vector3(12.2f, 0.9f, 0.15f), Look.Mat(colors[n % colors.Length], 0.5f, true), "board", false);
                    var tm = new GameObject("ad").AddComponent<TextMesh>(); tm.transform.SetParent(b.transform.parent, false);
                    tm.transform.localPosition = new Vector3(x, 0.45f, z + (z < 0 ? 0.09f : -0.09f)); tm.transform.localRotation = Quaternion.Euler(0, z < 0 ? 180 : 0, 0); // readable from the pitch side
                    if (font != null) { tm.font = font; tm.GetComponent<MeshRenderer>().sharedMaterial = font.material; }
                    tm.text = words[n % words.Length]; tm.anchor = TextAnchor.MiddleCenter; tm.characterSize = 0.09f; tm.fontSize = 60; tm.color = Color.white;
                    n++;
                }
        }

        void Lights(bool night)
        {
            var go = new GameObject("Sun"); go.transform.SetParent(transform, false);
            sun = go.AddComponent<Light>(); sun.type = LightType.Directional;
            sun.transform.rotation = Quaternion.Euler(night ? 62f : 48f, -35f, 0);
            sun.intensity = night ? 0.85f : 1.15f; sun.color = night ? new Color(0.86f, 0.9f, 1f) : new Color(1f, 0.96f, 0.88f);
            sun.shadows = LightShadows.Soft; sun.shadowStrength = night ? 0.55f : 0.75f;
            var head = Look.Mat(new Color(1f, 0.98f, 0.9f), 0, true);
            var mast = Look.Mat(new Color(0.3f, 0.3f, 0.34f), 0.4f);
            foreach (var c in new[] { new Vector3(-64, 0, -48), new Vector3(64, 0, -48), new Vector3(-64, 0, 48), new Vector3(64, 0, 48) })
            {
                Look.Prim(PrimitiveType.Cylinder, transform, c + new Vector3(0, 21, 0), new Vector3(0.9f, 21, 0.9f), mast, "mast", false);
                var h = Look.Prim(PrimitiveType.Cube, transform, c + new Vector3(0, 43, 0), new Vector3(7, 4, 0.6f), head, "lamps", false);
                h.transform.LookAt(Vector3.zero);
                if (night) { var pl = h.AddComponent<Light>(); pl.type = LightType.Point; pl.range = 120; pl.intensity = 0.6f; pl.color = new Color(0.95f, 0.97f, 1f); }
            }
        }
    }
}
