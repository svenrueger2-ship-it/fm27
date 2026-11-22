// Headless build for CI (game-ci): creates the materials and the scene, then builds WebGL into build/WebGL.
// Run: Unity -batchmode -quit -executeMethod BuildScript.BuildWebGL
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

public static class BuildScript
{
    const string ScenePath = "Assets/Scenes/Match.unity";

    [MenuItem("FM27/Prepare scene + materials")]
    public static void Prepare()
    {
        Directory.CreateDirectory("Assets/Resources/FM27");
        Directory.CreateDirectory("Assets/Scenes");
        MakeMat("Lit", "Standard", m => { m.enableInstancing = true; m.SetFloat("_Glossiness", 0.25f); });
        MakeMat("Unlit", "Unlit/Color", m => m.enableInstancing = true);
        MakeMat("VertexColor", "Sprites/Default", null);
        MakeMat("Transparent", "Unlit/Transparent", null);
        AssetDatabase.SaveAssets(); AssetDatabase.Refresh();

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        // fog is set at runtime – keep its shader variants by using it in the scene
        RenderSettings.fog = true; RenderSettings.fogMode = FogMode.Linear;
        var go = new GameObject("Bridge");
        go.AddComponent<FM27.View.Bridge>();
        EditorSceneManager.SaveScene(scene, ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
    }

    static void MakeMat(string name, string shader, System.Action<Material> tweak)
    {
        string path = $"Assets/Resources/FM27/{name}.mat";
        var sh = Shader.Find(shader);
        if (sh == null) { Debug.LogError("Shader missing: " + shader); return; }
        var m = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (m == null) { m = new Material(sh); AssetDatabase.CreateAsset(m, path); } else m.shader = sh;
        tweak?.Invoke(m);
        EditorUtility.SetDirty(m);
    }

    public static void BuildWebGL()
    {
        Prepare();
        PlayerSettings.companyName = "BAKUSA";
        PlayerSettings.productName = "FM27 Match";
        PlayerSettings.bundleVersion = "1.0.0";
        PlayerSettings.colorSpace = ColorSpace.Linear;
        PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
        PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { GraphicsDeviceType.OpenGLES3 });
        PlayerSettings.WebGL.template = "PROJECT:FM27";
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback = true;   // GitHub Pages does not send Content-Encoding for .gz
        PlayerSettings.WebGL.dataCaching = true;
        PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
        PlayerSettings.WebGL.linkerTarget = WebGLLinkerTarget.Wasm;
        PlayerSettings.stripEngineCode = true;
        PlayerSettings.SetManagedStrippingLevel(BuildTargetGroup.WebGL, ManagedStrippingLevel.Low);
        PlayerSettings.runInBackground = true;

        string outDir = "build/WebGL/FM27Match";
        Directory.CreateDirectory(outDir);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = outDir,
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        });
        Debug.Log($"FM27 build: {report.summary.result}, {report.summary.totalSize / 1048576f:F1} MB, {report.summary.totalErrors} errors");
        if (report.summary.result != BuildResult.Succeeded) EditorApplication.Exit(1);
    }
}
