import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { StyleTransferRequest, StyleTransferResponse } from "@/types";
import { uploadToSpaces } from "@/lib/spaces";

export const maxDuration = 300;

/** Download an image URL and return it as a base-64 data URI. */
async function imageUrlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image at ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

/** Download an image URL and return the raw Buffer. */
async function imageUrlToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image at ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Call a deployed Modal function that wraps FLUX Kontext for style transfer.
 *
 * Expected Modal endpoint contract:
 *   POST <MODAL_FUNCTION_URL>
 *   Headers:  Authorization: Bearer <tokenId>:<tokenSecret>
 *   Body (JSON): { target_image, style_references, prompt, strength }
 *   Response (JSON): { image: "<base64-encoded PNG>" }
 */
async function callModal(
  targetBase64: string,
  styleRefsBase64: string[],
  prompt: string,
  strength: number
): Promise<Buffer> {
  const url = process.env.MODAL_FUNCTION_URL;
  if (!url) throw new Error("MODAL_FUNCTION_URL is not configured");

  const tokenId = process.env.MODAL_TOKEN_ID;
  const tokenSecret = process.env.MODAL_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) throw new Error("MODAL_TOKEN_ID / MODAL_TOKEN_SECRET are not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenId}:${tokenSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_image: targetBase64,
      style_references: styleRefsBase64,
      prompt,
      strength,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Modal request failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { image: string };
  return Buffer.from(data.image, "base64");
}

/**
 * Replicate fallback — uses FLUX Kontext Pro via Replicate's HTTP API.
 * Polls until the prediction completes (up to ~280s).
 */
async function callReplicate(
  targetBase64: string,
  styleRefsBase64: string[],
  prompt: string,
  strength: number
): Promise<Buffer> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) throw new Error("REPLICATE_API_TOKEN is not configured");

  const fullPrompt =
    styleRefsBase64.length > 0
      ? `Apply the artistic style from the reference image to the target. ${prompt}`
      : prompt;

  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      model: "black-forest-labs/flux-kontext-pro",
      input: {
        prompt: fullPrompt,
        image: targetBase64,
        ...(styleRefsBase64.length > 0 && { style_image: styleRefsBase64[0] }),
        guidance_scale: 7.5,
        strength,
        num_outputs: 1,
        output_format: "png",
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "");
    throw new Error(`Replicate create prediction failed (${createRes.status}): ${errText.slice(0, 500)}`);
  }

  let prediction = (await createRes.json()) as {
    id: string;
    status: string;
    output?: string[] | string | null;
    error?: string | null;
    urls?: { get?: string };
  };

  const getUrl =
    prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;

  for (let i = 0; i < 140; i++) {
    if (prediction.status === "succeeded" || prediction.status === "failed" || prediction.status === "canceled") break;
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${apiToken}` } });
    if (!pollRes.ok) throw new Error(`Replicate poll failed (${pollRes.status})`);
    prediction = (await pollRes.json()) as typeof prediction;
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate prediction ended with "${prediction.status}": ${prediction.error ?? "unknown"}`);
  }

  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!outputUrl || typeof outputUrl !== "string") throw new Error("Replicate returned no output URL");
  return imageUrlToBuffer(outputUrl);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StyleTransferRequest;

    if (!body.target_image) {
      return NextResponse.json({ error: "target_image is required" }, { status: 400 });
    }
    if (!body.prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const styleRefs: string[] = body.style_references ?? [];
    const strength = Math.min(1, Math.max(0, body.strength ?? 0.75));

    // Convert all images to base64 in parallel
    const [targetBase64, ...styleRefsBase64] = await Promise.all([
      imageUrlToBase64(body.target_image),
      ...styleRefs.map((url) => imageUrlToBase64(url)),
    ]);

    // Try Modal first, fall back to Replicate
    let resultBuffer: Buffer;

    if (process.env.MODAL_FUNCTION_URL) {
      resultBuffer = await callModal(targetBase64, styleRefsBase64, body.prompt, strength);
    } else if (process.env.REPLICATE_API_TOKEN) {
      resultBuffer = await callReplicate(targetBase64, styleRefsBase64, body.prompt, strength);
    } else {
      return NextResponse.json(
        { error: "No ML backend configured. Set MODAL_FUNCTION_URL or REPLICATE_API_TOKEN." },
        { status: 503 }
      );
    }

    // Upload result to DO Spaces
    const objectKey = `results/${randomUUID()}.png`;
    const imageUrl = await uploadToSpaces(resultBuffer, objectKey, "image/png");

    return NextResponse.json({ imageUrl } satisfies StyleTransferResponse);
  } catch (err) {
    console.error("[style-transfer] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
