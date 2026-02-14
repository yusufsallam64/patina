"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState, useCallback } from "react";
import type { PatinaNode } from "@/types";
import { DismissButton } from "./DismissButton";

export function MusicNode({ id, data, selected }: NodeProps<PatinaNode>) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const audioUrl = data.audioUrl || data.content;

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (audio.duration && isFinite(audio.duration)) {
      setProgress((audio.currentTime / audio.duration) * 100);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  }, []);

  const handleDurationChange = useCallback(() => {
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
  }, []);

  const togglePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const audio = audioRef.current;
      if (!audio || !audioUrl) return;
      if (playing) {
        audio.pause();
      } else {
        audio.play().catch(console.error);
      }
    },
    [playing, audioUrl]
  );

  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const audio = audioRef.current;
      const bar = progressRef.current;
      if (!audio || !bar || !isFinite(audio.duration)) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
      setProgress(ratio * 100);
      setCurrentTime(audio.currentTime);
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const audio = audioRef.current;
      const bar = progressRef.current;
      if (!audio || !bar || !isFinite(audio.duration)) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
      setProgress(ratio * 100);
      setCurrentTime(audio.currentTime);
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging]);

  const formatTime = (s: number) => {
    if (!isFinite(s) || s === 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="patina-node group cursor-default"
      data-selected={selected}
      style={{ width: 280 }}
    >
      <DismissButton nodeId={id} />
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle bg-surface rounded-t-[14px]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <span className="text-accent text-sm">♪</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate tracking-[0.01em]">
              {data.title || "Generated Track"}
            </p>
            <p className="text-[10px] text-muted uppercase tracking-[0.1em] font-medium">
              suno ai
            </p>
          </div>
        </div>
      </div>

      {/* Player — nopan class prevents ReactFlow from intercepting clicks */}
      <div className="px-4 py-4 bg-surface rounded-b-[14px] nopan nodrag">
        {audioUrl ? (
          <>
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="metadata"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onDurationChange={handleDurationChange}
              onEnded={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />

            {/* Scrubable progress bar */}
            <div
              ref={progressRef}
              className="w-full h-[6px] bg-border-subtle rounded-full mb-1.5 overflow-hidden cursor-pointer group/scrub"
              onClick={handleScrub}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleScrub(e);
                setDragging(true);
              }}
            >
              <div
                className="h-full bg-gradient-to-r from-accent to-accent-dim rounded-full relative"
                style={{
                  width: `${progress}%`,
                  transition: dragging ? "none" : "width 0.3s linear",
                }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md opacity-0 group-hover/scrub:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Time display */}
            <div className="flex justify-between mb-3">
              <span className="text-[9px] font-mono text-muted/50 tabular-nums">
                {formatTime(currentTime)}
              </span>
              <span className="text-[9px] font-mono text-muted/50 tabular-nums">
                {formatTime(duration)}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center">
              <button
                onClick={togglePlay}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-10 h-10 rounded-full bg-accent hover:bg-accent-dim flex items-center justify-center transition-all duration-200 hover:shadow-[0_0_16px_var(--accent-glow-strong)] cursor-pointer"
              >
                <span className="text-white text-sm ml-[1px]">
                  {playing ? "⏸" : "▶"}
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-3">
            <div className="flex items-end gap-[3px]">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-[3px] bg-accent/60 rounded-full"
                  style={{
                    animation: `eq-bar 1.2s ease-in-out infinite`,
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] text-muted tracking-wide">
              Generating...
            </span>
          </div>
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
