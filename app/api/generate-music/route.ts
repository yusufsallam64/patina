import { NextResponse } from "next/server";
import type { GenerateMusicRequest } from "@/types";

export const maxDuration = 120;

const SUNO_BASE = "https://studio-api.prod.suno.com/api/v2/external/hackathons";

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
        return NextResponse.json({
          audio_url: current.audio_url,
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
