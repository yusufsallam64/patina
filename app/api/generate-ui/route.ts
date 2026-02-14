import { NextResponse } from "next/server";
import anthropic from "@/lib/claude";
import type { GenerateUIRequest, GenerateUIResponse } from "@/types";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body: GenerateUIRequest = await request.json();
    const { vibe, user_input } = body;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a frontend designer. Generate a complete, self-contained HTML page that matches this aesthetic vibe.

VIBE PROFILE:
- Mood: ${vibe.mood}
- Tags: ${vibe.mood_tags.join(", ")}
- Aesthetic: ${vibe.aesthetic_tags.join(", ")}
- Colors: dominant ${vibe.color_palette.dominant.join(", ")}, accent ${vibe.color_palette.accent.join(", ")}
- Tone: ${vibe.color_palette.background_tone}
- Texture: ${vibe.texture}
- Warmth: ${vibe.lighting.warmth}, Contrast: ${vibe.lighting.contrast}

USER REQUEST: ${user_input}

REQUIREMENTS:
- Output ONLY valid HTML — no markdown, no explanation, no code fences
- Include <script src="https://cdn.tailwindcss.com"></script> in the head
- Use Tailwind classes for all styling
- Commit fully to the color palette — use the exact hex colors from the vibe
- Choose a distinctive Google Font that matches the mood (include via <link>)
- Add subtle CSS animations or transitions where appropriate
- Make it visually striking — this should look like a real product, not a demo
- The page should be self-contained and render correctly in an iframe
- Use dark or light background based on the background_tone`,
        },
      ],
    });

    const html =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Clean up any markdown code fences if present
    const cleanHtml = html
      .replace(/^```html?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    return NextResponse.json({
      code: cleanHtml,
      preview_html: cleanHtml,
    } satisfies GenerateUIResponse);
  } catch (error) {
    console.error("Generate UI error:", error);
    return NextResponse.json(
      { error: "Failed to generate UI" },
      { status: 500 }
    );
  }
}
