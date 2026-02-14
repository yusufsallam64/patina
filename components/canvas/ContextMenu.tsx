"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { usePatinaStore } from "@/lib/store";

/** Client-side polling for Suno audio — updates the music node when streaming/complete */
function pollForAudio(clipId: string, nodeId: string) {
  let attempts = 0;
  const maxAttempts = 60; // ~120s
  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
      return;
    }

    try {
      const res = await fetch(`/api/music-status?id=${clipId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.audio_url && (data.status === "streaming" || data.status === "complete")) {
        const { updateNodeData } = usePatinaStore.getState();
        updateNodeData(nodeId, {
          content: data.audio_url,
          audioUrl: data.audio_url,
          title: data.title || "Generated Track",
        });
        if (data.status === "complete") clearInterval(interval);
      }
    } catch {
      // Keep polling
    }
  }, 2000);
}

interface ContextMenuProps {
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function ContextMenu({ position, onClose }: ContextMenuProps) {
  const { compositeVibe, nodes, addNode } = usePatinaStore();
  const { screenToFlowPosition } = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleGenerateUI = useCallback(async () => {
    if (!compositeVibe || !position) return;

    setLoading("ui");
    try {
      const res = await fetch("/api/generate-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibe: compositeVibe,
          user_input: "Create a landing page that embodies this aesthetic. Include a hero section, a feature grid, and a footer.",
        }),
      });

      if (!res.ok) throw new Error("Generate UI failed");
      const data = await res.json();

      const flowPos = screenToFlowPosition({ x: position.x + 40, y: position.y + 40 });
      addNode(
        {
          type: "code",
          content: data.code,
          previewHtml: data.preview_html,
          title: "Generated UI",
        },
        flowPos
      );
    } catch (err) {
      console.error("Generate UI error:", err);
    } finally {
      setLoading(null);
      onClose();
    }
  }, [compositeVibe, position, screenToFlowPosition, addNode, onClose]);

  const handleStyleTransfer = useCallback(async () => {
    if (!compositeVibe || !position) return;

    // Find all image nodes to use as style references
    const imageNodes = nodes.filter((n) => n.data.type === "image");
    if (imageNodes.length === 0) return;

    // Use the first image as target, rest as style refs
    const targetImage = imageNodes[0].data.content;
    const styleRefs = imageNodes.slice(1).map((n) => n.data.content);

    setLoading("style");
    try {
      const res = await fetch("/api/style-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_image: targetImage,
          style_references: styleRefs,
          prompt: `Apply this aesthetic: ${compositeVibe.mood}. Colors: ${compositeVibe.color_palette.dominant.join(", ")}. Feel: ${compositeVibe.aesthetic_tags.join(", ")}`,
          strength: 0.75,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Style transfer failed");
      }
      const data = await res.json();

      const flowPos = screenToFlowPosition({ x: position.x + 40, y: position.y + 40 });
      addNode(
        {
          type: "image",
          content: data.imageUrl,
          title: "Styled Image",
          originalImageUrl: targetImage,
        },
        flowPos
      );
    } catch (err) {
      console.error("Style transfer error:", err);
    } finally {
      setLoading(null);
      onClose();
    }
  }, [compositeVibe, nodes, position, screenToFlowPosition, addNode, onClose]);

  const handleGenerateMusic = useCallback(async () => {
    if (!compositeVibe || !position) return;

    setLoading("music");

    // Create the music node immediately with a loading state
    const flowPos = screenToFlowPosition({ x: position.x + 40, y: position.y + 40 });
    const nodeId = addNode(
      {
        type: "music",
        content: "",
        title: "Generating...",
      },
      flowPos
    );

    try {
      const res = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sonic_mood: compositeVibe.sonic_mood,
          mood_tags: compositeVibe.mood_tags,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Music generation failed");
      }

      const data = await res.json();

      // Update the node with audio URL
      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, {
        content: data.audio_url || "",
        audioUrl: data.audio_url || "",
        title: data.title || "Generated Track",
      });

      // If we got a clip_id but no audio yet, start client-side polling
      if (data.clip_id && !data.audio_url) {
        pollForAudio(data.clip_id, nodeId);
      }
    } catch (err) {
      console.error("Generate music error:", err);
      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, { title: "Generation failed" });
    } finally {
      setLoading(null);
      onClose();
    }
  }, [compositeVibe, position, screenToFlowPosition, addNode, onClose]);

  if (!position) return null;

  const hasVibe = !!compositeVibe;
  const hasImages = nodes.some((n) => n.data.type === "image");

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface border border-border-subtle rounded-xl shadow-2xl shadow-black/40 py-1.5 min-w-[200px]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted border-b border-border-subtle mb-1">
        Actions
      </div>

      <button
        onClick={handleGenerateUI}
        disabled={!hasVibe || loading === "ui"}
        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        <span className="w-5 text-center text-accent">
          {loading === "ui" ? "⟳" : "◈"}
        </span>
        <span>{loading === "ui" ? "Generating..." : "Generate UI"}</span>
        {!hasVibe && <span className="ml-auto text-[10px] text-muted">needs vibe</span>}
      </button>

      <button
        onClick={handleStyleTransfer}
        disabled={!hasVibe || !hasImages || loading === "style"}
        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        <span className="w-5 text-center text-accent">
          {loading === "style" ? "⟳" : "✦"}
        </span>
        <span>{loading === "style" ? "Styling..." : "Style Transfer"}</span>
        {!hasImages && <span className="ml-auto text-[10px] text-muted">needs images</span>}
      </button>

      <button
        onClick={handleGenerateMusic}
        disabled={!hasVibe || loading === "music"}
        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        <span className="w-5 text-center text-accent">
          {loading === "music" ? "⟳" : "♪"}
        </span>
        <span>{loading === "music" ? "Generating..." : "Generate Music"}</span>
        {!hasVibe && <span className="ml-auto text-[10px] text-muted">needs vibe</span>}
      </button>

      <div className="border-t border-border-subtle mt-1 pt-1">
        <button
          onClick={onClose}
          className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-surface-hover transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
