# Threat Model

## Project Overview

Xun Meng is a React + Express dream-journal and AI-companion web app backed by PostgreSQL. Users create AI characters, store dream records, review chat history, and send text or image inputs to AI features that may call OpenAI and ElevenLabs when those secrets are configured. The API currently relies on a server-issued anonymous session cookie rather than real user accounts, and the frontend also includes a browser-local archive flow for saved dream conversations. The current repo has no deployed instance, and `artifacts/mockup-sandbox/` is a dev-only surface unless production reachability is later demonstrated.

## Assets

- **Dream journals and companion replies** — highly personal diary-style content, emotional analysis, symbols, and image-derived drafts. Exposure would reveal sensitive user thoughts and mental-state clues.
- **Character profiles and system prompts** — custom personas and prompts shape the companion behavior. Unauthorized changes affect integrity and can alter every downstream AI response.
- **Chat history** — ongoing conversations with the companion may contain intimate disclosures and should not be globally readable or erasable by unrelated users.
- **Browser-local archived dreams** — saved dream conversations, transcriptions, summaries, and images persisted in browser storage are also sensitive and must not silently outlive the privacy boundary users expect.
- **AI provider quotas and secrets** — OpenAI and ElevenLabs keys represent direct financial exposure. Public endpoints that spend tokens or TTS credits are worth protecting even when user accounts do not exist.
- **Anonymous usage-tracking records** — rate-limit state, request logs, and anonymous-session identifiers influence abuse controls and should not be forgeable or cheaply re-mintable by arbitrary callers.

## Trust Boundaries

- **Browser to API** — every `/api/**` request originates from an untrusted client and must be validated, scoped, and protected against abuse.
- **Browser local storage to UI** — any dream data persisted in `localStorage` is accessible to whoever later uses that browser profile, so local archive features can bypass server-side session boundaries if they are treated as protected records.
- **API to PostgreSQL** — route handlers can read and mutate all persistent records. Missing per-user scoping here becomes complete data compromise.
- **API to OpenAI / ElevenLabs** — these outbound calls spend provider credits and may be abused for denial of wallet or service degradation if public callers are not constrained.
- **Public caller to private data boundary** — dream records, character state, chat history, and archived conversations are private product data even if the MVP omits login.
- **Dev-only to production boundary** — `artifacts/mockup-sandbox/**` should normally be ignored in production scans unless the main app exposes it.

## Scan Anchors

- Production entry points: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/middleware/{session,rate-limit}.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/xun-meng/src/App.tsx`
- Highest-risk code areas: public CRUD routes in `artifacts/api-server/src/routes/{characters,dreams,chat}.ts`; paid AI routes in `artifacts/api-server/src/routes/ai.ts`; browser-local archive flows in `artifacts/xun-meng/src/pages/{dream-space,dream-archive,dream-archive-list,dream-local-detail}.tsx`
- Public surfaces: all `/api` endpoints are anonymous; AI-spend routes include `/ai/chat`, `/ai/dream-chat`, `/ai/organize`, `/ai/recognize-image`, and `/ai/tts`
- Dev-only area: `artifacts/mockup-sandbox/**`

## Threat Categories

### Spoofing

The project currently has no real user authentication, so any production deployment that expects private per-user data must introduce a trustworthy identity boundary before exposing shared storage. The anonymous session cookie is better than raw client headers, but abuse controls still fail if attackers can cheaply mint fresh identities just by dropping or rotating cookies.

Required guarantees:
- Private user data APIs MUST bind requests to a trustworthy server-side identity or to a deployment model that truly limits access to a single trusted user.
- Abuse-control identities MUST be derived from trusted proxy/app state, not directly from spoofable client headers.
- Anonymous spend-control identities MUST NOT be resettable at negligible cost by simply omitting or rotating client-controlled session state.

### Tampering

The API exposes write paths for characters, dreams, and chat state. In this product, unauthorized modification is harmful because it can erase journals, alter active personas, and poison future AI context. Browser-local archive data also matters because local deletion or overwrite can silently destroy saved memories outside the server’s visibility.

Required guarantees:
- All state-changing routes MUST enforce server-side authorization before insert, update, delete, activation, or clear operations.
- Bulk-destructive operations MUST be scoped to the caller's own records and MUST NOT default to global deletion.
- If archived dream content is persisted locally, its lifecycle and deletion semantics MUST match the privacy and ownership model communicated to users.

### Information Disclosure

Dream entries, chat history, and image-derived drafts are inherently sensitive. Returning shared records from public endpoints without per-user filtering would disclose one user's intimate data to any other caller. Separately, storing sensitive archive data in browser-local storage can expose it to later users of the same browser profile even when the server session has changed.

Required guarantees:
- Any endpoint returning dream, character, or chat records MUST scope results to the owning user or trusted single-user deployment context.
- Privacy claims in the UI MUST match the actual server-side and client-side isolation model.
- Sensitive archived content MUST NOT bypass the intended privacy boundary simply because it was copied into browser storage.

### Denial of Service

Several routes trigger costly model, vision, web-search, or TTS requests, and the API accepts large request bodies to support image uploads. Weak, resettable, or incomplete throttling can turn those endpoints into a denial-of-wallet or capacity exhaustion vector.

Required guarantees:
- Every production AI-spend endpoint MUST have abuse controls proportional to its cost.
- Rate limits and daily quotas MUST be keyed from identities attackers cannot cheaply mint or reset.
- Expensive endpoints that are not essential to anonymous traffic SHOULD require stronger gating than low-cost reads.
- High-cost request inputs such as long prompts, accumulated history, and image payloads MUST have explicit size limits aligned with acceptable provider spend.

### Elevation of Privilege

Because the API server talks directly to the database and external AI providers, any missing authorization check effectively grants a public caller the server's full privilege over that subsystem. In this repo, the main elevation risk is not classic role escalation but public callers inheriting unrestricted server authority over stored private data or provider-backed AI features.

Required guarantees:
- Public callers MUST NOT inherit global CRUD authority over shared tables.
- Public callers MUST NOT inherit unrestricted ability to spend provider-backed AI/TTS credits.
