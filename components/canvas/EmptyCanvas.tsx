"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePatinaStore } from "@/lib/store";

const ease = [0.16, 1, 0.3, 1] as const;

const DEMO_NODES = [
  {
    data: {
      type: "image" as const,
      content: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600&q=80&auto=format",
      title: "Brutalist concrete",
    },
    position: { x: 80, y: 60 },
  },
  {
    data: {
      type: "image" as const,
      content: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80&auto=format",
      title: "Abstract gradient",
    },
    position: { x: 380, y: 40 },
  },
  {
    data: {
      type: "image" as const,
      content: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80&auto=format",
      title: "Alpine atmosphere",
    },
    position: { x: 80, y: 340 },
  },
  {
    data: {
      type: "image" as const,
      content: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&q=80&auto=format",
      title: "Warm interior",
    },
    position: { x: 680, y: 80 },
  },
  {
    data: {
      type: "image" as const,
      content: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&q=80&auto=format",
      title: "Tokyo neon",
    },
    position: { x: 380, y: 320 },
  },
  {
    data: {
      type: "text" as const,
      content: "Contrast between raw, brutalist surfaces and warm ambient lighting. The tension between industrial coldness and human warmth. Think Tadao Ando meets James Turrell — precision geometry softened by light.",
      title: "Mood direction",
    },
    position: { x: 700, y: 340 },
  },
  {
    data: {
      type: "text" as const,
      content: "Color palette should breathe. Deep charcoals and warm grays as the foundation, punctuated by amber and soft violet accents. Never pure black — always a hint of warmth underneath.",
      title: "Color notes",
    },
    position: { x: 700, y: 550 },
  },
];

/**
 * Cinematic empty state with layered atmospheric depth.
 * Gradient mesh, animated grid, glowing wordmark, and rich hints.
 */
export function EmptyCanvas() {
  const nodeCount = usePatinaStore((s) => s.nodes.length);
  const addNode = usePatinaStore((s) => s.addNode);
  const visible = nodeCount === 0;
  const [seeding, setSeeding] = useState(false);

  const seedDemo = useCallback(() => {
    setSeeding(true);
    // Stagger node creation for a nice cascade effect
    DEMO_NODES.forEach((node, i) => {
      setTimeout(() => {
        addNode(node.data, node.position);
      }, i * 120);
    });
    setTimeout(() => setSeeding(false), DEMO_NODES.length * 120 + 200);
  }, [addNode]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.96, filter: "blur(12px)" }}
          transition={{ duration: 0.7, ease }}
        >
          {/* ── Layer 1: Gradient mesh background ── */}
          <div className="absolute inset-0">
            <motion.div
              className="absolute w-[800px] h-[800px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(139,92,246,0.07) 0%, rgba(139,92,246,0.02) 40%, transparent 70%)",
                top: "10%",
                left: "15%",
              }}
              animate={{
                x: [0, 80, -60, 40, -20, 0],
                y: [0, -50, 60, -30, 20, 0],
                scale: [1, 1.08, 0.95, 1.05, 0.98, 1],
              }}
              transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute w-[600px] h-[600px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(124,58,237,0.05) 0%, rgba(124,58,237,0.015) 40%, transparent 70%)",
                bottom: "5%",
                right: "10%",
              }}
              animate={{
                x: [0, -70, 50, -30, 60, 0],
                y: [0, 50, -60, 40, -20, 0],
                scale: [1, 0.94, 1.07, 0.97, 1.03, 1],
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute w-[400px] h-[400px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 60%)",
                top: "45%",
                left: "55%",
              }}
              animate={{
                x: [0, 50, -70, 30, -40, 0],
                y: [0, -60, 30, -50, 40, 0],
                scale: [1, 1.1, 0.93, 1.06, 0.97, 1],
              }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* ── Layer 2: Floating particles ── */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute w-[3px] h-[3px] rounded-full bg-accent/20"
              style={{
                left: `${15 + i * 14}%`,
                top: `${20 + (i % 3) * 25}%`,
              }}
              animate={{
                x: [0, 30 * (i % 2 === 0 ? 1 : -1), -20 * (i % 2 === 0 ? 1 : -1), 0],
                y: [0, -25 * (i % 3 === 0 ? 1 : -1), 35 * (i % 3 === 0 ? 1 : -1), 0],
                opacity: [0.15, 0.4, 0.15],
              }}
              transition={{
                duration: 10 + i * 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 1.5,
              }}
            />
          ))}

          {/* ── Layer 3: Corner accents ── */}
          <motion.div
            className="absolute top-8 left-8"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 0.15, scale: 1 }}
            transition={{ delay: 1.5, duration: 0.8, ease }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M0 12V0h12" stroke="currentColor" strokeWidth="1" className="text-accent" />
            </svg>
          </motion.div>
          <motion.div
            className="absolute bottom-8 right-8"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 0.15, scale: 1 }}
            transition={{ delay: 1.7, duration: 0.8, ease }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M32 20v12H20" stroke="currentColor" strokeWidth="1" className="text-accent" />
            </svg>
          </motion.div>

          {/* ── Center content ── */}
          <div className="relative flex flex-col items-center">
            {/* Glow ring behind wordmark */}
            <motion.div
              className="absolute w-[200px] h-[200px] rounded-full -top-16"
              style={{
                background:
                  "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 60%)",
              }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Wordmark */}
            <motion.div
              className="relative flex flex-col items-center gap-3 mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.9, ease }}
            >
              <h1 className="text-[52px] font-extralight tracking-[0.12em] text-foreground/90 lowercase">
                patina
              </h1>
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <motion.div
                  className="w-10 h-[1px] bg-gradient-to-r from-transparent to-accent/50"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.7, duration: 0.6, ease }}
                  style={{ transformOrigin: "right" }}
                />
                <span className="text-[9px] uppercase tracking-[0.2em] text-accent/50 font-medium">
                  aesthetic engine
                </span>
                <motion.div
                  className="w-10 h-[1px] bg-gradient-to-l from-transparent to-accent/50"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.7, duration: 0.6, ease }}
                  style={{ transformOrigin: "left" }}
                />
              </motion.div>
            </motion.div>

            {/* Description */}
            <motion.p
              className="text-[13px] text-muted/40 tracking-[0.04em] text-center max-w-[320px] leading-[1.7] mb-10"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.8, ease }}
            >
              Collect references. Extract the vibe.
              <br />
              <span className="text-foreground/30">Generate music, images, and interfaces</span>
              <br />
              that feel exactly right.
            </motion.p>

            {/* Input type hints — cards with icons */}
            <motion.div
              className="flex items-stretch gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              {[
                { icon: "landscape", label: "Images", sub: "jpg, png, webp" },
                { icon: "segment", label: "Text", sub: "notes & quotes" },
                { icon: "link", label: "URLs", sub: "any webpage" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  className="flex flex-col items-center gap-2.5 px-5 py-4 rounded-xl border border-border-subtle/40 bg-surface/30 min-w-[100px]"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 + i * 0.12, duration: 0.5, ease }}
                  whileHover={{ borderColor: "rgba(139,92,246,0.2)", y: -2 }}
                >
                  <span className="material-symbols-outlined text-[20px] text-accent/40">
                    {item.icon}
                  </span>
                  <span className="text-[11px] tracking-[0.06em] text-foreground/50 font-medium">
                    {item.label}
                  </span>
                  <span className="text-[9px] text-muted/30 tracking-wide">
                    {item.sub}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* Action hint */}
            <motion.div
              className="mt-10 flex flex-col items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.8 }}
            >
              {/* Animated drop zone indicator */}
              <motion.div
                className="w-12 h-12 rounded-2xl border border-dashed border-accent/15 flex items-center justify-center"
                animate={{
                  borderColor: [
                    "rgba(139,92,246,0.1)",
                    "rgba(139,92,246,0.25)",
                    "rgba(139,92,246,0.1)",
                  ],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.span
                  className="text-accent/30 text-lg"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                  +
                </motion.span>
              </motion.div>

              <div className="flex items-center gap-4 text-[10px] text-muted/25 tracking-[0.08em]">
                <span>drag & drop</span>
                <span className="w-[3px] h-[3px] rounded-full bg-muted/20" />
                <span>paste</span>
                <span className="w-[3px] h-[3px] rounded-full bg-muted/20" />
                <span className="font-mono">&#8984;V</span>
              </div>

              {/* Demo seed button */}
              <motion.button
                onClick={seedDemo}
                disabled={seeding}
                className="mt-6 pointer-events-auto px-5 py-2.5 rounded-xl border border-accent/20 bg-accent/5 hover:bg-accent/10 hover:border-accent/30 text-[11px] text-accent/60 hover:text-accent/90 tracking-[0.06em] font-medium transition-all duration-300 disabled:opacity-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.2, duration: 0.6 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {seeding ? "Loading..." : "Load demo board"}
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
