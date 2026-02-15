"use client";

import { useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { usePatinaStore } from "@/lib/store";
import type { PatinaNode } from "@/types";

const nodeEntrance = {
  initial: { opacity: 0, scale: 0.8, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 350, damping: 25, mass: 0.8 },
};

export function SuggestedNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const { acceptSuggestion, dismissSuggestion } = usePatinaStore();
  const [imgFailed, setImgFailed] = useState(false);

  const suggestionType = (data.metadata?.suggestionType as string) || "image";
  const originUrl = data.metadata?.originUrl as string | undefined;
  const why = data.metadata?.query as string | undefined;
  const domain = (originUrl || data.content || "").replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0];

  const isImage = suggestionType === "image" && !imgFailed;

  return (
    <motion.div
      className="patina-node group overflow-hidden opacity-70 hover:opacity-100 transition-opacity duration-300"
      data-selected={selected}
      initial={nodeEntrance.initial}
      animate={nodeEntrance.animate}
      transition={nodeEntrance.transition}
      style={{
        width: isImage ? 180 : 260,
        borderStyle: "dashed",
        borderColor: "rgba(139, 92, 246, 0.25)",
      }}
    >
      {/* Image type */}
      {isImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.content}
            alt={data.title || "Suggested reference"}
            className="w-full h-auto block rounded-[13px]"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
          {/* Bottom bar for image nodes */}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => acceptSuggestion(id)}
                className="flex-1 py-1.5 text-[10px] font-medium rounded-md bg-accent text-white hover:bg-accent-dim transition-colors tracking-wide"
              >
                Keep
              </button>
              <button
                onClick={() => dismissSuggestion(id)}
                className="flex-1 py-1.5 text-[10px] font-medium rounded-md bg-white/10 text-white/80 hover:bg-white/20 transition-colors tracking-wide"
              >
                Skip
              </button>
              {originUrl && (
                <a
                  href={originUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="py-1.5 px-2 text-[10px] font-medium rounded-md bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                  title="Open source"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6.5v3a.5.5 0 01-.5.5h-6a.5.5 0 01-.5-.5v-6a.5.5 0 01.5-.5H6" />
                    <path d="M7.5 2H10v2.5" />
                    <path d="M5.5 6.5L10 2" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Text / URL / fallback card */
        <div className="flex flex-col" style={{ maxHeight: 280 }}>
          {/* Header — fixed */}
          <div className="px-4 pt-3.5 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-accent/60 uppercase tracking-[0.12em] font-medium">
                {suggestionType === "text" ? "essay" : imgFailed ? "visual" : "article"}
              </span>
              {domain && (
                <span className="text-[9px] text-muted/40 tracking-wide truncate max-w-[120px]">
                  {domain}
                </span>
              )}
            </div>

            {/* Title */}
            {data.title && (
              <p className="text-[13px] font-medium text-foreground/85 leading-snug">
                {data.title}
              </p>
            )}
          </div>

          {/* Scrollable content area */}
          <div className="nodrag-scroll flex-1 overflow-y-auto px-4 min-h-0 scrollbar-thin">
            {/* Why — curator's reasoning */}
            {why && (
              <p className="text-[11.5px] text-foreground/50 leading-relaxed pb-2">
                {why}
              </p>
            )}

            {/* Show the actual content/URL if different from title */}
            {data.content && data.content !== data.title && !data.content.startsWith("http") && (
              <p className="text-[11px] text-foreground/40 leading-relaxed pb-2">
                {data.content}
              </p>
            )}
          </div>

          {/* Actions — fixed at bottom */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-t border-border-subtle/30 flex-shrink-0">
            {originUrl && (
              <a
                href={originUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 py-1.5 text-center text-[10px] font-medium rounded-md bg-white/5 text-foreground/50 hover:text-foreground/80 hover:bg-white/10 transition-colors tracking-wide"
              >
                Open
              </a>
            )}
            <button
              onClick={() => acceptSuggestion(id)}
              className="flex-1 py-1.5 text-[10px] font-medium rounded-md bg-accent/80 text-white hover:bg-accent transition-colors tracking-wide"
            >
              Keep
            </button>
            <button
              onClick={() => dismissSuggestion(id)}
              className="flex-1 py-1.5 text-[10px] font-medium rounded-md bg-white/5 text-foreground/40 hover:text-foreground/70 hover:bg-white/10 transition-colors tracking-wide"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Ghost label */}
      <div className="absolute top-2 left-2">
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent/15 text-accent/80 uppercase tracking-[0.1em] font-medium">
          suggested
        </span>
      </div>
    </motion.div>
  );
}
