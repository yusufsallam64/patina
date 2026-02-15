"use client";

import { useEffect, useRef } from "react";
import { usePatinaStore } from "@/lib/store";
import {
  computeWeightedContributions,
  mergeVibeContributions,
} from "@/lib/proximity";
import type { VibeContribution } from "@/types";

const EMBEDDABLE_DOMAINS = [
  "youtube.com", "youtu.be",
  "open.spotify.com", "spotify.com",
  "vimeo.com",
  "soundcloud.com",
];

function isEmbeddableUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return EMBEDDABLE_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function isFontsGoogleUrl(url: string): boolean {
  return /fonts\.google\.com\/specimen\//i.test(url);
}

/**
 * Hook that watches the canvas nodes and:
 * 1. Triggers vibe extraction for any new node without a cached vibe
 * 2. Recomputes the composite vibe whenever vibeCache or node positions change
 */
export function useVibeExtraction() {
  const {
    nodes,
    vibeCache,
    setVibeContribution,
    setCompositeVibe,
    setIsExtracting,
  } = usePatinaStore();

  // Track which nodes we've already started extracting for
  const extractingRef = useRef<Set<string>>(new Set());

  // ── 1. Extract vibes for new nodes ──
  useEffect(() => {
    const extractableTypes = new Set(["image", "text", "url"]);

    for (const node of nodes) {
      const id = node.id;
      // Skip if already cached, already extracting, or not extractable type
      if (vibeCache[id] || extractingRef.current.has(id) || !extractableTypes.has(node.data.type)) {
        continue;
      }
      // Skip nodes with no content
      if (!node.data.content) continue;

      const sourceUrl = node.data.sourceUrl || node.data.content || "";

      // Embeddable URLs (YouTube, Spotify, etc.) — wait for embedThumbnail from OEmbed
      if (node.data.type === "url" && isEmbeddableUrl(sourceUrl)) {
        if (!node.data.embedThumbnail) continue; // Wait until OEmbed fetch completes
        extractingRef.current.add(id);
        setIsExtracting(true);
        // Use thumbnail as image + title as text context
        extractVibe(sourceUrl, "url", node.data.embedThumbnail, node.data.title)
          .then((contribution) => {
            if (contribution) setVibeContribution(id, contribution);
          })
          .catch((err) => console.error(`Vibe extraction failed for node ${id}:`, err))
          .finally(() => {
            extractingRef.current.delete(id);
            if (extractingRef.current.size === 0) setIsExtracting(false);
          });
        continue;
      }

      // Google Fonts — text-only extraction based on font name
      if (node.data.type === "url" && isFontsGoogleUrl(sourceUrl)) {
        const fontName = sourceUrl.match(/specimen\/([^/?#]+)/)?.[1]?.replace(/\+/g, " ") || "";
        if (!fontName) continue;
        extractingRef.current.add(id);
        setIsExtracting(true);
        extractVibe(`Typography: "${fontName}" typeface from Google Fonts. Analyze the aesthetic and mood that this font family evokes.`, "text")
          .then((contribution) => {
            if (contribution) setVibeContribution(id, contribution);
          })
          .catch((err) => console.error(`Vibe extraction failed for node ${id}:`, err))
          .finally(() => {
            extractingRef.current.delete(id);
            if (extractingRef.current.size === 0) setIsExtracting(false);
          });
        continue;
      }

      // For URL nodes, wait until ogImage has been fetched (or confirmed missing)
      // so we can include it in vibe extraction
      if (node.data.type === "url" && node.data.sourceUrl && !node.data.ogImage && !node.data.originalText) continue;

      extractingRef.current.add(id);
      setIsExtracting(true);

      extractVibe(node.data.content, node.data.type as "image" | "text" | "url", node.data.ogImage)
        .then((contribution) => {
          if (contribution) {
            setVibeContribution(id, contribution);
          }
        })
        .catch((err) => {
          console.error(`Vibe extraction failed for node ${id}:`, err);
        })
        .finally(() => {
          extractingRef.current.delete(id);
          // Check if all extractions are done
          if (extractingRef.current.size === 0) {
            setIsExtracting(false);
          }
        });
    }
  }, [nodes, vibeCache, setVibeContribution, setIsExtracting]);

  // ── 2. Recompute composite vibe whenever cache or positions change ──
  useEffect(() => {
    const contributions = computeWeightedContributions(nodes, vibeCache);
    const merged = mergeVibeContributions(contributions);
    // Only overwrite compositeVibe when we actually have contributions.
    // Otherwise we'd clobber a valid compositeVibe loaded from localStorage
    // before the per-node extraction API calls have finished.
    if (merged) {
      setCompositeVibe(merged);
    }
  }, [nodes, vibeCache, setCompositeVibe]);
}

/** Call the extract-vibe API route */
async function extractVibe(
  content: string,
  type: "image" | "text" | "url",
  ogImage?: string,
  title?: string
): Promise<VibeContribution | null> {
  const res = await fetch("/api/extract-vibe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, type, ogImage, title }),
  });

  if (!res.ok) {
    console.error("extract-vibe returned", res.status);
    return null;
  }

  const data = await res.json();
  return data.contribution ?? null;
}
