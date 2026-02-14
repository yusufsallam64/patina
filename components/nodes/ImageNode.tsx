"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PatinaNode } from "@/types";
import { DismissButton } from "./DismissButton";

export function ImageNode({ id, data, selected }: NodeProps<PatinaNode>) {
  return (
    <div
      className="patina-node group overflow-hidden"
      data-selected={selected}
      style={{ width: 240 }}
    >
      <DismissButton nodeId={id} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.content}
        alt={data.title || "Reference image"}
        className="w-full h-auto block rounded-[13px]"
        draggable={false}
      />

      {/* Vibe extracted indicator — soft glow dot */}
      {data.vibeContribution && (
        <div
          className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-accent"
          style={{ animation: "soft-pulse 2.5s ease-in-out infinite" }}
        />
      )}

      {/* Title overlay on hover */}
      {data.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <p className="text-[11px] text-white/90 font-medium truncate tracking-wide">
            {data.title}
          </p>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-[7px] !h-[7px] !bg-accent !border-2 !border-surface"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-[7px] !h-[7px] !bg-accent !border-2 !border-surface"
      />
    </div>
  );
}
