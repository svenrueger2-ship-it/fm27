// Keyboard controls: 1-4 speed, C camera, Space pause, Up/Down mentality, Esc/Enter finish the match.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "FM27PlayerController.generated.h"

class AFM27MatchActor;

UCLASS()
class AFM27PlayerController : public APlayerController
{
	GENERATED_BODY()
public:
	AFM27PlayerController();
	virtual void PlayerTick(float DeltaTime) override;
	AFM27MatchActor* Match() const;
};
