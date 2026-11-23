#include "FM27PlayerActor.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/StaticMesh.h"
#include "FM27Look.h"

AFM27PlayerActor::AFM27PlayerActor()
{
	PrimaryActorTick.bCanEverTick = false; // driven by the match actor
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);
}

USceneComponent* AFM27PlayerActor::Pivot(USceneComponent* Parent, const FVector& Loc, const TCHAR* Name)
{
	USceneComponent* C = NewObject<USceneComponent>(this, Name);
	C->SetupAttachment(Parent); C->SetRelativeLocation(Loc); C->RegisterComponent();
	return C;
}

UStaticMeshComponent* AFM27PlayerActor::Part(USceneComponent* Parent, UStaticMesh* Mesh, const FVector& Loc, const FVector& SizeCm, const FLinearColor& Color, const TCHAR* Name)
{
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this, Name);
	C->SetStaticMesh(Mesh); C->SetupAttachment(Parent);
	C->SetRelativeLocation(Loc); C->SetRelativeScale3D(SizeCm / 100.f);
	C->SetCollisionEnabled(ECollisionEnabled::NoCollision); C->SetGenerateOverlapEvents(false);
	C->SetMaterial(0, FM27Look::Mat(this, MBase, Color));
	C->RegisterComponent();
	return C;
}

void AFM27PlayerActor::Init(const fm27::Agent* InAgent, const fm27::TeamSetup& Team, UStaticMesh* Cube, UStaticMesh* Sphere, UStaticMesh* Cylinder, UMaterialInterface* BaseMat)
{
	Agent = InAgent; MCube = Cube; MSphere = Sphere; MCyl = Cylinder; MBase = BaseMat;
	const fm27::PlayerSetup& P = Agent->p;
	const FLinearColor Kit = FM27Look::Hex(Agent->gk ? Team.keeper : Team.primary, Agent->gk ? FLinearColor(0.05f, 0.4f, 0.15f) : FLinearColor::Red);
	const FLinearColor Kit2 = FM27Look::Hex(Team.secondary, FLinearColor::White);
	const FLinearColor Skin = FM27Look::Hex(P.skin, FM27Look::Skin(P.id)), Hair = FM27Look::Hex(P.hair, FM27Look::Hair(P.id));
	const FLinearColor Shorts = Agent->gk ? Kit * 0.6f : Kit2 * 0.9f, Boot(0.02f, 0.02f, 0.025f);
	Height = 0.96f + ((P.id * 37) % 11) / 100.f;
	Root->SetRelativeScale3D(FVector(Height));

	Hips = Pivot(Root, FVector(0, 0, 93), TEXT("Hips"));
	Part(Hips, MCube, FVector(0, 0, -2), FVector(22, 36, 20), Shorts, TEXT("ShortsMesh"));
	Torso = Pivot(Hips, FVector(0, 0, 8), TEXT("Torso"));
	Part(Torso, MCyl, FVector(0, 0, 27), FVector(24, 40, 58), Kit, TEXT("Shirt"));
	Part(Torso, MSphere, FVector(0, 0, 55), FVector(26, 44, 16), Kit, TEXT("Shoulders"));
	Part(Torso, MCyl, FVector(0, 0, 62), FVector(10, 10, 10), Skin, TEXT("Neck"));
	Part(Torso, MCube, FVector(12.5f, 0, 50), FVector(1, 30, 3), Kit2, TEXT("Trim"));
	Head = Pivot(Torso, FVector(0, 0, 76), TEXT("Head"));
	Part(Head, MSphere, FVector(0, 0, 0), FVector(23, 21, 25), Skin, TEXT("Face"));
	Part(Head, MSphere, FVector(-1.5f, 0, 6), FVector(24, 22.5f, 17), Hair, TEXT("HairMesh"));
	Part(Head, MSphere, FVector(0, -10.5f, -1), FVector(5, 4, 7), Skin, TEXT("EarL"));
	Part(Head, MSphere, FVector(0, 10.5f, -1), FVector(5, 4, 7), Skin, TEXT("EarR"));

	auto Arm = [&](int Side, TObjectPtr<USceneComponent>& Elbow, const TCHAR* N1, const TCHAR* N2, const TCHAR* N3, const TCHAR* N4, const TCHAR* N5)
	{
		USceneComponent* Sh = Pivot(Torso, FVector(0, 24.f * Side, 50), N1);
		Part(Sh, MCyl, FVector(0, 0, -13), FVector(11, 11, 28), Kit, N2);
		Elbow = Pivot(Sh, FVector(0, 0, -28), N3);
		Part(Elbow, MCyl, FVector(0, 0, -12), FVector(8.5f, 8.5f, 26), Skin, N4);
		Part(Elbow, MSphere, FVector(0, 0, -27), FVector(7, 8, 9), Skin, N5);
		return Sh;
	};
	LShoulder = Arm(-1, LElbow, TEXT("LShoulder"), TEXT("LUpper"), TEXT("LElbow"), TEXT("LFore"), TEXT("LHand"));
	RShoulder = Arm(1, RElbow, TEXT("RShoulder"), TEXT("RUpper"), TEXT("RElbow"), TEXT("RFore"), TEXT("RHand"));

	auto Leg = [&](int Side, TObjectPtr<USceneComponent>& Knee, const TCHAR* N1, const TCHAR* N2, const TCHAR* N3, const TCHAR* N4, const TCHAR* N5)
	{
		USceneComponent* Hp = Pivot(Hips, FVector(0, 10.f * Side, -6), N1);
		Part(Hp, MCyl, FVector(0, 0, -21), FVector(15, 15, 42), Skin, N2);
		Knee = Pivot(Hp, FVector(0, 0, -43), N3);
		Part(Knee, MCyl, FVector(0, 0, -20), FVector(12, 12, 40), Kit * 0.95f, N4);
		Part(Knee, MCube, FVector(4, 0, -44), FVector(25, 10, 7), Boot, N5);
		return Hp;
	};
	LHip = Leg(-1, LKnee, TEXT("LHip"), TEXT("LThigh"), TEXT("LKnee"), TEXT("LSock"), TEXT("LBoot"));
	RHip = Leg(1, RKnee, TEXT("RHip"), TEXT("RThigh"), TEXT("RKnee"), TEXT("RSock"), TEXT("RBoot"));

	Number = NewObject<UTextRenderComponent>(this, TEXT("Number"));
	Number->SetupAttachment(Torso); Number->SetRelativeLocation(FVector(-12.5f, 0, 32)); Number->SetRelativeRotation(FRotator(0, 180, 0));
	Number->SetHorizontalAlignment(EHTA_Center); Number->SetVerticalAlignment(EVRTA_TextCenter);
	Number->SetWorldSize(22.f); Number->SetText(FText::AsNumber(P.number));
	Number->SetTextRenderColor(Kit.GetLuminance() > 0.55f ? FColor(25, 25, 30) : FColor::White);
	Number->RegisterComponent();
}

void AFM27PlayerActor::Sync(float Alpha, float Dt)
{
	if (!Agent) return;
	if (Agent->sentOff) { SetActorHiddenInGame(true); return; }
	const fm27::V2 P = fm27::V2::Lerp(Agent->prev, Agent->pos, Alpha);
	const FVector World = FM27Look::World(P.x, P.y, 0.f);
	float Speed = bFirst ? 0.f : FVector::Dist2D(World, LastPos) / FMath::Max(Dt, 1e-4f) / 100.f;
	if (Speed > 14.f) Speed = Agent->vel.Len(); // teleports at set pieces
	bFirst = false; LastPos = World;
	const float Yaw = FMath::RadiansToDegrees(FMath::Lerp(Agent->prevFacing, Agent->facing, Alpha));
	const FRotator Want(0, Yaw, 0);
	SetActorLocationAndRotation(World, FMath::RInterpTo(GetActorRotation(), Want, Dt, 14.f));
	Animate(Speed, Dt);
}

void AFM27PlayerActor::Animate(float Speed, float Dt)
{
	const fm27::Agent& A = *Agent;
	const float Run = FMath::Clamp(Speed / 8.5f, 0.f, 1.f);
	Phase += Dt * (2.2f + Speed * 1.05f);
	const float Sw = FMath::Sin(Phase), Cw = FMath::Cos(Phase);
	const float LegAmp = FMath::Lerp(6.f, 52.f, Run), ArmAmp = FMath::Lerp(4.f, 42.f, Run), Lean = FMath::Lerp(2.f, 14.f, Run);
	const float Bob = FMath::Abs(Sw) * 5.f * Run;
	const float T = A.animT, Now = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
	// UE: positive pitch swings a hanging limb forward, negative pitch leans the torso forward
	FVector HipsPos(0, 0, 93 + Bob); FRotator HipsRot = FRotator::ZeroRotator, TorsoRot(-Lean, Sw * 4.f * Run, 0);
	float LHipP = Sw * LegAmp, RHipP = -Sw * LegAmp, LKneeP = -(FMath::Max(0.f, -Cw) * LegAmp * 1.6f + 6.f), RKneeP = -(FMath::Max(0.f, Cw) * LegAmp * 1.6f + 6.f);
	float LShP = -Sw * ArmAmp, RShP = Sw * ArmAmp, LShR = -6.f, RShR = 6.f, ElbP = 20.f + Run * 50.f;
	if (A.anim == "kick")
	{
		const float K = FMath::Clamp(T / 0.42f, 0.f, 1.f);
		const float Swing = K < 0.45f ? FMath::Lerp(0.f, -55.f, K / 0.45f) : FMath::Lerp(-55.f, 75.f, (K - 0.45f) / 0.55f);
		RHipP = Swing; RKneeP = -(K < 0.5f ? 70.f * (K / 0.5f) : FMath::Lerp(70.f, 5.f, (K - 0.5f) / 0.5f));
		LHipP = -8.f; LKneeP = -15.f; LShP = 35.f; RShP = -25.f; LShR = -35.f; RShR = 30.f; TorsoRot = FRotator(6.f - K * 12.f, 0, 0);
	}
	else if (A.anim == "tackle")
	{
		const float K = FMath::Clamp(T / 0.6f, 0.f, 1.f), Down = FMath::Sin(K * UE_PI);
		HipsPos = FVector(20.f * Down, 0, 93 - 55.f * Down); HipsRot = FRotator(55.f * Down, 0, 0);
		LHipP = 80.f * Down; LKneeP = -10.f; RHipP = 40.f * Down; RKneeP = -70.f * Down; LShP = -40.f * Down; RShP = -60.f * Down; LShR = -40.f; RShR = 40.f;
	}
	else if (A.anim == "dive")
	{
		const float K = FMath::Clamp(T / 0.9f, 0.f, 1.f), Up = FMath::Sin(FMath::Min(1.f, K * 1.4f) * UE_PI);
		const float Dir = (A.p.id & 1) == 0 ? 1.f : -1.f;
		HipsPos = FVector(0, Dir * 110.f * FMath::Min(1.f, K * 1.6f), 93 + 50.f * Up - 55.f * FMath::Clamp(K * 1.8f - 0.8f, 0.f, 1.f));
		HipsRot = FRotator(0, 0, Dir * 85.f * FMath::Min(1.f, K * 1.8f));
		LShP = 170.f; RShP = 170.f; LShR = -10.f; RShR = 10.f; ElbP = 5.f; LHipP = -10.f; RHipP = 10.f; LKneeP = -20.f; RKneeP = -10.f;
	}
	else if (A.anim == "header")
	{
		const float K = FMath::Clamp(T / 0.6f, 0.f, 1.f), Jump = FMath::Sin(K * UE_PI) * 55.f;
		HipsPos = FVector(0, 0, 93 + Jump); TorsoRot = FRotator(20.f - 45.f * K, 0, 0);
		LShP = 60.f; RShP = 60.f; LShR = -45.f; RShR = 45.f; LKneeP = -50.f; RKneeP = -35.f; LHipP = 10.f; RHipP = -15.f;
	}
	else if (A.anim == "celebrate")
	{
		const float J = FMath::Abs(FMath::Sin(Now * 6.f + A.slot));
		HipsPos = FVector(0, 0, 93 + J * 25.f * (1.f - Run) + Bob);
		LShP = 165.f - FMath::Sin(Now * 9.f) * 15.f; RShP = 165.f + FMath::Sin(Now * 9.f) * 15.f; LShR = -25.f; RShR = 25.f; ElbP = 15.f;
		if (Run < 0.3f) { LHipP = J * 20.f; RHipP = -J * 10.f; LKneeP = -(J * 40.f + 5.f); RKneeP = -(J * 30.f + 5.f); }
	}
	else if (A.anim == "idle")
	{
		const float Br = FMath::Sin(Now * 2.f + A.slot) * 1.5f;
		TorsoRot = FRotator(-3.f - Br, 0, 0); LShR = -8.f; RShR = 8.f; ElbP = 12.f; LHipP = -2.f; RHipP = 2.f; LKneeP = -6.f; RKneeP = -6.f;
		if (A.gk) { LShR = -30.f; RShR = 30.f; ElbP = 40.f; LHipP = 12.f; RHipP = 12.f; LKneeP = -30.f; RKneeP = -30.f; HipsPos = FVector(0, 0, 86); TorsoRot = FRotator(-18.f, 0, 0); }
	}
	const float S = 1.f - FMath::Exp(-Dt * 18.f);
	auto Blend = [S](USceneComponent* C, const FRotator& R) { C->SetRelativeRotation(FQuat::Slerp(C->GetRelativeRotation().Quaternion(), R.Quaternion(), S)); };
	Hips->SetRelativeLocation(FMath::Lerp(Hips->GetRelativeLocation(), HipsPos, S));
	Blend(Hips, HipsRot); Blend(Torso, TorsoRot);
	Blend(LShoulder, FRotator(LShP, 0, -LShR)); Blend(RShoulder, FRotator(RShP, 0, -RShR)); // UE roll is mirrored vs. the Unity rig
	Blend(LElbow, FRotator(ElbP, 0, 0)); Blend(RElbow, FRotator(ElbP, 0, 0));
	Blend(LHip, FRotator(LHipP, 0, 0)); Blend(RHip, FRotator(RHipP, 0, 0));
	Blend(LKnee, FRotator(LKneeP, 0, 0)); Blend(RKnee, FRotator(RKneeP, 0, 0));
	if (A.anim != "dive") Blend(Head, FRotator(Lean * 0.6f, 0, 0));
}
