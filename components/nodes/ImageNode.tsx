"use client";

import { type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { usePatinaStore } from "@/lib/store";
import type { PatinaNode } from "@/types";
import { DismissButton } from "./DismissButton";

const nodeEntrance = {
  initial: { opacity: 0, scale: 0.8, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 350, damping: 25, mass: 0.8 },
};

export function ImageNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const vibeCache = usePatinaStore((s) => s.vibeCache);
  const nodeColor = vibeCache[id]?.colors?.[0] || null;
  const isLoading = data.isLoading || !data.content;

  return (
    <motion.div
      className="patina-node group overflow-hidden"
      data-selected={selected}
      initial={nodeEntrance.initial}
      animate={nodeEntrance.animate}
      transition={nodeEntrance.transition}
      style={{
        width: 240,
        ...(nodeColor ? {
          '--node-color': nodeColor,
          '--node-glow': `${nodeColor}40`,
          '--node-glow-strong': `${nodeColor}66`,
        } as React.CSSProperties : {}),
      }}
    >
      <DismissButton nodeId={id} />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3" style={{ width: 240, height: 240 }}>
          <div
            className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full"
            style={{ animation: "spin 1s linear infinite" }}
          />
          <p className="text-[11px] text-muted/60 tracking-wide">Generating...</p>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.content}
            alt={data.title || "Reference image"}
            className="w-full h-auto block rounded-[13px]"
            draggable={false}
          />

          {/* Vibe extracted indicator — soft glow dot */}
          {data.vibeContribution && (
            <div
              className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-accent"
              style={{ animation: "soft-pulse 2.5s ease-in-out infinite" }}
            />
          )}

          {/* Title overlay on hover */}
          {data.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-[11px] text-white/90 font-medium truncate tracking-wide">
                {data.title}
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
