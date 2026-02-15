import { NextResponse } from "next/server";
import type { DiscoverResponse, SuggestedReference, VibeProfile } from "@/types";

export const maxDuration = 60;

interface DiscoverRequestBody {
  vibe: VibeProfile;
  references: Array<{
    type: "image" | "text" | "url";
    content: string;
    title?: string;
  }>;
  narrative?: string;
}

// Schema for structured Sonar output
const SUGGESTION_SCHEMA = {
  type: "object" as const,
  properties: {
    discoveries: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const, description: "The specific name of the work, piece, article, or project" },
          creator: { type: "string" as const, description: "The artist, author, designer, director, or creator" },
          url: { type: "string" as const, description: "A direct URL to this specific work — not a homepage or platform" },
          image_url: { type: "string" as const, description: "A direct image URL if this is a visual work, or an illustrative image" },
          why: { type: "string" as const, description: "One sentence on the specific connection to this collection — not a generic description" },
          domain: { type: "string" as const, description: "The domain this comes from: visual art, photography, literature, essay, film, architecture, music, design, philosophy, fashion, or other" },
        },
        required: ["title", "creator", "url", "why", "domain"],
      },
    },
  },
  required: ["discoveries"],
};

function buildPrompt(canvasContent: string, vibeContext: string, narrative: string | undefined): string {
  return `You are an expert cultural researcher and creative curator. A user is building a personal reference collection — a moodboard of images, texts, and links that define their taste. Your job is to search the internet and find specific, real works that belong in this collection.

THE ACTUAL CONTENT ON THEIR CANVAS (this is the primary signal — look at what these references actually are, not just abstract labels):

${canvasContent}

IMPORTANT: The references above are the ground truth of what this collection is about. Look at what they literally depict and describe — the subjects, the scenes, the themes, the cultural context. Use this as your primary guide for what to search for.

Secondary context — an AI-extracted aesthetic profile (use as supplementary color/mood info, but do NOT let abstract labels like "cyberpunk" or "minimalist" override what the actual content shows):
${vibeContext}

${narrative ? `A curatorial reading of the collection:\n${narrative}\n` : ""}
Find 6-8 specific discoveries that would genuinely expand this collection. Match the ACTUAL SUBJECT MATTER and cultural world of the references, not just abstract aesthetic labels. If someone has club photography and DJ culture on their board, find more from that world — not sci-fi films that happen to share a color palette.

What makes a good discovery:
- It belongs in the same cultural world as the existing references
- A specific work by a specific person — not "check out this artist" but link to THE specific photograph, THE essay, THE building, THE album
- Something that shares deep thematic DNA with the collection, not just surface color similarity
- Unexpected cross-domain connections that still feel deeply relevant — a piece of writing about the same culture, a film that captures the same energy, architecture that embodies the same spirit
- Content from quality sources: museum collections, design archives, literary magazines, film databases, artist portfolios, cultural publications

What makes a BAD discovery:
- Anything that matches the color palette but misses the subject matter entirely (e.g., suggesting Blade Runner for a nightlife collection just because both have neon)
- Generic platform links (youtube.com homepage, pinterest boards, amazon, etsy)
- Stock photography or commercial image sites
- Listicles or "top 10" roundups
- Broad category pages instead of specific works

For visual works, always include a direct image URL. Think like someone who is deeply embedded in the same cultural scene as this collection — not a search engine.`;
}

async function callSonar(
  messageContent: Array<{ type: string; [key: string]: unknown }>,
  apiKey: string
): Promise<Response> {
  return fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [{ role: "user", content: messageContent }],
      return_images: true,
      response_format: {
        type: "json_schema",
        json_schema: {
          schema: SUGGESTION_SCHEMA,
          name: "discoveries",
        },
      },
      web_search_options: {
        search_context_size: "high",
        image_results_enhanced_relevance: true,
      },
      search_domain_filter: [
        "-pinterest.com",
        "-shutterstock.com",
        "-gettyimages.com",
        "-amazon.com",
        "-etsy.com",
        "-aliexpress.com",
        "-istockphoto.com",
        "-depositphotos.com",
        "-alamy.com",
      ],
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body: DiscoverRequestBody = await request.json();
    const { vibe, references, narrative } = body;

    // Build a full dump of everything on the canvas
    const canvasContent = references.map((ref, i) => {
      if (ref.type === "image") {
        return `[Reference ${i + 1} — Image]: ${ref.title || "Untitled image"}\n  URL: ${ref.content}`;
      } else if (ref.type === "url") {
        return `[Reference ${i + 1} — Link]: ${ref.title || "Untitled"}\n  URL: ${ref.content}`;
      } else {
        return `[Reference ${i + 1} — Text]: "${ref.content}"`;
      }
    }).join("\n\n");

    const vibeContext = [
      `Mood: ${vibe.mood_tags.join(", ")}`,
      `Aesthetic: ${vibe.aesthetic_tags.join(", ")}`,
      `Dominant colors: ${vibe.color_palette.dominant.join(", ")}`,
      `Accent colors: ${vibe.color_palette.accent.join(", ")}`,
      `Background tone: ${vibe.color_palette.background_tone}`,
      `Texture: ${vibe.texture}`,
      `Lighting warmth: ${vibe.lighting.warmth}, contrast: ${vibe.lighting.contrast}`,
      `Saturation: ${vibe.saturation}, brightness: ${vibe.brightness}`,
      `Sonic mood: ${vibe.sonic_mood}`,
    ].join("\n");

    const prompt = buildPrompt(canvasContent, vibeContext, narrative);
    const apiKey = process.env.PERPLEXITY_API_KEY!;

    // Validate image URLs before sending — HEAD check to see if Sonar can reach them
    const imageRefs = references.filter((r) => r.type === "image" && r.content.startsWith("https://"));
    const validImageUrls: string[] = [];

    if (imageRefs.length > 0) {
      console.log("[discover] Validating", imageRefs.length, "image URLs:", imageRefs.map(r => r.content));

      const checks = await Promise.allSettled(
        imageRefs.slice(0, 4).map(async (img) => {
          const res = await fetch(img.content, { method: "HEAD", signal: AbortSignal.timeout(3000) });
          const ct = res.headers.get("content-type") || "";
          if (res.ok && ct.startsWith("image/")) return img.content;
          console.log("[discover] Image validation failed:", img.content, res.status, ct);
          return null;
        })
      );

      for (const check of checks) {
        if (check.status === "fulfilled" && check.value) {
          validImageUrls.push(check.value);
        }
      }

      console.log("[discover] Valid images:", validImageUrls.length, "/", imageRefs.length);
    }

    // Build message with validated images
    const messageContent: Array<{ type: string; [key: string]: unknown }> = [];
    for (const url of validImageUrls) {
      messageContent.push({ type: "image_url", image_url: { url } });
    }
    messageContent.push({ type: "text", text: prompt });

    console.log("[discover] Sending request to sonar-pro with", {
      validImages: validImageUrls.length,
      referenceCount: references.length,
      hasNarrative: !!narrative,
      moodTags: vibe.mood_tags,
      aestheticTags: vibe.aesthetic_tags,
    });

    let sonarRes = await callSonar(messageContent, apiKey);

    // If Sonar rejects images (can't load them), retry with text only
    if (!sonarRes.ok) {
      const errText = await sonarRes.text();
      const isImageError = errText.includes("Failed to load image") || errText.includes("invalid_image");

      if (isImageError && validImageUrls.length > 0) {
        console.log("[discover] Sonar can't load images, retrying text-only. Error:", errText);
        const textOnly = [{ type: "text" as const, text: prompt }];
        sonarRes = await callSonar(textOnly, apiKey);
      }

      if (!sonarRes.ok) {
        const retryErr = isImageError ? errText : await sonarRes.text();
        console.error("[discover] Sonar API error:", sonarRes.status, retryErr);
        return NextResponse.json({ error: "Sonar API error", details: retryErr }, { status: 502 });
      }
    }

    const data = await sonarRes.json();

    // Log the full response for debugging
    const text = data.choices?.[0]?.message?.content || "";
    const citations: string[] = data.citations || [];
    const searchResults: Array<{ title: string; url: string; snippet?: string }> = data.search_results || [];
    const images: Array<{ image_url?: string; imageUrl?: string; origin_url?: string; originUrl?: string; height?: number; width?: number }> = data.images || [];

    console.log("[discover] Sonar response:", {
      textLength: text.length,
      citationCount: citations.length,
      searchResultCount: searchResults.length,
      imageCount: images.length,
      textPreview: text.slice(0, 500),
      searchResults: searchResults.slice(0, 5).map(r => ({ title: r.title, url: r.url })),
      images: images.slice(0, 3),
    });

    const suggestions: SuggestedReference[] = [];

    // Parse the structured JSON response
    try {
      const parsed = typeof text === "string" ? JSON.parse(text) : text;
      const discoveries: Array<{
        title?: string;
        creator?: string;
        url?: string;
        image_url?: string;
        why?: string;
        domain?: string;
      }> = parsed.discoveries || [];

      console.log("[discover] Parsed", discoveries.length, "structured discoveries:", discoveries.map(d => `${d.domain}: ${d.title} by ${d.creator}`));

      for (const d of discoveries) {
        if (!d.title || !d.url) continue;

        const isVisual = d.image_url || ["visual art", "photography", "design", "architecture", "fashion"].includes(d.domain || "");

        suggestions.push({
          id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: isVisual && d.image_url ? "image" : d.domain === "literature" || d.domain === "essay" || d.domain === "philosophy" ? "text" : "url",
          content: isVisual && d.image_url ? d.image_url : d.url,
          title: d.creator ? `${d.title} — ${d.creator}` : d.title,
          originUrl: d.url,
          query: d.why,
        });
      }
    } catch (parseErr) {
      console.error("[discover] Failed to parse structured response:", parseErr);
      console.log("[discover] Raw text:", text.slice(0, 1000));
    }

    // Add images from Sonar's image search
    for (const img of images.slice(0, 4)) {
      const imgUrl = img.image_url || img.imageUrl || "";
      const originUrl = img.origin_url || img.originUrl || "";
      if (!imgUrl) continue;

      const alreadyHas = suggestions.some(s => s.content === imgUrl);
      if (!alreadyHas) {
        suggestions.push({
          id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "image",
          content: imgUrl,
          originUrl: originUrl || undefined,
          width: img.width,
          height: img.height,
        });
      }
    }

    // If structured parsing produced few results, supplement with search_results (which have titles + snippets)
    if (suggestions.length < 4 && searchResults.length > 0) {
      console.log("[discover] Supplementing with", searchResults.length, "search results");
      for (const result of searchResults.slice(0, 6)) {
        const alreadyHas = suggestions.some(s => s.originUrl === result.url || s.content === result.url);
        if (!alreadyHas && result.title && result.url) {
          suggestions.push({
            id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: "url",
            content: result.url,
            title: result.title,
            originUrl: result.url,
            query: result.snippet,
          });
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduped = suggestions.filter((s) => {
      const key = s.originUrl || s.content;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log("[discover] Final suggestions:", deduped.length, deduped.map(s => `${s.type}: ${s.title || s.content.slice(0, 60)}`));

    return NextResponse.json({ suggestions: deduped } satisfies DiscoverResponse);
  } catch (error) {
    console.error("[discover] Error:", error);
    return NextResponse.json(
      { error: "Failed to discover references" },
      { status: 500 }
    );
  }
}
