# Video Production Automation

A Next.js dashboard that turns a **completed video script** into production assets:
storyboard → image prompts → video prompts → voiceover direction → CSV exports.

The app never generates topics or scripts. It starts from a script you provide.

## Setup

```bash
npm install
cp .env.example .env.local   # then add your OpenRouter API key
npm run dev                  # http://localhost:3000
```

Set in `.env.local` (Azure OpenAI):

| Variable | Required | Default |
| --- | --- | --- |
| `AZURE_OPENAI_ENDPOINT` | yes | — |
| `AZURE_OPENAI_API_KEY` | yes | — |
| `AZURE_OPENAI_DEPLOYMENT` | yes | — |
| `AZURE_OPENAI_API_VERSION` | no | `2024-10-21` |

## Flow

1. **Video Input** — pick category (`AI_EXPLAINER` / `AI_STORY` / `TALKING_HEAD`),
   duration in seconds, paste the script → **Generate Storyboard**.
2. **Storyboard Editor** — edit scenes/shorts/descriptions/durations → **Generate Prompts**.
3. **Prompt Editor** — edit image & video prompts (one of each per short),
   download CSVs (`Scene,Short,Prompt`) → **Generate Voiceover**.
4. **Voiceover Editor** — edit the timed, emotion-annotated voiceover direction.

## Structure

```
app/
  page.tsx                       # dashboard (4 sections)
  layout.tsx, globals.css
  api/generate-storyboard/route.ts
  api/generate-prompts/route.ts
  api/generate-voiceover/route.ts
services/azure-openai.ts         # generateStoryboard/generatePrompts/generateVoiceover
components/ui.tsx                 # Card, Button, Field, Textarea, ErrorBanner
lib/types.ts                     # shared types
lib/csv.ts                       # prompt parsing + CSV build/download
```
