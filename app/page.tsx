"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CopyButton,
  ErrorBanner,
  Field,
  Textarea,
} from "@/components/ui";
import { mergePromptRows } from "@/lib/csv";
import { downloadWorkbook } from "@/lib/xlsx";
import {
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABELS,
  type PromptsResponse,
  type PromptTableRow,
  type VideoCategory,
} from "@/lib/types";

const SAMPLE_SCRIPT = `HOOK
June 27th rank list release aaguthu...

REHOOK
TNEA updates udane therinjukanum-na...

Problem
...

Solution
...

CTA
...`;

type Stage = "input" | "storyboard";

export default function Dashboard() {
  // Section 1 — inputs
  const [category, setCategory] = useState<VideoCategory>("HYPER_REALISTIC");
  const [duration, setDuration] = useState<number>(30);
  const [script, setScript] = useState<string>("");

  // Generated, editable artifacts
  const [storyboard, setStoryboard] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [promptRows, setPromptRows] = useState<PromptTableRow[]>([]);
  const [voiceover, setVoiceover] = useState<string>("");

  // Per-step loading + error state
  const [loading, setLoading] = useState<Stage | null>(null);
  const [error, setError] = useState<string>("");

  const callApi = async <T,>(url: string, payload: unknown): Promise<T> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Request failed.");
    }
    return data as T;
  };

  const handleGenerateStoryboard = async () => {
    setError("");
    if (!script.trim()) {
      setError("Please paste your script first.");
      return;
    }
    setLoading("input");
    try {
      const { storyboard: result } = await callApi<{ storyboard: string }>(
        "/api/generate-storyboard",
        { category, duration, script },
      );
      setStoryboard(result);
      // Reset downstream artifacts so they don't go stale.
      setPromptRows([]);
      setVoiceover("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  // Generate image prompts, video prompts and voiceover together.
  const handleGeneratePrompts = async () => {
    setError("");
    setLoading("storyboard");
    try {
      const [prompts, vo] = await Promise.all([
        callApi<PromptsResponse>("/api/generate-prompts", {
          category,
          duration,
          storyboard,
          instructions,
        }),
        callApi<{ voiceover: string }>("/api/generate-voiceover", {
          category,
          duration,
          script,
          storyboard,
        }),
      ]);
      setPromptRows(
        mergePromptRows(prompts.imagePrompts, prompts.videoPrompts),
      );
      setVoiceover(vo.voiceover);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  const updateRow = (
    index: number,
    field: "image" | "video",
    value: string,
  ) => {
    setPromptRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  };

  const handleDownloadWorkbook = async () => {
    try {
      await downloadWorkbook("video-production.xlsx", {
        script,
        storyboard,
        rows: promptRows,
        voiceover,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build file.");
    }
  };

  const hasStoryboard = storyboard.trim().length > 0;
  const hasPrompts = promptRows.length > 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Video Production Automation
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Paste a finished script. Generate storyboard, image &amp; video
          prompts, and voiceover direction — then export CSVs.
        </p>
      </header>

      {error && <ErrorBanner message={error} />}

      <div className="mt-6 space-y-6">
        {/* SECTION 1 — VIDEO INPUT */}
        <Card title="Video Input" step={1} subtitle="Your completed script">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Video Category">
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as VideoCategory)
                  }
                  className="w-full rounded-lg border border-white/10 bg-black/40 p-2.5 text-sm text-white/90 outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
                >
                  {VIDEO_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-[#0a0a0f]">
                      {VIDEO_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Video Duration (seconds)">
                <input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  placeholder="30"
                  className="w-full rounded-lg border border-white/10 bg-black/40 p-2.5 text-sm text-white/90 outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
                />
              </Field>
            </div>

            <Field label="Script">
              <Textarea
                rows={12}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={SAMPLE_SCRIPT}
              />
            </Field>

            <Button
              onClick={handleGenerateStoryboard}
              loading={loading === "input"}
            >
              Generate Storyboard
            </Button>
          </div>
        </Card>

        {/* SECTION 2 — STORYBOARD EDITOR */}
        <Card
          title="Storyboard Editor"
          step={2}
          subtitle="Edit scenes, shots, descriptions and durations"
          disabled={!hasStoryboard && loading !== "input"}
        >
          {hasStoryboard ? (
            <div className="space-y-4">
              <Textarea
                rows={16}
                value={storyboard}
                onChange={(e) => setStoryboard(e.target.value)}
              />
              <Field label="Additional instructions (optional)">
                <Textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Anything specific to apply when generating the image & video prompts — e.g. character details, props, color palette, mood. Leave empty to proceed without extra guidance."
                />
              </Field>
              <Button
                onClick={handleGeneratePrompts}
                loading={loading === "storyboard"}
              >
                Generate Prompts
              </Button>
            </div>
          ) : (
            <p className="text-sm text-white/40">
              Generate a storyboard above to begin editing.
            </p>
          )}
        </Card>

        {/* SECTION 3 — PROMPTS & VOICEOVER */}
        <Card
          title="Prompts & Voiceover"
          step={3}
          subtitle="Image + video prompt per shot, with voiceover direction"
          disabled={!hasPrompts}
        >
          {hasPrompts ? (
            <div className="space-y-5">
              {/* Column headers (desktop) */}
              <div className="hidden gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-white/40 lg:grid lg:grid-cols-[7rem_1fr_1fr]">
                <span>Shot</span>
                <span>Image Prompt</span>
                <span>Video Prompt</span>
              </div>

              <div className="space-y-4">
                {promptRows.map((row, i) => (
                  <div
                    key={`${row.scene}-${row.shot}-${i}`}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 lg:grid-cols-[7rem_1fr_1fr]"
                  >
                    <div className="text-sm font-medium text-white/70">
                      <div>{row.scene}</div>
                      <div className="text-white/45">{row.shot}</div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between lg:hidden">
                        <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                          Image Prompt
                        </span>
                        <CopyButton text={row.image} />
                      </div>
                      <Textarea
                        rows={8}
                        value={row.image}
                        onChange={(e) => updateRow(i, "image", e.target.value)}
                      />
                      <div className="hidden justify-end lg:flex">
                        <CopyButton text={row.image} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between lg:hidden">
                        <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                          Video Prompt
                        </span>
                        <CopyButton text={row.video} />
                      </div>
                      <Textarea
                        rows={8}
                        value={row.video}
                        onChange={(e) => updateRow(i, "video", e.target.value)}
                      />
                      <div className="hidden justify-end lg:flex">
                        <CopyButton text={row.video} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Voiceover — one big box aligned to the table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/70">
                    Voiceover
                  </span>
                  <CopyButton text={voiceover} />
                </div>
                <Textarea
                  rows={16}
                  value={voiceover}
                  onChange={(e) => setVoiceover(e.target.value)}
                />
              </div>

              <Button onClick={handleDownloadWorkbook}>
                Download XLSX
              </Button>
            </div>
          ) : (
            <p className="text-sm text-white/40">
              Generate prompts from the storyboard to continue.
            </p>
          )}
        </Card>
      </div>

      <footer className="mt-10 text-center text-xs text-white/30">
        Set <code className="text-white/50">AZURE_OPENAI_*</code> values in
        .env.local to enable generation.
      </footer>
    </main>
  );
}
