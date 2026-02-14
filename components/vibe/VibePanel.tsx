"use client";

import { usePatinaStore } from "@/lib/store";
import { PaletteDisplay } from "./PaletteDisplay";
import { MoodTags } from "./MoodTags";

export function VibePanel() {
  const { compositeVibe, isExtracting, nodes } = usePatinaStore();

  const referenceCount = nodes.filter((n) =>
    ["image", "text", "url"].includes(n.data.type)
  ).length;

  return (
    <aside className="w-[320px] h-full border-l border-border-subtle bg-surface flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-subtle">
        <h2 className="text-sm font-medium tracking-wide uppercase text-muted">
          Vibe Profile
        </h2>
        <p className="text-xs text-muted mt-1">
          {referenceCount} reference{referenceCount !== 1 ? "s" : ""} on canvas
          {isExtracting && (
            <span className="ml-2 text-accent animate-pulse">extracting...</span>
          )}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {compositeVibe ? (
          <>
            {/* Color Palette */}
            <PaletteDisplay palette={compositeVibe.color_palette} />

            {/* Mood */}
            <div>
              <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                Mood
              </h3>
              <p className="text-sm">{compositeVibe.mood}</p>
            </div>

            {/* Tags */}
            <MoodTags
              label="Mood"
              tags={compositeVibe.mood_tags}
            />
            <MoodTags
              label="Aesthetic"
              tags={compositeVibe.aesthetic_tags}
            />

            {/* Sliders */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wide">
                Properties
              </h3>
              <SliderRow label="Warmth" value={compositeVibe.lighting.warmth} />
              <SliderRow label="Contrast" value={compositeVibe.lighting.contrast} />
              <SliderRow label="Saturation" value={compositeVibe.saturation} />
              <SliderRow label="Brightness" value={compositeVibe.brightness} />
            </div>

            {/* Texture */}
            <div>
              <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                Texture
              </h3>
              <p className="text-sm">{compositeVibe.texture}</p>
            </div>

            {/* Sonic Mood */}
            {compositeVibe.sonic_mood && (
              <div>
                <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  Sonic Mood
                </h3>
                <p className="text-sm italic text-muted">
                  {compositeVibe.sonic_mood}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-sm text-muted">
              Drop references onto the canvas to start building your vibe.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function SliderRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted w-20">{label}</span>
      <div className="flex-1 h-1.5 bg-border-subtle rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted w-8 text-right font-mono">
        {value.toFixed(2)}
      </span>
    </div>
  );
}
