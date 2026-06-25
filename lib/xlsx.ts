import ExcelJS from "exceljs";
import type { PromptTableRow } from "./types";

interface WorkbookInput {
  script: string;
  storyboard: string;
  rows: PromptTableRow[];
  voiceover: string;
}

/** A worksheet with a header in A1 and the ENTIRE text wrapped in cell A2. */
function addTextSheet(
  wb: ExcelJS.Workbook,
  name: string,
  header: string,
  text: string,
): void {
  const ws = wb.addWorksheet(name);
  ws.getColumn(1).width = 100;
  ws.getCell("A1").value = header;
  ws.getCell("A1").font = { bold: true };
  const cell = ws.getCell("A2");
  cell.value = text.replace(/\r\n/g, "\n");
  cell.alignment = { wrapText: true, vertical: "top" };
}

/**
 * Build a single workbook:
 *   Sheet 1 "Prompts"     — A: scene, B: shot, C: image prompt,
 *                            D: video prompt, E: voiceover (single wrapped cell)
 *   Sheet 2 "Script"      — full script in one wrapped cell
 *   Sheet 3 "Storyboard"  — full storyboard in one wrapped cell
 */
export function buildWorkbook({
  script,
  storyboard,
  rows,
  voiceover,
}: WorkbookInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  const prompts = wb.addWorksheet("Prompts");
  prompts.columns = [
    { header: "Scene", key: "scene", width: 12 },
    { header: "Shot", key: "shot", width: 12 },
    { header: "Image Prompt", key: "image", width: 60 },
    { header: "Video Prompt", key: "video", width: 60 },
    { header: "Voiceover", key: "voiceover", width: 60 },
  ];
  prompts.getRow(1).font = { bold: true };

  const fullVoiceover = voiceover.replace(/\r\n/g, "\n");
  if (rows.length === 0) {
    prompts.addRow({ voiceover: fullVoiceover });
  } else {
    rows.forEach((row, i) => {
      prompts.addRow({
        scene: row.scene,
        shot: row.shot,
        image: row.image,
        video: row.video,
        voiceover: i === 0 ? fullVoiceover : "",
      });
    });
  }

  // Wrap the long-text columns (image, video, voiceover) on every data row.
  ["C", "D", "E"].forEach((col) => {
    prompts.getColumn(col).alignment = { wrapText: true, vertical: "top" };
  });

  addTextSheet(wb, "Script", "Script", script);
  addTextSheet(wb, "Storyboard", "Storyboard", storyboard);

  return wb;
}

/** Build the workbook and trigger a client-side .xlsx download. */
export async function downloadWorkbook(
  filename: string,
  input: WorkbookInput,
): Promise<void> {
  const wb = buildWorkbook(input);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
