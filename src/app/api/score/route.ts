// src/app/api/score/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // Edge가 아니라 Node 런타임 사용

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("audio") as File | null;
    const text = form.get("text") as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, message: "audio 파일이 없습니다." }, { status: 400 });
    }

    // 간단한 검증
    const meta = {
      name: file.name,
      type: file.type,
      size: file.size,
      text,
    };

    // 실제 Azure 연결 전까지는 파일을 저장하지 않고 메타만 회신
    return NextResponse.json({ ok: true, meta });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "서버 오류" },
      { status: 500 }
    );
  }
}
