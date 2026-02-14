"use client";

import { useEffect, useRef } from "react";
import { usePatinaStore } from "@/lib/store";
import {
  computeWeightedContributions,
  mergeVibeContributions,
} from "@/lib/proximity";
import type { VibeContribution } from "@/types";

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

      extractingRef.current.add(id);
      setIsExtracting(true);

      extractVibe(node.data.content, node.data.type as "image" | "text" | "url")
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
    setCompositeVibe(merged!);
  }, [nodes, vibeCache, setCompositeVibe]);
}

/** Call the extract-vibe API route */
async function extractVibe(
  content: string,
  type: "image" | "text" | "url"
): Promise<VibeContribution | null> {
  const res = await fetch("/api/extract-vibe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, type }),
  });

  if (!res.ok) {
    console.error("extract-vibe returned", res.status);
    return null;
  }

  const data = await res.json();
  return data.contribution ?? null;
}
