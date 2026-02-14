import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { uploadToSpaces } from "@/lib/spaces";
import type { VibeProfile } from "@/types";

export const maxDuration = 300;

/**
 * Build a rich diffusion prompt from the composite vibe profile.
 */
function vibeToPrompt(vibe: VibeProfile): string {
  const parts: string[] = [];

  // Core mood
  parts.push(vibe.mood);

  // Aesthetic direction
  if (vibe.aesthetic_tags.length > 0) {
    parts.push(`${vibe.aesthetic_tags.join(", ")} aesthetic`);
  }

  // Color guidance
  if (vibe.color_palette.dominant.length > 0) {
    parts.push(`dominant colors: ${vibe.color_palette.dominant.join(", ")}`);
  }
  if (vibe.color_palette.accent.length > 0) {
    parts.push(`accent colors: ${vibe.color_palette.accent.join(", ")}`);
  }
  parts.push(`${vibe.color_palette.background_tone} background tone`);

  // Lighting
  const warmthDesc = vibe.lighting.warmth > 0.6 ? "warm" : vibe.lighting.warmth < 0.4 ? "cool" : "neutral";
  const contrastDesc = vibe.lighting.contrast > 0.6 ? "high contrast" : vibe.lighting.contrast < 0.4 ? "low contrast, soft" : "balanced contrast";
  parts.push(`${warmthDesc} lighting, ${contrastDesc}`);

  // Texture
  if (vibe.texture) {
    parts.push(`${vibe.texture} texture`);
  }

  // Mood tags for extra flavour
  if (vibe.mood_tags.length > 0) {
    parts.push(vibe.mood_tags.slice(0, 4).join(", "));
  }

  // Technical quality
  parts.push("masterpiece, highly detailed, professional photography, 8k");

  return parts.join(". ") + ".";
}

/**
 * Call a deployed Modal function for text-to-image generation.
 *
 * Expected Modal endpoint contract:
 *   POST <MODAL_IMAGE_GEN_URL>
 *   Headers:  Authorization: Bearer <tokenId>:<tokenSecret>
 *   Body (JSON): { prompt: string, width?: number, height?: number }
 *   Response (JSON): { image: "<base64-encoded PNG>" }
 */
async function callModal(prompt: string): Promise<Buffer> {
  const url = process.env.MODAL_IMAGE_GEN_URL || process.env.MODAL_FUNCTION_URL;
  if (!url) throw new Error("MODAL_IMAGE_GEN_URL is not configured");

  const tokenId = process.env.MODAL_TOKEN_ID;
  const tokenSecret = process.env.MODAL_TOKEN_SECRET;
  if (!tokenId || !tokenSecret)
    throw new Error("MODAL_TOKEN_ID / MODAL_TOKEN_SECRET are not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenId}:${tokenSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      width: 1024,
      height: 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Modal request failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { image: string };
  return Buffer.from(data.image, "base64");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { vibe: VibeProfile; user_prompt?: string };

    if (!body.vibe) {
      return NextResponse.json({ error: "vibe is required" }, { status: 400 });
    }

    // Build prompt from vibe, optionally prepend user's custom direction
    let prompt = vibeToPrompt(body.vibe);
    if (body.user_prompt) {
      prompt = `${body.user_prompt}. ${prompt}`;
    }

    const resultBuffer = await callModal(prompt);

    // Upload to DO Spaces
    const objectKey = `generated/${randomUUID()}.png`;
    const imageUrl = await uploadToSpaces(resultBuffer, objectKey, "image/png");

    return NextResponse.json({ imageUrl, prompt });
  } catch (err) {
    console.error("[generate-image] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
