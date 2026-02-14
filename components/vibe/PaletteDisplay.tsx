"use client";

interface PaletteDisplayProps {
  palette: {
    dominant: string[];
    accent: string[];
    background_tone: "warm" | "cool" | "neutral";
  };
}

export function PaletteDisplay({ palette }: PaletteDisplayProps) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
        Color Palette
      </h3>

      {/* Dominant colors */}
      <div className="flex gap-1.5 mb-2">
        {palette.dominant.map((color, i) => (
          <div key={`dom-${i}`} className="group relative">
            <div
              className="w-10 h-10 rounded-lg border border-border-subtle transition-transform group-hover:scale-110"
              style={{ backgroundColor: color }}
            />
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {color}
            </span>
          </div>
        ))}
      </div>

      {/* Accent colors */}
      {palette.accent.length > 0 && (
        <div className="flex gap-1.5 mt-4">
          {palette.accent.map((color, i) => (
            <div key={`acc-${i}`} className="group relative">
              <div
                className="w-7 h-7 rounded-md border border-border-subtle transition-transform group-hover:scale-110"
                style={{ backgroundColor: color }}
              />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {color}
              </span>
            </div>
          ))}
          <span className="text-[10px] text-muted self-center ml-1">accent</span>
        </div>
      )}

      {/* Tone badge */}
      <div className="mt-3">
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border-subtle text-muted">
          {palette.background_tone} tone
        </span>
      </div>
    </div>
  );
}
