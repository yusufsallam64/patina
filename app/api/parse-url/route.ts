import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import anthropic from "@/lib/claude";
import type { ParseUrlResponse } from "@/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Patina/1.0)",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract metadata
    const title =
      $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "";

    const description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    const ogImage = $('meta[property="og:image"]').attr("content") || undefined;

    // Extract full page text — grab from semantic containers first, fall back to body
    const rawText = $("article, main, .content, .post, .entry-content, [role='main']")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const bodyText = rawText || $("body").text().replace(/\s+/g, " ").trim();

    // Extract image URLs (first 5)
    const images: string[] = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && !src.startsWith("data:") && images.length < 5) {
        try {
          const resolved = new URL(src, url).href;
          images.push(resolved);
        } catch {
          // Skip invalid URLs
        }
      }
    });

    // Run through Haiku for a rich summary + sentiment/aesthetic analysis
    let text = description;
    if (bodyText.length > 100) {
      try {
        const summary = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `Analyze this webpage content thoroughly. Write a rich summary covering:

1. **What it's about** — the core subject, key ideas, and narrative
2. **Tone & voice** — formal/casual, technical/poetic, warm/cold, etc.
3. **Aesthetic & visual language** — any design sensibility, color references, textures, or spatial qualities described or implied
4. **Emotional register** — what feelings does this content evoke? What mood does it create?
5. **Cultural context** — references, influences, era, movement, or subculture it belongs to

End with a "Vibe:" line — a dense, evocative one-liner capturing the overall aesthetic energy (like a mood board caption).

Title: ${title}
URL: ${url}

Content:
${bodyText.slice(0, 12000)}`,
            },
          ],
        });
        text = summary.content[0].type === "text" ? summary.content[0].text : description;
      } catch (err) {
        console.error("Summary error, falling back to raw text:", err);
        text = bodyText.slice(0, 2000);
      }
    }

    return NextResponse.json({
      title,
      description,
      text,
      images,
      ogImage,
    } satisfies ParseUrlResponse);
  } catch (error) {
    console.error("URL parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse URL" },
      { status: 500 }
    );
  }
}
