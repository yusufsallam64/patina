"use client";

import { usePatinaStore } from "@/lib/store";

export function DismissButton({ nodeId }: { nodeId: string }) {
  const hideNode = usePatinaStore((s) => s.hideNode);

  return (
    <button
      className="node-dismiss nodrag nopan"
      onClick={(e) => {
        e.stopPropagation();
        hideNode(nodeId);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      title="Hide from board"
    >
      ✕
    </button>
  );
}
