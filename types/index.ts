import type { Node, Edge } from "@xyflow/react";

// ─── Node Data Types ─────────────────────────────────────────────

export type PatinaNodeType =
  | "image"
  | "text"
  | "url"
  | "vibe"
  | "styled-photo"
  | "code"
  | "music"
  | "suggested";

export interface PatinaNodeData extends Record<string, unknown> {
  type: PatinaNodeType;
  content: string; // URL, base64, text, or generated content
  vibeContribution?: VibeContribution;
  metadata?: Record<string, unknown>;
  // For suggested nodes
  dismissed?: boolean;
  // For styled-photo nodes
  originalImageUrl?: string;
  // For code nodes
  previewHtml?: string;
  // For music nodes
  audioUrl?: string;
  title?: string;
}

export type PatinaNode = Node<PatinaNodeData>;
export type PatinaEdge = Edge;

// ─── Dropped Content (before classification) ─────────────────────

export interface DroppedContent {
  raw: string | File;
  sourceType: "file" | "paste" | "url" | "text";
  position: { x: number; y: number };
}

// ─── Vibe Types ──────────────────────────────────────────────────

export interface CSSFilters {
  brightness: number;
  contrast: number;
  saturate: number;
  "hue-rotate": string;
  sepia: number;
}

export interface VibeContribution {
  colors: string[];
  mood_tags: string[];
  aesthetic_tags: string[];
  warmth: number;
  contrast: number;
  saturation: number;
  texture: string;
  css_filters: CSSFilters;
  sonic_mood?: string;
}

export interface VibeProfile {
  color_palette: {
    dominant: string[];
    accent: string[];
    background_tone: "warm" | "cool" | "neutral";
  };
  mood: string;
  mood_tags: string[];
  lighting: { warmth: number; contrast: number };
  texture: string;
  saturation: number;
  brightness: number;
  aesthetic_tags: string[];
  css_filters: CSSFilters;
  sonic_mood: string;
}

// ─── Discovery Types ─────────────────────────────────────────────

export interface SuggestedReference {
  id: string;
  imageUrl: string;
  originUrl: string;
  width: number;
  height: number;
  query?: string;
}

// ─── API Request/Response Types ──────────────────────────────────

export interface ExtractVibeRequest {
  content: string;
  type: "image" | "text" | "url";
}

export interface ExtractVibeResponse {
  contribution: VibeContribution;
}

export interface MergeVibeRequest {
  contributions: {
    nodeId: string;
    vibe: VibeContribution;
    weight: number;
  }[];
}

export interface MergeVibeResponse {
  profile: VibeProfile;
}

export interface DiscoverRequest {
  vibe: VibeProfile;
}

export interface DiscoverResponse {
  suggestions: SuggestedReference[];
}

export interface StyleTransferRequest {
  style_references: string[];
  target_image: string;
  prompt: string;
  strength?: number;
}

export interface StyleTransferResponse {
  jobId: string;
}

export interface StyleTransferStatusResponse {
  status: "pending" | "processing" | "done" | "error";
  imageUrl?: string;
  error?: string;
}

export interface GenerateUIRequest {
  vibe: VibeProfile;
  user_input: string;
}

export interface GenerateUIResponse {
  code: string;
  preview_html: string;
}

export interface GenerateMusicRequest {
  sonic_mood: string;
  mood_tags: string[];
  duration?: number;
}

export interface GenerateMusicResponse {
  audio_url: string;
  title: string;
}

export interface UploadResponse {
  url: string;
}

export interface ParseUrlResponse {
  title: string;
  description: string;
  text: string;
  images: string[];
  ogImage?: string;
}
