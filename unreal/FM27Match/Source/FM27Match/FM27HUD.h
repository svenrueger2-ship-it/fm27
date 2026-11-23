#pragma once
#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "FM27HUD.generated.h"

UCLASS()
class AFM27HUD : public AHUD
{
	GENERATED_BODY()
public:
	virtual void DrawHUD() override;
};
