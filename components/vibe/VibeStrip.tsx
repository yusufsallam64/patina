"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useMemo } from "react";
import { usePatinaStore } from "@/lib/store";

export function VibeStrip() {
  const {
    compositeVibe,
    isExtracting,
    setVibeNarrative,
    setIsNarrativeLoading,
  } = usePatinaStore();

  // Debounced narrative generation (invisible to user, used by interview/discover APIs)
  const narrativeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVibeKeyRef = useRef<string>("");

  useEffect(() => {
    if (!compositeVibe) return;

    const vibeKey = [
      ...compositeVibe.mood_tags,
      ...compositeVibe.color_palette.dominant.slice(0, 3),
      ...compositeVibe.aesthetic_tags,
    ].join("|");

    if (vibeKey === lastVibeKeyRef.current) return;

    if (narrativeTimerRef.current) clearTimeout(narrativeTimerRef.current);

    narrativeTimerRef.current = setTimeout(async () => {
      lastVibeKeyRef.current = vibeKey;
      setIsNarrativeLoading(true);
      try {
        const res = await fetch("/api/vibe-narrative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vibe: compositeVibe }),
        });
        if (res.ok) {
          const data = await res.json();
          setVibeNarrative(data.narrative);
        }
      } catch (err) {
        console.error("Narrative generation failed:", err);
      } finally {
        setIsNarrativeLoading(false);
      }
    }, 3000);

    return () => {
      if (narrativeTimerRef.current) clearTimeout(narrativeTimerRef.current);
    };
  }, [compositeVibe, setVibeNarrative, setIsNarrativeLoading]);

  const colors = useMemo(() => {
    if (!compositeVibe) return [];
    return [
      ...compositeVibe.color_palette.dominant,
      ...compositeVibe.color_palette.accent,
    ].slice(0, 6);
  }, [compositeVibe]);

  if (!compositeVibe) return null;

  const moodTags = compositeVibe.mood_tags.slice(0, 3);
  const aestheticTags = compositeVibe.aesthetic_tags.slice(0, 3);
  const tags = [...moodTags, ...aestheticTags].slice(0, 5);

  return (
    <>
      {/* Tags — top center, very subtle */}
      <AnimatePresence>
        {tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="absolute top-3 left-0 right-0 z-[30] pointer-events-none select-none text-center"
          >
            <span className="text-[11px] text-muted/50 tracking-[0.06em]">
              {tags.join("  ·  ")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Color palette swatches — rendered separately so it can be placed in the top-left bar */
export function VibePalette() {
  const compositeVibe = usePatinaStore((s) => s.compositeVibe);
  const isExtracting = usePatinaStore((s) => s.isExtracting);

  const colors = useMemo(() => {
    if (!compositeVibe) return [];
    const all = [
      ...(compositeVibe.color_palette?.dominant ?? []),
      ...(compositeVibe.color_palette?.accent ?? []),
    ].filter(Boolean);
    return all.slice(0, 6);
  }, [compositeVibe]);

  // Debug: log to console so we can trace the issue
  useEffect(() => {
    console.log("[VibePalette] compositeVibe:", compositeVibe ? "exists" : "null");
    console.log("[VibePalette] color_palette:", compositeVibe?.color_palette);
    console.log("[VibePalette] colors array:", colors);
  }, [compositeVibe, colors]);

  // Always show — render placeholder when no colors yet
  return (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      {colors.length > 0 ? (
        colors.map((color, i) => (
          <div
            key={i}
            style={{
              width: 22,
              height: 22,
              borderRadius: i === 0 ? "2px 0 0 2px" : i === colors.length - 1 ? "0 2px 2px 0" : 0,
              backgroundColor: color,
              flexShrink: 0,
              transition: "background-color 1.5s ease",
            }}
          />
        ))
      ) : isExtracting ? (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "var(--accent)",
            animation: "soft-pulse 1.5s ease-in-out infinite",
          }}
        />
      ) : null}
    </div>
  );
}
