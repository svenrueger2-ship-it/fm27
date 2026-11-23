using UnrealBuildTool;

public class FM27Match : ModuleRules
{
	public FM27Match(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "Json" });
		// the match simulation (Sim/) is plain C++17 shared with the unit tests
		PublicIncludePaths.Add(System.IO.Path.Combine(ModuleDirectory, "Sim"));
		ShadowVariableWarningLevel = WarningLevel.Warning;
		bEnableExceptions = false;
	}
}
