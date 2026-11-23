#include "FM27GameMode.h"
#include "FM27MatchActor.h"
#include "FM27PlayerController.h"
#include "FM27HUD.h"
#include "Engine/World.h"

AFM27GameMode::AFM27GameMode()
{
	DefaultPawnClass = nullptr; // pure spectator: the broadcast camera is the view
	PlayerControllerClass = AFM27PlayerController::StaticClass();
	HUDClass = AFM27HUD::StaticClass();
}

void AFM27GameMode::StartPlay()
{
	Super::StartPlay();
	GetWorld()->SpawnActor<AFM27MatchActor>(AFM27MatchActor::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator);
}
