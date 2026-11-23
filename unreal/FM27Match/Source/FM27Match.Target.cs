using UnrealBuildTool;
using System.Collections.Generic;

public class FM27MatchTarget : TargetRules
{
	public FM27MatchTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;
		ExtraModuleNames.Add("FM27Match");
	}
}
