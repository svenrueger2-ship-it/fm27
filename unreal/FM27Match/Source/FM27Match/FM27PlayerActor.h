// A self-built footballer from engine basic shapes, animated procedurally (run, kick, tackle, dive, header, celebration).
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MatchSim.h"
#include "FM27PlayerActor.generated.h"

class UStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UTextRenderComponent;

UCLASS()
class AFM27PlayerActor : public AActor
{
	GENERATED_BODY()
public:
	AFM27PlayerActor();
	void Init(const fm27::Agent* InAgent, const fm27::TeamSetup& Team, UStaticMesh* Cube, UStaticMesh* Sphere, UStaticMesh* Cylinder, UMaterialInterface* BaseMat);
	void Sync(float Alpha, float DeltaSeconds);
	const fm27::Agent* Agent = nullptr;

private:
	UPROPERTY()
	TObjectPtr<USceneComponent> Root;
	UPROPERTY()
	TObjectPtr<USceneComponent> Hips;
	UPROPERTY()
	TObjectPtr<USceneComponent> Torso;
	UPROPERTY()
	TObjectPtr<USceneComponent> Head;
	UPROPERTY()
	TObjectPtr<USceneComponent> LShoulder;
	UPROPERTY()
	TObjectPtr<USceneComponent> RShoulder;
	UPROPERTY()
	TObjectPtr<USceneComponent> LElbow;
	UPROPERTY()
	TObjectPtr<USceneComponent> RElbow;
	UPROPERTY()
	TObjectPtr<USceneComponent> LHip;
	UPROPERTY()
	TObjectPtr<USceneComponent> RHip;
	UPROPERTY()
	TObjectPtr<USceneComponent> LKnee;
	UPROPERTY()
	TObjectPtr<USceneComponent> RKnee;
	UPROPERTY()
	TObjectPtr<UTextRenderComponent> Number;

	UStaticMesh* MCube = nullptr; UStaticMesh* MSphere = nullptr; UStaticMesh* MCyl = nullptr; UMaterialInterface* MBase = nullptr;
	float Phase = 0.f, Height = 1.f; FVector LastPos = FVector::ZeroVector; bool bFirst = true;

	USceneComponent* Pivot(USceneComponent* Parent, const FVector& Loc, const TCHAR* Name);
	UStaticMeshComponent* Part(USceneComponent* Parent, UStaticMesh* Mesh, const FVector& Loc, const FVector& SizeCm, const FLinearColor& Color, const TCHAR* Name);
	void Animate(float Speed, float Dt);
};
