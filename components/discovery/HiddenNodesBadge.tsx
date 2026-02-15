"use client";

import { useState, useRef, useEffect } from "react";
import { usePatinaStore } from "@/lib/store";

export function HiddenNodesBadge() {
  const { hiddenNodes, restoreNode, restoreAllNodes } = usePatinaStore();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (hiddenNodes.length === 0) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] text-muted/40 hover:text-foreground/60 transition-colors tracking-wide"
      >
        {hiddenNodes.length} hidden
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-56 glass-panel rounded-[3px] z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
            <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted/60">
              Hidden
            </span>
            <button
              onClick={() => {
                restoreAllNodes();
                setOpen(false);
              }}
              className="text-[9px] text-accent/60 hover:text-accent tracking-wide transition-colors"
            >
              Restore all
            </button>
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1">
            {hiddenNodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover transition-colors group"
              >
                <span className="text-[10px] text-muted/40 w-3">
                  {node.data.type === "image"
                    ? "◻"
                    : node.data.type === "music"
                      ? "♪"
                      : node.data.type === "code"
                        ? "◈"
                        : "¶"}
                </span>
                <span className="text-[11px] text-foreground/50 flex-1 truncate">
                  {node.data.title || node.data.content?.slice(0, 30) || node.data.type}
                </span>
                <button
                  onClick={() => {
                    restoreNode(node.id);
                  }}
                  className="text-[9px] text-muted/30 hover:text-accent opacity-0 group-hover:opacity-100 transition-all tracking-wide"
                >
                  restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
