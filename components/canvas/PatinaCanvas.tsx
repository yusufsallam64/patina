"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type NodeTypes,
} from "@xyflow/react";
import { usePatinaStore } from "@/lib/store";
import { ImageNode } from "@/components/nodes/ImageNode";
import { TextNode } from "@/components/nodes/TextNode";
import { SuggestedNode } from "@/components/nodes/SuggestedNode";

// Register custom node types
const nodeTypes: NodeTypes = {
  image: ImageNode,
  text: TextNode,
  suggested: SuggestedNode,
  // TODO: Add remaining node types as they're built
  // url: URLNode,
  // vibe: VibeNode,
  // "styled-photo": StyledPhotoNode,
  // code: CodeNode,
  // music: MusicNode,
};

export function PatinaCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    usePatinaStore();

  // Handle file drops onto the canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      // TODO: Implement drop handling with auto-classification
      // 1. Get files or text from the drop event
      // 2. Classify content type
      // 3. Upload images to DO Spaces
      // 4. Add node to canvas at drop position
      // 5. Trigger vibe extraction for the new node
    },
    []
  );

  // Handle paste (Cmd+V)
  const onPaste = useCallback(
    (event: React.ClipboardEvent) => {
      // TODO: Implement paste handling
      // 1. Check for image data, text, or URLs in clipboard
      // 2. Classify and add as node
    },
    []
  );

  return (
    <div
      className="w-full h-full"
      onPaste={onPaste}
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
    </div>
  );
}
