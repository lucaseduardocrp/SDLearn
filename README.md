# Archon /sd-lab

**Desenhe. Quebre. Seja julgado.** A system design practice arena: pick a real interview problem, build the architecture on a drag-and-drop canvas (or in Mermaid), inject failures with the Chaos Lab, and get scored 0–100 by two AI judges who assess independently, debate, and reach a consensus verdict (pass / borderline / fail) with detailed feedback.

## Features

- **Problem library** — 16 interview problems (URL Shortener, Rate Limiter, Twitter feed, WhatsApp, YouTube, Uber, Payments, Ticketmaster…) with difficulty, concept tags, functional/non-functional requirements, scale, latency budget and hints.
- **Canvas** — React Flow canvas with 18 component types (client, CDN, load balancer, services, caches, SQL/NoSQL, queues, streams…), replicas per component, sync/async connections and sticky-note annotations. Autosaves.
- **Mermaid editor** — generate Mermaid from the canvas, or write Mermaid and apply it to the canvas (shapes and names like "Redis" or "Kafka" are mapped to component types; `×3` sets replicas; `-.->` is async).
- **Chaos Lab** — deterministic simulation over your graph: kill a component, lose replicas, partition a connection, spike traffic, inject latency or let the Chaos Monkey choose. It models capacity per replica, cache hit ratios (and the database stampede when the cache dies), queue buffering, hard vs soft dependencies, end-to-end latency, and detects single points of failure. Results are painted on the canvas.
- **Two AI judges** — *O Rigoroso* (rigor) and *O Pragmático* (pragmatism) grade independently against a per-problem grading key, read each other's assessment and rebut, and a moderator writes the consensus feedback. Each role can use a different provider and model (OpenAI, Anthropic, Gemini, Grok, Ollama or Azure OpenAI), configured from the **Configurações** page.
- **Community hub** — content packs (problems with grading keys, plus articles) written in Markdown, browsed and installed from the **Hub** page. See [hub/README.md](hub/README.md) to contribute.
- **Automatic pre-check** — a deterministic rubric (expected components, connectivity, data path, SPOFs, peak capacity, latency, documented trade-offs) shown live while you draw and passed to the judges as evidence. Without an AI provider you still get this pre-check, clearly labelled as not being a judge score.
- **Learning library** — 20 articles (Portuguese) on caching, sharding, replication, queues, streaming, rate limiting, real-time, idempotency, resilience, geospatial indexing and more, each linked to the problems where it applies.

## Layout

- `services/shared` — types, validation, problem/article/component catalogs, grading keys, the pack builder and the engines (chaos simulation, Mermaid ⇄ canvas, rubric). Used by both API and web.
- `services/sdlearn-api` — NestJS API, PostgreSQL persistence, judge panel and LLM providers.
- `services/sdlearn-web` — React + Vite frontend.
- `hub/` — community content packs and the published hub index (`hub/dist`).

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

Open **Configurações** (gear icon), connect one or more providers, then choose a provider and model for each role (O Rigoroso, O Pragmático, Moderador). **Testar** sends a tiny request to confirm the key and model work. Using different models for the two judges makes their assessments more independent.

| Provider | What you need |
|---|---|
| OpenAI | API key. A custom base URL turns it into any OpenAI-compatible endpoint (LM Studio, vLLM, OpenRouter). |
| Anthropic | API key. Uses the official SDK with structured outputs; `claude-opus-5-5` is suggested. |
| Google Gemini | AI Studio API key. |
| Grok (xAI) | xAI API key. |
| Ollama | A running Ollama (`ollama serve`) and a pulled model. No key. |
| Azure OpenAI | Endpoint, deployment and, in Development, an API key. |

Keys saved from the page are encrypted with AES-256-GCM when `SECRETS_KEY` is set in `.env`; without it they are stored in plain text and the page warns about it. Keys can also come from environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OLLAMA_BASE_URL`, `AZURE_OPENAI_*`).

How a submission is graded:

1. **Pre-check** — the deterministic rubric and chaos baseline run first and are passed to the judges as evidence.
2. **Independent assessments** — each judge marks every key point of the problem's grading key as covered, partial or missing, quoting evidence, and gives a holistic score. Judge score = 60% weighted key-point coverage + 40% holistic.
3. **Debate** — each judge reads the other's assessment and may revise its score by at most 15 points.
4. **Consensus** — the server computes the final score (mean of the revised scores); the moderator writes the feedback. Pass ≥ 75, borderline 55–74, fail < 55.

The candidate's canvas and notes are fenced as data in the prompt, so instructions written in them are ignored. With **Consistência 3×**, each judge runs three times and the median is used (9 model calls instead of 5). Evaluations run in the background; if a provider fails, the evaluation is marked failed with the reason and no score is invented. The grading key is only revealed in the evaluation result.

## Community hub

The **Hub** page lists the packs published by the configured hub (by default `hub/dist/index.json` in this repository) and installs them with one click. Each bundle is checked against the SHA-256 in the index and validated before installation. Installed problems get ids like `<pack-id>.<problem-id>` and continue the library numbering. **Importar pacote .json** installs a single bundle without a hub.

To contribute content, follow [hub/README.md](hub/README.md): write Markdown with YAML frontmatter, run `npm run hub:check`, then `npm run hub:build`, and open a pull request. To share your own hub, publish the repository and set the Hub page address (or `HUB_INDEX_URL`) to the raw URL of `hub/dist/index.json`.

## Tests

`npm test` runs the API tests (catalog and grading keys, sessions, hub install with checksum, chaos engine, Mermaid round-trip, rubric, judge panel scoring, debate limits and sampling with a fake provider, prompt fencing, key encryption, OpenAI-compatible and Ollama adapters against a local HTTP server) and the web tests.
