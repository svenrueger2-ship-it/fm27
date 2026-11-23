#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "FM27GameMode.generated.h"

UCLASS()
class AFM27GameMode : public AGameModeBase
{
	GENERATED_BODY()
public:
	AFM27GameMode();
	virtual void StartPlay() override;
};
