import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { VibeProfile, InterviewQuestion, InterviewAnswer } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 15;

interface InterviewRequestBody {
  vibe: VibeProfile;
  references: Array<{
    type: "image" | "text" | "url";
    content: string;
    title?: string;
  }>;
  narrative?: string;
  relatedQuestions?: string[];
  previousAnswers?: InterviewAnswer[];
}

export async function POST(request: Request) {
  try {
    const body: InterviewRequestBody = await request.json();
    const { vibe, references, narrative, relatedQuestions, previousAnswers } = body;

    const refSummary = references
      .slice(0, 6)
      .map((r, i) => {
        if (r.type === "image") return `${i + 1}. [Image] ${r.title || "Untitled"}`;
        if (r.type === "url") return `${i + 1}. [Link] ${r.title || r.content}`;
        return `${i + 1}. [Text] "${r.content.slice(0, 80)}"`;
      })
      .join("\n");

    const vibeContext = `Mood: ${vibe.mood_tags.join(", ")}. Aesthetic: ${vibe.aesthetic_tags.join(", ")}. Colors: ${vibe.color_palette.dominant.slice(0, 3).join(", ")}.`;

    const relatedContext = relatedQuestions?.length
      ? `\nPrevious search suggested these directions:\n${relatedQuestions.map((q) => `- ${q}`).join("\n")}\nUse these as seeds but make the questions more specific and provocative.`
      : "";

    const previousContext = previousAnswers?.length
      ? `\nQUESTIONS ALREADY ASKED (do NOT repeat these or ask similar things — push into NEW territory):\n${previousAnswers.map((a) => `- Q: "${a.question}" → They chose: "${a.answer}"${a.context ? ` (added: "${a.context}")` : ""}`).join("\n")}\nBuild on what they revealed but explore completely different angles.`
      : "";

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      temperature: 1,
      messages: [
        {
          role: "user",
          content: `You are helping someone curate a moodboard/reference collection. Based on what they've collected so far, generate exactly 3 binary questions that help them articulate what direction they want to explore next.

Their collection:
${refSummary}

Vibe: ${vibeContext}
${narrative ? `Curatorial reading: ${narrative}` : ""}${relatedContext}${previousContext}

Rules:
- Each question should challenge them to think about WHY they're drawn to what they've collected
- Questions should help distinguish between similar-but-different directions (e.g., "Are you drawn to the decay itself, or the beauty emerging from it?")
- optionA and optionB should be short (3-8 words), specific, and represent genuinely different creative directions
- Don't use generic options like "Yes" / "No" — each option should describe a specific direction
- Make questions feel like a conversation with a sharp curator, not a survey
- NEVER repeat or rephrase questions that were already asked — always explore fresh angles

Return ONLY valid JSON in this exact format, no other text:
{"questions": [{"question": "...", "optionA": "...", "optionB": "..."}, {"question": "...", "optionA": "...", "optionB": "..."}, {"question": "...", "optionA": "...", "optionB": "..."}]}`,
        },
      ],
    });

    let text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

    const parsed = JSON.parse(text);
    const questions: InterviewQuestion[] = parsed.questions;

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Interview generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate interview questions" },
      { status: 500 }
    );
  }
}
