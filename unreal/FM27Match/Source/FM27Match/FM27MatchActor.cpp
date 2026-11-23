#include "FM27MatchActor.h"
#include "FM27PlayerActor.h"
#include "FM27Json.h"
#include "FM27Look.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/SpotLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/SpotLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/PostProcessVolume.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "UObject/ConstructorHelpers.h"
#include "GameFramework/PlayerController.h"
#include "HAL/PlatformMisc.h"

static const TCHAR* CamNames[] = { TEXT("TV-Kamera"), TEXT("Weit"), TEXT("Hinter dem Tor"), TEXT("Vogelperspektive") };

AFM27MatchActor::AFM27MatchActor()
{
	PrimaryActorTick.bCanEverTick = true;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Sphere(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> Mat(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	MeshCube = Cube.Object; MeshSphere = Sphere.Object; MeshCylinder = Cylinder.Object; BaseMaterial = Mat.Object;
}

// ======================================================================= setup
void AFM27MatchActor::LoadSetup()
{
	FString SetupPath, Json;
	FM27Json::FHostOptions Opt;
	FParse::Value(FCommandLine::Get(), TEXT("setup="), SetupPath);
	FParse::Value(FCommandLine::Get(), TEXT("result="), ResultPath);
	bool bOk = false;
	if (!SetupPath.IsEmpty() && FFileHelper::LoadFileToString(Json, *SetupPath))
		bOk = FM27Json::ParseSetup(Json, Setup, Opt);
	bNight = Opt.bNight; Speed = Opt.Speed; bReplays = Opt.bReplays; bHighlights = Opt.bHighlights; UserSide = Opt.UserSide;
	FParse::Value(FCommandLine::Get(), TEXT("userside="), UserSide);
	const FString Camera = Opt.Camera;
	if (!bOk)
	{
		// demo match (started without the launcher)
		const char* Pos[] = { "TW", "LV", "IV", "IV", "RV", "LM", "ZM", "ZM", "RM", "ST", "ST" };
		auto Make = [&](fm27::TeamSetup& T, int Id, const char* Name, const char* Short, const char* C1, const char* C2)
		{
			T.id = Id; T.name = Name; T.shortName = Short; T.primary = C1; T.secondary = C2; T.formation = "4-4-2"; T.players.clear();
			for (int i = 0; i < 11; i++)
			{
				fm27::PlayerSetup P; P.id = Id * 100 + i; P.name = "Spieler " + std::to_string(i + 1); P.number = i + 1; P.pos = Pos[i];
				P.ovr = 72; P.pace = 72; P.shooting = 70; P.passing = 72; P.dribbling = 70; P.defending = 68; P.physical = 70; P.gk = i == 0 ? 75 : 20;
				T.players.push_back(P);
			}
		};
		Make(Setup.home, 1, "Heimteam", "HEI", "#1e4fd8", "#ffffff");
		Make(Setup.away, 2, "Gastteam", "GAS", "#d81e2a", "#111111");
		Setup.seed = (unsigned)FDateTime::Now().GetTicks();
		StatusText = TEXT("Demo-Spiel (ohne Launcher gestartet)");
	}
	CamMode = LiveCamMode = Camera == TEXT("bird") ? 3 : Camera == TEXT("behind") ? 2 : Camera == TEXT("wide") ? 1 : 0;
	if (UserSide >= 0) { const float P = UserTeam().pressing; PressIdx = P < 0.38f ? 0 : P > 0.68f ? 2 : 1; }
	CameraName = CamNames[CamMode];
	HomeShort = FM27Json::Str(Setup.home.shortName); AwayShort = FM27Json::Str(Setup.away.shortName);
	HomeColor = FM27Look::Hex(Setup.home.primary, FLinearColor::Red); AwayColor = FM27Look::Hex(Setup.away.primary, FLinearColor::Blue);
}

void AFM27MatchActor::BeginPlay()
{
	Super::BeginPlay();
	LoadSetup();
	Sim = std::make_unique<fm27::MatchSim>(Setup);
	Sim->onEvent = [this](const fm27::MatchEvent& E) { OnSimEvent(E); };
	BuildWorld();
	for (int S = 0; S < 2; S++)
		for (const fm27::Agent& A : Sim->teams[S])
		{
			AFM27PlayerActor* P = GetWorld()->SpawnActor<AFM27PlayerActor>(AFM27PlayerActor::StaticClass(), FM27Look::World(A.pos.x, A.pos.y, 0), FRotator::ZeroRotator);
			if (!P) continue;
			P->Init(&A, S == 0 ? Setup.home : Setup.away, MeshCube, MeshSphere, MeshCylinder, BaseMaterial);
			Players.Add(P);
		}
	BallMesh = Box(MeshSphere, FVector(0, 0, 11), FVector(22, 22, 22), FLinearColor(0.95f, 0.95f, 0.95f), true);
	Cam = GetWorld()->SpawnActor<ACameraActor>(ACameraActor::StaticClass(), FVector(0, -6400, 2100), FRotator(-18, 90, 0));
	if (Cam)
	{
		Cam->GetCameraComponent()->SetConstraintAspectRatio(false);
		Cam->GetCameraComponent()->SetFieldOfView(30.f);
		if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0)) PC->SetViewTarget(Cam);
	}
}

// ======================================================================= world building
UStaticMeshComponent* AFM27MatchActor::Box(UStaticMesh* Mesh, const FVector& Loc, const FVector& SizeCm, const FLinearColor& Color, bool bShadow, const FRotator& Rot)
{
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this);
	C->SetStaticMesh(Mesh); C->SetupAttachment(Root);
	C->SetRelativeLocationAndRotation(Loc, Rot); C->SetRelativeScale3D(SizeCm / 100.f);
	C->SetCollisionEnabled(ECollisionEnabled::NoCollision); C->SetCastShadow(bShadow); C->SetGenerateOverlapEvents(false);
	C->SetMaterial(0, FM27Look::Mat(this, BaseMaterial, Color));
	C->RegisterComponent();
	return C;
}

void AFM27MatchActor::BuildWorld()
{
	BuildPitch(); BuildGoals(); BuildStands(); BuildLights();
}

void AFM27MatchActor::LineSeg(float X0, float Y0, float X1, float Y1)
{
	const FVector A = FM27Look::World(X0, Y0, 0.012f), B = FM27Look::World(X1, Y1, 0.012f);
	const FVector Mid = (A + B) * 0.5f; const float Len = FVector::Dist(A, B);
	const float Yaw = FMath::RadiansToDegrees(FMath::Atan2(B.Y - A.Y, B.X - A.X));
	Box(MeshCube, Mid, FVector(Len + 12.f, 12.f, 1.f), FLinearColor(0.85f, 0.88f, 0.85f), false, FRotator(0, Yaw, 0));
}

void AFM27MatchActor::Arc(float Cx, float Cy, float R, float A0, float A1)
{
	const int N = FMath::Max(6, FMath::CeilToInt(R * 3.f * (A1 - A0)));
	for (int i = 0; i < N; i++)
	{
		const float T0 = A0 + (A1 - A0) * i / N, T1 = A0 + (A1 - A0) * (i + 1) / N;
		LineSeg(Cx + FMath::Cos(T0) * R, Cy + FMath::Sin(T0) * R, Cx + FMath::Cos(T1) * R, Cy + FMath::Sin(T1) * R);
	}
}

void AFM27MatchActor::BuildPitch()
{
	// mown stripes
	for (int i = 0; i < 20; i++)
	{
		const float X = 5.25f * i + 2.625f;
		const FLinearColor G = (i & 1) ? FLinearColor(0.045f, 0.20f, 0.04f) : FLinearColor(0.06f, 0.26f, 0.05f);
		Box(MeshCube, FM27Look::World(X, 34.f, -0.01f), FVector(525.f, 6800.f, 2.f), G);
	}
	Box(MeshCube, FVector(0, 0, -3), FVector(16000.f, 12000.f, 2.f), FLinearColor(0.035f, 0.15f, 0.035f)); // run-off
	LineSeg(0, 0, 105, 0); LineSeg(0, 68, 105, 68); LineSeg(0, 0, 0, 68); LineSeg(105, 0, 105, 68); LineSeg(52.5f, 0, 52.5f, 68);
	Arc(52.5f, 34, 9.15f, 0, 2 * UE_PI);
	for (int S = 0; S < 2; S++)
	{
		const float Gx = S == 0 ? 0 : 105, D = S == 0 ? 1 : -1;
		LineSeg(Gx, 13.84f, Gx + D * 16.5f, 13.84f); LineSeg(Gx + D * 16.5f, 13.84f, Gx + D * 16.5f, 54.16f); LineSeg(Gx, 54.16f, Gx + D * 16.5f, 54.16f);
		LineSeg(Gx, 24.84f, Gx + D * 5.5f, 24.84f); LineSeg(Gx + D * 5.5f, 24.84f, Gx + D * 5.5f, 43.16f); LineSeg(Gx, 43.16f, Gx + D * 5.5f, 43.16f);
		const float Px = S == 0 ? 11.f : 94.f, Ang = FMath::Acos(5.5f / 9.15f);
		if (S == 0) Arc(Px, 34, 9.15f, -Ang, Ang); else Arc(Px, 34, 9.15f, UE_PI - Ang, UE_PI + Ang);
		Box(MeshCylinder, FM27Look::World(Px, 34, 0.012f), FVector(30, 30, 1), FLinearColor(0.85f, 0.88f, 0.85f));
	}
	Box(MeshCylinder, FM27Look::World(52.5f, 34, 0.012f), FVector(30, 30, 1), FLinearColor(0.85f, 0.88f, 0.85f));
	for (const FVector2D& C : { FVector2D(0, 0), FVector2D(0, 68), FVector2D(105, 0), FVector2D(105, 68) })
	{
		Box(MeshCylinder, FM27Look::World(C.X, C.Y, 0.75f), FVector(4, 4, 150), FLinearColor::White, true);
		Box(MeshCube, FM27Look::World(C.X, C.Y, 1.35f) + FVector(0, 18, 0), FVector(1, 36, 26), FLinearColor(1.f, 0.75f, 0.02f), true);
	}
}

void AFM27MatchActor::BuildGoals()
{
	UInstancedStaticMeshComponent* Net = NewObject<UInstancedStaticMeshComponent>(this);
	Net->SetStaticMesh(MeshCylinder); Net->SetupAttachment(Root); Net->SetCastShadow(false); Net->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Net->SetMaterial(0, FM27Look::Mat(this, BaseMaterial, FLinearColor(0.85f, 0.85f, 0.85f)));
	Net->RegisterComponent();
	auto Strand = [&](const FVector& A, const FVector& B)
	{
		const FVector Mid = (A + B) * 0.5f, Dir = (B - A); const float Len = Dir.Size();
		const FRotator Rot = FRotationMatrix::MakeFromZ(Dir.GetSafeNormal()).Rotator();
		Net->AddInstance(FTransform(Rot, Mid, FVector(0.02f, 0.02f, Len / 100.f)));
	};
	for (int S = 0; S < 2; S++)
	{
		const float X = S == 0 ? 0.f : 105.f, D = S == 0 ? -1.f : 1.f, Depth = 2.2f;
		for (float Y : { 34.f - 3.66f, 34.f + 3.66f }) Box(MeshCylinder, FM27Look::World(X, Y, 1.22f), FVector(12, 12, 244), FLinearColor::White, true);
		Box(MeshCylinder, FM27Look::World(X, 34, 2.44f), FVector(12, 12, 744), FLinearColor::White, true, FRotator(0, 0, 90));
		// net: back, sides and roof as a grid of thin strands
		for (float Y = 34.f - 3.66f; Y <= 34.f + 3.67f; Y += 0.3f)
		{
			Strand(FM27Look::World(X + D * Depth, Y, 0), FM27Look::World(X + D * Depth, Y, 2.44f));
			Strand(FM27Look::World(X, Y, 2.44f), FM27Look::World(X + D * Depth, Y, 2.44f));
		}
		for (float Z = 0.f; Z <= 2.45f; Z += 0.3f)
		{
			Strand(FM27Look::World(X + D * Depth, 34.f - 3.66f, Z), FM27Look::World(X + D * Depth, 34.f + 3.66f, Z));
			for (float Y : { 34.f - 3.66f, 34.f + 3.66f }) Strand(FM27Look::World(X, Y, Z), FM27Look::World(X + D * Depth, Y, Z));
		}
		for (float Dx = 0.f; Dx <= Depth + 0.01f; Dx += 0.3f)
		{
			Strand(FM27Look::World(X + D * Dx, 34.f - 3.66f, 0), FM27Look::World(X + D * Dx, 34.f - 3.66f, 2.44f));
			Strand(FM27Look::World(X + D * Dx, 34.f + 3.66f, 0), FM27Look::World(X + D * Dx, 34.f + 3.66f, 2.44f));
			Strand(FM27Look::World(X + D * Dx, 34.f - 3.66f, 2.44f), FM27Look::World(X + D * Dx, 34.f + 3.66f, 2.44f));
		}
	}
}

void AFM27MatchActor::BuildStands()
{
	const FLinearColor Concrete(0.12f, 0.12f, 0.14f), RoofC(0.05f, 0.05f, 0.07f);
	// fan colours: home colour shades, white, black, away corner
	TArray<FLinearColor> Palette = { HomeColor, HomeColor * 0.7f, FLinearColor(0.85f, 0.85f, 0.88f), FLinearColor(0.04f, 0.04f, 0.05f), AwayColor, FLinearColor(0.35f, 0.25f, 0.18f) };
	for (const FLinearColor& C : Palette)
	{
		UInstancedStaticMeshComponent* I = NewObject<UInstancedStaticMeshComponent>(this);
		I->SetStaticMesh(MeshCube); I->SetupAttachment(Root); I->SetCastShadow(false); I->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		I->SetMaterial(0, FM27Look::Mat(this, BaseMaterial, C)); I->RegisterComponent();
		Crowd.Add(I); CrowdBase.AddDefaulted();
	}
	UInstancedStaticMeshComponent* Heads = NewObject<UInstancedStaticMeshComponent>(this);
	Heads->SetStaticMesh(MeshSphere); Heads->SetupAttachment(Root); Heads->SetCastShadow(false); Heads->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Heads->SetMaterial(0, FM27Look::Mat(this, BaseMaterial, FM27Look::Skin(2))); Heads->RegisterComponent();
	Crowd.Add(Heads); CrowdBase.AddDefaulted();
	const int32 HeadIdx = Crowd.Num() - 1;

	FRandomStream Rnd(9);
	struct FStand { FVector Centre; float Len; float Yaw; };
	const FStand Stands[] = { { FVector(0, -4300, 0), 12200, 0 }, { FVector(0, 4300, 0), 12200, 180 }, { FVector(-6150, 0, 0), 8400, 90 }, { FVector(6150, 0, 0), 8400, -90 } };
	const int Rows = 22; const float RowH = 55.f, RowD = 85.f;
	for (int SI = 0; SI < 4; SI++)
	{
		const FStand& St = Stands[SI];
		const FTransform Frame(FRotator(0, St.Yaw, 0), St.Centre);
		// local: X along the stand, -Y away from the pitch
		for (int R = 0; R < Rows; R++)
			Box(MeshCube, Frame.TransformPosition(FVector(0, -(R + 0.5f) * RowD, (R + 1) * RowH * 0.5f)), FVector(St.Len, RowD, (R + 1) * RowH), Concrete, false, FRotator(0, St.Yaw, 0));
		Box(MeshCube, Frame.TransformPosition(FVector(0, -Rows * RowD - 50, Rows * RowH * 0.5f + 300)), FVector(St.Len + 200, 100, Rows * RowH + 600), Concrete, false, FRotator(0, St.Yaw, 0));
		Box(MeshCube, Frame.TransformPosition(FVector(0, -Rows * RowD * 0.5f - 100, Rows * RowH + 750)), FVector(St.Len + 400, Rows * RowD + 600, 40), RoofC, true, FRotator(0, St.Yaw, -6));
		for (int R = 0; R < Rows; R++)
			for (float X = -St.Len / 2 + 40; X < St.Len / 2 - 40; X += 62)
			{
				if (Rnd.FRand() < 0.08f) continue;
				const FVector P = Frame.TransformPosition(FVector(X + Rnd.FRand() * 12, -(R + 0.5f) * RowD + 15, (R + 1) * RowH));
				int32 Group = Rnd.FRand() < 0.55f ? (Rnd.FRand() < 0.6f ? 0 : 1) : (Rnd.FRand() < 0.5f ? 2 : 3);
				if (SI == 3 && Rnd.FRand() < 0.8f) Group = 4; // away end
				const FTransform Body(FRotator(0, St.Yaw, 0), P + FVector(0, 0, 28), FVector(0.42f, 0.26f, 0.56f));
				const FTransform Head(FRotator::ZeroRotator, P + FVector(0, 0, 66), FVector(0.2f));
				Crowd[Group]->AddInstance(Body); CrowdBase[Group].Add(Body);
				Crowd[HeadIdx]->AddInstance(Head); CrowdBase[HeadIdx].Add(Head);
			}
	}
	// advertising boards
	const FLinearColor BoardC[] = { FLinearColor(0.02f, 0.02f, 0.04f), HomeColor * 0.8f, FLinearColor(0.03f, 0.15f, 0.6f) };
	const TCHAR* Words[] = { TEXT("FUSSBALL MANAGER 2027"), TEXT("BAKUSA"), TEXT("LIVE 3D"), TEXT("FM27") };
	int N = 0;
	for (float X = -5000; X <= 5000; X += 1250)
		for (float Y : { -3720.f, 3720.f })
		{
			Box(MeshCube, FVector(X, Y, 45), FVector(1220, 15, 90), BoardC[N % 3]);
			UTextRenderComponent* T = NewObject<UTextRenderComponent>(this);
			T->SetupAttachment(Root); T->SetRelativeLocation(FVector(X, Y + (Y < 0 ? 9.f : -9.f), 45)); T->SetRelativeRotation(FRotator(0, Y < 0 ? 90.f : -90.f, 0));
			T->SetHorizontalAlignment(EHTA_Center); T->SetVerticalAlignment(EVRTA_TextCenter); T->SetWorldSize(48.f); T->SetText(FText::FromString(Words[N % 4])); T->SetTextRenderColor(FColor::White);
			T->RegisterComponent();
			N++;
		}
}

void AFM27MatchActor::BuildLights()
{
	UWorld* W = GetWorld();
	if (ADirectionalLight* Sun = W->SpawnActor<ADirectionalLight>(FVector::ZeroVector, FRotator(bNight ? -55.f : -40.f, -35.f, 0)))
	{
		UDirectionalLightComponent* L = Cast<UDirectionalLightComponent>(Sun->GetLightComponent());
		L->SetMobility(EComponentMobility::Movable);
		L->SetIntensity(bNight ? 2.5f : 8.f); L->SetLightColor(bNight ? FLinearColor(0.75f, 0.82f, 1.f) : FLinearColor(1.f, 0.93f, 0.82f));
		L->SetAtmosphereSunLight(true); L->SetCastShadows(true);
	}
	if (ASkyLight* Sky = W->SpawnActor<ASkyLight>())
	{
		USkyLightComponent* L = Sky->GetLightComponent();
		L->SetMobility(EComponentMobility::Movable); L->bRealTimeCapture = true; L->SetIntensity(bNight ? 0.6f : 1.f); L->RecaptureSky();
	}
	if (AActor* Atmos = W->SpawnActor<AActor>())
	{
		USkyAtmosphereComponent* A = NewObject<USkyAtmosphereComponent>(Atmos); A->RegisterComponent(); Atmos->SetRootComponent(A);
	}
	if (AExponentialHeightFog* Fog = W->SpawnActor<AExponentialHeightFog>())
	{
		Fog->GetComponent()->SetFogDensity(Setup.weather == "rain" ? 0.04f : 0.012f);
		Fog->GetComponent()->SetVolumetricFog(!bNight ? false : true);
	}
	if (APostProcessVolume* PP = W->SpawnActor<APostProcessVolume>())
	{
		PP->bUnbound = true;
		PP->Settings.bOverride_BloomIntensity = true; PP->Settings.BloomIntensity = 0.55f;
		PP->Settings.bOverride_VignetteIntensity = true; PP->Settings.VignetteIntensity = 0.35f;
		PP->Settings.bOverride_AutoExposureBias = true; PP->Settings.AutoExposureBias = bNight ? 0.6f : 0.f;
	}
	// floodlight masts with real spot lights aimed at the pitch
	const FLinearColor Mast(0.2f, 0.2f, 0.22f);
	for (const FVector& C : { FVector(-6400, -4800, 0), FVector(6400, -4800, 0), FVector(-6400, 4800, 0), FVector(6400, 4800, 0) })
	{
		Box(MeshCylinder, C + FVector(0, 0, 2100), FVector(90, 90, 4200), Mast, true);
		Box(MeshCube, C + FVector(0, 0, 4300), FVector(60, 700, 400), FLinearColor(1.f, 1.f, 0.95f), false, FRotator(0, FMath::RadiansToDegrees(FMath::Atan2(-C.Y, -C.X)) + 90.f, 0));
		if (ASpotLight* S = W->SpawnActor<ASpotLight>(C + FVector(0, 0, 4200), (FVector::ZeroVector - (C + FVector(0, 0, 4200))).Rotation()))
		{
			USpotLightComponent* L = Cast<USpotLightComponent>(S->GetLightComponent());
			L->SetMobility(EComponentMobility::Movable);
			L->SetIntensity(bNight ? 60000.f : 15000.f); L->SetAttenuationRadius(16000.f); L->SetOuterConeAngle(38.f); L->SetInnerConeAngle(24.f);
			L->SetLightColor(FLinearColor(0.96f, 0.97f, 1.f)); L->SetCastShadows(true);
		}
	}
}

// ======================================================================= loop
void AFM27MatchActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!Sim) return;
	const float Dt = FMath::Min(DeltaSeconds, 0.1f);
	if (PlayingClip < 0 && QueuedClip >= 0) { ReplayDelay -= Dt; if (ReplayDelay <= 0.f) { const int32 Q = QueuedClip; QueuedClip = -1; StartReplay(Q); } }
	if (PlayingClip >= 0) { ReplayTick(Dt); UpdateCrowd(Dt); return; }
	if (!bPaused && !Sim->finished) Sim->Advance(Dt * Speed);
	const float Alpha = FMath::Clamp(Sim->Alpha(), 0.f, 1.f);
	for (AFM27PlayerActor* P : Players) if (P) P->Sync(Alpha, Dt);
	const fm27::Ball& B = Sim->ball;
	const fm27::V2 Bp = fm27::V2::Lerp(B.prev, B.pos, Alpha);
	const FVector BallW = FM27Look::World(Bp.x, Bp.y, FMath::Lerp(B.prevZ, B.z, Alpha)) + FVector(0, 0, 11);
	if (BallMesh)
	{
		const FVector Move = BallW - LastBall;
		if (Move.Size2D() > 0.1f && Move.Size2D() < 300.f)
		{
			const FVector Axis = FVector::CrossProduct(FVector::UpVector, Move.GetSafeNormal2D());
			BallMesh->AddWorldRotation(FQuat(Axis, Move.Size2D() / 11.f));
		}
		BallMesh->SetWorldLocation(BallW); LastBall = BallW;
	}
	UpdateCamera(BallW, FVector(B.vel.x, B.vel.y, 0) * 100.f, Dt);
	UpdateCrowd(Dt);
	if (Sim->finished)
	{
		if (!bResultWritten) { WriteResult(); EndTimer = 6.f; }
		if (!bHighlightsDone)
		{
			bHighlightsDone = true;
			if (bHighlights && !Sim->clips.empty())
			{
				for (int32 i = 0; i < (int32)Sim->clips.size(); i++) if (Sim->clips[i].type == "goal") HlQueue.Add(i);
				for (int32 i = 0; i < (int32)Sim->clips.size() && HlQueue.Num() < 8; i++) if (Sim->clips[i].type != "goal") HlQueue.Add(i);
				if (HlQueue.Num() > 8) HlQueue.SetNum(8);
				bHighlightsMode = true; HlIndex = 0; StartReplay(HlQueue[0]);
				return;
			}
		}
		EndTimer -= DeltaSeconds;
		if (EndTimer <= 0.f && !ResultPath.IsEmpty()) FPlatformMisc::RequestExit(false);
	}
}

void AFM27MatchActor::UpdateCamera(const FVector& Ball, const FVector& BallVel, float Dt)
{
	if (!Cam) return;
	FVector Target = Ball + BallVel * 0.35f;
	Target.X = FMath::Clamp(Target.X, -4000.f, 4000.f); Target.Z = 0; Target.Y = FMath::Clamp(Target.Y * 0.55f, -1400.f, 1400.f);
	const bool bClose = Focus.IsValid() && GetWorld()->GetTimeSeconds() < CloseUpUntil;
	FVector Pos; float Fov;
	if (bClose)
	{
		Target = Focus->GetActorLocation() + FVector(0, 0, 120);
		Pos = Focus->GetActorLocation() + FVector(FMath::Sin(GetWorld()->GetTimeSeconds() * 0.3f) * 300.f, -900.f, 320.f); Fov = 32.f;
	}
	else if (CamMode == 10 || CamMode == 11)
	{
		const float GX = Sim->clips.empty() || PlayingClip < 0 ? 0.f : (Sim->clips[PlayingClip].goalX - 52.5f) * 100.f;
		const float Sgn = GX >= 0.f ? 1.f : -1.f;
		Target = Ball;
		if (CamMode == 10) { Pos = FVector(Ball.X - Sgn * 900.f, FMath::Clamp(Ball.Y, -3000.f, 3000.f) - 1700.f, 260.f); Fov = 30.f; }
		else { Pos = FVector(GX + Sgn * 1300.f, Ball.Y * 0.25f, 550.f); Fov = 38.f; }
	}
	else
	{
		const int Dir = Sim->ball.owner ? Sim->Dir(Sim->ball.owner->side) : 1;
		switch (CamMode)
		{
		case 1: Pos = FVector(Target.X * 0.55f, -7800.f, 3400.f); Fov = 36.f; break;
		case 2: Pos = FVector(Target.X - Dir * 2400.f, Target.Y * 0.6f, 1100.f); Fov = 46.f; break;
		case 3: Pos = FVector(Target.X, Target.Y - 2200.f, 7200.f); Fov = 42.f; break;
		default: Pos = FVector(Target.X * 0.82f, -6400.f, 2100.f); Fov = 24.f + FMath::Abs(Target.X) * 0.0006f; break;
		}
	}
	CamLook = FMath::VInterpTo(CamLook, Target, Dt, bClose ? 4.f : 2.6f);
	const FVector NewPos = FMath::VInterpTo(Cam->GetActorLocation(), Pos, Dt, bClose ? 3.f : 2.2f);
	Cam->SetActorLocationAndRotation(NewPos, FMath::RInterpTo(Cam->GetActorRotation(), (CamLook - NewPos).Rotation(), Dt, 8.f));
	UCameraComponent* C = Cam->GetCameraComponent();
	C->SetFieldOfView(FMath::FInterpTo(C->FieldOfView, Fov, Dt, 2.f));
}

void AFM27MatchActor::UpdateCrowd(float Dt)
{
	Cheer = FMath::FInterpConstantTo(Cheer, 0.f, Dt, 0.12f);
	CrowdTick -= Dt;
	if (Cheer < 0.05f || CrowdTick > 0.f) return;
	CrowdTick = 1.f / 30.f;
	const float Now = GetWorld()->GetTimeSeconds();
	for (int32 G = 0; G < Crowd.Num(); G++)
	{
		TArray<FTransform> Moved = CrowdBase[G];
		for (int32 i = 0; i < Moved.Num(); i++)
		{
			const float H = FMath::Max(0.f, FMath::Sin(Now * (5.f + (i % 7)) + i * 0.37f)) * 35.f * Cheer;
			Moved[i].AddToTranslation(FVector(0, 0, H));
		}
		Crowd[G]->BatchUpdateInstancesTransforms(0, Moved, false, true);
	}
}

void AFM27MatchActor::OnSimEvent(const fm27::MatchEvent& E)
{
	const FString Club = E.side == 0 ? HomeShort : E.side == 1 ? AwayShort : FString();
	FString Line; bool bGoal = false;
	if (E.type == "goal") { Line = FString::Printf(TEXT("%d'  TOR! %s (%s)"), E.minute, *NameOf(E.player), *Club); bGoal = true; Cheer = 1.f;
		for (AFM27PlayerActor* P : Players) if (P && P->Agent && P->Agent->p.id == E.player) { Focus = P; CloseUpUntil = GetWorld()->GetTimeSeconds() + 4.5f / FMath::Max(1.f, Speed * 0.5f); } }
	else if (E.type == "yellow") Line = FString::Printf(TEXT("%d'  Gelb: %s"), E.minute, *NameOf(E.player));
	else if (E.type == "red") Line = FString::Printf(TEXT("%d'  ROT: %s"), E.minute, *NameOf(E.player));
	else if (E.type == "save") { Line = FString::Printf(TEXT("%d'  Parade %s"), E.minute, *NameOf(E.player)); Cheer = FMath::Max(Cheer, 0.5f); }
	else if (E.type == "penalty") Line = FString::Printf(TEXT("%d'  Elfmeter fuer %s"), E.minute, *Club);
	else if (E.type == "post") { Line = FString::Printf(TEXT("%d'  Aluminium!"), E.minute); Cheer = FMath::Max(Cheer, 0.6f); }
	else if (E.type == "halftime" || E.type == "fulltime") Line = FM27Json::Str(E.text);
	else if (E.type == "shot") Cheer = FMath::Max(Cheer, 0.25f);
	else if (E.type == "clip" && E.text == "goal" && bReplays && E.assist >= 0) { QueuedClip = E.assist; ReplayDelay = 1.6f; }
	else if (E.type == "formation" || E.type == "sub") Line = FString::Printf(TEXT("%d'  %s"), E.minute, *FM27Json::Str(E.text));
	if (!Line.IsEmpty()) { Feed.Insert({ Line, GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f, bGoal }, 0); if (Feed.Num() > 5) Feed.SetNum(5); }
}

FString AFM27MatchActor::NameOf(int32 Id) const
{
	for (const auto* T : { &Setup.home, &Setup.away })
	{
		for (const auto& P : T->players) if (P.id == Id) return FM27Json::Str(P.name);
		for (const auto& P : T->bench) if (P.id == Id) return FM27Json::Str(P.name);
	}
	return Id ? TEXT("?") : TEXT("Eigentor");
}

void AFM27MatchActor::WriteResult()
{
	bResultWritten = true;
	if (ResultPath.IsEmpty()) return;
	FFileHelper::SaveStringToFile(FM27Json::WriteSummary(Sim->summary), *ResultPath, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
}

// ======================================================================= controls / HUD data
void AFM27MatchActor::CycleCamera() { LiveCamMode = (LiveCamMode + 1) % 4; if (PlayingClip < 0) CamMode = LiveCamMode; CameraName = CamNames[LiveCamMode]; }
void AFM27MatchActor::ChangeMentality(int Delta)
{
	if (!Sim || UserSide < 0) return;
	Sim->SetMentality(UserSide, Sim->mentality[UserSide] + Delta);
}
int32 AFM27MatchActor::UserMentality() const { return Sim && UserSide >= 0 ? Sim->mentality[UserSide] : 0; }
void AFM27MatchActor::FinishNow() { if (Sim) { Sim->RunToEnd(); } }
int32 AFM27MatchActor::HomeGoals() const { return Sim ? Sim->score[0] : 0; }
int32 AFM27MatchActor::AwayGoals() const { return Sim ? Sim->score[1] : 0; }
FString AFM27MatchActor::Clock() const { return Sim ? FM27Json::Str(Sim->Clock()) : TEXT("00:00"); }
bool AFM27MatchActor::IsFinished() const { return Sim && Sim->finished; }

// ======================================================================= replays & highlights (v3.3)
void AFM27MatchActor::StartReplay(int32 ClipIdx)
{
	if (!Sim || ClipIdx < 0 || ClipIdx >= (int32)Sim->clips.size() || Sim->clips[ClipIdx].frames.size() < 2) { PlayingClip = -1; EndReplay(); return; }
	PlayingClip = ClipIdx; PlayT = 0.f; CamMode = 10; Focus.Reset();
	const fm27::Clip& C = Sim->clips[ClipIdx];
	ReplayLabel = bHighlightsMode ? FString::Printf(TEXT("HIGHLIGHTS %d/%d   %d'  %s"), HlIndex + 1, HlQueue.Num(), C.minute, *FM27Json::Str(C.text))
	                              : FString::Printf(TEXT("WIEDERHOLUNG   %d'  %s"), C.minute, *FM27Json::Str(C.text));
	Cheer = FMath::Max(Cheer, C.type == "goal" ? 0.6f : 0.3f);
}

void AFM27MatchActor::ReplayTick(float Dt)
{
	const fm27::Clip& C = Sim->clips[PlayingClip];
	const float Dur = C.Duration();
	const float Rate = (PlayT > Dur - 4.2f && PlayT < Dur - 1.6f) ? 0.42f : 1.f; // slow motion around the decisive moment
	PlayT += Dt * Rate;
	if (PlayT >= Dur) { EndReplay(); return; }
	if (PlayT > Dur * 0.5f) CamMode = 11;
	const float T = C.frames.front().t + PlayT;
	size_t i = 0; while (i + 2 < C.frames.size() && C.frames[i + 1].t <= T) i++;
	const fm27::Frame& A = C.frames[i]; const fm27::Frame& B = C.frames[i + 1];
	const float K = FMath::Clamp((T - A.t) / FMath::Max(1e-4f, B.t - A.t), 0.f, 1.f);
	for (int32 n = 0; n < Players.Num() && n < 22; n++) if (Players[n]) Players[n]->ReplayPose(A.p[n], B.p[n], K, Dt);
	const FVector BallW = FM27Look::World(FMath::Lerp(A.bx, B.bx, K), FMath::Lerp(A.by, B.by, K), FMath::Lerp(A.bz, B.bz, K)) + FVector(0, 0, 11);
	if (BallMesh)
	{
		const FVector Move = BallW - LastBall;
		if (Move.Size2D() > 0.1f && Move.Size2D() < 300.f) BallMesh->AddWorldRotation(FQuat(FVector::CrossProduct(FVector::UpVector, Move.GetSafeNormal2D()), Move.Size2D() / 11.f));
		BallMesh->SetWorldLocation(BallW); LastBall = BallW;
	}
	UpdateCamera(BallW, FVector::ZeroVector, Dt);
}

void AFM27MatchActor::EndReplay()
{
	PlayingClip = -1; ReplayLabel.Reset();
	if (bHighlightsMode)
	{
		HlIndex++;
		if (HlIndex < HlQueue.Num()) { StartReplay(HlQueue[HlIndex]); return; }
		bHighlightsMode = false; EndTimer = 2.f;
	}
	CamMode = LiveCamMode;
}

void AFM27MatchActor::SkipReplay()
{
	if (PlayingClip < 0) { QueuedClip = -1; return; }
	if (bHighlightsMode) HlIndex = HlQueue.Num();
	EndReplay();
}

// ======================================================================= live tactics & substitutions
static const char* GFormations[] = { "4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1", "3-4-3", "4-5-1" };
static const float GPress[] = { 0.25f, 0.5f, 0.85f };
static const TCHAR* GPressName[] = { TEXT("niedrig"), TEXT("mittel"), TEXT("hoch") };

FString AFM27MatchActor::FormationName() const { return UserSide >= 0 ? FM27Json::Str(UserTeam().formation) : FString(); }
FString AFM27MatchActor::PressingName() const { return GPressName[FMath::Clamp(PressIdx, 0, 2)]; }

void AFM27MatchActor::CycleFormation()
{
	if (!Sim || UserSide < 0) return;
	const std::string Cur = UserTeam().formation; int32 Idx = 0;
	for (int32 i = 0; i < 8; i++) if (Cur == GFormations[i]) Idx = i;
	Sim->SetFormation(UserSide, GFormations[(Idx + 1) % 8]);
	(UserSide == 1 ? Setup.away : Setup.home).formation = GFormations[(Idx + 1) % 8];
}

void AFM27MatchActor::CyclePressing()
{
	if (!Sim || UserSide < 0) return;
	PressIdx = (PressIdx + 1) % 3; Sim->SetPressing(UserSide, GPress[PressIdx]);
	Feed.Insert({ FString::Printf(TEXT("Pressing: %s"), GPressName[PressIdx]), GetWorld()->GetTimeSeconds(), false }, 0); if (Feed.Num() > 5) Feed.SetNum(5);
}

void AFM27MatchActor::ToggleSubMenu()
{
	if (!Sim || UserSide < 0 || Sim->finished || PlayingClip >= 0) return;
	if (bSubMenu) { MenuBack(); return; }
	if (SubsUsed >= 5) { Feed.Insert({ TEXT("Alle 5 Wechsel aufgebraucht"), GetWorld()->GetTimeSeconds(), false }, 0); if (Feed.Num() > 5) Feed.SetNum(5); return; }
	bSubMenu = true; MenuStage = 0; MenuIndex = 0; OutSlot = -1; bPausedBeforeMenu = bPaused; bPaused = true;
}

TArray<FString> AFM27MatchActor::MenuLines() const
{
	TArray<FString> L;
	if (!Sim || UserSide < 0) return L;
	if (MenuStage == 0)
		for (const fm27::Agent& A : Sim->teams[UserSide])
			L.Add(FString::Printf(TEXT("%-3s %s   (%d, Kraft %d%%)%s"), *FM27Json::Str(A.p.pos), *FM27Json::Str(A.p.name), A.p.ovr, (int32)(A.stamina * 100.f), A.sentOff ? TEXT("  - vom Platz") : TEXT("")));
	else
		for (const fm27::PlayerSetup& P : UserTeam().bench)
			if (!SubbedOut.Contains(P.id)) L.Add(FString::Printf(TEXT("%-3s %s   (%d)"), *FM27Json::Str(P.pos), *FM27Json::Str(P.name), P.ovr));
	return L;
}

void AFM27MatchActor::MenuMove(int32 Delta)
{
	const int32 N = MenuLines().Num();
	if (N > 0) MenuIndex = (MenuIndex + Delta + N) % N;
}

void AFM27MatchActor::MenuConfirm()
{
	if (!bSubMenu || !Sim) return;
	if (MenuStage == 0)
	{
		if (MenuIndex >= (int32)Sim->teams[UserSide].size() || Sim->teams[UserSide][MenuIndex].sentOff) return;
		OutSlot = MenuIndex; MenuStage = 1; MenuIndex = 0;
		if (MenuLines().Num() == 0) MenuBack();
		return;
	}
	TArray<const fm27::PlayerSetup*> Avail;
	for (const fm27::PlayerSetup& P : UserTeam().bench) if (!SubbedOut.Contains(P.id)) Avail.Add(&P);
	if (!Avail.IsValidIndex(MenuIndex) || OutSlot < 0) return;
	const fm27::PlayerSetup In = *Avail[MenuIndex];
	const int32 OutId = Sim->teams[UserSide][OutSlot].p.id;
	Sim->Substitute(UserSide, OutId, In);
	SubbedOut.Add(In.id); SubbedOut.Add(OutId); SubsUsed++;
	const int32 Idx = UserSide * 11 + OutSlot;
	if (Players.IsValidIndex(Idx))
	{
		// a fresh actor for the new player (components can't be re-created on the old one)
		const fm27::Agent& A = Sim->teams[UserSide][OutSlot];
		if (Players[Idx]) Players[Idx]->Destroy();
		AFM27PlayerActor* P = GetWorld()->SpawnActor<AFM27PlayerActor>(AFM27PlayerActor::StaticClass(), FM27Look::World(A.pos.x, A.pos.y, 0), FRotator::ZeroRotator);
		if (P) P->Init(&A, UserTeam(), MeshCube, MeshSphere, MeshCylinder, BaseMaterial);
		Players[Idx] = P;
	}
	bSubMenu = false; bPaused = bPausedBeforeMenu;
}

void AFM27MatchActor::MenuBack()
{
	if (MenuStage == 1) { MenuStage = 0; MenuIndex = FMath::Max(0, OutSlot); return; }
	bSubMenu = false; bPaused = bPausedBeforeMenu;
}
