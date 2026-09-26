import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "hoichoi-content-studio",
    time: new Date().toISOString(),
  });
}
