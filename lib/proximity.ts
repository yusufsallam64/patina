import type { PatinaNode, VibeContribution } from "@/types";

/**
 * Calculate Euclidean distance between two points
 */
export function euclideanDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Calculate influence weight based on distance.
 * Closer = higher weight. weight = 1 / (distance + epsilon)
 */
export function distanceToWeight(distance: number, epsilon = 1): number {
  return 1 / (distance + epsilon);
}

/**
 * Calculate the centroid of a set of nodes
 */
export function centroid(nodes: PatinaNode[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };
  const sum = nodes.reduce(
    (acc, n) => ({ x: acc.x + n.position.x, y: acc.y + n.position.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / nodes.length, y: sum.y / nodes.length };
}

/**
 * Find all nodes within maxDistance of a point, sorted by distance (closest first).
 * Returns each node with its distance and influence weight.
 */
export function getNodesNearPoint(
  nodes: PatinaNode[],
  point: { x: number; y: number },
  maxDistance = 1500
): { node: PatinaNode; distance: number; weight: number }[] {
  return nodes
    .map((node) => {
      const distance = euclideanDistance(node.position, point);
      return { node, distance, weight: distanceToWeight(distance) };
    })
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Compute proximity-weighted contributions for vibe merging.
 * Returns an array of { nodeId, vibe, weight } for each node that has a cached vibe.
 */
export function computeWeightedContributions(
  nodes: PatinaNode[],
  vibeCache: Record<string, VibeContribution>
): { nodeId: string; vibe: VibeContribution; weight: number }[] {
  // Filter to nodes that have vibe contributions
  const vibeNodes = nodes.filter((n) => vibeCache[n.id]);
  if (vibeNodes.length === 0) return [];

  const center = centroid(vibeNodes);

  return vibeNodes.map((node) => {
    const dist = euclideanDistance(node.position, center);
    return {
      nodeId: node.id,
      vibe: vibeCache[node.id],
      weight: distanceToWeight(dist),
    };
  });
}

/**
 * Merge weighted vibe contributions into a composite VibeProfile.
 * Done client-side for speed.
 */
export function mergeVibeContributions(
  contributions: { nodeId: string; vibe: VibeContribution; weight: number }[]
): import("@/types").VibeProfile | null {
  if (contributions.length === 0) return null;

  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);

  // ── Weighted average for numeric values ──
  let warmth = 0;
  let contrast = 0;
  let saturation = 0;
  let brightness = 0;
  let filterBrightness = 0;
  let filterContrast = 0;
  let filterSaturate = 0;
  let filterSepia = 0;

  // ── Collect all tags/colors with weights ──
  const colorWeights: Record<string, number> = {};
  const moodTagWeights: Record<string, number> = {};
  const aestheticTagWeights: Record<string, number> = {};
  const textures: string[] = [];
  const sonicMoods: string[] = [];

  for (const { vibe, weight } of contributions) {
    const w = weight / totalWeight;

    warmth += vibe.warmth * w;
    contrast += vibe.contrast * w;
    saturation += vibe.saturation * w;
    brightness += (vibe.css_filters.brightness ?? 1) * w;
    filterBrightness += vibe.css_filters.brightness * w;
    filterContrast += vibe.css_filters.contrast * w;
    filterSaturate += vibe.css_filters.saturate * w;
    filterSepia += vibe.css_filters.sepia * w;

    for (const color of vibe.colors) {
      colorWeights[color] = (colorWeights[color] || 0) + weight;
    }
    for (const tag of vibe.mood_tags) {
      moodTagWeights[tag] = (moodTagWeights[tag] || 0) + weight;
    }
    for (const tag of vibe.aesthetic_tags) {
      aestheticTagWeights[tag] = (aestheticTagWeights[tag] || 0) + weight;
    }
    if (vibe.texture) textures.push(vibe.texture);
    if (vibe.sonic_mood) sonicMoods.push(vibe.sonic_mood);
  }

  // ── Sort by weight and take top N ──
  const sortedColors = Object.entries(colorWeights)
    .sort(([, a], [, b]) => b - a)
    .map(([color]) => color);

  const sortedMoodTags = Object.entries(moodTagWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([tag]) => tag);

  const sortedAestheticTags = Object.entries(aestheticTagWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([tag]) => tag);

  // ── Determine background tone ──
  const backgroundTone: "warm" | "cool" | "neutral" =
    warmth > 0.6 ? "warm" : warmth < 0.4 ? "cool" : "neutral";

  return {
    color_palette: {
      dominant: sortedColors.slice(0, 5),
      accent: sortedColors.slice(5, 8),
      background_tone: backgroundTone,
    },
    mood: sortedMoodTags.slice(0, 3).join(", "),
    mood_tags: sortedMoodTags,
    lighting: { warmth, contrast },
    texture: textures[0] || "smooth",
    saturation,
    brightness,
    aesthetic_tags: sortedAestheticTags,
    css_filters: {
      brightness: filterBrightness,
      contrast: filterContrast,
      saturate: filterSaturate,
      "hue-rotate": "0deg",
      sepia: filterSepia,
    },
    sonic_mood: sonicMoods.join(", ") || "ambient, atmospheric",
  };
}
