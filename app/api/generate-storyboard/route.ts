import { NextResponse } from "next/server";
import { generateStoryboard } from "@/services/azure-openai";
import { VIDEO_CATEGORIES, type StoryboardRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<StoryboardRequest>;
    const { category, duration, script } = body;

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
        { error: "A script is required." },
        { status: 400 },
      );
    }

    const storyboard = await generateStoryboard({ category, duration, script });
    return NextResponse.json({ storyboard });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
