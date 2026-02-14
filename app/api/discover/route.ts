import { NextResponse } from "next/server";
import anthropic from "@/lib/claude";
import { sonarSearch } from "@/lib/perplexity";
import type { DiscoverRequest, DiscoverResponse, SuggestedReference } from "@/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body: DiscoverRequest = await request.json();
    const { vibe } = body;

    // Step 1: Have Claude generate aesthetic search queries from the vibe
    const queryResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Given this aesthetic vibe profile, generate 2 search queries that would find visually related reference images on the web. The queries should be specific and descriptive enough to find images matching this aesthetic.

Vibe: ${vibe.mood}
Tags: ${vibe.mood_tags.join(", ")}
Aesthetic: ${vibe.aesthetic_tags.join(", ")}
Colors: ${vibe.color_palette.dominant.join(", ")}
Texture: ${vibe.texture}

Return ONLY a JSON array of 2 search query strings. No markdown, no explanation.
Example: ["dark cinematic film stills moody lighting", "brutalist architecture editorial photography"]`,
        },
      ],
    });

    const queryText =
      queryResponse.content[0].type === "text"
        ? queryResponse.content[0].text
        : "[]";

    const jsonMatch = queryText.match(/\[[\s\S]*\]/);
    const queries: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Step 2: Search with Perplexity Sonar for each query
    const suggestions: SuggestedReference[] = [];

    for (const query of queries.slice(0, 2)) {
      try {
        const result = await sonarSearch(query);
        for (const img of result.images.slice(0, 3)) {
          suggestions.push({
            id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            imageUrl: img.imageUrl,
            originUrl: img.originUrl,
            width: img.width,
            height: img.height,
            query,
          });
        }
      } catch (e) {
        console.error(`Sonar search failed for query "${query}":`, e);
      }
    }

    return NextResponse.json({ suggestions } satisfies DiscoverResponse);
  } catch (error) {
    console.error("Discovery error:", error);
    return NextResponse.json(
      { error: "Failed to discover references" },
      { status: 500 }
    );
  }
}
