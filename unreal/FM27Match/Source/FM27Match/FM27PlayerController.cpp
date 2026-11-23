#include "FM27PlayerController.h"
#include "FM27MatchActor.h"
#include "Camera/CameraActor.h"
#include "EngineUtils.h"
#include "InputCoreTypes.h"

AFM27PlayerController::AFM27PlayerController()
{
	bShowMouseCursor = true;
	bAutoManageActiveCameraTarget = false;
}

AFM27MatchActor* AFM27PlayerController::Match() const
{
	for (TActorIterator<AFM27MatchActor> It(GetWorld()); It; ++It) return *It;
	return nullptr;
}

void AFM27PlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);
	AFM27MatchActor* M = Match();
	if (!M) return;
	// keep the broadcast camera as view target
	if (GetViewTarget() == this || GetViewTarget() == nullptr)
		for (TActorIterator<ACameraActor> It(GetWorld()); It; ++It) { SetViewTarget(*It); break; }
	if (WasInputKeyJustPressed(EKeys::One)) M->SetSpeed(1.f);
	if (WasInputKeyJustPressed(EKeys::Two)) M->SetSpeed(2.f);
	if (WasInputKeyJustPressed(EKeys::Three)) M->SetSpeed(4.f);
	if (WasInputKeyJustPressed(EKeys::Four)) M->SetSpeed(8.f);
	if (WasInputKeyJustPressed(EKeys::C)) M->CycleCamera();
	if (WasInputKeyJustPressed(EKeys::SpaceBar)) M->TogglePause();
	if (WasInputKeyJustPressed(EKeys::Up)) M->ChangeMentality(1);
	if (WasInputKeyJustPressed(EKeys::Down)) M->ChangeMentality(-1);
	if (WasInputKeyJustPressed(EKeys::Escape) || WasInputKeyJustPressed(EKeys::Enter)) M->FinishNow();
}
