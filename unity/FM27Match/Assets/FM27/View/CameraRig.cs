// Broadcast-style cameras: TV (main stand), behind the goal, bird's eye and a close-up for celebrations.
using UnityEngine;

namespace FM27.View
{
    public class CameraRig : MonoBehaviour
    {
        public Camera cam;
        public string mode = "tv";
        public Transform focus;           // optional close-up target (scorer)
        public float closeUpUntil;
        public float replayGoalX = 52.5f; // world x of the goal the replayed move went to
        Vector3 look, vel;

        public static CameraRig Create(bool night)
        {
            var go = new GameObject("Camera"); var c = go.AddComponent<Camera>(); go.tag = "MainCamera";
            c.clearFlags = CameraClearFlags.SolidColor; c.backgroundColor = night ? new Color(0.03f, 0.04f, 0.09f) : new Color(0.55f, 0.68f, 0.86f);
            c.nearClipPlane = 0.3f; c.farClipPlane = 600f; c.fieldOfView = 30f; c.allowHDR = false; c.allowMSAA = true;
            go.AddComponent<AudioListener>();
            var r = go.AddComponent<CameraRig>(); r.cam = c; return r;
        }

        public void Follow(Vector3 ball, Vector3 ballVel, int attackDir, float dt)
        {
            Vector3 target = ball + new Vector3(ballVel.x, 0, ballVel.z) * 0.35f;
            target.x = Mathf.Clamp(target.x, -40f, 40f); target.y = 0; target.z = Mathf.Clamp(target.z * 0.55f, -14f, 14f);
            Vector3 pos; float fov;
            bool close = focus != null && Time.time < closeUpUntil;
            if (close)
            {
                target = focus.position + Vector3.up * 1.2f;
                pos = focus.position + new Vector3(0, 3.2f, -9f) + new Vector3(Mathf.Sin(Time.time * 0.3f) * 3f, 0, 0); fov = 32f;
            }
            else switch (mode)
            {
                case "rside": // low touchline camera during replays
                    target = ball; pos = new Vector3(ball.x - Mathf.Sign(replayGoalX) * 9f, 2.6f, Mathf.Clamp(ball.z, -30f, 30f) - 17f); fov = 30f; break;
                case "rgoal": // behind the goal during replays
                    target = ball; pos = new Vector3(replayGoalX + Mathf.Sign(replayGoalX) * 13f, 5.5f, ball.z * 0.25f); fov = 38f; break;
                case "behind":
                    pos = new Vector3(target.x - attackDir * 24f, 11f, target.z * 0.6f); fov = 46f; break;
                case "bird":
                    pos = new Vector3(target.x, 72f, target.z - 22f); fov = 42f; break;
                case "wide":
                    pos = new Vector3(target.x * 0.55f, 34f, -78f); fov = 36f; break;
                default: // tv
                    pos = new Vector3(target.x * 0.82f, 21f, -64f); fov = 24f + Mathf.Abs(target.x) * 0.06f; break;
            }
            look = Vector3.SmoothDamp(look, target, ref vel, close ? 0.25f : 0.45f);
            float k = 1f - Mathf.Exp(-dt * (close ? 3f : 2.2f));
            transform.position = Vector3.Lerp(transform.position, pos, k);
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(look - transform.position), 1f - Mathf.Exp(-dt * 8f));
            cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, fov, k);
        }

        public void Snap(Vector3 at) { look = at; transform.position = new Vector3(at.x * 0.82f, 21f, -64f); transform.LookAt(at); }
    }
}
