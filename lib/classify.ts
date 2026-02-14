import type { PatinaNodeType } from "@/types";

/**
 * Auto-classify dropped content into a node type.
 * Uses content type detection — Claude Vision is the fallback for ambiguous cases.
 */

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i;
const URL_PATTERN = /^https?:\/\//i;

export function classifyContent(
  raw: string | File
): { type: PatinaNodeType; content: string } | null {
  // File objects — check MIME type
  if (raw instanceof File) {
    if (raw.type.startsWith("image/")) {
      return { type: "image", content: "" }; // content set after upload
    }
    if (raw.type.startsWith("text/")) {
      return { type: "text", content: "" }; // content set after reading
    }
    // Default: try as image
    return { type: "image", content: "" };
  }

  // String content
  if (typeof raw === "string") {
    const trimmed = raw.trim();

    // Check for image URL
    if (URL_PATTERN.test(trimmed) && IMAGE_EXTENSIONS.test(trimmed)) {
      return { type: "image", content: trimmed };
    }

    // Check for general URL
    if (URL_PATTERN.test(trimmed)) {
      return { type: "url", content: trimmed };
    }

    // Check for base64 image data
    if (trimmed.startsWith("data:image/")) {
      return { type: "image", content: trimmed };
    }

    // Default: text
    return { type: "text", content: trimmed };
  }

  return null;
}
