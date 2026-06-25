import type { PromptRow, PromptTableRow } from "./types";

/**
 * Parse the formatted prompt text (image OR video prompts) into rows.
 *
 * Expected shape (tolerant of blank lines and minor variations):
 *
 *   Scene 1
 *   Shot 1
 *   <prompt line(s)>
 *   Shot 2
 *   <prompt line(s)>
 *
 *   Scene 2
 *   Shot 1
 *   <prompt line(s)>
 */
export function parsePromptsToRows(text: string): PromptRow[] {
  const rows: PromptRow[] = [];
  if (!text) return rows;

  const sceneRe = /^\s*scene\s+([0-9]+)\b.*$/i;
  // Accept "Shot" (and legacy "Short") as the shot-label.
  const shotRe = /^\s*(?:shot|short)s?\s+([0-9]+)\b.*$/i;
  // Labels we want to strip if the model prefixes the prompt line.
  const labelRe = /^\s*(image\s*prompt|video\s*prompt|prompt)\s*[:\-]?\s*/i;

  const lines = text.split(/\r?\n/);

  let currentScene = "";
  let currentShot = "";
  let buffer: string[] = [];

  const flush = () => {
    if (currentScene && currentShot) {
      const prompt = buffer.join(" ").replace(/\s+/g, " ").trim();
      if (prompt) {
        rows.push({
          scene: `Scene ${currentScene}`,
          shot: `Shot ${currentShot}`,
          prompt,
        });
      }
    }
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const sceneMatch = line.match(sceneRe);
    if (sceneMatch) {
      flush();
      currentScene = sceneMatch[1];
      currentShot = "";
      continue;
    }

    const shotMatch = line.match(shotRe);
    if (shotMatch) {
      flush();
      currentShot = shotMatch[1];
      continue;
    }

    // Otherwise this is prompt content for the current shot.
    buffer.push(line.replace(labelRe, ""));
  }
  flush();

  return rows;
}

/**
 * Merge parsed image-prompt rows and video-prompt rows into one table,
 * aligned by Scene + Shot. Order follows the image prompts; any video-only
 * shots are appended afterwards so nothing is lost.
 */
export function mergePromptRows(
  imagePrompts: string,
  videoPrompts: string,
): PromptTableRow[] {
  const imageRows = parsePromptsToRows(imagePrompts);
  const videoRows = parsePromptsToRows(videoPrompts);

  const key = (scene: string, shot: string) => `${scene}||${shot}`;
  const videoByKey = new Map(videoRows.map((r) => [key(r.scene, r.shot), r]));

  const merged: PromptTableRow[] = [];
  const used = new Set<string>();

  for (const img of imageRows) {
    const k = key(img.scene, img.shot);
    used.add(k);
    merged.push({
      scene: img.scene,
      shot: img.shot,
      image: img.prompt,
      video: videoByKey.get(k)?.prompt ?? "",
    });
  }

  for (const vid of videoRows) {
    const k = key(vid.scene, vid.shot);
    if (used.has(k)) continue;
    merged.push({ scene: vid.scene, shot: vid.shot, image: "", video: vid.prompt });
  }

  return merged;
}

/** Escape a single CSV field per RFC 4180. */
function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a CSV string with header Scene,Shot,Prompt from rows. */
export function rowsToCsv(rows: PromptRow[]): string {
  const header = "Scene,Shot,Prompt";
  const body = rows
    .map((r) => [r.scene, r.shot, r.prompt].map(escapeCsv).join(","))
    .join("\n");
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

/** Trigger a client-side download of the given CSV content. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
