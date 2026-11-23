// JSON in/out for the match client: setup from the manager game, summary back (same schema as the Unity build).
#pragma once
#include "CoreMinimal.h"
#include "MatchSim.h"

namespace FM27Json
{
	bool ParseSetup(const FString& Json, fm27::MatchSetup& Out, bool& bNight, float& Speed, FString& Camera, FString& Quality);
	FString WriteSummary(const fm27::MatchSummary& S);
	FString EventToJson(const fm27::MatchEvent& E);
	inline FString Str(const std::string& S) { return FString(UTF8_TO_TCHAR(S.c_str())); }
	inline std::string Std(const FString& S) { return std::string(TCHAR_TO_UTF8(*S)); }
}
