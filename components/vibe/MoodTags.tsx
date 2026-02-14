"use client";

interface MoodTagsProps {
  label: string;
  tags: string[];
}

export function MoodTags({ label, tags }: MoodTagsProps) {
  if (tags.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        {label} Tags
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-xs px-2.5 py-1 rounded-full bg-surface-hover border border-border-subtle text-foreground/80 transition-colors hover:border-accent/30"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
