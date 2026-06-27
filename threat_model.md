# Threat Model

## Project Overview

Xun Meng is a React + Express dream-journal and AI-companion web app backed by PostgreSQL. Users create AI characters, store dream records, review chat history, and send text or image inputs to AI features that may call OpenAI and ElevenLabs when those secrets are configured. The current repo has no deployed instance, and `artifacts/mockup-sandbox/` is a dev-only surface unless production reachability is later demonstrated.

## Assets

- **Dream journals and companion replies** — highly personal diary-style content, emotional analysis, symbols, and image-derived drafts. Exposure would reveal sensitive user thoughts and mental-state clues.
- **Character profiles and system prompts** — custom personas and prompts shape the companion behavior. Unauthorized changes affect integrity and can alter every downstream AI response.
- **Chat history** — ongoing conversations with the companion may contain intimate disclosures and should not be globally readable or erasable by unrelated users.
- **AI provider quotas and secrets** — OpenAI and ElevenLabs keys represent direct financial exposure. Public endpoints that spend tokens or TTS credits are worth protecting even when user accounts do not exist.
- **Anonymous usage-tracking records** — rate-limit state, request logs, and anonymous-session identifiers influence abuse controls and should not be forgeable by arbitrary callers.

## Trust Boundaries

- **Browser to API** — every `/api/**` request originates from an untrusted client and must be validated, scoped, and protected against abuse.
- **API to PostgreSQL** — route handlers can read and mutate all persistent records. Missing per-user scoping here becomes complete data compromise.
- **API to OpenAI / ElevenLabs** — these outbound calls spend provider credits and may be abused for denial of wallet or service degradation if public callers are not constrained.
- **Public caller to private data boundary** — dream records, character state, and chat history are private product data even if the MVP omits login.
- **Dev-only to production boundary** — `artifacts/mockup-sandbox/**` should normally be ignored in production scans unless the main app exposes it.

## Scan Anchors

- Production entry points: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/xun-meng/src/App.tsx`
- Highest-risk code areas: public CRUD routes in `artifacts/api-server/src/routes/{characters,dreams,chat}.ts`; paid AI routes and abuse controls in `artifacts/api-server/src/routes/ai.ts` and `artifacts/api-server/src/middleware/rate-limit.ts`
- Public surfaces: all documented `/api` endpoints are currently unauthenticated
- Dev-only area: `artifacts/mockup-sandbox/**`

## Threat Categories

### Spoofing

The project currently has no real user authentication, so any production deployment that expects private per-user data must introduce a trustworthy identity boundary before exposing shared storage. Anonymous usage controls also must not treat raw client-supplied headers as authoritative identity, because spoofable identifiers let attackers impersonate fresh sessions and evade quotas.

Required guarantees:
- Private user data APIs MUST bind requests to a trustworthy server-side identity or to a deployment model that truly limits access to a single trusted user.
- Abuse-control identities MUST be derived from trusted proxy/app state, not directly from spoofable client headers.

### Tampering

The API exposes write paths for characters, dreams, and chat state. In this product, unauthorized modification is harmful because it can erase journals, alter active personas, and poison future AI context.

Required guarantees:
- All state-changing routes MUST enforce server-side authorization before insert, update, delete, activation, or clear operations.
- Bulk-destructive operations MUST be scoped to the caller's own records and MUST NOT default to global deletion.

### Information Disclosure

Dream entries, chat history, and image-derived drafts are inherently sensitive. Returning shared records from public endpoints without per-user filtering would disclose one user's intimate data to any other caller.

Required guarantees:
- Any endpoint returning dream, character, or chat records MUST scope results to the owning user or trusted single-user deployment context.
- Privacy claims in the UI MUST match the actual server-side isolation model.

### Denial of Service

Several routes trigger costly model or TTS requests, and the API accepts large request bodies to support image uploads. Weak or bypassable throttling can turn those endpoints into a denial-of-wallet or capacity exhaustion vector.

Required guarantees:
- Every production AI-spend endpoint MUST have abuse controls proportional to its cost.
- Rate limits and daily quotas MUST be keyed from identities attackers cannot cheaply mint or spoof.
- Expensive endpoints that are not essential to anonymous traffic SHOULD require stronger gating than low-cost reads.

### Elevation of Privilege

Because the API server talks directly to the database and external AI providers, any missing authorization check effectively grants a public caller the server's full privilege over that subsystem. The main elevation risk in this repo is not classic role escalation but public callers inheriting unrestricted server authority.

Required guarantees:
- Public callers MUST NOT inherit global CRUD authority over shared tables.
- Public callers MUST NOT inherit unrestricted ability to spend provider-backed AI/TTS credits.
