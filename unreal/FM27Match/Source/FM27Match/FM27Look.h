// Colours, coordinate mapping and material instances for the self-built look.
#pragma once
#include "CoreMinimal.h"
#include "Materials/MaterialInstanceDynamic.h"
#include <string>

namespace FM27Look
{
	/** Sim pitch metres (x 0..105, y 0..68, height z) -> Unreal world centimetres, pitch centre at origin. */
	inline FVector World(float X, float Y, float Z) { return FVector((X - 52.5f) * 100.f, (Y - 34.f) * 100.f, Z * 100.f); }

	inline FLinearColor Hex(const std::string& S, const FLinearColor& Fallback)
	{
		if (S.size() < 7 || S[0] != '#') return Fallback;
		const FColor C = FColor::FromHex(FString(UTF8_TO_TCHAR(S.c_str())));
		return FLinearColor::FromSRGBColor(C);
	}
	inline FLinearColor Skin(int Id)
	{
		static const FColor Skins[] = { FColor(245, 204, 176), FColor(222, 173, 133), FColor(184, 135, 97), FColor(140, 97, 66), FColor(97, 64, 43), FColor(69, 46, 31) };
		return FLinearColor::FromSRGBColor(Skins[FMath::Abs(Id * 7919) % 6]);
	}
	inline FLinearColor Hair(int Id)
	{
		static const FColor Hairs[] = { FColor(20, 15, 13), FColor(56, 36, 20), FColor(107, 71, 36), FColor(191, 153, 89), FColor(140, 61, 26), FColor(153, 153, 153) };
		return FLinearColor::FromSRGBColor(Hairs[FMath::Abs(Id * 104729 + 3) % 6]);
	}
	/** BasicShapeMaterial has a "Color" vector parameter – enough for a clean, stylised look without imported assets. */
	inline UMaterialInstanceDynamic* Mat(UObject* Outer, UMaterialInterface* Base, const FLinearColor& Color)
	{
		UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(Base, Outer);
		if (M) M->SetVectorParameterValue(TEXT("Color"), Color);
		return M;
	}
}
