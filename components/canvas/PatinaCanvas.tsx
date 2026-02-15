"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from "@xyflow/react";
import { usePatinaStore } from "@/lib/store";
import { useVibeExtraction } from "@/hooks/useVibeExtraction";
import { useDiscovery } from "@/hooks/useDiscovery";
import { classifyContent } from "@/lib/classify";
import { ImageNode } from "@/components/nodes/ImageNode";
import { TextNode } from "@/components/nodes/TextNode";
import { SuggestedNode } from "@/components/nodes/SuggestedNode";
import { CodeNode } from "@/components/nodes/CodeNode";
import { MusicNode } from "@/components/nodes/MusicNode";
import { ContextMenu } from "@/components/canvas/ContextMenu";
import { EmptyCanvas } from "@/components/canvas/EmptyCanvas";
import { GlowCanvas } from "@/components/canvas/GlowCanvas";
import { EnergyField } from "@/components/canvas/EnergyField";
import type { PatinaNodeType } from "@/types";

const nodeTypes: NodeTypes = {
  image: ImageNode,
  text: TextNode,
  suggested: SuggestedNode,
  code: CodeNode,
  music: MusicNode,
};

/** Upload a File to DO Spaces via our API route, returns CDN URL */
async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url;
}

/** Parse a URL server-side to get metadata */
async function parseUrl(url: string): Promise<{ title: string; description: string; text?: string; ogImage?: string }> {
  const res = await fetch("/api/parse-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return { title: "", description: "" };
  return res.json();
}

/** Blend a hex color at `alpha` opacity over the base canvas color #0a0a0c */
function blendWithBase(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#0a0a0c";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Base: #0a0a0c = rgb(10, 10, 12)
  const br = Math.round(10 + (r - 10) * alpha);
  const bg = Math.round(10 + (g - 10) * alpha);
  const bb = Math.round(12 + (b - 12) * alpha);
  return `#${br.toString(16).padStart(2, "0")}${bg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

function PatinaCanvasInner() {
  const { nodes, onNodesChange, addNode, compositeVibe } =
    usePatinaStore();
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [quickText, setQuickText] = useState<string | null>(null);
  const quickTextRef = useRef<HTMLTextAreaElement>(null);

  // Generate UI prompt flow
  const [uiPrompt, setUIPrompt] = useState<{
    position: { x: number; y: number };
    sourceCode?: string;
  } | null>(null);
  const [uiPromptText, setUIPromptText] = useState("");
  const uiPromptRef = useRef<HTMLTextAreaElement>(null);

  // Trigger vibe extraction for new nodes, recompute composite
  useVibeExtraction();

  // Trigger ambient discovery via Perplexity
  useDiscovery();

  // Dynamic background tint from vibe palette
  const canvasBg = useMemo(() => {
    const dominant = compositeVibe?.color_palette?.dominant?.[0];
    if (!dominant) return "#0a0a0c";
    return blendWithBase(dominant, 0.08);
  }, [compositeVibe?.color_palette?.dominant]);

  // Right-click context menu
  const onContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  // Close context menu on any canvas click
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Shared logic: add a node from classified content
  const addContentNode = useCallback(
    async (
      type: PatinaNodeType,
      content: string,
      position: { x: number; y: number },
      extra?: { title?: string }
    ) => {
      addNode(
        {
          type: type === "url" ? "text" : type, // use "text" node renderer until we build a URL node
          content,
          title: extra?.title,
        },
        position
      );
    },
    [addNode]
  );

  // Process a dropped/pasted file
  const processFile = useCallback(
    async (file: File, position: { x: number; y: number }) => {
      const classified = classifyContent(file);
      if (!classified) return;

      if (classified.type === "image") {
        const url = await uploadFile(file);
        addContentNode("image", url, position, { title: file.name });
      } else {
        // Read text file
        const text = await file.text();
        addContentNode("text", text, position, { title: file.name });
      }
    },
    [addContentNode]
  );

  // Process a dropped/pasted string
  const processString = useCallback(
    async (raw: string, position: { x: number; y: number }) => {
      const classified = classifyContent(raw);
      if (!classified) return;

      if (classified.type === "image") {
        // Direct image URL — use as-is
        addContentNode("image", classified.content, position);
      } else if (classified.type === "url") {
        // Parse the URL to get metadata + page content
        const meta = await parseUrl(classified.content);
        const ogIsImage =
          meta.ogImage &&
          /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(meta.ogImage) &&
          meta.ogImage.startsWith("https://"); // Only use HTTPS og:images
        if (ogIsImage && meta.ogImage) {
          addContentNode("image", meta.ogImage, position, { title: meta.title });
        } else {
          // Use actual page text for richer vibe extraction, fall back to description
          const content = meta.text || meta.description || classified.content;
          addContentNode(
            "url",
            content,
            position,
            { title: meta.title || classified.content }
          );
        }
      } else {
        addContentNode("text", classified.content, position);
      }
    },
    [addContentNode]
  );

  // ── Drop Handler ──
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check for files first
      if (event.dataTransfer.files.length > 0) {
        const files = Array.from(event.dataTransfer.files);
        for (let i = 0; i < files.length; i++) {
          await processFile(files[i], {
            x: position.x + i * 30,
            y: position.y + i * 30,
          });
        }
        return;
      }

      // Check for text/url data
      const text =
        event.dataTransfer.getData("text/uri-list") ||
        event.dataTransfer.getData("text/plain");
      if (text) {
        await processString(text, position);
      }
    },
    [screenToFlowPosition, processFile, processString]
  );

  // ── Paste Handler ──
  const onPaste = useCallback(
    async (event: React.ClipboardEvent) => {
      // Don't intercept paste inside input fields
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const { zoom, x, y } = getViewport();
      const wrapper = wrapperRef.current;
      const centerX = wrapper ? wrapper.clientWidth / 2 : 400;
      const centerY = wrapper ? wrapper.clientHeight / 2 : 300;
      const position = screenToFlowPosition({ x: centerX, y: centerY });

      // Check for image in clipboard
      const items = Array.from(event.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith("image/"));

      if (imageItem) {
        event.preventDefault();
        const file = imageItem.getAsFile();
        if (file) await processFile(file, position);
        return;
      }

      // Check for text
      const text = event.clipboardData.getData("text/plain");
      if (text) {
        event.preventDefault();
        await processString(text, position);
      }
    },
    [getViewport, screenToFlowPosition, processFile, processString]
  );

  // ── Type-to-create: detect keypresses on canvas ──
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if already typing, or if inside an input/textarea
      if (quickText !== null) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;

      // Ignore modifier combos, navigation, function keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return; // only printable single chars

      e.preventDefault();
      setQuickText(e.key);
    };

    wrapper.addEventListener("keydown", handleKeyDown);
    return () => wrapper.removeEventListener("keydown", handleKeyDown);
  }, [quickText]);

  // Auto-focus the textarea when it appears
  useEffect(() => {
    if (quickText !== null && quickTextRef.current) {
      const ta = quickTextRef.current;
      ta.focus();
      // Place cursor at end (after the initial char)
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [quickText !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitQuickText = useCallback(() => {
    const text = quickText?.trim();
    if (!text) {
      setQuickText(null);
      return;
    }
    const wrapper = wrapperRef.current;
    const centerX = wrapper ? wrapper.clientWidth / 2 : 400;
    const centerY = wrapper ? wrapper.clientHeight / 2 : 300;
    const position = screenToFlowPosition({ x: centerX, y: centerY });
    processString(text, position);
    setQuickText(null);
  }, [quickText, screenToFlowPosition, processString]);

  const cancelQuickText = useCallback(() => {
    setQuickText(null);
  }, []);

  // ── Generate UI prompt flow ──
  const requestGenerateUI = useCallback(
    (screenPos: { x: number; y: number }, sourceCode?: string) => {
      const flowPos = screenToFlowPosition({ x: screenPos.x + 40, y: screenPos.y + 40 });
      setUIPrompt({ position: flowPos, sourceCode });
      setUIPromptText("");
    },
    [screenToFlowPosition]
  );

  // Auto-focus UI prompt textarea
  useEffect(() => {
    if (uiPrompt && uiPromptRef.current) {
      uiPromptRef.current.focus();
    }
  }, [uiPrompt]);

  const submitUIPrompt = useCallback(async () => {
    const compositeVibe = usePatinaStore.getState().compositeVibe;
    if (!uiPrompt || !compositeVibe) return;

    const userInput = uiPromptText.trim();
    if (!userInput && !uiPrompt.sourceCode) {
      setUIPrompt(null);
      return;
    }

    // Create placeholder node
    const isStylize = !!uiPrompt.sourceCode;
    const nodeId = addNode(
      {
        type: "code",
        content: "",
        previewHtml: `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#111115;font-family:system-ui"><div style="text-align:center"><div style="font-size:24px;margin-bottom:12px;animation:spin 1.5s linear infinite">◈</div><p style="color:#64647a;font-size:13px;letter-spacing:0.05em">${isStylize ? "Stylizing..." : "Generating UI..."}</p></div><style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}</style></body></html>`,
        title: isStylize ? "Stylizing..." : "Generating...",
      },
      uiPrompt.position
    );

    // Close prompt
    setUIPrompt(null);
    setUIPromptText("");

    try {
      const body: Record<string, unknown> = {
        vibe: compositeVibe,
        user_input: userInput,
      };
      if (uiPrompt.sourceCode) {
        body.source_code = uiPrompt.sourceCode;
      }

      const res = await fetch("/api/generate-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Generate UI failed");
      const data = await res.json();

      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, {
        content: data.code,
        previewHtml: data.preview_html,
        title: isStylize ? "Stylized UI" : "Generated UI",
      });
    } catch (err) {
      console.error("Generate UI error:", err);
      const { updateNodeData } = usePatinaStore.getState();
      updateNodeData(nodeId, {
        title: "Generation failed",
        previewHtml: `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#111115;font-family:system-ui"><p style="color:#ef4444;font-size:13px">Generation failed</p></body></html>`,
      });
    }
  }, [uiPrompt, uiPromptText, addNode]);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full relative"
      style={{ backgroundColor: canvasBg, transition: "background-color 1.5s ease" }}
      onPaste={onPaste}
      onContextMenu={onContextMenu}
      tabIndex={0}
    >
      {/* Ambient glow layer — renders behind nodes */}
      <GlowCanvas />

      {/* Plasma energy beams between nearby nodes */}
      <EnergyField />

      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaneClick={closeContextMenu}
        onNodeClick={closeContextMenu}
        onMoveStart={closeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        noPanClassName="nodrag-scroll"
        noWheelClassName="nodrag-scroll"
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent', position: 'relative', zIndex: 1 }}
      >
        <Controls />
        <Background
          variant={BackgroundVariant.Lines}
          gap={32}
          color="rgba(26, 26, 34, 0.5)"
        />
      </ReactFlow>

      <ContextMenu
        position={contextMenu}
        onClose={() => setContextMenu(null)}
        onRequestGenerateUI={requestGenerateUI}
      />

      <EmptyCanvas />

      {/* Quick text input overlay */}
      {quickText !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div className="glass-panel rounded-2xl p-4 w-[340px] flex flex-col gap-3">
            <p className="text-[11px] text-muted tracking-wide font-medium uppercase">
              New note
            </p>
            <textarea
              ref={quickTextRef}
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitQuickText();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelQuickText();
                }
              }}
              placeholder="Type your note..."
              rows={3}
              className="w-full bg-background/60 border border-border-subtle rounded-lg px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent/40 resize-none leading-relaxed tracking-[0.01em]"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted/40 tracking-wide">
                Enter to add · Esc to cancel
              </span>
              <div className="flex gap-2">
                <button
                  onClick={cancelQuickText}
                  className="px-3 py-1.5 text-[11px] rounded-lg text-muted hover:text-foreground transition-colors tracking-wide"
                >
                  Cancel
                </button>
                <button
                  onClick={submitQuickText}
                  className="px-3 py-1.5 text-[11px] rounded-lg bg-accent hover:bg-accent-dim text-white transition-colors tracking-wide font-medium"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate UI prompt overlay */}
      {uiPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div className="glass-panel rounded-2xl p-4 w-[380px] flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-accent text-[14px]">◈</span>
              <p className="text-[11px] text-muted tracking-wide font-medium uppercase">
                {uiPrompt.sourceCode ? "Stylize with vibe" : "Generate UI"}
              </p>
            </div>
            <textarea
              ref={uiPromptRef}
              value={uiPromptText}
              onChange={(e) => setUIPromptText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitUIPrompt();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setUIPrompt(null);
                  setUIPromptText("");
                }
              }}
              placeholder={
                uiPrompt.sourceCode
                  ? "Any direction for the stylize? (or just hit Enter)"
                  : "What do you want to build? e.g. a pricing page, a dashboard, a login form..."
              }
              rows={2}
              className="w-full bg-background/60 border border-border-subtle rounded-lg px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent/40 resize-none leading-relaxed tracking-[0.01em]"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted/40 tracking-wide">
                Enter to generate · Esc to cancel
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setUIPrompt(null); setUIPromptText(""); }}
                  className="px-3 py-1.5 text-[11px] rounded-lg text-muted hover:text-foreground transition-colors tracking-wide"
                >
                  Cancel
                </button>
                <button
                  onClick={submitUIPrompt}
                  className="px-3 py-1.5 text-[11px] rounded-lg bg-accent hover:bg-accent-dim text-white transition-colors tracking-wide font-medium"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PatinaCanvas() {
  return (
    <ReactFlowProvider>
      <PatinaCanvasInner />
    </ReactFlowProvider>
  );
}
