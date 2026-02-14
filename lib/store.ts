import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import type {
  PatinaNode,
  PatinaEdge,
  PatinaNodeData,
  DroppedContent,
  VibeContribution,
  VibeProfile,
  SuggestedReference,
} from "@/types";

// ─── Store Interface ─────────────────────────────────────────────

interface PatinaStore {
  // Nodes & Edges (react-flow)
  nodes: PatinaNode[];
  edges: PatinaEdge[];
  onNodesChange: OnNodesChange<PatinaNode>;
  onEdgesChange: OnEdgesChange<PatinaEdge>;
  onConnect: OnConnect;

  // Add / remove content
  addNode: (data: PatinaNodeData, position: { x: number; y: number }) => string;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<PatinaNodeData>) => void;

  // Vibe
  vibeCache: Record<string, VibeContribution>;
  compositeVibe: VibeProfile | null;
  isExtracting: boolean;
  setVibeContribution: (nodeId: string, vibe: VibeContribution) => void;
  setCompositeVibe: (vibe: VibeProfile) => void;
  setIsExtracting: (v: boolean) => void;

  // Discovery
  suggestedNodes: SuggestedReference[];
  isDiscovering: boolean;
  setSuggestedNodes: (nodes: SuggestedReference[]) => void;
  acceptSuggestion: (id: string) => void;
  dismissSuggestion: (id: string) => void;
  setIsDiscovering: (v: boolean) => void;

  // Mode
  mode: "smart" | "power";
  toggleMode: () => void;

  // Persistence
  saveBoard: () => string;
  loadBoard: (data: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────

let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node-${Date.now()}-${++nodeIdCounter}`;
}

// ─── Store ───────────────────────────────────────────────────────

// Demo seed nodes — remove before production
const DEMO_NODES: PatinaNode[] = [
  {
    id: "demo-img-1",
    type: "image",
    position: { x: 80, y: 100 },
    data: {
      type: "image",
      content: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=480&q=80",
      title: "Yosemite Valley",
    },
  },
  {
    id: "demo-img-2",
    type: "image",
    position: { x: 400, y: 60 },
    data: {
      type: "image",
      content: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=480&q=80",
      title: "Mountain Stars",
    },
  },
  {
    id: "demo-text-1",
    type: "text",
    position: { x: 120, y: 380 },
    data: {
      type: "text",
      content:
        "Warm amber light filtering through fog, the kind of quiet that feels heavy — like the world is holding its breath.",
      title: "mood reference",
    },
  },
  {
    id: "demo-suggested-1",
    type: "suggested",
    position: { x: 460, y: 340 },
    data: {
      type: "suggested",
      content: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=360&q=80",
    },
  },
];

export const usePatinaStore = create<PatinaStore>((set, get) => ({
  // ── Nodes & Edges ──
  nodes: DEMO_NODES,
  edges: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },

  // ── Add / Remove ──
  addNode: (data, position) => {
    const id = generateNodeId();
    const newNode: PatinaNode = {
      id,
      type: data.type,
      position,
      data,
    };
    set({ nodes: [...get().nodes, newNode] });
    return id;
  },

  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
    // Clean up vibe cache
    const cache = { ...get().vibeCache };
    delete cache[id];
    set({ vibeCache: cache });
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    });
  },

  // ── Vibe ──
  vibeCache: {},
  compositeVibe: null,
  isExtracting: false,

  setVibeContribution: (nodeId, vibe) => {
    set({ vibeCache: { ...get().vibeCache, [nodeId]: vibe } });
  },

  setCompositeVibe: (vibe) => {
    set({ compositeVibe: vibe });
  },

  setIsExtracting: (v) => {
    set({ isExtracting: v });
  },

  // ── Discovery ──
  suggestedNodes: [],
  isDiscovering: false,

  setSuggestedNodes: (nodes) => {
    set({ suggestedNodes: nodes });
  },

  acceptSuggestion: (id) => {
    const suggestion = get().suggestedNodes.find((s) => s.id === id);
    if (!suggestion) return;

    // Add as a real image node
    const nodeId = get().addNode(
      {
        type: "image",
        content: suggestion.imageUrl,
        metadata: { originUrl: suggestion.originUrl, fromDiscovery: true },
      },
      // Place near the center of the viewport — caller should provide better position
      { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 }
    );

    // Remove from suggestions
    set({
      suggestedNodes: get().suggestedNodes.filter((s) => s.id !== id),
    });
  },

  dismissSuggestion: (id) => {
    set({
      suggestedNodes: get().suggestedNodes.filter((s) => s.id !== id),
    });
  },

  setIsDiscovering: (v) => {
    set({ isDiscovering: v });
  },

  // ── Mode ──
  mode: "smart",

  toggleMode: () => {
    set({ mode: get().mode === "smart" ? "power" : "smart" });
  },

  // ── Persistence ──
  saveBoard: () => {
    const { nodes, edges, vibeCache, compositeVibe } = get();
    const data = JSON.stringify({ nodes, edges, vibeCache, compositeVibe });
    localStorage.setItem("patina-board", data);
    return data;
  },

  loadBoard: (data) => {
    try {
      const parsed = JSON.parse(data);
      set({
        nodes: parsed.nodes || [],
        edges: parsed.edges || [],
        vibeCache: parsed.vibeCache || {},
        compositeVibe: parsed.compositeVibe || null,
      });
    } catch (e) {
      console.error("Failed to load board:", e);
    }
  },
}));
