"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PatinaNode } from "@/types";
import { DismissButton } from "./DismissButton";

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

/** Render text with clickable links */
function LinkedText({ text }: { text: string }) {
  const parts: (string | { url: string; key: number })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  const regex = new RegExp(URL_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ url: match[0], key: keyCounter++ });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((part) =>
        typeof part === "string" ? (
          part
        ) : (
          <a
            key={part.key}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent/70 hover:text-accent underline underline-offset-2 decoration-accent/30 hover:decoration-accent/60 transition-colors cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {part.url}
          </a>
        )
      )}
    </>
  );
}

export function TextNode({ id, data, selected }: NodeProps<PatinaNode>) {
  return (
    <div
      className="patina-node group p-4"
      data-selected={selected}
      style={{ width: 280, maxHeight: 200 }}
    >
      <DismissButton nodeId={id} />
      {/* Vibe extracted indicator */}
      {data.vibeContribution && (
        <div
          className="absolute top-3 right-3 w-2 h-2 rounded-full bg-accent"
          style={{ animation: "soft-pulse 2.5s ease-in-out infinite" }}
        />
      )}

      <p className="text-[13px] text-foreground/85 leading-[1.65] overflow-hidden line-clamp-6 tracking-[0.01em]">
        <LinkedText text={data.content} />
      </p>

      {data.title && (
        <p className="text-[10px] text-muted mt-3 uppercase tracking-[0.08em] truncate font-medium">
          {data.title}
        </p>
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
