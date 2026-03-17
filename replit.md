# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains an IB Spanish B oral exam practice mobile app with smart theme selection and AI examiner.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with Expo Router
- **AI**: Replit AI Integrations (OpenAI) via `@workspace/integrations-openai-ai-server`

## Features (IB Spanish Oral Exam App)

### Feature 11: Smart Theme Selection System
- 5 IB themes: Identidades, Experiencias, Ingenio humano, Organización social, Compartir el planeta
- User-selected mode: pick any theme directly
- Auto-rotation mode: random theme, no repeats until all 5 used (stored in AsyncStorage)
- Theme selection screen with "Random (Recommended)" button
- Current theme displayed during exam
- AI examiner adapts questions to selected theme
- Cross-theme linking for Band 6-7 skills
- Session summary: theme used, new vs. repeated, next theme suggestion
- Session history with duration/message counts

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── mobile/             # Expo mobile app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── integrations-openai-ai-server/  # OpenAI server integration
│   └── integrations-openai-ai-react/   # OpenAI React integration
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Mobile App Structure (artifacts/mobile)

```text
app/
  _layout.tsx          # Root layout (ThemeProvider + ExamProvider)
  index.tsx            # Home screen
  theme-select.tsx     # Theme selection screen
  exam.tsx             # Exam chat screen (AI examiner)
  summary.tsx          # Session summary screen
  history.tsx          # Session history screen
constants/
  colors.ts            # Dark/light theme (navy + gold palette)
  themes.ts            # IB theme definitions + storage keys
contexts/
  ThemeContext.tsx     # Theme selection + auto-rotation logic
  ExamContext.tsx      # Exam session state + AsyncStorage persistence
```

## API Routes

- `GET /api/healthz` — health check
- `POST /api/exam/chat` — SSE streaming AI examiner chat

## Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — auto-set by Replit
- `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-set by Replit
- `DATABASE_URL` — PostgreSQL connection string (Replit managed)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build`
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
