import { NextResponse } from "next/server";
import type { GenerateMusicRequest } from "@/types";
import { uploadToSpaces } from "@/lib/spaces";

export const maxDuration = 120;

const SUNO_BASE = "https://studio-api.prod.suno.com/api/v2/external/hackathons";

/** Download audio from Suno CDN and re-upload to DO Spaces for permanent storage */
async function proxyAudioToSpaces(sunoUrl: string): Promise<string> {
  const res = await fetch(sunoUrl);
  if (!res.ok) throw new Error(`Failed to fetch audio from Suno: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = sunoUrl.includes(".mp3") ? "mp3" : "wav";
  const key = `audio/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  return uploadToSpaces(buffer, key, `audio/${ext === "mp3" ? "mpeg" : "wav"}`);
}

export async function POST(request: Request) {
  try {
    const body: GenerateMusicRequest = await request.json();
    const { sonic_mood, mood_tags, duration } = body;

    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "SUNO_API_KEY not configured" }, { status: 503 });
    }

    // Build a descriptive topic from the vibe profile
    const topic = `${sonic_mood}. A ${mood_tags.slice(0, 3).join(", ")} instrumental track.`.slice(0, 500);
    const tags = mood_tags.slice(0, 5).join(", ").slice(0, 100);

    // Step 1: Generate
    const genRes = await fetch(`${SUNO_BASE}/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic,
        tags,
        make_instrumental: true,
      }),
    });

    if (!genRes.ok) {
      const err = await genRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail || `Suno generate failed (${genRes.status})` },
        { status: genRes.status }
      );
    }

    const clip = await genRes.json();
    const clipId: string = clip.id;

    // Step 2: Poll until streaming or complete
    const POLL_INTERVAL = 2000;
    const MAX_POLLS = 50; // ~100s max

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      const pollRes = await fetch(`${SUNO_BASE}/clips?ids=${clipId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!pollRes.ok) continue;

      const clips = await pollRes.json();
      const current = Array.isArray(clips) ? clips[0] : clips;

      if (!current) continue;

      if (current.status === "streaming" || current.status === "complete") {
        // Proxy audio to DO Spaces so URLs don't expire
        let permanentUrl = current.audio_url;
        if (current.audio_url && current.status === "complete") {
          try {
            permanentUrl = await proxyAudioToSpaces(current.audio_url);
          } catch (e) {
            console.error("Failed to proxy audio to Spaces, using Suno URL:", e);
          }
        }

        return NextResponse.json({
          audio_url: permanentUrl,
          title: current.title || "Generated Track",
          status: current.status,
          clip_id: current.id,
          image_url: current.image_url,
        });
      }

      if (current.status === "error") {
        return NextResponse.json(
          { error: current.metadata?.error_message || "Suno generation failed" },
          { status: 500 }
        );
      }
    }

    // Timed out but return the clip ID so the client can keep polling
    return NextResponse.json({
      audio_url: null,
      title: "Generating...",
      status: "pending",
      clip_id: clipId,
    });
  } catch (error) {
    console.error("Generate music error:", error);
    return NextResponse.json(
      { error: "Failed to generate music" },
      { status: 500 }
    );
  }
}
