import type { PatinaNodeType } from "@/types";

/**
 * Auto-classify dropped content into a node type.
 * Uses content type detection — Claude Vision is the fallback for ambiguous cases.
 */

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?.*)?$/i;
const URL_PATTERN = /^https?:\/\//i;
const IMAGE_HOSTS = /images\.unsplash\.com|i\.imgur\.com|pbs\.twimg\.com|cdn\.dribbble\.com|mir-s3-cdn-cf\.behance\.net/i;

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

    // Check for base64 image data
    if (trimmed.startsWith("data:image/")) {
      return { type: "image", content: trimmed };
    }

    if (URL_PATTERN.test(trimmed)) {
      // Only classify as image if it's HTTPS (Claude rejects HTTP image URLs)
      const isHttps = trimmed.startsWith("https://");
      if (isHttps && (IMAGE_EXTENSIONS.test(trimmed) || IMAGE_HOSTS.test(trimmed))) {
        return { type: "image", content: trimmed };
      }

      // General URL (including HTTP image URLs — treated as URL references)
      return { type: "url", content: trimmed };
    }

    // Default: text
    return { type: "text", content: trimmed };
  }

  return null;
}
