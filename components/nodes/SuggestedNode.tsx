"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { usePatinaStore } from "@/lib/store";
import type { PatinaNode } from "@/types";

export function SuggestedNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const { acceptSuggestion, dismissSuggestion } = usePatinaStore();

  return (
    <div
      className="patina-node group overflow-hidden opacity-60 hover:opacity-100 transition-opacity duration-300"
      data-selected={selected}
      style={{
        width: 180,
        borderStyle: "dashed",
        borderColor: "rgba(139, 92, 246, 0.2)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.content}
        alt="Suggested reference"
        className="w-full h-auto block rounded-[13px]"
        draggable={false}
      />

      {/* Action overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 rounded-[13px]">
        <button
          onClick={() => acceptSuggestion(id)}
          className="px-3.5 py-1.5 text-[11px] font-medium rounded-lg bg-accent text-white hover:bg-accent-dim transition-colors tracking-wide"
        >
          Keep
        </button>
        <button
          onClick={() => dismissSuggestion(id)}
          className="px-3.5 py-1.5 text-[11px] font-medium rounded-lg bg-white/10 text-white/80 hover:bg-white/15 transition-colors tracking-wide"
        >
          Skip
        </button>
      </div>

      {/* Ghost label */}
      <div className="absolute top-2 left-2">
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent/15 text-accent/80 uppercase tracking-[0.1em] font-medium">
          suggested
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-[7px] !h-[7px] !bg-accent/50 !border-2 !border-surface"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-[7px] !h-[7px] !bg-accent/50 !border-2 !border-surface"
      />
    </div>
  );
}
