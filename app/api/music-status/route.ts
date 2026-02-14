import { NextRequest, NextResponse } from "next/server";

const SUNO_BASE = "https://studio-api.prod.suno.com/api/v2/external/hackathons";

export async function GET(req: NextRequest) {
  const clipId = req.nextUrl.searchParams.get("id");
  if (!clipId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SUNO_API_KEY not configured" }, { status: 503 });
  }

  const res = await fetch(`${SUNO_BASE}/clips?ids=${clipId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to poll Suno" }, { status: res.status });
  }

  const clips = await res.json();
  const clip = Array.isArray(clips) ? clips[0] : clips;

  return NextResponse.json({
    status: clip?.status || "unknown",
    audio_url: clip?.audio_url || null,
    title: clip?.title || null,
    image_url: clip?.image_url || null,
  });
}
