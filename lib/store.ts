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
  InterviewAnswer,
} from "@/types";

// ─── Board Types ────────────────────────────────────────────────

export interface BoardMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface BoardData {
  nodes: PatinaNode[];
  edges: PatinaEdge[];
  vibeCache: Record<string, VibeContribution>;
  compositeVibe: VibeProfile | null;
}

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
  discoveryVersion: number;
  setSuggestedNodes: (nodes: SuggestedReference[]) => void;
  acceptSuggestion: (id: string, position?: { x: number; y: number }) => void;
  dismissSuggestion: (id: string) => void;
  setIsDiscovering: (v: boolean) => void;
  requestRediscovery: () => void;
  interviewAnswers: InterviewAnswer[];
  setInterviewAnswers: (answers: InterviewAnswer[]) => void;
  relatedQuestions: string[];
  setRelatedQuestions: (questions: string[]) => void;

  // Hidden nodes (dismissed but cached)
  hiddenNodes: PatinaNode[];
  hideNode: (id: string) => void;
  restoreNode: (id: string) => void;
  restoreAllNodes: () => void;

  // Vibe narrative
  vibeNarrative: string | null;
  isNarrativeLoading: boolean;
  setVibeNarrative: (narrative: string | null) => void;
  setIsNarrativeLoading: (v: boolean) => void;

  // Mode
  mode: "smart" | "power";
  toggleMode: () => void;

  // Multi-board
  currentBoardId: string;
  boards: BoardMeta[];
  createBoard: (name?: string) => string;
  switchBoard: (id: string) => void;
  deleteBoard: (id: string) => void;
  renameBoard: (id: string, name: string) => void;
  saveCurrentBoard: () => void;
  loadBoardList: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────

let nodeIdCounter = 0;
function generateNodeId(): string {
  return `node-${Date.now()}-${++nodeIdCounter}`;
}

function generateBoardId(): string {
  return `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const BOARDS_INDEX_KEY = "patina-boards-index";
const boardDataKey = (id: string) => `patina-board-${id}`;

function saveBoardData(id: string, data: BoardData) {
  try {
    localStorage.setItem(boardDataKey(id), JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save board data:", e);
  }
}

function loadBoardData(id: string): BoardData | null {
  try {
    const raw = localStorage.getItem(boardDataKey(id));
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Filter out legacy "suggested" nodes that are no longer rendered on canvas
    if (data.nodes) {
      data.nodes = data.nodes.filter((n: PatinaNode) => n.type !== "suggested");
      // Migrate legacy text nodes with sourceUrl to the new url node type
      data.nodes = data.nodes.map((n: PatinaNode) => {
        if (n.type === "text" && n.data?.sourceUrl) {
          return { ...n, type: "url" };
        }
        return n;
      });
    }
    return data;
  } catch {
    return null;
  }
}

function saveBoardsIndex(boards: BoardMeta[]) {
  try {
    localStorage.setItem(BOARDS_INDEX_KEY, JSON.stringify(boards));
  } catch (e) {
    console.error("Failed to save boards index:", e);
  }
}

function loadBoardsIndex(): BoardMeta[] {
  try {
    const raw = localStorage.getItem(BOARDS_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ─── Store ───────────────────────────────────────────────────────

const DEFAULT_BOARD_ID = "default";

export const usePatinaStore = create<PatinaStore>((set, get) => ({
  // ── Nodes & Edges ──
  nodes: [],
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
  discoveryVersion: 0,

  setSuggestedNodes: (suggestions) => {
    set({ suggestedNodes: suggestions });
  },

  acceptSuggestion: (id, position) => {
    const suggestion = get().suggestedNodes.find((s) => s.id === id);
    if (!suggestion) return;

    const nodeType = suggestion.type === "url" ? "text" : suggestion.type;
    const pos = position || { x: 0, y: 0 };
    const newNode: PatinaNode = {
      id: generateNodeId(),
      type: nodeType,
      position: pos,
      data: {
        type: nodeType as PatinaNodeData["type"],
        content: suggestion.content,
        title: suggestion.title,
        sourceUrl: suggestion.originUrl,
        metadata: { originUrl: suggestion.originUrl, query: suggestion.query, fromDiscovery: true },
      },
    };
    set({
      nodes: [...get().nodes, newNode],
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

  requestRediscovery: () => {
    set({
      suggestedNodes: [],
      discoveryVersion: get().discoveryVersion + 1,
    });
  },

  // ── Interview & Related Questions ──
  interviewAnswers: [],
  setInterviewAnswers: (answers) => set({ interviewAnswers: answers }),
  relatedQuestions: [],
  setRelatedQuestions: (questions) => set({ relatedQuestions: questions }),

  // ── Hidden Nodes ──
  hiddenNodes: [],

  hideNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    // Move to hidden list — keep vibe cache intact
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      hiddenNodes: [...get().hiddenNodes, node],
    });
  },

  restoreNode: (id) => {
    const node = get().hiddenNodes.find((n) => n.id === id);
    if (!node) return;
    set({
      hiddenNodes: get().hiddenNodes.filter((n) => n.id !== id),
      nodes: [...get().nodes, node],
    });
  },

  restoreAllNodes: () => {
    set({
      nodes: [...get().nodes, ...get().hiddenNodes],
      hiddenNodes: [],
    });
  },

  // ── Vibe Narrative ──
  vibeNarrative: null,
  isNarrativeLoading: false,
  setVibeNarrative: (narrative) => set({ vibeNarrative: narrative }),
  setIsNarrativeLoading: (v) => set({ isNarrativeLoading: v }),

  // ── Mode ──
  mode: "smart",

  toggleMode: () => {
    set({ mode: get().mode === "smart" ? "power" : "smart" });
  },

  // ── Multi-board ──
  currentBoardId: DEFAULT_BOARD_ID,
  boards: [],

  createBoard: (name) => {
    const { saveCurrentBoard } = get();
    saveCurrentBoard();

    const id = generateBoardId();
    const boardName = name || `Board ${get().boards.length + 1}`;
    const now = Date.now();

    const meta: BoardMeta = { id, name: boardName, createdAt: now, updatedAt: now };
    const updatedBoards = [...get().boards, meta];

    set({
      currentBoardId: id,
      boards: updatedBoards,
      nodes: [],
      edges: [],
      vibeCache: {},
      compositeVibe: null,
      suggestedNodes: [],
      vibeNarrative: null,
    });

    saveBoardsIndex(updatedBoards);
    saveBoardData(id, { nodes: [], edges: [], vibeCache: {}, compositeVibe: null });

    return id;
  },

  switchBoard: (id) => {
    if (id === get().currentBoardId) return;

    // Save current board first
    get().saveCurrentBoard();

    // Load target board
    const data = loadBoardData(id);
    set({
      currentBoardId: id,
      nodes: data?.nodes || [],
      edges: data?.edges || [],
      vibeCache: data?.vibeCache || {},
      compositeVibe: data?.compositeVibe || null,
      suggestedNodes: [],
      isExtracting: false,
      vibeNarrative: null,
    });
  },

  deleteBoard: (id) => {
    const { boards, currentBoardId } = get();
    if (boards.length <= 1) return; // Don't delete the last board

    const updatedBoards = boards.filter((b) => b.id !== id);
    set({ boards: updatedBoards });
    saveBoardsIndex(updatedBoards);

    try { localStorage.removeItem(boardDataKey(id)); } catch {}

    // If we deleted the current board, switch to the first remaining one
    if (id === currentBoardId && updatedBoards.length > 0) {
      get().switchBoard(updatedBoards[0].id);
    }
  },

  renameBoard: (id, name) => {
    const updatedBoards = get().boards.map((b) =>
      b.id === id ? { ...b, name, updatedAt: Date.now() } : b
    );
    set({ boards: updatedBoards });
    saveBoardsIndex(updatedBoards);
  },

  saveCurrentBoard: () => {
    const { currentBoardId, nodes, edges, vibeCache, compositeVibe, boards } = get();
    saveBoardData(currentBoardId, { nodes, edges, vibeCache, compositeVibe });

    // Update timestamp
    const updatedBoards = boards.map((b) =>
      b.id === currentBoardId ? { ...b, updatedAt: Date.now() } : b
    );
    set({ boards: updatedBoards });
    saveBoardsIndex(updatedBoards);
  },

  loadBoardList: () => {
    let boards = loadBoardsIndex();

    if (boards.length === 0) {
      // First time — create a default board
      const now = Date.now();
      const defaultMeta: BoardMeta = {
        id: DEFAULT_BOARD_ID,
        name: "My First Board",
        createdAt: now,
        updatedAt: now,
      };
      boards = [defaultMeta];
      saveBoardsIndex(boards);
    }

    // Load the most recently updated board
    const sorted = [...boards].sort((a, b) => b.updatedAt - a.updatedAt);
    const activeBoardId = sorted[0].id;
    const data = loadBoardData(activeBoardId);

    set({
      boards,
      currentBoardId: activeBoardId,
      nodes: data?.nodes || [],
      edges: data?.edges || [],
      vibeCache: data?.vibeCache || {},
      compositeVibe: data?.compositeVibe || null,
    });
  },
}));
