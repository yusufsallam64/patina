"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReactFlow } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { usePatinaStore } from "@/lib/store";
import type { InterviewQuestion, InterviewAnswer, SuggestedReference } from "@/types";

type DeckState = "idle" | "loading-interview" | "interview" | "searching" | "targeted-searching" | "deck";

// Extract Google Font family from a fonts.google.com URL
function extractFontFamily(url: string): string | null {
  const match = url.match(/fonts\.google\.com\/specimen\/([^/?#]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1]).replace(/\+/g, " ");
}

export function DiscoveryDeck() {
  const {
    nodes,
    compositeVibe,
    isExtracting,
    suggestedNodes,
    setSuggestedNodes,
    acceptSuggestion,
    dismissSuggestion,
    setIsDiscovering,
    vibeNarrative,
    relatedQuestions,
    setRelatedQuestions,
    setInterviewAnswers,
    currentBoardId,
    targetedNodes,
    clearTargetedNodes,
  } = usePatinaStore();

  const [state, setState] = useState<DeckState>("idle");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [contextInput, setContextInput] = useState("");
  const [currentCard, setCurrentCard] = useState(0);
  const [exitDirection, setExitDirection] = useState<"left" | "up">("left");
  const contextInputRef = useRef<HTMLInputElement>(null);

  const reactFlowInstance = useReactFlow();

  // Reset discovery state when board changes
  const prevBoardRef = useRef(currentBoardId);
  useEffect(() => {
    if (prevBoardRef.current !== currentBoardId) {
      prevBoardRef.current = currentBoardId;
      setState("idle");
      setQuestions([]);
      setCurrentQ(0);
      setAnswers([]);
      setContextInput("");
      setCurrentCard(0);
    }
  }, [currentBoardId]);

  // Watch for targeted discovery trigger from store
  useEffect(() => {
    if (targetedNodes.length >= 2) {
      triggerTargetedDiscovery(targetedNodes);
    }
  }, [targetedNodes]);

  const referenceCount = nodes.filter((n) =>
    ["image", "text", "url"].includes(n.data.type)
  ).length;

  const canDiscover = referenceCount >= 2 && !isExtracting && compositeVibe;

  // Keyboard navigation for deck
  useEffect(() => {
    if (state !== "deck") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleSkip();
      if (e.key === "ArrowRight") handleAdd();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, currentCard, suggestedNodes]);

  const getViewportCenter = useCallback(() => {
    const viewport = reactFlowInstance.getViewport();
    const container = document.querySelector(".react-flow");
    const w = container?.clientWidth || window.innerWidth;
    const h = container?.clientHeight || window.innerHeight;
    return {
      x: (-viewport.x + w / 2) / viewport.zoom - 120,
      y: (-viewport.y + h / 2) / viewport.zoom - 100,
    };
  }, [reactFlowInstance]);

  const startInterview = async () => {
    setState("loading-interview");
    try {
      const refNodes = nodes
        .filter((n) => ["image", "text", "url"].includes(n.data.type))
        .slice(0, 6);

      const { interviewAnswers: previousAnswers } = usePatinaStore.getState();
      const res = await fetch("/api/discovery-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibe: compositeVibe,
          references: refNodes.map((n) => ({
            type: n.data.type,
            content: n.data.content,
            title: n.data.title,
          })),
          narrative: vibeNarrative,
          relatedQuestions,
          previousAnswers,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
        setCurrentQ(0);
        setAnswers([]);
        setContextInput("");
        setState("interview");
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  };

  const answerQuestion = (answer: string) => {
    const newAnswer: InterviewAnswer = {
      question: questions[currentQ].question,
      answer,
      context: contextInput.trim() || undefined,
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    setContextInput("");

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // All answered — trigger discovery
      setInterviewAnswers(newAnswers);
      triggerDiscovery(newAnswers);
    }
  };

  const triggerDiscovery = async (interviewAnswers: InterviewAnswer[]) => {
    setState("searching");
    setIsDiscovering(true);

    try {
      const refNodes = nodes
        .filter((n) => ["image", "text", "url"].includes(n.data.type))
        .slice(0, 6);

      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibe: compositeVibe,
          references: refNodes.map((n) => ({
            type: n.data.type,
            content: n.data.content,
            title: n.data.title,
          })),
          narrative: vibeNarrative,
          interviewAnswers,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.suggestions?.length > 0) {
          setSuggestedNodes(data.suggestions);
          setCurrentCard(0);
          setState("deck");
        } else {
          setState("idle");
        }
        if (data.relatedQuestions) {
          setRelatedQuestions(data.relatedQuestions);
        }
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    } finally {
      setIsDiscovering(false);
    }
  };

  const triggerTargetedDiscovery = async (nodeIds: string[]) => {
    setState("targeted-searching");
    setIsDiscovering(true);

    try {
      const selectedNodes = nodes.filter((n) => nodeIds.includes(n.id));
      const references = selectedNodes.map((n) => ({
        type: n.data.type as "image" | "text" | "url",
        content: n.data.content,
        title: n.data.title,
      }));

      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibe: compositeVibe,
          references,
          narrative: vibeNarrative,
          targetedContext: "Find content that lives at the intersection of these specific references. Focus on what connects them — shared themes, cultural lineage, and conceptual bridges.",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.suggestions?.length > 0) {
          setSuggestedNodes(data.suggestions);
          setCurrentCard(0);
          setState("deck");
        } else {
          setState("idle");
        }
        if (data.relatedQuestions) {
          setRelatedQuestions(data.relatedQuestions);
        }
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    } finally {
      setIsDiscovering(false);
      clearTargetedNodes();
    }
  };

  const handleAdd = () => {
    const card = suggestedNodes[currentCard];
    if (!card) return;
    setExitDirection("up");
    const center = getViewportCenter();
    acceptSuggestion(card.id, center);
    // suggestedNodes shrinks by 1, currentCard stays same index (now points to next card)
    if (currentCard >= suggestedNodes.length - 1) {
      // Was last card
      setState("idle");
    }
  };

  const handleSkip = () => {
    const card = suggestedNodes[currentCard];
    if (!card) return;
    setExitDirection("left");
    dismissSuggestion(card.id);
    if (currentCard >= suggestedNodes.length - 1) {
      setState("idle");
    }
  };

  const dismissDeck = () => {
    setState("idle");
    // Don't clear suggestions — user might want to come back
  };

  if (!canDiscover && state === "idle") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[25] flex justify-center pointer-events-none pb-8">
      <div className="pointer-events-auto">
        <AnimatePresence mode="wait">
          {/* ── Idle ── */}
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-2"
              style={{ marginBottom: "8vh" }}
            >
              {/* Related question hints from previous round */}
              {relatedQuestions.length > 0 && (
                <div className="flex flex-col items-center gap-1.5 mb-1">
                  {relatedQuestions.slice(0, 2).map((q, i) => (
                    <span
                      key={i}
                      className="text-[11px] text-muted/60 tracking-[0.02em] max-w-[360px] text-center leading-relaxed"
                    >
                      {q}
                    </span>
                  ))}
                </div>
              )}
              <div className="w-[40px] h-px bg-border-subtle mb-1" />
              <button
                onClick={startInterview}
                className="text-[12px] uppercase tracking-[0.14em] text-muted/70 hover:text-foreground/90 transition-colors duration-200 cursor-pointer"
              >
                go deeper
              </button>
            </motion.div>
          )}

          {/* ── Loading Interview ── */}
          {state === "loading-interview" && (
            <motion.div
              key="loading-interview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
              style={{ marginBottom: "8vh" }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full bg-accent"
                style={{ animation: "soft-pulse 1.5s ease-in-out infinite" }}
              />
              <span className="text-[11px] text-muted/50 tracking-wide">
                preparing...
              </span>
            </motion.div>
          )}

          {/* ── Interview ── */}
          {state === "interview" && questions[currentQ] && (
            <motion.div
              key={`interview-${currentQ}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="bg-surface border border-border-subtle rounded-[3px] relative pb-2"
              style={{ width: 520 }}
            >
              {/* Header with dismiss */}
              <div className="flex items-start justify-between p-8 pb-0">
                <div className="text-[13px] text-foreground/80 leading-[1.7] pr-6 prose-inline">
                  <ReactMarkdown>{questions[currentQ].question}</ReactMarkdown>
                </div>
                <button
                  onClick={() => setState("idle")}
                  className="text-[10px] text-muted/40 hover:text-foreground/60 transition-colors tracking-wide cursor-pointer shrink-0"
                >
                  dismiss
                </button>
              </div>

              {/* Options */}
              <div className="flex gap-3 px-8 pt-6 pb-5">
                <button
                  onClick={() => answerQuestion(questions[currentQ].optionA)}
                  className="flex-1 py-3 px-5 text-[11px] tracking-wide border border-border-subtle text-foreground/60 hover:bg-surface-hover hover:text-foreground/90 transition-all duration-150 rounded-[2px] cursor-pointer"
                >
                  {questions[currentQ].optionA}
                </button>
                <button
                  onClick={() => answerQuestion(questions[currentQ].optionB)}
                  className="flex-1 py-3 px-5 text-[11px] tracking-wide border border-border-subtle text-foreground/60 hover:bg-surface-hover hover:text-foreground/90 transition-all duration-150 rounded-[2px] cursor-pointer"
                >
                  {questions[currentQ].optionB}
                </button>
              </div>

              {/* Context input + progress */}
              <div className="border-t border-border-subtle/40 mx-8 px-0 py-4 flex items-center gap-4">
                <input
                  ref={contextInputRef}
                  type="text"
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && contextInput.trim()) {
                      answerQuestion(contextInput.trim());
                    }
                  }}
                  placeholder="add context..."
                  className="flex-1 bg-transparent text-[11px] text-foreground/60 placeholder:text-muted/30 outline-none border-none tracking-[0.02em]"
                />
                <div className="flex gap-1.5 shrink-0">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className="w-[5px] h-[5px] rounded-full transition-colors duration-200"
                      style={{
                        backgroundColor:
                          i === currentQ
                            ? "var(--foreground)"
                            : i < currentQ
                              ? "var(--accent)"
                              : "var(--border-subtle)",
                        opacity: i === currentQ ? 0.6 : i < currentQ ? 0.5 : 0.3,
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Searching (regular + targeted) ── */}
          {(state === "searching" || state === "targeted-searching") && (
            <motion.div
              key="searching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
              style={{ marginBottom: "8vh" }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full bg-accent"
                style={{ animation: "soft-pulse 1.5s ease-in-out infinite" }}
              />
              <span className="text-[11px] text-muted/50 tracking-wide">
                {state === "targeted-searching" ? "finding connections..." : "searching..."}
              </span>
            </motion.div>
          )}

          {/* ── Card Deck ── */}
          {state === "deck" && suggestedNodes.length > 0 && (
            <motion.div
              key="deck"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="relative"
            >
              {/* Peek cards behind */}
              {suggestedNodes.slice(currentCard + 1, currentCard + 3).map((card, i) => (
                <div
                  key={card.id}
                  className="absolute top-0 left-0 w-[380px] bg-surface border border-border-subtle rounded-[3px] p-5"
                  style={{
                    transform: `translate(${(i + 1) * 4}px, ${(i + 1) * 4}px) scale(${1 - (i + 1) * 0.02})`,
                    opacity: i === 0 ? 0.6 : 0.3,
                    zIndex: -(i + 1),
                  }}
                >
                  <div className="opacity-0">placeholder</div>
                </div>
              ))}

              {/* Main card */}
              <AnimatePresence mode="popLayout">
                {suggestedNodes[currentCard] && (
                  <DiscoveryCard
                    key={suggestedNodes[currentCard].id}
                    card={suggestedNodes[currentCard]}
                    onAdd={handleAdd}
                    onSkip={handleSkip}
                    onDismiss={dismissDeck}
                    exitDirection={exitDirection}
                    remaining={suggestedNodes.length - currentCard}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DiscoveryCard({
  card,
  onAdd,
  onSkip,
  onDismiss,
  exitDirection,
  remaining,
}: {
  card: SuggestedReference;
  onAdd: () => void;
  onSkip: () => void;
  onDismiss: () => void;
  exitDirection: "left" | "up";
  remaining: number;
}) {
  const siteDomain = (card.originUrl || card.content || "")
    .replace(/^https?:\/\/(www\.)?/, "")
    .split(/[/?#]/)[0];

  const isImage = card.type === "image" && card.content?.startsWith("http");
  const isTypography = card.domain === "typography";
  const fontFamily = isTypography ? extractFontFamily(card.originUrl || card.content || "") : null;
  const vibeNarrative = usePatinaStore((s) => s.vibeNarrative);

  // Dynamically load Google Font for typography cards
  useEffect(() => {
    if (!fontFamily) return;
    const linkId = `gfont-${fontFamily.replace(/\s+/g, "-")}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [fontFamily]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{
        opacity: 0,
        x: exitDirection === "left" ? -120 : 0,
        y: exitDirection === "up" ? -60 : 0,
        transition: { duration: 0.2 },
      }}
      transition={{ duration: 0.2 }}
      className="w-[380px] bg-surface border border-border-subtle rounded-[3px] relative"
    >
      {/* Dismiss deck */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 text-[9px] text-muted/30 hover:text-foreground/60 transition-colors z-10"
      >
        ✕
      </button>

      {/* Image hero for image cards */}
      {isImage && (
        <div className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.content}
            alt=""
            draggable={false}
            style={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block", background: "#0a0a0c" }}
          />
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{ height: 24, background: "linear-gradient(to top, var(--surface), transparent)" }}
          />
        </div>
      )}

      {/* Typography preview for font cards */}
      {isTypography && fontFamily && (
        <div className="px-5 pt-5 pb-2">
          <p
            className="text-[16px] text-foreground/70 leading-relaxed"
            style={{
              fontFamily: `"${fontFamily}", sans-serif`,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {vibeNarrative || "The quick brown fox jumps over the lazy dog. Typography shapes how we feel before we read a single word."}
          </p>
          <p className="text-[10px] font-mono text-muted/40 mt-2">
            {fontFamily}
          </p>
        </div>
      )}

      <div className="p-5">
        {/* Title */}
        {card.title && (
          <div className="text-[13px] font-medium text-foreground/90 leading-snug mb-1.5 prose-inline" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            <ReactMarkdown>{card.title}</ReactMarkdown>
          </div>
        )}

        {/* Domain badge + site domain */}
        <div className="flex items-center gap-1.5 mb-3">
          {card.domain && (
            <span className="text-[9px] uppercase font-mono text-muted/50 tracking-[0.08em]">
              {card.domain}
            </span>
          )}
          {card.domain && siteDomain && (
            <span className="text-[9px] text-muted/30">·</span>
          )}
          {siteDomain && (
            <span className="text-[10px] font-mono text-muted/50">
              {siteDomain}
            </span>
          )}
        </div>

        {/* Why */}
        {card.query && (
          <div className="text-[12px] text-foreground/60 italic leading-relaxed prose-inline" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            <ReactMarkdown>{card.query}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center border-t border-border-subtle/50">
        <button
          onClick={onAdd}
          className="flex-1 py-3.5 text-[11px] text-accent hover:bg-accent/5 transition-colors tracking-wide text-center cursor-pointer"
        >
          add
        </button>
        <div className="w-px self-stretch bg-border-subtle/50" />
        <button
          onClick={onSkip}
          className="flex-1 py-3.5 text-[11px] text-muted/60 hover:text-foreground/70 hover:bg-surface-hover transition-colors tracking-wide text-center cursor-pointer"
        >
          skip
        </button>
        <div className="w-px self-stretch bg-border-subtle/50" />
        <span className="px-4 py-3.5 text-[9px] text-muted/30 font-mono">
          {remaining}
        </span>
      </div>
    </motion.div>
  );
}
