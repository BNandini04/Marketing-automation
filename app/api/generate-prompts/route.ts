import { NextResponse } from "next/server";
import { generatePrompts } from "@/services/azure-openai";
import { VIDEO_CATEGORIES, type PromptsRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<PromptsRequest>;
    const { category, duration, storyboard, instructions } = body;

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
    if (!storyboard || !storyboard.trim()) {
      return NextResponse.json(
        { error: "A storyboard is required." },
        { status: 400 },
      );
    }

    const prompts = await generatePrompts({
      category,
      duration,
      storyboard,
      instructions,
    });
    return NextResponse.json(prompts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
