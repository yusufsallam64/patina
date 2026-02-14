"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PatinaNode } from "@/types";

export function TextNode({ data, selected }: NodeProps<PatinaNode>) {
  return (
    <div
      className={`relative rounded-xl border-2 bg-surface p-4 transition-all duration-200 ${
        selected
          ? "border-accent shadow-lg shadow-accent/20"
          : "border-border-subtle hover:border-border-subtle/80"
      }`}
      style={{ width: 280, maxHeight: 200 }}
    >
      {/* Vibe extraction indicator */}
      {data.vibeContribution && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent animate-pulse" />
      )}

      <p className="text-sm text-foreground/90 leading-relaxed overflow-hidden line-clamp-6">
        {data.content}
      </p>

      {data.title && (
        <p className="text-[10px] text-muted mt-2 uppercase tracking-wide truncate">
          {data.title}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-accent !border-2 !border-surface"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-accent !border-2 !border-surface"
      />
    </div>
  );
}
