# 巡梦 (Xun Meng)

一个可自定义人格的 AI 梦境陪伴者 Web App。用户可以创建专属的 AI 角色，记录梦境，与 AI 进行深度对话和情绪探索。

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied to /api)
- `pnpm --filter @workspace/xun-meng run dev` — run the frontend (proxied to /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string (auto-provided by Replit)
- Optional env: `OPENAI_API_KEY` — enables real AI (without it, app uses mock responses)
- Optional env: `AI_MODEL_NAME` — model to use (default: `gpt-4o`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Framer Motion + wouter (routing)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas for server validation
- `lib/db/src/schema/` — Drizzle table definitions (characters, dreams, chat-messages)
- `artifacts/api-server/src/routes/` — Express route handlers (characters, dreams, chat, ai, health)
- `artifacts/xun-meng/src/pages/` — frontend pages
- `artifacts/xun-meng/src/components/` — shared components including `CompanionOrb`

## Architecture decisions

- **Character system is central**: every AI call passes the active character's `systemPrompt` so responses stay in persona
- **Mock-first AI**: all AI endpoints gracefully fall back to curated mock responses when `OPENAI_API_KEY` is not set
- **DB migration via raw SQL**: `drizzle-kit push` requires a TTY for interactive conflict resolution; column renames are done via `executeSql` directly
- **API contract-first**: OpenAPI spec → codegen → both frontend hooks and server validators; never write raw fetch or manual Zod schemas for API shapes
- **No auth**: MVP intentionally skips auth to keep focus on core companion experience

## Product

- **陪伴主页**: Living companion orb with breathing/glow Framer Motion animations, quick actions
- **AI 聊天**: Immersive chat with voice input (Web Speech API) and TTS (speechSynthesis)
- **角色创建**: 6 preset templates + fully custom character creation
- **梦境记录**: Voice input, AI analysis by active character, mood/clarity/recurring fields
- **图片识别**: Upload image → AI extracts dream elements → one-click save as dream
- **梦境详情**: Full AI analysis with companion's persona-driven reply

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `drizzle-kit push` fails without TTY; use `executeSql` for column renames and new table creation directly
- When adding new DB columns or renaming, always use raw SQL via `executeSql` in code_execution notebook
- After modifying `openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` before editing any route or frontend code
- The `dreams` table originally had `keywords`→renamed to `symbols`, `ai_response`→renamed to `companion_reply`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
