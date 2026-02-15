"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { usePatinaStore } from "@/lib/store";
import { getNodesNearPoint } from "@/lib/proximity";
import type { NearbyNodeContext } from "@/types";

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
  onRequestGenerateUI: (screenPos: { x: number; y: number }, sourceCode?: string) => void;
}

export function ContextMenu({ position, onClose, onRequestGenerateUI }: ContextMenuProps) {
  const { compositeVibe, nodes, addNode, vibeCache, triggerTargetedDiscovery } = usePatinaStore();
  const { screenToFlowPosition } = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Convert screen position to flow-space for proximity calculations
  const flowPos = useMemo(() => {
    if (!position) return null;
    return screenToFlowPosition({ x: position.x, y: position.y });
  }, [position, screenToFlowPosition]);

  // Detect if user clicked on an image node (check bounding box: 240x300)
  const clickedImageNode = useMemo(() => {
    if (!flowPos) return null;
    return nodes.find((n) => {
      if (n.data.type !== "image" && n.data.type !== "styled-photo") return false;
      const nx = n.position.x;
      const ny = n.position.y;
      return (
        flowPos.x >= nx &&
        flowPos.x <= nx + 240 &&
        flowPos.y >= ny &&
        flowPos.y <= ny + 300
      );
    }) ?? null;
  }, [flowPos, nodes]);

  // Build nearby context for proximity-based generation
  const buildNearbyContext = useCallback(
    (excludeNodeId?: string): NearbyNodeContext[] => {
      if (!flowPos) return [];

      const nearby = getNodesNearPoint(nodes, flowPos, 1500)
        .filter(({ node }) => node.id !== excludeNodeId)
        .slice(0, 10);

      return nearby.map(({ node, weight }) => ({
        type: node.data.type,
        content: node.data.content,
        vibeContribution: vibeCache[node.id] || node.data.vibeContribution,
        weight,
      }));
    },
    [flowPos, nodes, vibeCache]
  );

  const nearbyContext = useMemo(() => buildNearbyContext(), [buildNearbyContext]);
  const hasNearbyNodes = nearbyContext.length > 0;

  // ─── Proximity-based handlers ──────────────────────────────────

  const handleGenerateHere = useCallback(async () => {
    if (!position || !flowPos) return;

    const context = buildNearbyContext();
    if (context.length === 0) return;

    onClose();

    // Create placeholder immediately
    const placeholderPos = { x: flowPos.x, y: flowPos.y };
    const nodeId = addNode(
      { type: "image", content: "", title: "Generate Here", isLoading: true },
      placeholderPos
    );

    try {
      const res = await fetch("/api/generate-from-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nearby_nodes: context, mode: "remix" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, {
        content: data.imageUrl,
        title: "Generated Image",
        isLoading: false,
      });
    } catch (err) {
      console.error("Generate Here error:", err);
      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, { title: "Generation failed", isLoading: false });
    }
  }, [position, flowPos, buildNearbyContext, onClose, addNode]);

  const handleRestyleThis = useCallback(async () => {
    if (!position || !flowPos || !clickedImageNode) return;

    const context = buildNearbyContext(clickedImageNode.id);
    if (context.length === 0) return;

    onClose();

    // Create placeholder next to original
    const placeholderPos = { x: clickedImageNode.position.x + 280, y: clickedImageNode.position.y };
    const nodeId = addNode(
      { type: "image", content: "", title: "Restyle This", isLoading: true },
      placeholderPos
    );

    try {
      const res = await fetch("/api/generate-from-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nearby_nodes: context,
          mode: "restyle",
          target_image: clickedImageNode.data.content,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Restyle failed");
      }

      const data = await res.json();
      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, {
        content: data.imageUrl,
        title: "Restyled Image",
        originalImageUrl: clickedImageNode.data.content,
        isLoading: false,
      });
    } catch (err) {
      console.error("Restyle This error:", err);
      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, { title: "Restyle failed", isLoading: false });
    }
  }, [position, flowPos, clickedImageNode, buildNearbyContext, onClose, addNode]);

  const handleGenerateText = useCallback(async () => {
    if (!position || !flowPos) return;

    const context = buildNearbyContext();
    if (context.length === 0) return;

    onClose();

    // Create placeholder text node
    const placeholderPos = { x: flowPos.x, y: flowPos.y };
    const nodeId = addNode(
      { type: "text", content: "", title: "Generating...", isLoading: true },
      placeholderPos
    );

    try {
      const res = await fetch("/api/generate-from-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nearby_nodes: context, mode: "text" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Text generation failed");
      }

      const data = await res.json();
      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, {
        content: data.text,
        title: "Generated Text",
        isLoading: false,
      });
    } catch (err) {
      console.error("Generate Text error:", err);
      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, {
        content: "Generation failed",
        title: "Error",
        isLoading: false,
      });
    }
  }, [position, flowPos, buildNearbyContext, onClose, addNode]);

  // ─── Existing handlers (unchanged) ────────────────────────────

  // Find selected text node that looks like code (for stylize flow)
  const selectedTextNode = nodes.find(
    (n) => n.selected && n.data.type === "text" && n.data.content
  );
  const selectedCodeNode = nodes.find(
    (n) => n.selected && n.data.type === "code" && n.data.content
  );
  const codeSource = selectedTextNode || selectedCodeNode;
  const hasCodeToStylize = !!codeSource;

  const handleGenerateUI = useCallback((sourceNode?: typeof codeSource) => {
    if (!position) return;
    onClose();
    onRequestGenerateUI(position, sourceNode?.data.content);
  }, [position, onClose, onRequestGenerateUI, codeSource]);

  const handleGenerateMusic = useCallback(async () => {
    if (!compositeVibe || !position) return;

    // Create the music node immediately with a loading state
    const musicFlowPos = screenToFlowPosition({ x: position.x + 40, y: position.y + 40 });
    const nodeId = addNode(
      {
        type: "music",
        content: "",
        title: "Generating...",
      },
      musicFlowPos
    );

    // Close menu immediately
    onClose();

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
    }
  }, [compositeVibe, position, screenToFlowPosition, addNode, onClose]);

  // Multi-select: find how many content nodes are selected
  const selectedContentNodes = nodes.filter(
    (n) => n.selected && ["image", "text", "url"].includes(n.data.type)
  );
  const canFindRelated = selectedContentNodes.length >= 2;

  const handleFindRelated = useCallback(() => {
    if (!canFindRelated) return;
    onClose();
    triggerTargetedDiscovery(selectedContentNodes.map((n) => n.id));
  }, [canFindRelated, selectedContentNodes, onClose, triggerTargetedDiscovery]);

  if (!position) return null;

  const hasVibe = !!compositeVibe;
  const hasNearbyOtherNodes = clickedImageNode
    ? buildNearbyContext(clickedImageNode.id).length > 0
    : false;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] rounded-xl py-1.5 min-w-[210px] border border-border-subtle"
      data-context-menu
      style={{
        left: position.x,
        top: position.y,
        animation: "node-appear 0.18s cubic-bezier(0.16, 1, 0.3, 1) both",
        background: "rgba(17, 17, 21, 0.97)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px -4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset",
      }}
    >
      <div className="px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted/60 border-b border-border-subtle mb-1">
        Actions
      </div>

      {/* ── Proximity-based actions ── */}

      {!clickedImageNode && (
        <MenuButton
          onClick={handleGenerateHere}
          disabled={!hasNearbyNodes}
          icon="▣"
          label="Generate Here"
          hint={!hasNearbyNodes ? "needs nearby nodes" : undefined}
        />
      )}

      {clickedImageNode && (
        <MenuButton
          onClick={handleRestyleThis}
          disabled={!hasNearbyOtherNodes}
          icon="✦"
          label="Restyle This"
          hint={!hasNearbyOtherNodes ? "needs nearby nodes" : undefined}
        />
      )}

      {!clickedImageNode && (
        <MenuButton
          onClick={handleGenerateText}
          disabled={!hasNearbyNodes}
          icon="¶"
          label="Generate Text"
          hint={!hasNearbyNodes ? "needs nearby nodes" : undefined}
        />
      )}

      {/* ── Targeted discovery ── */}
      {canFindRelated && (
        <div className="border-t border-border-subtle mt-1 pt-1">
          <div className="px-3 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-muted/40 mb-0.5">
            Discovery
          </div>
          <MenuButton
            onClick={handleFindRelated}
            disabled={false}
            icon="⊕"
            label="Find Related"
            hint={`${selectedContentNodes.length} selected`}
          />
        </div>
      )}

      {/* ── Existing vibe-based actions ── */}

      <div className="border-t border-border-subtle mt-1 pt-1">
        <div className="px-3 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-muted/40 mb-0.5">
          Vibe-based
        </div>

        {hasCodeToStylize && (
          <MenuButton
            onClick={() => handleGenerateUI(codeSource!)}
            disabled={!hasVibe}
            icon="✦"
            label="Stylize Selected"
            hint={!hasVibe ? "needs vibe" : undefined}
          />
        )}

        <MenuButton
          onClick={() => handleGenerateUI()}
          disabled={!hasVibe}
          icon="◈"
          label="Generate UI"
          hint={!hasVibe ? "needs vibe" : undefined}
        />

        <MenuButton
          onClick={handleGenerateMusic}
          disabled={!hasVibe}
          icon="♪"
          label="Generate Music"
          hint={!hasVibe ? "needs vibe" : undefined}
        />
      </div>

      <div className="border-t border-border-subtle mt-1 pt-1">
        <button
          onClick={onClose}
          className="w-full text-left px-3 py-2 text-[12px] text-muted/50 hover:text-muted hover:bg-surface-hover/50 transition-colors tracking-wide rounded-md mx-0"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function MenuButton({
  onClick,
  disabled,
  icon,
  label,
  hint,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: string;
  label: string;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-3 py-2 text-[12px] hover:bg-accent/8 disabled:opacity-25 disabled:cursor-not-allowed flex items-center gap-2.5 transition-colors tracking-[0.01em] group"
    >
      <span className="w-5 text-center text-accent text-[13px] group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="text-foreground/80 group-hover:text-foreground transition-colors">
        {label}
      </span>
      {hint && (
        <span className="ml-auto text-[9px] text-muted/40 tracking-wide">
          {hint}
        </span>
      )}
    </button>
  );
}
