#include "FM27Json.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

namespace
{
	int32 I(const TSharedPtr<FJsonObject>& O, const TCHAR* K, int32 Def) { double V; return O->TryGetNumberField(K, V) ? (int32)V : Def; }
	float F(const TSharedPtr<FJsonObject>& O, const TCHAR* K, float Def) { double V; return O->TryGetNumberField(K, V) ? (float)V : Def; }
	std::string S(const TSharedPtr<FJsonObject>& O, const TCHAR* K, const char* Def) { FString V; return O->TryGetStringField(K, V) ? FM27Json::Std(V) : std::string(Def); }

	fm27::PlayerSetup Player(const TSharedPtr<FJsonObject>& O)
	{
		fm27::PlayerSetup P;
		P.id = I(O, TEXT("id"), 0); P.name = S(O, TEXT("name"), "Spieler"); P.number = I(O, TEXT("number"), 0); P.pos = S(O, TEXT("pos"), "ZM");
		P.ovr = I(O, TEXT("ovr"), 60); P.pace = I(O, TEXT("pace"), 60); P.shooting = I(O, TEXT("shooting"), 60); P.passing = I(O, TEXT("passing"), 60);
		P.dribbling = I(O, TEXT("dribbling"), 60); P.defending = I(O, TEXT("defending"), 60); P.physical = I(O, TEXT("physical"), 60); P.gk = I(O, TEXT("gk"), 30);
		P.fitness = F(O, TEXT("fitness"), 100.f); P.morale = F(O, TEXT("morale"), 0.5f); P.skin = S(O, TEXT("skin"), ""); P.hair = S(O, TEXT("hair"), "");
		return P;
	}

	fm27::TeamSetup Team(const TSharedPtr<FJsonObject>& O)
	{
		fm27::TeamSetup T;
		if (!O.IsValid()) return T;
		T.id = I(O, TEXT("id"), 0); T.name = S(O, TEXT("name"), "Team"); T.shortName = S(O, TEXT("shortName"), "TEA");
		T.primary = S(O, TEXT("primary"), "#c81e1e"); T.secondary = S(O, TEXT("secondary"), "#ffffff"); T.keeper = S(O, TEXT("keeper"), "#1f7a3d");
		T.formation = S(O, TEXT("formation"), "4-4-2"); T.mentality = I(O, TEXT("mentality"), 0);
		T.pressing = F(O, TEXT("pressing"), 0.5f); T.tempo = F(O, TEXT("tempo"), 0.5f); T.width = F(O, TEXT("width"), 0.5f); T.lineHeight = F(O, TEXT("lineHeight"), 0.5f);
		const TArray<TSharedPtr<FJsonValue>>* Arr;
		if (O->TryGetArrayField(TEXT("players"), Arr)) for (const auto& V : *Arr) if (V->Type == EJson::Object) T.players.push_back(Player(V->AsObject()));
		if (O->TryGetArrayField(TEXT("bench"), Arr)) for (const auto& V : *Arr) if (V->Type == EJson::Object) T.bench.push_back(Player(V->AsObject()));
		return T;
	}
}

bool FM27Json::ParseSetup(const FString& Json, fm27::MatchSetup& Out, bool& bNight, float& Speed, FString& Camera, FString& Quality)
{
	TSharedPtr<FJsonObject> Root;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid()) return false;
	const TSharedPtr<FJsonObject>* M;
	if (!Root->TryGetObjectField(TEXT("match"), M)) return false;
	const TSharedPtr<FJsonObject>* H; const TSharedPtr<FJsonObject>* A;
	if (!(*M)->TryGetObjectField(TEXT("home"), H) || !(*M)->TryGetObjectField(TEXT("away"), A)) return false;
	Out.home = Team(*H); Out.away = Team(*A);
	Out.seed = (unsigned)I(*M, TEXT("seed"), 1); Out.weather = S(*M, TEXT("weather"), "clear"); Out.homeAdvantage = F(*M, TEXT("homeAdvantage"), 0.03f);
	bool bNeutral = false; (*M)->TryGetBoolField(TEXT("neutral"), bNeutral); Out.neutral = bNeutral;
	bNight = true; Root->TryGetBoolField(TEXT("night"), bNight);
	Speed = F(Root, TEXT("speed"), 1.f);
	Camera = TEXT("tv"); Root->TryGetStringField(TEXT("camera"), Camera);
	Quality = TEXT("hoch"); Root->TryGetStringField(TEXT("quality"), Quality);
	return Out.home.players.size() >= 11 && Out.away.players.size() >= 11;
}

static TSharedPtr<FJsonObject> EventObj(const fm27::MatchEvent& E)
{
	auto O = MakeShared<FJsonObject>();
	O->SetStringField(TEXT("type"), FM27Json::Str(E.type)); O->SetNumberField(TEXT("minute"), E.minute); O->SetNumberField(TEXT("side"), E.side);
	O->SetNumberField(TEXT("player"), E.player); O->SetNumberField(TEXT("assist"), E.assist); O->SetNumberField(TEXT("xg"), E.xg); O->SetStringField(TEXT("text"), FM27Json::Str(E.text));
	return O;
}

static TSharedPtr<FJsonObject> StatsObj(const fm27::SideStats& S)
{
	auto O = MakeShared<FJsonObject>();
	O->SetNumberField(TEXT("goals"), S.goals); O->SetNumberField(TEXT("shots"), S.shots); O->SetNumberField(TEXT("onTarget"), S.onTarget);
	O->SetNumberField(TEXT("passes"), S.passes); O->SetNumberField(TEXT("passesOk"), S.passesOk); O->SetNumberField(TEXT("tackles"), S.tackles);
	O->SetNumberField(TEXT("fouls"), S.fouls); O->SetNumberField(TEXT("corners"), S.corners); O->SetNumberField(TEXT("offsides"), S.offsides);
	O->SetNumberField(TEXT("yellow"), S.yellow); O->SetNumberField(TEXT("red"), S.red); O->SetNumberField(TEXT("saves"), S.saves);
	O->SetNumberField(TEXT("xg"), S.xg); O->SetNumberField(TEXT("possession"), S.possession);
	return O;
}

FString FM27Json::EventToJson(const fm27::MatchEvent& E)
{
	FString Out; auto W = TJsonWriterFactory<>::Create(&Out); FJsonSerializer::Serialize(EventObj(E).ToSharedRef(), W); return Out;
}

FString FM27Json::WriteSummary(const fm27::MatchSummary& S)
{
	auto O = MakeShared<FJsonObject>();
	O->SetStringField(TEXT("type"), TEXT("summary"));
	auto Sum = MakeShared<FJsonObject>();
	Sum->SetNumberField(TEXT("homeGoals"), S.homeGoals); Sum->SetNumberField(TEXT("awayGoals"), S.awayGoals);
	Sum->SetObjectField(TEXT("home"), StatsObj(S.home)); Sum->SetObjectField(TEXT("away"), StatsObj(S.away));
	TArray<TSharedPtr<FJsonValue>> Ev; for (const auto& E : S.events) Ev.Add(MakeShared<FJsonValueObject>(EventObj(E)));
	Sum->SetArrayField(TEXT("events"), Ev);
	TArray<TSharedPtr<FJsonValue>> Ra;
	for (const auto& R : S.ratings)
	{
		auto RO = MakeShared<FJsonObject>();
		RO->SetNumberField(TEXT("id"), R.id); RO->SetNumberField(TEXT("side"), R.side); RO->SetNumberField(TEXT("rating"), R.rating);
		RO->SetNumberField(TEXT("goals"), R.goals); RO->SetNumberField(TEXT("assists"), R.assists); RO->SetNumberField(TEXT("minutes"), R.minutes);
		Ra.Add(MakeShared<FJsonValueObject>(RO));
	}
	Sum->SetArrayField(TEXT("ratings"), Ra);
	O->SetObjectField(TEXT("summary"), Sum);
	FString Out; auto W = TJsonWriterFactory<>::Create(&Out); FJsonSerializer::Serialize(O, W); return Out;
}
