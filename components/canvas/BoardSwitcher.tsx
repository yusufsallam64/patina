"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { usePatinaStore, type BoardMeta } from "@/lib/store";

export function BoardSwitcher() {
  const {
    boards,
    currentBoardId,
    createBoard,
    switchBoard,
    deleteBoard,
    renameBoard,
    saveCurrentBoard,
    loadBoardList,
    compositeVibe,
  } = usePatinaStore();

  const dotColor = compositeVibe?.color_palette?.dominant?.[0] || "var(--accent)";

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Load boards on mount
  useEffect(() => {
    loadBoardList();
  }, [loadBoardList]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      saveCurrentBoard();
    }, 30000);
    return () => clearInterval(interval);
  }, [saveCurrentBoard]);

  // Save on beforeunload
  useEffect(() => {
    const handleUnload = () => saveCurrentBoard();
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [saveCurrentBoard]);

  // Close panel on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentBoard = boards.find((b) => b.id === currentBoardId);

  const handleCreate = () => {
    createBoard();
    setOpen(false);
  };

  const handleSwitch = (id: string) => {
    switchBoard(id);
    setOpen(false);
  };

  const handleStartRename = (board: BoardMeta) => {
    setEditingId(board.id);
    setEditName(board.name);
  };

  const handleFinishRename = () => {
    if (editingId && editName.trim()) {
      renameBoard(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Current board button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl glass-panel hover:border-border transition-all duration-200 group"
      >
        <span
          className="w-[6px] h-[6px] rounded-full"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}40` }}
        />
        <span className="text-[12px] tracking-[0.02em] text-foreground/80 group-hover:text-foreground truncate max-w-[160px] transition-colors">
          {currentBoard?.name || "Board"}
        </span>
        <span className="text-[9px] text-muted/50 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}>
          ▾
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 w-64 glass-panel rounded-xl z-50 overflow-hidden"
          style={{ animation: "node-appear 0.18s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          <div className="px-3.5 py-2.5 border-b border-border-subtle flex items-center justify-between">
            <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted/60">
              Boards
            </span>
            <button
              onClick={handleCreate}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent hover:text-accent transition-colors tracking-wide font-medium"
            >
              + New
            </button>
          </div>

          <div className="max-h-[300px] overflow-y-auto py-1">
            {boards.map((board) => (
              <div
                key={board.id}
                className={`group flex items-center gap-2 px-3.5 py-2 cursor-pointer transition-all duration-150 mx-1 rounded-lg ${
                  board.id === currentBoardId
                    ? "bg-accent/8 text-foreground"
                    : "text-foreground/60 hover:bg-surface-hover hover:text-foreground/90"
                }`}
              >
                {board.id === currentBoardId && (
                  <span className="w-[4px] h-[4px] rounded-full bg-accent flex-shrink-0" />
                )}
                {editingId === board.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFinishRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 bg-transparent border border-accent/30 rounded-md px-2 py-0.5 text-[12px] outline-none focus:border-accent transition-colors"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => handleSwitch(board.id)}
                      className="flex-1 text-left text-[12px] truncate tracking-[0.01em]"
                    >
                      {board.name}
                    </button>

                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(board);
                        }}
                        className="text-[10px] text-muted/40 hover:text-foreground/70 p-1 rounded transition-colors"
                        title="Rename"
                      >
                        ✎
                      </button>
                      {boards.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBoard(board.id);
                          }}
                          className="text-[10px] text-muted/40 hover:text-red-400 p-1 rounded transition-colors"
                          title="Delete"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
