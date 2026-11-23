using UnrealBuildTool;
using System.Collections.Generic;

public class FM27MatchEditorTarget : TargetRules
{
	public FM27MatchEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;
		ExtraModuleNames.Add("FM27Match");
	}
}
