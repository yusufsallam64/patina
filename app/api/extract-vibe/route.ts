import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ExtractVibeRequest, ExtractVibeResponse } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body: ExtractVibeRequest = await request.json();
    const { content, type } = body;

    // Build the message based on content type
    const userContent: Anthropic.Messages.ContentBlockParam[] = [];

    if (type === "image") {
      // For image URLs, pass as image block
      userContent.push({
        type: "image",
        source: { type: "url", url: content },
      });
    }

    userContent.push({
      type: "text",
      text:
        type === "text"
          ? `Analyze this text as a creative/aesthetic reference and extract its vibe contribution. The text:\n\n${content}`
          : `Analyze this image as a creative/aesthetic reference and extract its vibe contribution.`,
    });

    userContent.push({
      type: "text",
      text: `Return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "colors": ["#hex1", "#hex2", ...],
  "mood_tags": ["tag1", "tag2", ...],
  "aesthetic_tags": ["tag1", "tag2", ...],
  "warmth": 0.0-1.0,
  "contrast": 0.0-1.0,
  "saturation": 0.0-1.0,
  "texture": "description",
  "css_filters": {
    "brightness": number,
    "contrast": number,
    "saturate": number,
    "hue-rotate": "Xdeg",
    "sepia": number
  },
  "sonic_mood": "description of what music would match this aesthetic"
}

Extract 3-8 dominant/accent colors as hex values.
Provide 3-6 mood tags and 3-6 aesthetic tags.
All numeric values should be realistic CSS filter values.
sonic_mood should describe tempo, instruments, genre, and feel.`,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{ role: "user", content: userContent }],
    });

    // Parse the response
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const contribution = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ contribution } satisfies ExtractVibeResponse);
  } catch (error) {
    console.error("Extract vibe error:", error);
    return NextResponse.json(
      { error: "Failed to extract vibe" },
      { status: 500 }
    );
  }
}
