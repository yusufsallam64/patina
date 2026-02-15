import { NextResponse } from "next/server";
import type { DiscoverResponse, InterviewAnswer, SuggestedReference, VibeProfile } from "@/types";

export const maxDuration = 60;

interface DiscoverRequestBody {
  vibe: VibeProfile;
  references: Array<{
    type: "image" | "text" | "url";
    content: string;
    title?: string;
  }>;
  narrative?: string;
  interviewAnswers?: InterviewAnswer[];
}

function buildPrompt(canvasContent: string, vibeContext: string, narrative: string | undefined, interviewAnswers?: InterviewAnswer[]): string {
  const interviewSection = interviewAnswers?.length
    ? `\nTHE USER'S DIRECTION FOR THIS ROUND (they answered these questions to guide your search — weight these heavily):\n${interviewAnswers.map((a) => `Q: "${a.question}" → A: "${a.answer}"${a.context ? ` (context: "${a.context}")` : ""}`).join("\n")}\n`
    : "";

  return `You are an expert cultural researcher and creative curator. A user is building a personal reference collection — a moodboard of images, texts, and links that define their taste. Your job is to search the internet and find specific, real works that belong in this collection.

THE ACTUAL CONTENT ON THEIR CANVAS (this is the primary signal — look at what these references actually are, not just abstract labels):

${canvasContent}

IMPORTANT: The references above are the ground truth of what this collection is about. Look at what they literally depict and describe — the subjects, the scenes, the themes, the cultural context. Use this as your primary guide for what to search for.

Secondary context — an AI-extracted aesthetic profile (use as supplementary color/mood info, but do NOT let abstract labels like "cyberpunk" or "minimalist" override what the actual content shows):
${vibeContext}

${narrative ? `A curatorial reading of the collection:\n${narrative}\n` : ""}${interviewSection}
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

Think like someone who is deeply embedded in the same cultural scene as this collection — not a search engine.

Present each discovery as a numbered list. For each:
- Bold the title and creator
- Cite your source with [N] references
- One sentence on the specific connection

Example:
1. **"Work Title" by Creator** [1] — Why this belongs.
2. **"Another Work" by Another Creator** [2] — Why this belongs.`;
}

function parseDiscoveriesFromText(
  text: string,
  citations: string[],
  searchResults: Array<{ title: string; url: string; snippet?: string }>
): Array<{ title: string; url: string; why: string }> {
  const results: Array<{ title: string; url: string; why: string }> = [];

  // Split by numbered items: "1. ", "2. ", etc.
  const segments = text.split(/(?:^|\n)\s*\d+\.\s+/).filter(Boolean);

  for (const segment of segments) {
    // Extract title: text between **...**
    const boldMatch = segment.match(/\*\*(.+?)\*\*/);
    if (!boldMatch) continue;
    const title = boldMatch[1].replace(/^[""]|[""]$/g, "").trim();

    // Extract citation refs: [N] patterns
    const citationRefs = [...segment.matchAll(/\[(\d+)\]/g)].map(m => parseInt(m[1], 10));

    // Get URL from citations (1-indexed: [1] = citations[0])
    let url: string | undefined;
    for (const ref of citationRefs) {
      const idx = ref - 1;
      if (idx >= 0 && idx < citations.length && citations[idx]) {
        url = citations[idx];
        break;
      }
    }

    // Fallback: match title against search_results
    if (!url) {
      const titleLower = title.toLowerCase();
      const match = searchResults.find(r =>
        r.title.toLowerCase().includes(titleLower) ||
        titleLower.includes(r.title.toLowerCase())
      );
      if (match) url = match.url;
    }

    // Skip discoveries without a verified URL
    if (!url) continue;

    // Extract "why": text after the bold title and citation refs
    const why = segment
      .replace(/\*\*(.+?)\*\*/, "")
      .replace(/\[\d+\]/g, "")
      .replace(/^[\s—–-]+/, "")
      .trim()
      .split("\n")[0]
      .trim();

    results.push({ title, url, why: why || title });
  }

  return results;
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
      return_related_questions: true,
      web_search_options: {
        search_context_size: "high",
        search_type: "pro",
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
    const { vibe, references, narrative, interviewAnswers } = body;

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

    const prompt = buildPrompt(canvasContent, vibeContext, narrative, interviewAnswers);
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
    const relatedQuestions: string[] = data.related_questions || [];

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

    // Parse free-text response with citation references
    const discoveries = parseDiscoveriesFromText(text, citations, searchResults);
    console.log("[discover] Parsed", discoveries.length, "discoveries from text:", discoveries.map(d => `${d.title} → ${d.url}`));

    for (const d of discoveries) {
      suggestions.push({
        id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "url",
        content: d.url,
        title: d.title,
        originUrl: d.url,
        query: d.why,
      });
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

    return NextResponse.json({ suggestions: deduped, relatedQuestions } satisfies DiscoverResponse);
  } catch (error) {
    console.error("[discover] Error:", error);
    return NextResponse.json(
      { error: "Failed to discover references" },
      { status: 500 }
    );
  }
}
