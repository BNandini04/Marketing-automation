import type {
  PromptsRequest,
  PromptsResponse,
  StoryboardRequest,
  VideoCategory,
  VoiceoverRequest,
} from "@/lib/types";

const DEFAULT_API_VERSION = "2024-10-21";

/** Generic pacing guidance (no longer category-specific). */
const PACING_RULES = [
  "Typical pacing is around 2-4 shots per scene, but the actual number must follow the content: give each scene as many shots as it genuinely needs to be told well (some scenes may have 1, others 4+).",
  "Do NOT force a fixed shots-per-scene count.",
].join("\n");

/**
 * Visual-style configuration per category. Drives the rendering style applied
 * to every image/video prompt and whether "cartoon, illustration" stays in the
 * negative prompt.
 */
interface StyleConfig {
  /** The rendering-style descriptors to apply to every prompt. */
  style: string;
  /** Keep "cartoon, illustration" in the negative prompt? */
  keepCartoonInNegative: boolean;
}

const STYLE_CONFIG: Record<VideoCategory, StyleConfig> = {
  HYPER_REALISTIC: {
    style:
      "Photorealistic, cinematic, high texture detail, natural dramatic lighting, raw skin textures.",
    keepCartoonInNegative: true,
  },
  CARTOONISTIC: {
    style:
      "3D animated stylized character, Pixar or Disney-style rendering, vibrant color palettes, clean smooth cell shading.",
    keepCartoonInNegative: false,
  },
  HYBRID: {
    style:
      "Stylized animated characters seamlessly integrated into a hyper-realistic, photorealistic background environment with cinematic lighting.",
    keepCartoonInNegative: false,
  },
};

/** Build the negative prompt, optionally keeping "cartoon, illustration". */
function buildNegativePrompt(keepCartoon: boolean): string {
  const cartoon = keepCartoon ? "cartoon, illustration, " : "";
  return (
    "text, captions, subtitles, watermark, logo, brand name, UI text, " +
    "readable words, unrealistic face, " +
    cartoon +
    "low quality, blurry face, distorted hands, extra fingers, extra limbs, " +
    "bad anatomy, overexposed lighting, harsh shadows, oversaturated colors, " +
    "unrealistic skin tone, plastic skin, duplicate face, glitch, noise, artifacts"
  );
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

async function callAzureOpenAI(
  messages: ChatMessage[],
  { temperature = 0.7 }: { temperature?: number } = {},
): Promise<string> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION || DEFAULT_API_VERSION;

  if (!apiKey) {
    throw new Error(
      "AZURE_OPENAI_API_KEY is not set. Add it to your .env.local file.",
    );
  }
  if (!endpoint) {
    throw new Error(
      "AZURE_OPENAI_ENDPOINT is not set (e.g. https://your-resource.openai.azure.com).",
    );
  }
  if (!deployment) {
    throw new Error(
      "AZURE_OPENAI_DEPLOYMENT is not set (your model deployment name).",
    );
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, temperature }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Azure OpenAI request failed (${res.status}): ${detail || res.statusText}`,
    );
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Azure OpenAI returned an empty response.");
  }
  return content.trim();
}

/** Strip a leading/trailing markdown code fence if the model wrapped output. */
function stripCodeFence(text: string): string {
  const fence = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return fence ? fence[1].trim() : text;
}

export async function generateStoryboard(
  req: StoryboardRequest,
): Promise<string> {
  const system = [
    "You are a professional video production assistant.",
    "You convert a COMPLETED script into a shot-by-shot storyboard.",
    "You never invent topics and never rewrite the script. You only break it into scenes and shots.",
  ].join(" ");

  const user = [
    `VIDEO CATEGORY: ${req.category}`,
    `TARGET DURATION: ${req.duration} seconds`,
    "",
    "PACING RULES:",
    PACING_RULES,
    "",
    "VISUAL STYLE (for downstream image/video generation):",
    STYLE_CONFIG[req.category].style,
    "",
    "SCRIPT:",
    req.script,
    "",
    "TASK:",
    "Break the script into Scenes. Each Scene contains Shots (individual shots).",
    "IMPORTANT: The number of shots per scene is NOT fixed. Decide how many shots each scene needs based on its content and pacing — different scenes will have different numbers of shots. Do NOT default to the same count for every scene.",
    "Every Shot must have a Visual Description and a Duration in seconds.",
    "The sum of all Shot durations must cover the entire target duration.",
    "",
    "OUTPUT FORMAT (plain text, no markdown). The example below shows the structure only — the number of shots per scene shown here is illustrative, not a target:",
    "Scene 1",
    "Shot 1",
    "Visual Description: <description>",
    "Duration: <n> sec",
    "Shot 2",
    "Visual Description: <description>",
    "Duration: <n> sec",
    "Shot 3",
    "Visual Description: <description>",
    "Duration: <n> sec",
    "",
    "Scene 2",
    "Shot 1",
    "Visual Description: <description>",
    "Duration: <n> sec",
    "",
    "Continue until the entire duration is covered. Vary the shots-per-scene to fit each scene. Output ONLY the storyboard.",
  ].join("\n");

  const out = await callAzureOpenAI([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return stripCodeFence(out);
}

export async function generatePrompts(
  req: PromptsRequest,
): Promise<PromptsResponse> {
  const system = [
    "You are a professional video production assistant.",
    "You convert a storyboard into AI image-generation and video-generation prompts.",
    "You produce exactly one image prompt and one video prompt for EVERY shot.",
  ].join(" ");

  const styleConfig = STYLE_CONFIG[req.category];
  const VISUAL_STYLE = styleConfig.style;

  const extraInstructions = (req.instructions ?? "").trim();

  const baseContext = [
    `VIDEO CATEGORY: ${req.category}`,
    `TARGET DURATION: ${req.duration} seconds`,
    "",
    "PACING RULES:",
    PACING_RULES,
    "",
    "VISUAL STYLE — apply these rendering-style descriptors to EVERY prompt:",
    VISUAL_STYLE,
    ...(extraInstructions
      ? [
          "",
          "ADDITIONAL USER INSTRUCTIONS (these take priority — follow them in every image and video prompt where applicable):",
          extraInstructions,
        ]
      : []),
    "",
    "STORYBOARD:",
    req.storyboard,
  ].join("\n");

  const NEGATIVE_PROMPT = buildNegativePrompt(styleConfig.keepCartoonInNegative);

  const imageUser = [
    baseContext,
    "",
    "TASK: For EVERY shot, write ONE detailed IMAGE PROMPT.",
    "",
    "GLOBAL RULES (apply to every prompt):",
    "- Each prompt must use a DIFFERENT angle, composition, or moment — visually distinct from the other prompts in the same scene.",
    "- Render EVERY prompt in this visual style (use these descriptors instead of any conflicting realism/cartoon terms): " +
      VISUAL_STYLE,
    "- No text overlays. No logos. No readable text anywhere in the scene.",
    "- Maintain consistency with the medical or education context of the storyboard above.",
    "- Use Indian context where relevant (people, settings, props).",
    "",
    "CHARACTER CONSISTENCY (enforce across ALL scenes and all Scene N.M variations):",
    "- Keep the same main character identity unless the storyboard explicitly introduces a new person.",
    "- Keep skin tone, height/build, face structure, hairstyle, age appearance, and overall styling consistent.",
    "- Keep wardrobe continuity (or a realistic progression like adding/removing a jacket) while preserving identity.",
    "- If multiple recurring characters exist, keep each one consistent across the full sequence.",
    "- In every prompt, restate enough identity anchors (age, gender, skin tone, build, hairstyle, wardrobe) so image models preserve the same character.",
    "",
    "EACH PROMPT MUST EXPLICITLY DESCRIBE, in natural cinematic language:",
    "- Subject: age range, gender (if relevant), posture, gesture, facial expression, emotion.",
    "- Environment: room/location type, props, mood, background elements.",
    "- Lighting: source, direction, intensity, shadow behavior, screen glow if applicable.",
    "- Camera: shot type, angle, framing, focal emphasis, depth of field.",
    "- Color and mood: cinematic grading direction.",
    "- Style: apply the VISUAL STYLE above (" +
      VISUAL_STYLE +
      ") and ALWAYS use 9:16 vertical composition.",
    "- End EVERY prompt with a negative prompt clause written exactly as: negative prompt: " +
      NEGATIVE_PROMPT,
    "",
    'Phrasing style example (the trailing style tokens must be replaced with the VISUAL STYLE above): "A young Indian male student, early twenties, medium brown skin, slim build, short neatly combed black hair, wearing a maroon collared shirt, leans over a wooden study desk, brow furrowed in worry, glancing at his phone; small cluttered room with textbooks and a desk lamp; warm lamp light from the left casting soft shadows, faint cool screen glow on his face; medium close-up, slight high angle, shallow depth of field; warm muted tones, cinematic grading; ' +
      VISUAL_STYLE +
      " 9:16 vertical composition. negative prompt: " +
      NEGATIVE_PROMPT +
      '"',
    "",
    "OUTPUT FORMAT (plain text, no markdown, follow exactly):",
    "Scene 1",
    "Shot 1",
    "<image prompt ending with the negative prompt clause>",
    "Shot 2",
    "<image prompt ending with the negative prompt clause>",
    "",
    "Scene 2",
    "Shot 1",
    "<image prompt ending with the negative prompt clause>",
    "",
    "Output ONLY the prompts in this format.",
  ].join("\n");

  const videoUser = [
    baseContext,
    "",
    "TASK: For EVERY shot, write ONE detailed VIDEO PROMPT.",
    "Each video prompt is an image-to-video prompt: it animates the matching image for that shot.",
    "Every video prompt MUST be structured in THIS order with these exact labels: an opening base-frame line, then 'Animation Sequence:', then 'Camera:', then 'Style:'.",
    "",
    "GLOBAL RULES (apply to every prompt):",
    "- ELABORATE, do not be terse. Each video prompt must be richly detailed and granular like the EXAMPLE below — multiple ordered animation beats with indented sub-bullets, specific motion values (percentages, pixel/degree amounts, timing, easing), and full Camera and Style sections. Aim to USE the available space (roughly 1500-2400 characters); do not output short, crisp one-line descriptions.",
    "- HARD LIMIT: each video prompt MUST be 2500 characters or fewer (including the section labels). Be detailed, but never exceed 2500 characters.",
    "- Open with a base-frame instruction: 'Use the uploaded image as the base frame.' Then state what to preserve exactly (the character's identity, face, skin tone, build, hairstyle, wardrobe, the environment, props, and layout). No text overlays, no logos, no readable text, no hallucinated text.",
    "- Keep motion cinematic and consistent with this visual style: " +
      VISUAL_STYLE +
      " Maintain the medical or education context of the storyboard above, and use Indian context where relevant.",
    "- Preserve character consistency: the animated person must remain the SAME identity as in the image and across all scenes — do not morph the face, age, skin tone, build, hairstyle, or wardrobe.",
    "- 9:16 vertical composition.",
    "",
    "SECTION CONTENT (be specific and granular in each):",
    "- Animation Sequence: describe the motion as MANY ordered beats using '-' bullets, with indented '•' sub-bullets that break each beat into precise micro-movements. Cover how the shot STARTS (e.g. static hold), subject movement (head turn in degrees, hand/finger motion, posture shift, blink, breathing, expression change with timing), environment/scene movement (background figures, props, fabric, screen glow rising/falling), and how the motion SETTLES at the end. Give concrete values where natural (scale 100% to 102%, drift 5 pixels, slow over ~1s, gentle ease-in-out). Keep it subtle and natural — no flashy particles, sparkles, glitter, or rays.",
    "- Camera: describe camera movement (static, slow push-in, pan, handheld drift, tilt), zoom, and rotation, each on its own '-' bullet. If static, say so explicitly.",
    "- Style: list on '-' bullets — the VISUAL STYLE above (" +
      VISUAL_STYLE +
      "), cinematic grading and mood, smooth easing throughout, frame rate (e.g. high-quality 24 fps), the shot's duration in seconds (match the storyboard), and restrictions (no text/logos/readable words, no extra fingers or distorted hands, no morphing of the character, no glitter/sparkles/flashy effects).",
    "",
    "EXAMPLE of the required structure, density, and granularity (adapt the content to each shot; match this level of detail):",
    "Use the uploaded image as the base frame. Preserve the young Indian doctor's identity, face, warm brown skin tone, slim build, neatly tied black hair, and white coat, along with the clinic background, desk, and props exactly. No text overlays, no logos, no hallucinated text.",
    "",
    "Animation Sequence:",
    "",
    "- Start with the doctor seated and completely still, holding the patient's file.",
    "- She lifts her gaze from the file toward the patient with a calm, reassuring expression:",
    "  • Head tilts up about 8 degrees over ~1s.",
    "  • Eyes shift focus, a single soft blink.",
    "  • A gentle, warm smile forms slowly.",
    "- Her right hand gestures subtly while explaining:",
    "  • Fingers open from the file, palm turning slightly upward.",
    "  • Small, smooth wrist movement, no jitter.",
    "- Background clinic stays alive but understated:",
    "  • Soft daylight from the window flickers faintly.",
    "  • A faint, slow breathing motion in her shoulders.",
    "- The motion settles as she holds eye contact and the smile steadies.",
    "",
    "Camera:",
    "- Very slow push-in toward the doctor's face.",
    "- No rotation.",
    "- Minimal zoom, ending on a tighter framing.",
    "",
    "Style:",
    "- Warm, cinematic medical-drama grading.",
    "- Smooth easing throughout.",
    "- High-quality 24 fps animation.",
    "- Duration: 3-4 seconds.",
    "- Realistic skin, natural shadows, preserve exact identity.",
    "- No text, logos, particles, sparkles, or flashy effects; no distorted hands or extra fingers.",
    "",
    "OUTPUT FORMAT (plain text, no markdown fences, follow exactly):",
    "Scene 1",
    "Shot 1",
    "<video prompt: base-frame line, then Animation Sequence:, then Camera:, then Style:>",
    "Shot 2",
    "<video prompt: base-frame line, then Animation Sequence:, then Camera:, then Style:>",
    "",
    "Scene 2",
    "Shot 1",
    "<video prompt: base-frame line, then Animation Sequence:, then Camera:, then Style:>",
    "",
    "Output ONLY the prompts in this format.",
  ].join("\n");

  const [imagePrompts, videoPrompts] = await Promise.all([
    callAzureOpenAI([
      { role: "system", content: system },
      { role: "user", content: imageUser },
    ]),
    callAzureOpenAI([
      { role: "system", content: system },
      { role: "user", content: videoUser },
    ]),
  ]);

  return {
    imagePrompts: stripCodeFence(imagePrompts),
    videoPrompts: stripCodeFence(videoPrompts),
  };
}

export async function generateVoiceover(
  req: VoiceoverRequest,
): Promise<string> {
  const system = [
    "You are a professional voiceover director.",
    "You write voiceover direction (emotion, pauses, delivery) from a script and storyboard.",
    "You do not rewrite the script's meaning; you direct its delivery.",
  ].join(" ");

  const user = [
    `VIDEO CATEGORY: ${req.category}`,
    `TARGET DURATION: ${req.duration} seconds`,
    "",
    "ORIGINAL SCRIPT:",
    req.script,
    "",
    "STORYBOARD:",
    req.storyboard,
    "",
    "TASK: Produce professional voiceover direction with emotions, pauses, and delivery notes.",
    "Output one block per section of the script, in order.",
    "Each block is a single bracketed tone/emotion line, followed by the spoken line on the next line.",
    "",
    "STRICT FORMATTING RULES:",
    "- Do NOT include section labels (no HOOK, REHOOK, BODY, MECHANISM, CTA, etc.).",
    "- Do NOT include any timing or seconds (no [0-8 sec | ...]). The bracket holds ONLY the tone/emotion descriptors.",
    "- The bracket may list multiple comma-separated emotion/delivery descriptors, e.g. [Curious, confident, slightly provocative].",
    "- Do NOT wrap the spoken line in double quotes. Write the dialogue as plain text.",
    "- Put delivery pauses INSIDE the spoken line using square brackets: [beat], [short pause], [pause]. Never use parentheses for these.",
    "- Do NOT leave a blank line between blocks. The next block's bracket line comes immediately after the previous spoken line.",
    "",
    "OUTPUT FORMAT (plain text, follow this shape EXACTLY):",
    "[Curious, confident, slightly provocative]",
    "First spoken line. [beat] More of the line. [short pause] The rest of the line.",
    "[Pattern break, urgent, story-driven]",
    "Next spoken line. [pause] The rest of it.",
    "",
    "Continue for every section of the script in order. Output ONLY the voiceover direction in this format — no headings, no titles, no timings, no quotes, no blank lines between blocks.",
  ].join("\n");

  const out = await callAzureOpenAI([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return stripCodeFence(out);
}
