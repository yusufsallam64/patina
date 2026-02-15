import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { VibeProfile } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { vibe }: { vibe: VibeProfile } = await request.json();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are a perceptive art critic who can see into someone's creative taste. Given this aesthetic profile, write 2-3 sentences describing what this person's eye is drawn to and why. Be specific and incisive — reference visual qualities, tensions, or cultural touchpoints. Write in second person ("You're drawn to..."). No clichés, no flattery, no flowery language. Be direct.

Color palette: ${vibe.color_palette.dominant.join(", ")}
Background tone: ${vibe.color_palette.background_tone}
Mood: ${vibe.mood_tags.join(", ")}
Aesthetic: ${vibe.aesthetic_tags.join(", ")}
Texture: ${vibe.texture}
Warmth: ${vibe.lighting.warmth}, Contrast: ${vibe.lighting.contrast}
Saturation: ${vibe.saturation}
Sonic mood: ${vibe.sonic_mood}

Return ONLY the 2-3 sentences. No quotes, no label, no explanation.`,
        },
      ],
    });

    const narrative =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    return NextResponse.json({ narrative });
  } catch (error) {
    console.error("Vibe narrative error:", error);
    return NextResponse.json(
      { error: "Failed to generate narrative" },
      { status: 500 }
    );
  }
}
