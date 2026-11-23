#include "FM27HUD.h"
#include "FM27MatchActor.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "EngineUtils.h"

static const TCHAR* MentalityName(int32 M)
{
	switch (M) { case -2: return TEXT("Mauern"); case -1: return TEXT("Defensiv"); case 1: return TEXT("Offensiv"); case 2: return TEXT("Alles nach vorn"); default: return TEXT("Normal"); }
}

void AFM27HUD::DrawHUD()
{
	Super::DrawHUD();
	AFM27MatchActor* M = nullptr;
	for (TActorIterator<AFM27MatchActor> It(GetWorld()); It; ++It) { M = *It; break; }
	if (!M || !Canvas) return;
	const float S = Canvas->ClipY / 1080.f;
	UFont* Big = GEngine->GetLargeFont(); UFont* Mid = GEngine->GetMediumFont(); UFont* Small = GEngine->GetSmallFont();

	// score bug (top left)
	const float X = 28 * S, Y = 26 * S, H = 46 * S;
	DrawRect(FLinearColor(0.03f, 0.03f, 0.08f, 0.9f), X, Y, 150 * S, H);
	DrawRect(M->HomeColor, X, Y, 8 * S, H);
	DrawText(M->HomeShort, FLinearColor::White, X + 22 * S, Y + 10 * S, Mid, 1.25f * S);
	DrawRect(FLinearColor::White, X + 150 * S, Y, 110 * S, H);
	DrawText(FString::Printf(TEXT("%d : %d"), M->HomeGoals(), M->AwayGoals()), FLinearColor(0.05f, 0.05f, 0.08f), X + 172 * S, Y + 6 * S, Big, 1.1f * S);
	DrawRect(FLinearColor(0.03f, 0.03f, 0.08f, 0.9f), X + 260 * S, Y, 150 * S, H);
	DrawRect(M->AwayColor, X + 402 * S, Y, 8 * S, H);
	DrawText(M->AwayShort, FLinearColor::White, X + 282 * S, Y + 10 * S, Mid, 1.25f * S);
	DrawRect(FLinearColor(0.36f, 0.25f, 0.9f, 0.95f), X + 410 * S, Y, 110 * S, H);
	DrawText(M->Clock(), FLinearColor::White, X + 428 * S, Y + 10 * S, Mid, 1.25f * S);

	// event feed (bottom left)
	float FY = Canvas->ClipY - 120 * S;
	for (const FFeedLine& L : M->Feed)
	{
		const float W = 30 * S + L.Text.Len() * 10.5f * S;
		DrawRect(L.bGoal ? FLinearColor(0.36f, 0.25f, 0.9f, 0.92f) : FLinearColor(0.03f, 0.03f, 0.08f, 0.82f), 28 * S, FY, W, 34 * S);
		DrawText(L.Text, FLinearColor::White, 42 * S, FY + 7 * S, Mid, 1.f * S);
		FY -= 40 * S;
	}

	// controls (bottom right)
	const FString Tactics = M->UserSide >= 0 ? FString::Printf(TEXT("   %s [Pfeile]   %s [F]   Pressing %s [P]   Wechsel %d/5 [W]"), MentalityName(M->UserMentality()), *M->FormationName(), *M->PressingName(), M->SubsUsed) : FString();
	const FString Help = FString::Printf(TEXT("Tempo %gx [1-4]   %s [C]   %s[Leertaste]%s   Ende [Esc]"),
		M->GetSpeed(), *M->CameraName, M->IsPaused() ? TEXT("PAUSE ") : TEXT("Pause "), *Tactics);
	float TW, TH; GetTextSize(Help, TW, TH, Small, 1.2f * S);
	DrawRect(FLinearColor(0.03f, 0.03f, 0.08f, 0.75f), Canvas->ClipX - TW - 48 * S, Canvas->ClipY - 56 * S, TW + 24 * S, TH + 16 * S);
	DrawText(Help, FLinearColor(0.85f, 0.83f, 1.f), Canvas->ClipX - TW - 36 * S, Canvas->ClipY - 48 * S, Small, 1.2f * S);

	if (M->IsReplaying())
	{
		float RW, RH; GetTextSize(M->ReplayLabel, RW, RH, Mid, 1.1f * S);
		DrawRect(FLinearColor(0.03f, 0.03f, 0.08f, 0.9f), Canvas->ClipX - RW - 70 * S, 26 * S, RW + 44 * S, 46 * S);
		DrawRect(FLinearColor(1.f, 0.82f, 0.29f), Canvas->ClipX - RW - 70 * S, 26 * S, 6 * S, 46 * S);
		DrawText(M->ReplayLabel, FLinearColor(1.f, 0.9f, 0.6f), Canvas->ClipX - RW - 50 * S, 36 * S, Mid, 1.1f * S);
		DrawText(TEXT("[R] ueberspringen"), FLinearColor(0.8f, 0.8f, 0.85f), Canvas->ClipX - 200 * S, 78 * S, Small, 1.1f * S);
	}
	if (M->IsMenuOpen())
	{
		const TArray<FString> Lines = M->MenuLines();
		const float MW = 620 * S, MH = (90 + Lines.Num() * 34) * S, MX = Canvas->ClipX - MW - 40 * S, MY = 110 * S;
		DrawRect(FLinearColor(0.04f, 0.03f, 0.1f, 0.95f), MX, MY, MW, MH);
		DrawText(M->MenuStage == 0 ? TEXT("WECHSEL - wer geht raus?") : TEXT("WECHSEL - wer kommt rein?"), FLinearColor(0.75f, 0.68f, 1.f), MX + 24 * S, MY + 16 * S, Mid, 1.1f * S);
		for (int32 i = 0; i < Lines.Num(); i++)
		{
			const float LY = MY + (56 + i * 34) * S;
			if (i == M->MenuIndex) DrawRect(FLinearColor(0.36f, 0.25f, 0.9f, 0.85f), MX + 12 * S, LY - 2 * S, MW - 24 * S, 32 * S);
			DrawText(Lines[i], FLinearColor::White, MX + 24 * S, LY + 3 * S, Small, 1.25f * S);
		}
		DrawText(TEXT("Pfeile waehlen - Enter bestaetigen - Esc zurueck"), FLinearColor(0.7f, 0.7f, 0.78f), MX + 24 * S, MY + MH - 30 * S, Small, 1.1f * S);
	}
	if (!M->StatusText.IsEmpty()) DrawText(M->StatusText, FLinearColor(1.f, 0.85f, 0.3f), 28 * S, 84 * S, Small, 1.2f * S);
	if (M->IsPaused()) DrawText(TEXT("PAUSE"), FLinearColor::White, Canvas->ClipX * 0.5f - 60 * S, Canvas->ClipY * 0.42f, Big, 2.f * S);
	if (M->IsFinished())
	{
		const float BW = 640 * S, BH = 160 * S, BX = (Canvas->ClipX - BW) / 2, BY = Canvas->ClipY * 0.36f;
		DrawRect(FLinearColor(0.03f, 0.03f, 0.08f, 0.92f), BX, BY, BW, BH);
		DrawText(TEXT("ABPFIFF"), FLinearColor(0.7f, 0.62f, 1.f), BX + 40 * S, BY + 20 * S, Mid, 1.3f * S);
		DrawText(FString::Printf(TEXT("%s  %d : %d  %s"), *M->HomeShort, M->HomeGoals(), M->AwayGoals(), *M->AwayShort), FLinearColor::White, BX + 40 * S, BY + 62 * S, Big, 1.6f * S);
		DrawText(TEXT("Zurueck zum Manager …"), FLinearColor(0.75f, 0.75f, 0.8f), BX + 40 * S, BY + 122 * S, Small, 1.2f * S);
	}
}
