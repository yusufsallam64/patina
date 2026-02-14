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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-medium text-muted/70 uppercase tracking-[0.12em]">
          Color Palette
        </h3>
        <span className="text-[9px] px-2 py-0.5 rounded-full border border-border-subtle text-muted/50 tracking-[0.06em]">
          {palette.background_tone}
        </span>
      </div>

      {/* Dominant colors — full-width gradient bar */}
      <div className="flex h-8 rounded-lg overflow-hidden mb-2">
        {palette.dominant.map((color, i) => (
          <div
            key={`dom-${i}`}
            className="group relative flex-1 cursor-crosshair transition-all duration-200 hover:flex-[1.4]"
            style={{ backgroundColor: color }}
          >
            <span className="absolute inset-x-0 bottom-0 text-center text-[8px] font-mono text-white/0 group-hover:text-white/80 transition-colors duration-150 py-1 bg-gradient-to-t from-black/40 to-transparent">
              {color}
            </span>
          </div>
        ))}
      </div>

      {/* Accent colors */}
      {palette.accent.length > 0 && (
        <div className="flex gap-1.5 mt-3">
          {palette.accent.map((color, i) => (
            <div key={`acc-${i}`} className="group relative">
              <div
                className="w-5 h-5 rounded-md transition-transform duration-150 group-hover:scale-125"
                style={{ backgroundColor: color }}
              />
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-mono text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {color}
              </span>
            </div>
          ))}
          <span className="text-[9px] text-muted/40 self-center ml-1.5 tracking-[0.08em]">
            accent
          </span>
        </div>
      )}
    </div>
  );
}
