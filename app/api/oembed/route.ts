import { NextResponse } from "next/server";

interface OEmbedResponse {
  html: string;
  title?: string;
  thumbnail_url?: string;
  provider_name?: string;
}

const OEMBED_PROVIDERS: Record<string, (url: string) => string> = {
  "youtube.com": (url) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  "youtu.be": (url) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  "open.spotify.com": (url) =>
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  "vimeo.com": (url) =>
    `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  "soundcloud.com": (url) =>
    `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`,
};

function getOEmbedEndpoint(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    for (const [domain, buildUrl] of Object.entries(OEMBED_PROVIDERS)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return buildUrl(url);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const endpoint = getOEmbedEndpoint(url);
  if (!endpoint) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 404 });
  }

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return NextResponse.json({ error: "OEmbed fetch failed" }, { status: 502 });
    }

    const data: OEmbedResponse = await res.json();
    return NextResponse.json({
      html: data.html || "",
      title: data.title || "",
      thumbnail_url: data.thumbnail_url || "",
      provider: data.provider_name || "",
    });
  } catch {
    return NextResponse.json({ error: "OEmbed request failed" }, { status: 500 });
  }
}
