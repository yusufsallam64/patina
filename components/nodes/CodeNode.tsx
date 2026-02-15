"use client";

import { type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { useState, useCallback, useRef } from "react";
import { usePatinaStore } from "@/lib/store";
import type { PatinaNode } from "@/types";
import { DismissButton } from "./DismissButton";

const nodeEntrance = {
  initial: { opacity: 0, scale: 0.8, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 350, damping: 25, mass: 0.8 },
};

const MIN_W = 320;
const MIN_H = 240;

export function CodeNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const [showCode, setShowCode] = useState(false);
  const vibeCache = usePatinaStore((s) => s.vibeCache);
  const nodeColor = vibeCache[id]?.colors?.[0] || null;
  const [size, setSize] = useState({ w: 420, h: 340 });
  const resizing = useRef(false);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizing.current = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = size.w;
      const startH = size.h;

      const onMove = (ev: MouseEvent) => {
        const newW = Math.max(MIN_W, startW + (ev.clientX - startX));
        const newH = Math.max(MIN_H, startH + (ev.clientY - startY));
        setSize({ w: newW, h: newH });
      };
      const onUp = () => {
        resizing.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [size]
  );

  return (
    <motion.div
      className="patina-node group overflow-hidden"
      data-selected={selected}
      initial={nodeEntrance.initial}
      animate={nodeEntrance.animate}
      transition={nodeEntrance.transition}
      style={{
        width: size.w,
        height: size.h,
        ...(nodeColor ? {
          '--node-color': nodeColor,
          '--node-glow': `${nodeColor}40`,
          '--node-glow-strong': `${nodeColor}66`,
        } as React.CSSProperties : {}),
      }}
    >
      <DismissButton nodeId={id} />
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-[7px] h-[7px] rounded-full bg-[#ff5f57]" />
            <div className="w-[7px] h-[7px] rounded-full bg-[#febc2e]" />
            <div className="w-[7px] h-[7px] rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] text-muted font-medium tracking-wide ml-1">
            {data.title || "Generated UI"}
          </span>
        </div>
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-[10px] px-2.5 py-1 rounded-md bg-border-subtle/50 hover:bg-surface-hover text-muted hover:text-foreground transition-colors font-medium tracking-wide"
        >
          {showCode ? "Preview" : "Code"}
        </button>
      </div>

      {/* Content */}
      <div className="w-full" style={{ height: "calc(100% - 40px)" }}>
        {showCode ? (
          <pre className="p-4 text-[11px] font-mono text-foreground/70 overflow-auto h-full leading-relaxed">
            <code>{data.content}</code>
          </pre>
        ) : (
          <iframe
            srcDoc={data.previewHtml || data.content}
            className="w-full h-full border-0 bg-white"
            style={{ borderRadius: "0 0 13px 13px", pointerEvents: resizing.current ? "none" : "auto" }}
            sandbox="allow-scripts"
            title="UI Preview"
          />
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize nopan nodrag z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={onResizeStart}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" className="text-muted/40">
          <path d="M7 1v6H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </motion.div>
  );
}
