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

const EMBEDDABLE_DOMAINS = [
  "youtube.com", "youtu.be",
  "open.spotify.com",
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

function isVideoEmbed(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.includes("youtube.com") || hostname === "youtu.be" || hostname.includes("vimeo.com");
  } catch {
    return false;
  }
}

function isFontsGoogleUrl(url: string): boolean {
  return /fonts\.google\.com\/specimen\//i.test(url);
}

function extractFontFamily(url: string): string | null {
  const match = url.match(/fonts\.google\.com\/specimen\/([^/?#]+)/i);
  if (!match) return null;
  return decodeURIComponent(match[1]).replace(/\+/g, " ");
}

/** Strip fixed width/height from OEmbed iframe HTML so CSS can control sizing */
function cleanEmbedHtml(html: string): string {
  return html
    .replace(/\s+width=["']\d+["']/gi, "")
    .replace(/\s+height=["']\d+["']/gi, "")
    .replace(/<iframe/gi, '<iframe style="width:100%;height:100%;position:absolute;top:0;left:0"');
}

export function URLNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const vibeCache = usePatinaStore((s) => s.vibeCache);
  const updateNodeData = usePatinaStore((s) => s.updateNodeData);
  const vibeNarrative = usePatinaStore((s) => s.vibeNarrative);
  const nodeColor = vibeCache[id]?.colors?.[0] || null;
  const isLoading = data.isLoading || !data.content;

  const sourceUrl = data.sourceUrl || data.content || "";
  const embeddable = isEmbeddableUrl(sourceUrl);
  const isFontPreview = isFontsGoogleUrl(sourceUrl);
  const fontFamily = isFontPreview ? extractFontFamily(sourceUrl) : null;

  const hasOriginal = !!data.originalText;
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [embedHtml, setEmbedHtml] = useState<string | null>(data.embedHtml || null);
  const [embedLoading, setEmbedLoading] = useState(false);

  // Fetch OEmbed data for embeddable URLs
  useEffect(() => {
    if (!embeddable || embedHtml || !sourceUrl || isLoading) return;
    setEmbedLoading(true);
    fetch(`/api/oembed?url=${encodeURIComponent(sourceUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((oembed) => {
        if (oembed?.html) {
          setEmbedHtml(oembed.html);
          updateNodeData(id, {
            embedHtml: oembed.html,
            embedProvider: oembed.provider,
            embedThumbnail: oembed.thumbnail_url || undefined,
            title: oembed.title || data.title,
          });
        }
      })
      .catch(() => {})
      .finally(() => setEmbedLoading(false));
  }, [id, sourceUrl, embeddable, embedHtml, isLoading, updateNodeData, data.title]);

  // Dynamically load Google Font for typography nodes
  useEffect(() => {
    if (!fontFamily) return;
    const linkId = `gfont-node-${fontFamily.replace(/\s+/g, "-")}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [fontFamily]);

  // Fetch metadata for URL nodes missing originalText or ogImage
  // Skip for embeddable URLs and font previews — they have their own layouts
  useEffect(() => {
    if (embeddable || isFontPreview) return;
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
  }, [id, data.sourceUrl, data.originalText, data.ogImage, isLoading, data.content, updateNodeData, embeddable, isFontPreview]);

  const nodeShell = (children: React.ReactNode) => (
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
      {data.vibeContribution && (
        <div
          className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent z-10"
          style={{ animation: "soft-pulse 2.5s ease-in-out infinite" }}
        />
      )}
      {children}
    </motion.div>
  );

  // ── Embeddable URL mode (YouTube, Spotify, Vimeo, SoundCloud) ──
  if (embeddable && !isLoading) {
    return nodeShell(
      <>
        {embedHtml ? (
          <div style={{ position: "relative" }}>
            {isVideoEmbed(sourceUrl) ? (
              <div
                dangerouslySetInnerHTML={{ __html: cleanEmbedHtml(embedHtml) }}
                style={{ position: "relative", width: "100%", paddingBottom: "56.25%", overflow: "hidden" }}
              />
            ) : (
              <div
                dangerouslySetInnerHTML={{ __html: cleanEmbedHtml(embedHtml) }}
                style={{ width: "100%", minHeight: 80 }}
              />
            )}
            {/* Transparent overlay — allows dragging the node. Click-through when selected so user can interact with player */}
            {!selected && (
              <div style={{ position: "absolute", inset: 0, zIndex: 1, cursor: "grab" }} />
            )}
          </div>
        ) : embedLoading ? (
          <div className="flex items-center justify-center py-10">
            <div
              className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full"
              style={{ animation: "spin 1s linear infinite" }}
            />
          </div>
        ) : null}

        {/* Title + Open link */}
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          {data.title && (
            <p className="text-[10px] text-muted uppercase tracking-[0.08em] truncate font-medium flex-1">
              {data.title}
            </p>
          )}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="nodrag nopan text-[10px] text-muted/40 hover:text-muted/70 transition-colors tracking-wide shrink-0"
            >
              Open ↗
            </a>
          )}
        </div>
      </>
    );
  }

  // ── Font preview mode (Google Fonts) ──
  if (isFontPreview && fontFamily && !isLoading) {
    const sampleText = vibeNarrative || "The quick brown fox jumps over the lazy dog";
    return nodeShell(
      <>
        <div style={{ padding: "20px 24px" }}>
          <p
            className="text-foreground/90 leading-tight mb-3"
            style={{ fontFamily: `"${fontFamily}", sans-serif`, fontSize: 48, fontWeight: 700 }}
          >
            Aa
          </p>
          <p
            className="text-foreground/80 leading-relaxed mb-2"
            style={{ fontFamily: `"${fontFamily}", sans-serif`, fontSize: 16 }}
          >
            {sampleText}
          </p>
          <p
            className="text-foreground/60 leading-relaxed"
            style={{ fontFamily: `"${fontFamily}", sans-serif`, fontSize: 12 }}
          >
            ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
          </p>
        </div>

        <div className="flex items-center justify-between" style={{ padding: "0 24px 12px" }}>
          <p className="text-[10px] text-muted uppercase tracking-[0.08em] font-medium font-mono">
            {fontFamily}
          </p>
          {data.sourceUrl && (
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="nodrag nopan text-[10px] text-muted/40 hover:text-muted/70 transition-colors tracking-wide"
            >
              Open ↗
            </a>
          )}
        </div>
      </>
    );
  }

  // ── Standard URL node (articles, essays, etc.) ──

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

  return nodeShell(
    <>
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
    </>
  );
}
