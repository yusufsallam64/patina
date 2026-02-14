"use client";

import { PatinaCanvas } from "@/components/canvas/PatinaCanvas";
import { VibePanel } from "@/components/vibe/VibePanel";
import { BoardSwitcher } from "@/components/canvas/BoardSwitcher";

export default function Home() {
  return (
    <div className="h-screen w-screen flex">
      {/* Main canvas area */}
      <div className="flex-1 relative">
        {/* Top bar */}
        <div className="absolute top-3 left-3 z-10">
          <BoardSwitcher />
        </div>

        <PatinaCanvas />
      </div>

      {/* Vibe panel sidebar */}
      <VibePanel />
    </div>
  );
}
