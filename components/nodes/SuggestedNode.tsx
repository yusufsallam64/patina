"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { usePatinaStore } from "@/lib/store";
import type { PatinaNode } from "@/types";

export function SuggestedNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const { acceptSuggestion, dismissSuggestion } = usePatinaStore();

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border-2 border-dashed transition-all duration-300 ${
        selected
          ? "border-accent/60 shadow-lg shadow-accent/10"
          : "border-accent/20 hover:border-accent/40"
      } opacity-70 hover:opacity-100`}
      style={{ width: 180 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.content}
        alt="Suggested reference"
        className="w-full h-auto block"
        draggable={false}
      />

      {/* Action overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={() => acceptSuggestion(id)}
          className="px-3 py-1.5 text-xs rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors"
        >
          Keep
        </button>
        <button
          onClick={() => dismissSuggestion(id)}
          className="px-3 py-1.5 text-xs rounded-lg bg-surface text-foreground hover:bg-surface-hover transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Ghost label */}
      <div className="absolute top-2 left-2">
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent uppercase tracking-wider">
          suggested
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-accent/50 !border-2 !border-surface"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-accent/50 !border-2 !border-surface"
      />
    </div>
  );
}
