import { NextRequest, NextResponse } from "next/server";
import { uploadToSpaces } from "@/lib/spaces";

const SUNO_BASE = "https://studio-api.prod.suno.com/api/v2/external/hackathons";

/** Download audio from Suno CDN and re-upload to DO Spaces for permanent storage */
async function proxyAudioToSpaces(sunoUrl: string): Promise<string> {
  const res = await fetch(sunoUrl);
  if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = sunoUrl.includes(".mp3") ? "mp3" : "wav";
  const key = `audio/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  return uploadToSpaces(buffer, key, `audio/${ext === "mp3" ? "mpeg" : "wav"}`);
}

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

  // Proxy completed audio to DO Spaces for permanent storage
  let audioUrl = clip?.audio_url || null;
  if (audioUrl && clip?.status === "complete") {
    try {
      audioUrl = await proxyAudioToSpaces(audioUrl);
    } catch (e) {
      console.error("Failed to proxy audio to Spaces:", e);
    }
  }

  return NextResponse.json({
    status: clip?.status || "unknown",
    audio_url: audioUrl,
    title: clip?.title || null,
    image_url: clip?.image_url || null,
  });
}
