import { NextResponse } from "next/server";
import { generateVoiceover } from "@/services/azure-openai";
import { VIDEO_CATEGORIES, type VoiceoverRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<VoiceoverRequest>;
    const { category, duration, script, storyboard } = body;

    if (!category || !VIDEO_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "A valid video category is required." },
        { status: 400 },
      );
    }
    if (!duration || duration <= 0) {
      return NextResponse.json(
        { error: "A positive duration (seconds) is required." },
        { status: 400 },
      );
    }
    if (!script || !script.trim()) {
      return NextResponse.json(
        { error: "The original script is required." },
        { status: 400 },
      );
    }
    if (!storyboard || !storyboard.trim()) {
      return NextResponse.json(
        { error: "A storyboard is required." },
        { status: 400 },
      );
    }

    const voiceover = await generateVoiceover({
      category,
      duration,
      script,
      storyboard,
    });
    return NextResponse.json({ voiceover });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
