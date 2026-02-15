"use client";

import { PatinaCanvas } from "@/components/canvas/PatinaCanvas";
import { VibeStrip, VibePalette } from "@/components/vibe/VibeStrip";
import { BoardSwitcher } from "@/components/canvas/BoardSwitcher";
import { HiddenNodesBadge } from "@/components/discovery/HiddenNodesBadge";

export default function Home() {
  return (
    <div className="h-screen w-screen relative">
      <PatinaCanvas />
      <div className="absolute top-3 left-3 z-[40] flex items-center gap-3">
        <BoardSwitcher />
        <VibePalette />
        <HiddenNodesBadge />
      </div>
      <VibeStrip />
    </div>
  );
}
