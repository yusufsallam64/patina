"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import type { PatinaNode } from "@/types";
import { DismissButton } from "./DismissButton";

export function CodeNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div
      className="patina-node group overflow-hidden"
      data-selected={selected}
      style={{ width: 420, height: 340 }}
    >
      <DismissButton nodeId={id} />
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-[7px] h-[7px] rounded-full bg-[#ff5f57]" />
            <div className="w-[7px] h-[7px] rounded-full bg-[#febc2e]" />
            <div className="w-[7px] h-[7px] rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] text-muted font-medium tracking-wide ml-1">
            {data.title || "Generated UI"}
          </span>
        </div>
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-[10px] px-2.5 py-1 rounded-md bg-border-subtle/50 hover:bg-surface-hover text-muted hover:text-foreground transition-colors font-medium tracking-wide"
        >
          {showCode ? "Preview" : "Code"}
        </button>
      </div>

      {/* Content */}
      <div className="w-full" style={{ height: "calc(100% - 40px)" }}>
        {showCode ? (
          <pre className="p-4 text-[11px] font-mono text-foreground/70 overflow-auto h-full leading-relaxed">
            <code>{data.content}</code>
          </pre>
        ) : (
          <iframe
            srcDoc={data.previewHtml || data.content}
            className="w-full h-full border-0 bg-white"
            style={{ borderRadius: "0 0 13px 13px" }}
            sandbox="allow-scripts"
            title="UI Preview"
          />
        )}
      </div>

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
