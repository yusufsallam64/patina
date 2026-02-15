import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import anthropic from "@/lib/claude";
import { uploadToSpaces } from "@/lib/spaces";
import type {
  GenerateFromContextRequest,
  GenerateFromContextResponse,
  NearbyNodeContext,
} from "@/types";

export const maxDuration = 300;

// ─── Helpers ─────────────────────────────────────────────────────

function influenceLevel(weight: number): string {
  if (weight > 0.5) return "STRONG";
  if (weight > 0.1) return "MEDIUM";
  return "LIGHT";
}

/** Build a deterministic context description from nearby nodes. */
function buildContextDescription(nodes: NearbyNodeContext[]): string {
  if (nodes.length === 0) return "No nearby context nodes found.";

  const lines: string[] = [];

  for (const node of nodes) {
    const level = influenceLevel(node.weight);

    switch (node.type) {
      case "image":
      case "styled-photo":
        if (node.vibeContribution) {
          const v = node.vibeContribution;
          lines.push(
            `[${level}] Image — colors: ${v.colors.join(", ")}; mood: ${v.mood_tags.join(", ")}; aesthetic: ${v.aesthetic_tags.join(", ")}; warmth: ${v.warmth.toFixed(2)}, contrast: ${v.contrast.toFixed(2)}; texture: ${v.texture}`
          );
        } else {
          lines.push(`[${level}] Image nearby (no style data extracted yet)`);
        }
        break;

      case "text":
      case "url":
        lines.push(
          `[${level}] Text: "${node.content.slice(0, 300)}"`
        );
        break;

      case "music":
        if (node.vibeContribution?.sonic_mood) {
          lines.push(
            `[${level}] Music — sonic mood: ${node.vibeContribution.sonic_mood}`
          );
        }
        break;

      case "code":
        lines.push(
          `[${level}] Code snippet: "${node.content.slice(0, 200)}"`
        );
        break;

      default:
        if (node.content) {
          lines.push(`[${level}] ${node.type}: "${node.content.slice(0, 200)}"`);
        }
        break;
    }
  }

  return lines.join("\n");
}

const SYSTEM_PROMPTS: Record<string, string> = {
  remix:
    `You are an expert at writing text-to-image prompts for FLUX diffusion models. Given a description of nearby visual and textual elements on a mood board, synthesize them into a single vivid, detailed image generation prompt. Blend the aesthetics, colors, moods, and any textual directions into one cohesive scene. Output ONLY the prompt text, nothing else. Keep it under 200 words. Include quality keywords like "masterpiece, highly detailed, professional, 8k" at the end.`,

  restyle:
    `You are an expert at writing image transformation prompts for FLUX Kontext (an image-to-image model). Given a description of nearby visual and textual influences on a mood board, describe how to transform the target image using those influences. Output ONLY the transformation prompt, nothing else. Focus on style, color grading, mood, and aesthetic changes. Keep it under 150 words.`,

  text:
    `You are a creative writer. Given a description of nearby visual and textual elements on a mood board, generate 2-4 sentences of creative text that embodies the aesthetic, mood, and feeling of those elements. The text should feel evocative and poetic — like a caption, manifesto fragment, or brand voice snippet. Output ONLY the generated text, nothing else.`,
};

/** Use Claude to synthesize nearby context into a generation prompt or text. */
async function synthesizeWithClaude(
  contextDescription: string,
  mode: string
): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[mode];
  if (!systemPrompt) throw new Error(`Unknown generation mode: ${mode}`);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Here are the nearby elements on the mood board and their influence levels:\n\n${contextDescription}\n\nSynthesize these into ${mode === "text" ? "creative text" : "a generation prompt"}.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "";
}

// ─── Modal callers ───────────────────────────────────────────────

/** Call Modal FLUX.1-schnell for text-to-image generation. */
async function callModalImageGen(prompt: string): Promise<Buffer> {
  const url = process.env.MODAL_IMAGE_GEN_URL || process.env.MODAL_FUNCTION_URL;
  if (!url) throw new Error("MODAL_IMAGE_GEN_URL is not configured");

  const tokenId = process.env.MODAL_TOKEN_ID;
  const tokenSecret = process.env.MODAL_TOKEN_SECRET;
  if (!tokenId || !tokenSecret)
    throw new Error("MODAL_TOKEN_ID / MODAL_TOKEN_SECRET are not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenId}:${tokenSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Modal image gen failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { image: string };
  return Buffer.from(data.image, "base64");
}

/** Download an image URL and return it as a base-64 data URI. */
async function imageUrlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image at ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

/** Call Modal FLUX Kontext for image-to-image style transfer. */
async function callModalStyleTransfer(
  targetBase64: string,
  prompt: string
): Promise<Buffer> {
  const url = process.env.MODAL_FUNCTION_URL;
  if (!url) throw new Error("MODAL_FUNCTION_URL is not configured");

  const tokenId = process.env.MODAL_TOKEN_ID;
  const tokenSecret = process.env.MODAL_TOKEN_SECRET;
  if (!tokenId || !tokenSecret)
    throw new Error("MODAL_TOKEN_ID / MODAL_TOKEN_SECRET are not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenId}:${tokenSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_image: targetBase64,
      style_references: [],
      prompt,
      strength: 0.75,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Modal style transfer failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { image: string };
  return Buffer.from(data.image, "base64");
}

// ─── Route Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateFromContextRequest;

    if (!body.nearby_nodes || body.nearby_nodes.length === 0) {
      return NextResponse.json(
        { error: "nearby_nodes is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!body.mode) {
      return NextResponse.json({ error: "mode is required" }, { status: 400 });
    }

    // Stage 1: Build context description
    const contextDescription = buildContextDescription(body.nearby_nodes);

    // Stage 2: Claude synthesis
    const synthesized = await synthesizeWithClaude(contextDescription, body.mode);

    if (!synthesized) {
      return NextResponse.json(
        { error: "Claude synthesis returned empty result" },
        { status: 500 }
      );
    }

    // Stage 3: Execute based on mode
    const result: GenerateFromContextResponse = { prompt_used: synthesized };

    switch (body.mode) {
      case "remix": {
        const imageBuffer = await callModalImageGen(synthesized);
        const objectKey = `generated/${randomUUID()}.png`;
        const imageUrl = await uploadToSpaces(imageBuffer, objectKey, "image/png");
        result.imageUrl = imageUrl;
        break;
      }

      case "restyle": {
        if (!body.target_image) {
          return NextResponse.json(
            { error: "target_image is required for restyle mode" },
            { status: 400 }
          );
        }
        const targetBase64 = await imageUrlToBase64(body.target_image);
        const imageBuffer = await callModalStyleTransfer(targetBase64, synthesized);
        const objectKey = `results/${randomUUID()}.png`;
        const imageUrl = await uploadToSpaces(imageBuffer, objectKey, "image/png");
        result.imageUrl = imageUrl;
        break;
      }

      case "text": {
        result.text = synthesized;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown mode: ${body.mode}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[generate-from-context] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
