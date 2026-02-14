import { NextResponse } from "next/server";
import type { GenerateMusicRequest, GenerateMusicResponse } from "@/types";

export const maxDuration = 120;

// TODO: Implement Suno API integration
// Suno is providing TreeHacks participants with API access.
// API docs will be provided at the event.
//
// Expected flow:
// 1. Take sonic_mood + mood_tags from vibe profile
// 2. Build a music generation prompt
// 3. Call Suno API to generate a track
// 4. Return audio URL

export async function POST(request: Request) {
  try {
    const body: GenerateMusicRequest = await request.json();
    const { sonic_mood, mood_tags, duration } = body;

    // TODO: Replace with actual Suno API call when docs are available

    return NextResponse.json(
      { error: "Music generation not yet implemented — awaiting Suno API docs" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Generate music error:", error);
    return NextResponse.json(
      { error: "Failed to generate music" },
      { status: 500 }
    );
  }
}
