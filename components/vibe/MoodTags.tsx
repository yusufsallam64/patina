"use client";

interface MoodTagsProps {
  label: string;
  tags: string[];
}

export function MoodTags({ label, tags }: MoodTagsProps) {
  if (tags.length === 0) return null;

  return (
    <div>
      <h3 className="text-[10px] font-medium text-muted/70 uppercase tracking-[0.12em] mb-2.5">
        {label}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-[11px] px-2.5 py-[5px] rounded-lg bg-border-subtle/40 text-foreground/60 transition-all duration-200 hover:bg-accent/10 hover:text-accent/80 tracking-[0.02em] cursor-default"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
