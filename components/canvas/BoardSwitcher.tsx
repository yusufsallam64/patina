"use client";

import { useEffect, useRef, useState } from "react";
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
  } = usePatinaStore();

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
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border-subtle hover:border-border-subtle/80 transition-colors text-sm"
      >
        <span className="w-2 h-2 rounded-full bg-accent" />
        <span className="truncate max-w-[160px]">
          {currentBoard?.name || "Board"}
        </span>
        <span className="text-muted text-xs">{open ? "▴" : "▾"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-border-subtle rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted">
              Boards
            </span>
            <button
              onClick={handleCreate}
              className="text-xs px-2 py-0.5 rounded bg-accent hover:bg-accent-dim text-white transition-colors"
            >
              + New
            </button>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {boards.map((board) => (
              <div
                key={board.id}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  board.id === currentBoardId
                    ? "bg-accent/10 border-l-2 border-accent"
                    : "hover:bg-surface-hover border-l-2 border-transparent"
                }`}
              >
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
                    className="flex-1 bg-transparent border border-border-subtle rounded px-1 py-0.5 text-sm outline-none focus:border-accent"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => handleSwitch(board.id)}
                      className="flex-1 text-left text-sm truncate"
                    >
                      {board.name}
                    </button>

                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(board);
                        }}
                        className="text-[10px] text-muted hover:text-foreground px-1"
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
                          className="text-[10px] text-muted hover:text-red-400 px-1"
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
