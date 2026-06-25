export type VideoCategory = "HYPER_REALISTIC" | "CARTOONISTIC" | "HYBRID";

export const VIDEO_CATEGORIES: VideoCategory[] = [
  "HYPER_REALISTIC",
  "CARTOONISTIC",
  "HYBRID",
];

/** Human-friendly labels for the category dropdown. */
export const VIDEO_CATEGORY_LABELS: Record<VideoCategory, string> = {
  HYPER_REALISTIC: "Hyper Realistic",
  CARTOONISTIC: "Cartoonistic",
  HYBRID: "Combination / Hybrid",
};

export interface StoryboardRequest {
  category: VideoCategory;
  duration: number; // seconds
  script: string;
}

export interface PromptsRequest {
  category: VideoCategory;
  duration: number;
  storyboard: string; // edited storyboard text
  instructions?: string; // optional extra user guidance for the prompts
}

export interface VoiceoverRequest {
  category: VideoCategory;
  duration: number;
  script: string;
  storyboard: string;
}

export interface PromptsResponse {
  imagePrompts: string;
  videoPrompts: string;
}

/** A single parsed row used for CSV export. */
export interface PromptRow {
  scene: string;
  shot: string;
  prompt: string;
}

/** One row of the prompt table: image + video prompt for a single shot. */
export interface PromptTableRow {
  scene: string;
  shot: string;
  image: string;
  video: string;
}
