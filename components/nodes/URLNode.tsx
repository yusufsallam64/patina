"use client";

import { useState, useEffect } from "react";
import { type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { usePatinaStore } from "@/lib/store";
import type { PatinaNode } from "@/types";
import { DismissButton } from "./DismissButton";

const nodeEntrance = {
  initial: { opacity: 0, scale: 0.8, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 350, damping: 25, mass: 0.8 },
};

type Tab = "summary" | "original";

export function URLNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const vibeCache = usePatinaStore((s) => s.vibeCache);
  const updateNodeData = usePatinaStore((s) => s.updateNodeData);
  const nodeColor = vibeCache[id]?.colors?.[0] || null;
  const isLoading = data.isLoading || !data.content;

  const hasOriginal = !!data.originalText;
  const [activeTab, setActiveTab] = useState<Tab>("summary");

  // Fetch metadata for URL nodes missing originalText or ogImage
  useEffect(() => {
    if (data.sourceUrl && (!data.originalText || !data.ogImage) && !isLoading) {
      fetch("/api/parse-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.sourceUrl }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((meta) => {
          if (meta) {
            const updates: Record<string, unknown> = {};
            if (!data.originalText) {
              updates.originalText = meta.bodyText || meta.text || "";
              updates.summaryText = meta.text || data.content;
            }
            if (!data.ogImage && meta.ogImage) {
              updates.ogImage = meta.ogImage;
            }
            if (Object.keys(updates).length > 0) {
              updateNodeData(id, updates);
            }
          }
        })
        .catch(() => {});
    }
  }, [id, data.sourceUrl, data.originalText, data.ogImage, isLoading, data.content, updateNodeData]);

  // Text content for summary / original tabs
  const rawText =
    activeTab === "original"
      ? data.originalText || data.content
      : data.summaryText || data.content;

  const displayText =
    activeTab === "original" && rawText
      ? rawText
          .replace(/([^\n])\n([^\n])/g, "$1\n\n$2")
          .replace(/\n{3,}/g, "\n\n")
      : rawText;

  const tabs: { key: Tab; label: string }[] = [
    { key: "summary", label: "Summary" },
    ...(hasOriginal ? [{ key: "original" as Tab, label: "Original" }] : []),
  ];

  return (
    <motion.div
      className="patina-node group overflow-hidden"
      data-selected={selected}
      initial={nodeEntrance.initial}
      animate={nodeEntrance.animate}
      transition={nodeEntrance.transition}
      style={{
        width: 320,
        ...(nodeColor
          ? ({
              "--node-color": nodeColor,
              "--node-glow": `${nodeColor}40`,
              "--node-glow-strong": `${nodeColor}66`,
            } as React.CSSProperties)
          : {}),
      }}
    >
      <DismissButton nodeId={id} />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <div
            className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full"
            style={{ animation: "spin 1s linear infinite" }}
          />
          {data.title && (
            <p className="text-[11px] text-muted/60 tracking-wide px-4 text-center truncate max-w-full">
              {data.title}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Vibe extracted indicator */}
          {data.vibeContribution && (
            <div
              className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent z-10"
              style={{ animation: "soft-pulse 2.5s ease-in-out infinite" }}
            />
          )}

          {/* OG Image card header */}
          {data.ogImage && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.ogImage}
                alt={data.title || "Site preview"}
                className="w-full h-[160px] object-cover"
                draggable={false}
              />
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--surface)] to-transparent" />
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-border-subtle/40 px-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`nodrag nopan px-3 py-2 text-[10px] font-medium tracking-wide transition-colors ${
                  activeTab === tab.key
                    ? "text-foreground/90 border-b-2"
                    : "text-muted/50 hover:text-muted/80"
                }`}
                style={
                  activeTab === tab.key
                    ? { borderColor: nodeColor || "var(--accent)" }
                    : {}
                }
              >
                {tab.label}
              </button>
            ))}
            {data.sourceUrl && (
              <a
                href={data.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="nodrag nopan ml-auto px-2 py-2 text-[10px] text-muted/40 hover:text-muted/70 transition-colors tracking-wide"
              >
                Open ↗
              </a>
            )}
          </div>

          {/* Content area */}
          <div className="p-4">
            <div
              className="nodrag-scroll text-[13px] text-foreground/85 leading-[1.65] tracking-[0.01em] scrollbar-thin prose-node"
              style={{ maxHeight: 240, overflowY: "auto" }}
            >
              <ReactMarkdown>{displayText}</ReactMarkdown>
            </div>
          </div>

          {/* Title bar at the bottom */}
          {data.title && (
            <div className="px-4 pb-3 pt-0">
              <p className="text-[10px] text-muted uppercase tracking-[0.08em] truncate font-medium">
                {data.title}
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
