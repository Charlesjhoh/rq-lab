// src/app/api/evaluate/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const text = formData.get("text") as string | null;

    if (!audioFile || !text) {
      return NextResponse.json(
        { error: "audio or text missing" },
        { status: 400 }
      );
    }

    // ⚠️ 지금은 Azure 호출 대신 더미 응답
    // 다음 단계에서 여기를 실제 Azure 코드로 교체
    return NextResponse.json({
      score: 82,
      feedback: [
        "강세와 리듬이 안정적입니다.",
        "일부 모음 발음이 약하게 들립니다.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "evaluation failed" },
      { status: 500 }
    );
  }
}
