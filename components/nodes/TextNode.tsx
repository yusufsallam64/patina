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

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

/** Render text with clickable links */
function LinkedText({ text }: { text: string }) {
  const parts: (string | { url: string; key: number })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  const regex = new RegExp(URL_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ url: match[0], key: keyCounter++ });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((part) =>
        typeof part === "string" ? (
          part
        ) : (
          <a
            key={part.key}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent/70 hover:text-accent underline underline-offset-2 decoration-accent/30 hover:decoration-accent/60 transition-colors cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {part.url}
          </a>
        )
      )}
    </>
  );
}

export function TextNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const vibeCache = usePatinaStore((s) => s.vibeCache);
  const updateNodeData = usePatinaStore((s) => s.updateNodeData);
  const nodeColor = vibeCache[id]?.colors?.[0] || null;
  const isLoading = data.isLoading || !data.content;

  const hasTabs = !!(data.originalText || data.summaryText);
  const [activeTab, setActiveTab] = useState<"original" | "summary">("original");

  // Lazy-fetch original text for URL-sourced nodes that don't have it yet
  useEffect(() => {
    if (data.sourceUrl && !data.originalText && !isLoading) {
      fetch("/api/parse-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.sourceUrl }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((meta) => {
          if (meta) {
            updateNodeData(id, {
              originalText: meta.bodyText || meta.text || "",
              summaryText: meta.text || data.content,
            });
          }
        })
        .catch(() => {}); // Silent — user still has summary
    }
  }, [id, data.sourceUrl, data.originalText, isLoading, data.content, updateNodeData]);

  // Determine what text to show
  const rawText = hasTabs
    ? (activeTab === "original"
        ? (data.originalText || data.content)
        : (data.summaryText || data.content))
    : data.content;

  // For original text, ensure paragraphs are separated for readability
  const displayText = (hasTabs && activeTab === "original" && rawText)
    ? rawText
        // Normalize line breaks: convert single newlines between text to double newlines for paragraph spacing
        .replace(/([^\n])\n([^\n])/g, "$1\n\n$2")
        // Collapse triple+ newlines to double
        .replace(/\n{3,}/g, "\n\n")
    : rawText;

  return (
    <motion.div
      className="patina-node group p-4"
      data-selected={selected}
      initial={nodeEntrance.initial}
      animate={nodeEntrance.animate}
      transition={nodeEntrance.transition}
      style={{
        width: 280,
        ...(nodeColor ? {
          '--node-color': nodeColor,
          '--node-glow': `${nodeColor}40`,
          '--node-glow-strong': `${nodeColor}66`,
        } as React.CSSProperties : {}),
      }}
    >
      <DismissButton nodeId={id} />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <div
            className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full"
            style={{ animation: "spin 1s linear infinite" }}
          />
          {data.title && (
            <p className="text-[11px] text-muted/60 tracking-wide">{data.title}</p>
          )}
        </div>
      ) : (
        <>
          {/* Vibe extracted indicator */}
          {data.vibeContribution && (
            <div
              className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent"
              style={{ animation: "soft-pulse 2.5s ease-in-out infinite" }}
            />
          )}

          {/* Tab bar — only for URL-sourced nodes */}
          {hasTabs && (
            <div className="flex gap-0 mb-2 border-b border-border-subtle/40">
              <button
                onClick={() => setActiveTab("original")}
                className={`nodrag nopan px-3 py-1.5 text-[10px] font-medium tracking-wide transition-colors ${
                  activeTab === "original"
                    ? "text-foreground/90 border-b-2"
                    : "text-muted/50 hover:text-muted/80"
                }`}
                style={activeTab === "original" ? { borderColor: nodeColor || "var(--accent)" } : {}}
              >
                Original
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={`nodrag nopan px-3 py-1.5 text-[10px] font-medium tracking-wide transition-colors ${
                  activeTab === "summary"
                    ? "text-foreground/90 border-b-2"
                    : "text-muted/50 hover:text-muted/80"
                }`}
                style={activeTab === "summary" ? { borderColor: nodeColor || "var(--accent)" } : {}}
              >
                Summary
              </button>
              {data.sourceUrl && (
                <a
                  href={data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag nopan ml-auto px-2 py-1.5 text-[10px] text-muted/40 hover:text-muted/70 transition-colors tracking-wide"
                >
                  Source
                </a>
              )}
            </div>
          )}

          <div className="nodrag-scroll text-[13px] text-foreground/85 leading-[1.65] overflow-y-auto max-h-[300px] tracking-[0.01em] scrollbar-thin prose-node">
            <ReactMarkdown>{displayText}</ReactMarkdown>
          </div>

          {data.title && (
            <p className="text-[10px] text-muted mt-3 uppercase tracking-[0.08em] truncate font-medium">
              {data.title}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}
