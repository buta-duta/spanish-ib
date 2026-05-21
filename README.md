# Spanish IB

AI-powered practice app for **IB Spanish B** (SL/HL). Pick a core theme, run a full mock exam, and drill reading, listening, writing, flashcards, and image-based tasks with instant feedback.

## Features

- **Mock exams** across IB themes (Identidades, Experiencias, Ingenio humano, and more)
- **Reading** — comprehension passages with word lookup
- **Listening** — audio dialogues and questions (OpenAI TTS; optional local TTS backends)
- **Writing** — prompts with AI feedback
- **Flashcards** and **image practice**
- **Session history** and progress tracking

## Stack

| Layer | Tech |
|-------|------|
| Mobile / web UI | Expo 54, React Native, Expo Router |
| API | Express 5, TypeScript |
| AI | OpenAI (chat, TTS, STT, images) |
| Monorepo | pnpm workspaces |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10.x (`corepack enable` or `npm i -g pnpm`)
- OpenAI API key

## Setup

```bash
git clone https://github.com/buta-duta/spanish-ib.git
cd spanish-ib
pnpm install
```

Copy environment templates and add your key:

```bash
cp .env.example .env
# artifacts/mobile/.env — set EXPO_PUBLIC_API_URL for local API
```

Root `.env` (required):

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `PORT` | API port (default `5000`) |

Optional overrides: `OPENAI_MODEL_FLASH`, `OPENAI_MODEL_PRO`, `OPENAI_MODEL_TTS`, `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_IMAGE_MODEL`, `LISTENING_SPEAKER_PAUSE_MS`.

Mobile (local web dev), in `artifacts/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:5000
```

## Run locally

**Both servers (Windows):**

```powershell
pnpm run dev:local
```

Opens API on `http://localhost:5000` and Expo web on `http://localhost:8081`.

**Or separately:**

```bash
pnpm run dev:api   # API
pnpm run dev:web   # Expo web
```

## Project layout

```
spanish-ib/
├── artifacts/
│   ├── api-server/     # Express API + Vercel entry
│   └── mobile/         # Expo app
├── lib/
│   └── integrations-gemini-ai-server/   # OpenAI client (chat, audio, image)
└── scripts/
    ├── dev-local.ps1
    ├── f5-tts/         # optional local TTS
    └── piper-tts/      # optional local TTS
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev:local` | Start API + web (PowerShell) |
| `pnpm run dev:api` | API only |
| `pnpm run dev:web` | Expo web only |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm run typecheck` | Typecheck workspace |

## Deploy

The API is built for [Vercel](https://vercel.com/). Set `OPENAI_API_KEY` (and related vars) in the project environment. Point the mobile/web client at your deployed API via `EXPO_PUBLIC_API_URL`.

## License

MIT
