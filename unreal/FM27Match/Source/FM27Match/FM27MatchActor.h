// Runs the match simulation and renders it: procedural stadium, players, ball, lights and broadcast cameras.
// Input/output: -setup="<file.json>" (from the FM27 launcher) and -result="<file.json>" (summary written at full time).
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MatchSim.h"
#include <memory>
#include "FM27MatchActor.generated.h"

class AFM27PlayerActor;
class ACameraActor;
class UStaticMesh;
class UStaticMeshComponent;
class UInstancedStaticMeshComponent;
class UMaterialInterface;

struct FFeedLine
{
	FString Text;
	float Time = 0;
	bool bGoal = false;
};

UCLASS()
class AFM27MatchActor : public AActor
{
	GENERATED_BODY()
public:
	AFM27MatchActor();
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	// controls (called by the player controller)
	void SetSpeed(float S) { Speed = FMath::Clamp(S, 0.25f, 16.f); }
	float GetSpeed() const { return Speed; }
	void CycleCamera();
	void TogglePause() { bPaused = !bPaused; }
	void ChangeMentality(int Delta);
	void FinishNow();
	void SkipReplay();
	void CycleFormation();
	void CyclePressing();
	// substitution menu (keyboard)
	void ToggleSubMenu();
	void MenuMove(int32 Delta);
	void MenuConfirm();
	void MenuBack();
	bool IsMenuOpen() const { return bSubMenu; }
	int32 MenuStage = 0, MenuIndex = 0, SubsUsed = 0;
	TArray<FString> MenuLines() const;
	FString FormationName() const; FString PressingName() const;

	// state for the HUD
	bool HasMatch() const { return Sim != nullptr; }
	FString HomeShort, AwayShort, CameraName = TEXT("TV-Kamera");
	FLinearColor HomeColor = FLinearColor::Red, AwayColor = FLinearColor::Blue;
	int32 HomeGoals() const; int32 AwayGoals() const; FString Clock() const; bool IsFinished() const; bool IsPaused() const { return bPaused; }
	int32 UserSide = -1; int32 UserMentality() const;
	TArray<FFeedLine> Feed;
	FString StatusText;
	bool IsReplaying() const { return PlayingClip >= 0; }
	FString ReplayLabel;

private:
	UPROPERTY()
	TObjectPtr<UStaticMesh> MeshCube;
	UPROPERTY()
	TObjectPtr<UStaticMesh> MeshSphere;
	UPROPERTY()
	TObjectPtr<UStaticMesh> MeshCylinder;
	UPROPERTY()
	TObjectPtr<UMaterialInterface> BaseMaterial;
	UPROPERTY()
	TObjectPtr<USceneComponent> Root;
	UPROPERTY()
	TArray<TObjectPtr<AFM27PlayerActor>> Players;
	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> BallMesh;
	UPROPERTY()
	TObjectPtr<ACameraActor> Cam;
	UPROPERTY()
	TArray<TObjectPtr<UInstancedStaticMeshComponent>> Crowd;

	std::unique_ptr<fm27::MatchSim> Sim;
	fm27::MatchSetup Setup;
	FString ResultPath;
	float Speed = 1.f, EndTimer = -1.f, Cheer = 0.f, CrowdTick = 0.f, CloseUpUntil = 0.f;
	bool bPaused = false, bNight = true, bResultWritten = false;
	int32 CamMode = 0; // 0 TV, 1 weit, 2 hinter dem Tor, 3 Vogel
	FVector CamLook = FVector::ZeroVector; FVector LastBall = FVector::ZeroVector;
	TWeakObjectPtr<AFM27PlayerActor> Focus;
	TArray<TArray<FTransform>> CrowdBase;
	// replays & highlights (v3.3)
	int32 PlayingClip = -1, QueuedClip = -1, HlIndex = 0; TArray<int32> HlQueue; float PlayT = 0.f, ReplayDelay = 0.f;
	bool bReplays = true, bHighlights = true, bHighlightsMode = false, bHighlightsDone = false; int32 LiveCamMode = 0, PressIdx = 1;
	void StartReplay(int32 ClipIdx); void ReplayTick(float Dt); void EndReplay();
	// substitutions
	bool bSubMenu = false, bPausedBeforeMenu = false; int32 OutSlot = -1; TArray<int32> SubbedOut;
	const fm27::TeamSetup& UserTeam() const { return UserSide == 1 ? Setup.away : Setup.home; }

	void LoadSetup();
	void BuildWorld();
	void BuildPitch(); void BuildGoals(); void BuildStands(); void BuildLights();
	UStaticMeshComponent* Box(UStaticMesh* Mesh, const FVector& Loc, const FVector& SizeCm, const FLinearColor& Color, bool bShadow = false, const FRotator& Rot = FRotator::ZeroRotator);
	void LineSeg(float X0, float Y0, float X1, float Y1);
	void Arc(float Cx, float Cy, float R, float A0, float A1);
	void UpdateCamera(const FVector& Ball, const FVector& BallVel, float Dt);
	void UpdateCrowd(float Dt);
	void OnSimEvent(const fm27::MatchEvent& E);
	void WriteResult();
	FString NameOf(int32 Id) const;
};
