# Patina

**A creative canvas that analyzes your aesthetic taste as you curate, then searches, discovers, and gives you more content to explore.**

Patina is an infinite canvas mood board where every reference you add contributes to a living "vibe profile." Drop in images, paste URLs to articles or portfolios, embed YouTube videos and Spotify tracks, preview Google Fonts, or type raw text. Each piece gets analyzed by Claude to extract its aesthetic DNA — colors, mood, texture, and sonic qualities — and the system continuously recomputes a composite vibe from all your references, weighted by spatial proximity on the canvas.

That composite vibe powers vibe-aware discovery (cross-domain suggestions via Perplexity Sonar Pro), vibe-aware search (web results filtered through your board's aesthetic), deep interviews (targeted questions to refine creative intent), style guide generation (color palettes, typography, CSS variables, design tokens), and inline embeddable media. Spatial positioning matters — works influence each other based on proximity, adding another layer of depth to curation.

Discovery shouldn't be the bottleneck; developing your taste is.

## Tech Stack

- **Next.js 16** with App Router and API routes
- **React 19** + **XYFlow (React Flow)** for the infinite canvas
- **Zustand** for state management with localStorage persistence
- **Framer Motion** for animations, **Tailwind CSS v4** for styling
- **Claude (Anthropic API)** — vibe extraction, style guide generation, discovery interviews, vibe narratives
- **Perplexity Sonar Pro API** — cross-domain vibe-aware web search and discovery
- **Cheerio** for server-side URL metadata parsing, **OEmbed** for media embeds
- **TypeScript** throughout, deployed on **Vercel**

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the canvas.

You'll need the following environment variables:

```
ANTHROPIC_API_KEY=
PERPLEXITY_API_KEY=
```
