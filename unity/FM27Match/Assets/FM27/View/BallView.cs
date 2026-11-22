// The ball: a sphere with a generated panel texture, rolling with its velocity.
using UnityEngine;

namespace FM27.View
{
    public class BallView : MonoBehaviour
    {
        Vector3 last;
        public static BallView Create(Transform parent)
        {
            var g = Look.NewPrim(PrimitiveType.Sphere, "Ball");
            g.transform.SetParent(parent, false); g.transform.localScale = Vector3.one * 0.44f;
            var tex = new Texture2D(128, 64, TextureFormat.RGB24, true);
            var px = new Color32[128 * 64];
            for (int y = 0; y < 64; y++) for (int x = 0; x < 128; x++)
                {
                    int cx = (x / 21) % 2, cy = (y / 21) % 2;
                    bool dark = (cx ^ cy) == 1 && ((x % 21) - 10) * ((x % 21) - 10) + ((y % 21) - 10) * ((y % 21) - 10) < 55;
                    px[y * 128 + x] = dark ? new Color32(30, 30, 40, 255) : new Color32(248, 248, 248, 255);
                }
            tex.SetPixels32(px); tex.Apply(true);
            var m = new Material(Look.Lit) { mainTexture = tex, color = Color.white }; if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.55f);
            g.GetComponent<MeshRenderer>().sharedMaterial = m;
            return g.AddComponent<BallView>();
        }

        public void Place(Vector3 world)
        {
            var d = world - last; d.y = 0;
            if (d.magnitude > 0.0001f && d.magnitude < 3f)
            {
                var axis = Vector3.Cross(Vector3.up, d.normalized);
                transform.Rotate(axis, d.magnitude / 0.22f * Mathf.Rad2Deg, Space.World);
            }
            last = world; transform.position = world + Vector3.up * 0.22f;
        }
    }
}
