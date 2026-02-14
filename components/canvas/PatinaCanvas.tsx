"use client";

import { useCallback, useRef, useState } from "react";
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
import { classifyContent } from "@/lib/classify";
import { ImageNode } from "@/components/nodes/ImageNode";
import { TextNode } from "@/components/nodes/TextNode";
import { SuggestedNode } from "@/components/nodes/SuggestedNode";
import { CodeNode } from "@/components/nodes/CodeNode";
import { MusicNode } from "@/components/nodes/MusicNode";
import { ContextMenu } from "@/components/canvas/ContextMenu";
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
async function parseUrl(url: string): Promise<{ title: string; description: string; ogImage?: string }> {
  const res = await fetch("/api/parse-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return { title: "", description: "" };
  return res.json();
}

function PatinaCanvasInner() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } =
    usePatinaStore();
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Trigger vibe extraction for new nodes, recompute composite
  useVibeExtraction();

  // Right-click context menu
  const onContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
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
        // Parse the URL to get metadata
        const meta = await parseUrl(classified.content);
        const ogIsImage = meta.ogImage && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(meta.ogImage);
        if (ogIsImage && meta.ogImage) {
          addContentNode("image", meta.ogImage, position, { title: meta.title });
        } else {
          addContentNode(
            "url",
            meta.description || classified.content,
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

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full"
      onPaste={onPaste}
      onContextMenu={onContextMenu}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-[#0a0a0c]"
      >
        <Controls />
        <Background
          variant={BackgroundVariant.Lines}
          gap={32}
          color="#1a1a22"
        />
      </ReactFlow>

      <ContextMenu
        position={contextMenu}
        onClose={() => setContextMenu(null)}
      />
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
