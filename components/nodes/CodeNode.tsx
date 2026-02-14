"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import type { PatinaNode } from "@/types";

export function CodeNode({ data, selected }: NodeProps<PatinaNode>) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-200 bg-surface ${
        selected
          ? "border-accent shadow-lg shadow-accent/20"
          : "border-border-subtle hover:border-border-subtle/80"
      }`}
      style={{ width: 400, height: 320 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <span className="text-xs text-muted uppercase tracking-wide">
          {data.title || "Generated UI"}
        </span>
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-[10px] px-2 py-0.5 rounded bg-border-subtle hover:bg-surface-hover text-muted transition-colors"
        >
          {showCode ? "Preview" : "Code"}
        </button>
      </div>

      {/* Content */}
      <div className="w-full" style={{ height: "calc(100% - 36px)" }}>
        {showCode ? (
          <pre className="p-3 text-xs font-mono text-foreground/80 overflow-auto h-full">
            <code>{data.content}</code>
          </pre>
        ) : (
          <iframe
            srcDoc={data.previewHtml || data.content}
            className="w-full h-full border-0 bg-white rounded-b-xl"
            sandbox="allow-scripts"
            title="UI Preview"
          />
        )}
      </div>

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
