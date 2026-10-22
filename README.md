# Archon /sd-lab

**Desenhe. Quebre. Seja julgado.** A system design practice arena: pick a real interview problem, build the architecture on a drag-and-drop canvas (or in Mermaid), inject failures with the Chaos Lab, and get scored 0–100 by two AI judges who assess independently, debate, and reach a consensus verdict (pass / borderline / fail) with detailed feedback.

## Features

- **Problem library** — 16 interview problems (URL Shortener, Rate Limiter, Twitter feed, WhatsApp, YouTube, Uber, Payments, Ticketmaster…) with difficulty, concept tags, functional/non-functional requirements, scale, latency budget and hints.
- **Canvas** — React Flow canvas with 18 component types (client, CDN, load balancer, services, caches, SQL/NoSQL, queues, streams…), replicas per component, sync/async connections and sticky-note annotations. Autosaves.
- **Mermaid editor** — generate Mermaid from the canvas, or write Mermaid and apply it to the canvas (shapes and names like "Redis" or "Kafka" are mapped to component types; `×3` sets replicas; `-.->` is async).
- **Chaos Lab** — deterministic simulation over your graph: kill a component, lose replicas, partition a connection, spike traffic, inject latency or let the Chaos Monkey choose. It models capacity per replica, cache hit ratios (and the database stampede when the cache dies), queue buffering, hard vs soft dependencies, end-to-end latency, and detects single points of failure. Results are painted on the canvas.
- **Two AI judges** — *O Rigoroso* (rigor) and *O Pragmático* (pragmatism) score independently, read each other's assessment and rebut, then a moderator produces the consensus score (always between their revised scores), strengths, improvements and next steps.
- **Automatic pre-check** — a deterministic rubric (expected components, connectivity, data path, SPOFs, peak capacity, latency, documented trade-offs) shown live while you draw and passed to the judges as evidence. Without an AI provider you still get this pre-check, clearly labelled as not being a judge score.
- **Learning library** — 20 articles (Portuguese) on caching, sharding, replication, queues, streaming, rate limiting, real-time, idempotency, resilience, geospatial indexing and more, each linked to the problems where it applies.

## Layout

- `services/shared` — types, validation, problem/article/component catalogs and the engines (chaos simulation, Mermaid ⇄ canvas, rubric). Used by both API and web.
- `services/sdlearn-api` — NestJS API, PostgreSQL persistence, judge panel and LLM providers.
- `services/sdlearn-web` — React + Vite frontend.

## Local development

Requirements: Node.js 24+, npm, and Docker (for PostgreSQL).

1. Copy `.env.example` to `.env` and, optionally, configure an AI provider (see below).
2. `docker compose up -d postgres`
3. `npm install`
4. `npm run dev` (starts API and web together; `npm run dev:api` / `npm run dev:web` run them separately).
5. Open `http://localhost:5173`.

The Vite dev server proxies `/api` to `http://localhost:3000`. Tables are created on API start-up; the database must be UTF-8 (the Compose image is). `GET /api/health` reports API, database and judge status.

### Offline mode (no API, no database)

`npm run dev:offline` runs the whole app in the browser: sessions are stored in `localStorage`, and the canvas, Mermaid, Chaos Lab and pre-check work exactly as with the API. AI judges are unavailable in this mode.

### Production build

`npm run build` builds shared, API and web. `npm run start:api` serves the API and, when `services/sdlearn-web/dist` exists (or `WEB_DIST_DIR` is set), the built web app from the same process.

## AI judges

Configure one provider in `.env`:

- **OpenAI or any OpenAI-compatible endpoint** — set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, `OPENAI_BASE_URL`). For a keyless local server such as Ollama, set `JUDGE_PROVIDER=openai` and `OPENAI_BASE_URL=http://localhost:11434/v1`.
- **Azure OpenAI** — set `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT`; in Development also `AZURE_OPENAI_API_KEY`, elsewhere the API uses managed identity.

An evaluation runs in the background (5 model calls: 2 assessments, 2 rebuttals, 1 consensus) and the page shows its progress. If a provider call fails, the evaluation is marked failed with the reason; no score is invented.

## Tests

`npm test` runs the API tests (catalog, sessions, chaos engine, Mermaid round-trip, rubric, judge panel with a fake provider) and the web tests.
