"use client";

import { PatinaCanvas } from "@/components/canvas/PatinaCanvas";
import { VibePanel } from "@/components/vibe/VibePanel";

export default function Home() {
  return (
    <div className="h-screen w-screen flex">
      {/* Main canvas area */}
      <div className="flex-1 relative">
        <PatinaCanvas />
      </div>

      {/* Vibe panel sidebar */}
      <VibePanel />
    </div>
  );
}
