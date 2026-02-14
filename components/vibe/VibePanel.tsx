"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { usePatinaStore } from "@/lib/store";
import { PaletteDisplay } from "./PaletteDisplay";
import { MoodTags } from "./MoodTags";

export function VibePanel() {
  const { compositeVibe, isExtracting, nodes, hiddenNodes, restoreNode, restoreAllNodes } = usePatinaStore();
  const [manualClose, setManualClose] = useState(false);

  const referenceCount = nodes.filter((n) =>
    ["image", "text", "url"].includes(n.data.type)
  ).length;

  const hasContent = nodes.length > 0;

  // Reset manual close when canvas is emptied
  useEffect(() => {
    if (!hasContent) setManualClose(false);
  }, [hasContent]);

  const isOpen = hasContent && !manualClose;

  return (
    <>
      {/* Collapsed toggle tab — visible when panel is hidden but canvas has content */}
      <AnimatePresence>
        {hasContent && !isOpen && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setManualClose(false)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-20 w-6 h-16 bg-surface border border-r-0 border-border-subtle rounded-l-lg flex items-center justify-center hover:bg-surface-hover transition-colors group"
          >
            <span className="text-[10px] text-muted/50 group-hover:text-accent transition-colors">
              ‹
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-full border-l border-border-subtle bg-surface/80 backdrop-blur-sm flex flex-col overflow-hidden flex-shrink-0"
          >
            <div className="w-[320px] h-full flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border-subtle">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-medium tracking-[0.12em] uppercase text-muted">
                    Vibe Profile
                  </h2>
                  <div className="flex items-center gap-2">
                    {isExtracting && (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-accent"
                          style={{ animation: "soft-pulse 1.5s ease-in-out infinite" }}
                        />
                        <span className="text-[10px] text-accent tracking-wide">extracting</span>
                      </div>
                    )}
                    <button
                      onClick={() => setManualClose(true)}
                      className="text-[10px] text-muted/30 hover:text-muted/60 transition-colors p-1"
                      title="Collapse"
                    >
                      ›
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted/60 mt-1 tracking-wide">
                  {referenceCount} reference{referenceCount !== 1 ? "s" : ""} on canvas
                </p>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
                {compositeVibe ? (
                  <>
                    <PaletteDisplay palette={compositeVibe.color_palette} />

                    {/* Mood */}
                    <div>
                      <h3 className="text-[10px] font-medium text-muted/70 uppercase tracking-[0.12em] mb-2">
                        Mood
                      </h3>
                      <p className="text-[13px] leading-relaxed tracking-[0.01em]">
                        {compositeVibe.mood}
                      </p>
                    </div>

                    <MoodTags label="Mood" tags={compositeVibe.mood_tags} />
                    <MoodTags label="Aesthetic" tags={compositeVibe.aesthetic_tags} />

                    {/* Property Sliders */}
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-medium text-muted/70 uppercase tracking-[0.12em]">
                        Properties
                      </h3>
                      <SliderRow label="Warmth" value={compositeVibe.lighting.warmth} />
                      <SliderRow label="Contrast" value={compositeVibe.lighting.contrast} />
                      <SliderRow label="Saturation" value={compositeVibe.saturation} />
                      <SliderRow label="Brightness" value={compositeVibe.brightness} />
                    </div>

                    {/* Texture */}
                    <div>
                      <h3 className="text-[10px] font-medium text-muted/70 uppercase tracking-[0.12em] mb-2">
                        Texture
                      </h3>
                      <p className="text-[13px] tracking-[0.01em]">{compositeVibe.texture}</p>
                    </div>

                    {/* Sonic Mood */}
                    {compositeVibe.sonic_mood && (
                      <div>
                        <h3 className="text-[10px] font-medium text-muted/70 uppercase tracking-[0.12em] mb-2">
                          Sonic Mood
                        </h3>
                        <p className="text-[12px] italic text-foreground/50 leading-relaxed">
                          {compositeVibe.sonic_mood}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-accent mb-4"
                      style={{ animation: "soft-pulse 2s ease-in-out infinite" }}
                    />
                    <p className="text-[12px] text-muted/50 leading-relaxed tracking-wide">
                      Analyzing your references...
                    </p>
                  </div>
                )}

                {/* Hidden nodes tray */}
                {hiddenNodes.length > 0 && (
                  <div className="border-t border-border-subtle pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] font-medium text-muted/70 uppercase tracking-[0.12em]">
                        Hidden ({hiddenNodes.length})
                      </h3>
                      <button
                        onClick={restoreAllNodes}
                        className="text-[9px] text-accent/60 hover:text-accent tracking-wide transition-colors"
                      >
                        Restore all
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {hiddenNodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-border-subtle/20 hover:bg-border-subtle/40 transition-colors group/hidden"
                        >
                          <span className="text-[10px] text-muted/40 w-4">
                            {node.data.type === "image" ? "◻" : node.data.type === "music" ? "♪" : node.data.type === "code" ? "◈" : "¶"}
                          </span>
                          <span className="text-[11px] text-foreground/50 flex-1 truncate">
                            {node.data.title || node.data.content?.slice(0, 40) || node.data.type}
                          </span>
                          <button
                            onClick={() => restoreNode(node.id)}
                            className="text-[9px] text-muted/30 hover:text-accent opacity-0 group-hover/hidden:opacity-100 transition-all tracking-wide"
                          >
                            restore
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function SliderRow({ label, value }: { label: string; value: number }) {
  const clamped = Math.min(Math.max(value, 0), 1);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-muted/70 w-[72px] tracking-wide">{label}</span>
      <div className="flex-1 h-[3px] bg-border-subtle rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${clamped * 100}%`,
            background: `linear-gradient(90deg, var(--accent), var(--accent-dim))`,
          }}
        />
      </div>
      <span className="text-[10px] text-muted/50 w-7 text-right font-mono tabular-nums">
        {clamped.toFixed(2)}
      </span>
    </div>
  );
}
