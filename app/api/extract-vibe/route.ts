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
      // Only pass HTTPS image URLs as image blocks (Claude rejects HTTP)
      const isHttps = content.startsWith("https://");
      const isDataUri = content.startsWith("data:");
      if (isHttps) {
        userContent.push({
          type: "image",
          source: { type: "url", url: content },
        });
      } else if (isDataUri) {
        // base64 data URI — extract media type and data
        const match = content.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (match) {
          userContent.push({
            type: "image",
            source: {
              type: "base64",
              media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: match[2],
            },
          });
        }
      }
      // For HTTP image URLs, fall through to text-based analysis
    }

    let analysisPrompt: string;
    if (type === "image") {
      // Check if we actually added an image block above
      const hasImageBlock = userContent.some((b) => b.type === "image");
      analysisPrompt = hasImageBlock
        ? "Analyze this image as a creative/aesthetic reference and extract its vibe contribution."
        : `Analyze this image URL as a creative/aesthetic reference and extract its vibe contribution. The URL: ${content}`;
    } else if (type === "url") {
      analysisPrompt = `Analyze this URL as a creative/aesthetic reference and extract its vibe contribution. Consider the brand, the name, and what this site likely looks and feels like. The URL: ${content}`;
    } else {
      analysisPrompt = `Analyze this text as a creative/aesthetic reference and extract its vibe contribution. The text:\n\n${content}`;
    }

    userContent.push({ type: "text", text: analysisPrompt });

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
