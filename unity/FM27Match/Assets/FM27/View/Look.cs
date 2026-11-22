// Shared materials, colours and primitive helpers for the self-built look (no external assets).
using System.Collections.Generic;
using UnityEngine;

namespace FM27.View
{
    public static class Look
    {
        static Material lit, unlit, vcol, transparent;
        static readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();

        // Materials live in Assets/Resources so the WebGL build keeps their shaders.
        public static Material Lit { get { if (lit == null) lit = Resources.Load<Material>("FM27/Lit"); return lit; } }
        public static Material Unlit { get { if (unlit == null) unlit = Resources.Load<Material>("FM27/Unlit"); return unlit; } }
        public static Material VertexColor { get { if (vcol == null) vcol = Resources.Load<Material>("FM27/VertexColor"); return vcol; } }
        public static Material Transparent { get { if (transparent == null) transparent = Resources.Load<Material>("FM27/Transparent"); return transparent; } }

        public static Material Mat(Color c, float smooth = 0.25f, bool emissive = false)
        {
            string key = ColorUtility.ToHtmlStringRGBA(c) + smooth + emissive;
            if (cache.TryGetValue(key, out var m)) return m;
            m = new Material(emissive ? Unlit : Lit) { color = c };
            if (!emissive && m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smooth);
            cache[key] = m; return m;
        }

        public static Color Hex(string hex, Color fallback)
        {
            if (!string.IsNullOrEmpty(hex) && ColorUtility.TryParseHtmlString(hex.StartsWith("#") ? hex : "#" + hex, out var c)) return c;
            return fallback;
        }

        static readonly Dictionary<PrimitiveType, Mesh> meshes = new Dictionary<PrimitiveType, Mesh>();
        /// <summary>A primitive without collider (no physics module needed in the WebGL build).</summary>
        public static GameObject NewPrim(PrimitiveType t, string name = null)
        {
            if (!meshes.TryGetValue(t, out var mesh) || mesh == null)
            {
                mesh = Resources.GetBuiltinResource<Mesh>(t + ".fbx");
                meshes[t] = mesh;
            }
            var g = new GameObject(name ?? t.ToString());
            g.AddComponent<MeshFilter>().sharedMesh = mesh;
            g.AddComponent<MeshRenderer>().sharedMaterial = Lit;
            return g;
        }

        public static GameObject Prim(PrimitiveType t, Transform parent, Vector3 localPos, Vector3 scale, Material m, string name = null, bool shadows = true)
        {
            var g = NewPrim(t, name);
            g.transform.SetParent(parent, false);
            g.transform.localPosition = localPos; g.transform.localScale = scale;
            var r = g.GetComponent<MeshRenderer>(); r.sharedMaterial = m;
            r.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            return g;
        }

        public static Transform Pivot(Transform parent, Vector3 localPos, string name)
        {
            var t = new GameObject(name).transform; t.SetParent(parent, false); t.localPosition = localPos; return t;
        }

        /// <summary>Sim pitch coordinates (x 0..105, y 0..68, height z) to world space (pitch centre at origin).</summary>
        public static Vector3 World(float x, float y, float z = 0f) => new Vector3(x - 52.5f, z, y - 34f);

        static readonly Color[] skins = { new Color(0.96f, 0.80f, 0.69f), new Color(0.87f, 0.68f, 0.52f), new Color(0.72f, 0.53f, 0.38f), new Color(0.55f, 0.38f, 0.26f), new Color(0.38f, 0.25f, 0.17f), new Color(0.27f, 0.18f, 0.12f) };
        static readonly Color[] hairs = { new Color(0.08f, 0.06f, 0.05f), new Color(0.22f, 0.14f, 0.08f), new Color(0.42f, 0.28f, 0.14f), new Color(0.75f, 0.6f, 0.35f), new Color(0.55f, 0.24f, 0.1f), new Color(0.6f, 0.6f, 0.6f) };
        public static Color Skin(int id) => skins[Mathf.Abs(id * 7919) % skins.Length];
        public static Color Hair(int id) => hairs[Mathf.Abs(id * 104729 + 3) % hairs.Length];
    }
}
