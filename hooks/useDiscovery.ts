"use client";

import { useEffect, useRef } from "react";
import { usePatinaStore } from "@/lib/store";
import type { SuggestedReference } from "@/types";

/**
 * Hook that watches the canvas content and triggers ambient discovery
 * via Perplexity Sonar Pro when the collection settles.
 * Sends actual canvas content (images + text) for contextual curation.
 */
export function useDiscovery() {
  const {
    compositeVibe,
    suggestedNodes,
    setSuggestedNodes,
    setIsDiscovering,
    nodes,
    vibeNarrative,
    discoveryVersion,
  } = usePatinaStore();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVibeKeyRef = useRef<string>("");

  useEffect(() => {
    if (!compositeVibe) return;
    // Don't discover if we already have suggestions on canvas
    if (suggestedNodes.length > 0) return;

    // Gather reference nodes
    const refNodes = nodes.filter((n) =>
      ["image", "text", "url"].includes(n.data.type)
    );
    if (refNodes.length < 2) return;

    // Build a key from actual content + discoveryVersion to allow forced rediscovery
    const vibeKey = `v${discoveryVersion}|${refNodes
      .map((n) => `${n.data.type}:${n.data.content?.slice(0, 50)}`)
      .join("|")}`;

    if (vibeKey === lastVibeKeyRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      lastVibeKeyRef.current = vibeKey;
      setIsDiscovering(true);
      try {
        // Build rich reference descriptions for Sonar
        const references = refNodes.slice(0, 6).map((n) => ({
          type: n.data.type as "image" | "text" | "url",
          content: n.data.content,
          title: n.data.title,
        }));

        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vibe: compositeVibe,
            references,
            narrative: vibeNarrative,
          }),
        });
        if (res.ok) {
          const data: { suggestions: SuggestedReference[] } = await res.json();
          console.log(`[discovery] got ${data.suggestions.length} suggestions:`, data.suggestions.map(s => `${s.type}: ${s.title || s.content.slice(0, 40)}`));
          if (data.suggestions.length > 0) {
            setSuggestedNodes(data.suggestions);
          }
        }
      } catch (err) {
        console.error("Discovery failed:", err);
      } finally {
        setIsDiscovering(false);
      }
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [compositeVibe, nodes, suggestedNodes.length, vibeNarrative, discoveryVersion, setSuggestedNodes, setIsDiscovering]);
}
