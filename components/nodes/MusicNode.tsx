"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import type { PatinaNode } from "@/types";

export function MusicNode({ data, selected }: NodeProps<PatinaNode>) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioUrl = data.audioUrl || data.content;

  // Auto-play when streaming URL arrives
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.load();
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const { currentTime, duration } = audioRef.current;
    if (duration) setProgress((currentTime / duration) * 100);
  };

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-200 bg-surface ${
        selected
          ? "border-accent shadow-lg shadow-accent/20"
          : "border-border-subtle hover:border-border-subtle/80"
      }`}
      style={{ width: 280 }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-accent text-lg">♪</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {data.title || "Generated Track"}
            </p>
            <p className="text-[10px] text-muted uppercase tracking-wide">
              suno ai
            </p>
          </div>
        </div>
      </div>

      {/* Player */}
      <div className="px-4 py-3">
        {audioUrl ? (
          <>
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />

            {/* Progress bar */}
            <div className="w-full h-1 bg-border-subtle rounded-full mb-3 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-accent hover:bg-accent-dim flex items-center justify-center transition-colors"
              >
                <span className="text-white text-sm">
                  {playing ? "⏸" : "▶"}
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-4">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-accent rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.random() * 16}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-muted ml-3">Generating...</span>
          </div>
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
