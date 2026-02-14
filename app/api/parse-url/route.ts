import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { ParseUrlResponse } from "@/types";

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

    // Extract main text content (first ~500 chars of body text)
    const text = $("article, main, .content, .post, body")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);

    // Extract image URLs (first 5)
    const images: string[] = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && !src.startsWith("data:") && images.length < 5) {
        // Resolve relative URLs
        try {
          const resolved = new URL(src, url).href;
          images.push(resolved);
        } catch {
          // Skip invalid URLs
        }
      }
    });

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
