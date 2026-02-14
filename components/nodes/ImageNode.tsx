"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PatinaNode } from "@/types";

export function ImageNode({ data, selected }: NodeProps<PatinaNode>) {
  return (
    <div
      className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-200 ${
        selected
          ? "border-accent shadow-lg shadow-accent/20"
          : "border-border-subtle hover:border-border-subtle/80"
      }`}
      style={{ width: 240 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.content}
        alt={data.title || "Reference image"}
        className="w-full h-auto block"
        draggable={false}
      />

      {/* Vibe extraction indicator */}
      {data.vibeContribution && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent animate-pulse" />
      )}

      {/* Title overlay on hover */}
      {data.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-xs text-white truncate">{data.title}</p>
        </div>
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
