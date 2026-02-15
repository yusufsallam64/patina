import { NextResponse } from "next/server";
import anthropic from "@/lib/claude";
import type { GenerateUIRequest, GenerateUIResponse } from "@/types";

export const maxDuration = 120;

const SYSTEM_PROMPT = `You are an elite frontend designer and engineer. You create distinctive, production-grade interfaces that feel like real shipped products — never generic AI demos.

DESIGN PRINCIPLES:
- Every pixel matters. Obsess over spacing, alignment, and visual rhythm.
- Typography is 80% of design. Choose typefaces with intent — pair a display font with a body font. Use dramatic size contrasts (e.g., 80px headline + 14px body). Tight letter-spacing on headings, generous line-height on body.
- Color is emotional. Don't just "use" the palette — create a hierarchy. One dominant surface color, one or two accent hits, the rest neutral. Let colors breathe with generous whitespace.
- Micro-interactions bring life. Subtle hover states, smooth transitions (200-300ms), transform scales on interactive elements.
- Depth through layering: subtle gradients, thoughtful shadows (avoid generic drop-shadows — use colored or offset shadows), frosted glass where appropriate.
- Avoid the "AI look": no generic hero sections with centered text + gradient backgrounds. Be specific and opinionated. Break the grid sometimes. Use asymmetry.
- Real products have real content. Write compelling copy, not "Lorem ipsum" or "Welcome to our platform". Invent a brand that fits the vibe.

OUTPUT RULES:
- Output ONLY valid HTML — no markdown, no explanation, no code fences, no commentary
- Include <script src="https://cdn.tailwindcss.com"></script> in the head
- Use Tailwind classes for all styling, plus <style> blocks for animations and custom properties
- Include Google Fonts via <link> — choose fonts that match the mood
- The page MUST be self-contained and render in an iframe
- Add CSS animations or transitions that reinforce the aesthetic
- The result should feel like a screenshot from a real product`;

export async function POST(request: Request) {
  try {
    const body: GenerateUIRequest = await request.json();
    const { vibe, user_input, source_code } = body as GenerateUIRequest & { source_code?: string };

    let userMessage: string;

    if (source_code) {
      // Transform existing code to match the vibe
      userMessage = `TASK: Transform the following code to fully embody the vibe profile below. Rewrite the styling, colors, typography, spacing, and visual feel while preserving the structure and functionality.

VIBE PROFILE:
- Mood: ${vibe.mood}
- Tags: ${vibe.mood_tags.join(", ")}
- Aesthetic: ${vibe.aesthetic_tags.join(", ")}
- Colors: dominant ${vibe.color_palette.dominant.join(", ")}, accent ${vibe.color_palette.accent.join(", ")}
- Tone: ${vibe.color_palette.background_tone}
- Texture: ${vibe.texture}
- Warmth: ${vibe.lighting.warmth}, Contrast: ${vibe.lighting.contrast}
- Saturation: ${vibe.saturation}, Brightness: ${vibe.brightness}

SOURCE CODE TO TRANSFORM:
${source_code}

${user_input ? `ADDITIONAL DIRECTION: ${user_input}` : ""}

Transform this into a self-contained HTML page with Tailwind. Preserve the component's purpose and functionality but completely reimagine its visual identity to match the vibe. Make it look like it belongs to a real product with this aesthetic.`;
    } else {
      // Generate from scratch
      userMessage = `TASK: Create a complete, self-contained HTML page that fully embodies the vibe profile below.

VIBE PROFILE:
- Mood: ${vibe.mood}
- Tags: ${vibe.mood_tags.join(", ")}
- Aesthetic: ${vibe.aesthetic_tags.join(", ")}
- Colors: dominant ${vibe.color_palette.dominant.join(", ")}, accent ${vibe.color_palette.accent.join(", ")}
- Tone: ${vibe.color_palette.background_tone}
- Texture: ${vibe.texture}
- Warmth: ${vibe.lighting.warmth}, Contrast: ${vibe.lighting.contrast}
- Saturation: ${vibe.saturation}, Brightness: ${vibe.brightness}

DIRECTION: ${user_input}

Commit fully to this aesthetic. Use the exact hex colors from the palette. Create something that feels like a real product — specific, opinionated, and visually striking.`;
    }

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
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
