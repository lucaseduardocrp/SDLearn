# Project Plan

**Status**: In Progress
**Created**: 2026-10-21
**Mode**: NEW
**Execution Mode**: auto

---

## 1. Project Overview

**Goal**: Build SDLearn, a full-featured system-design practice application with an open problem library, unlimited practice sessions, architecture and Mermaid editing, configurable chaos simulations, and independent two-judge AI evaluations. Provider integrations remain optional, all learning features stay unlocked, and billing information is transparent. Every module is independently testable.

**App Type**: SPA + API

**API Login**: No

**Mode**: NEW

**Deployment Plan**: No deployment plan found

---

## 2. Backend — NestJS API

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript |
| **Runtime** | Node |
| **Package Manager** | npm |
| **Test Runner** | Jest |
| **Mocking Library** | jest.mock |
| **Test Command** | npm test |
| **Orchestration** | docker-compose |

NestJS owns problem catalog, session lifecycle, architecture submissions, configurable chaos scenarios, and evaluation orchestration. PostgreSQL is the essential persistent store. The two judge adapters run independently and return normalized score (0–100), verdict (pass/borderline/fail), written feedback, and consensus. External AI providers are enhancement integrations: when credentials are absent or a provider fails, preserve the session and return a clearly identified unavailable/demo evaluation rather than fabricate a real AI judgment. Keep provider adapters behind interfaces so providers can be configured independently.

The requested one-container local run is a packaging constraint, not the production topology: local packaging must make the full app usable from one Docker container, while production uses managed PostgreSQL as a separate Azure service. Keep database access behind a repository boundary and document the local-image database lifecycle and persistence limitations clearly; never imply local container data is durable. A production database remains Essential.

---

## 3. Frontend — React Web App

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript |
| **Framework** | React + Vite + Tailwind CSS |
| **Package Manager** | npm |
| **Test Runner** | vitest |
| **Mocking Library** | vi.mock |
| **Test Command** | npm test |

The frontend consumes typed API contracts and provides a complete problem-to-practice-to-review workflow without account gates. Canvas and Mermaid editing, simulation controls, judge results, and transparent billing information are available without feature locks.

---

## 4. Services Required

| Azure Service | Role in App | Environment Variable | Default Value (Local) | Classification |
|---------------|------------|---------------------|----------------------|----------------|
| Azure Container Apps | Host the React web app and NestJS API as independently deployable services | `PORT`, `API_BASE_URL` | `5173`, `http://localhost:3000` | Essential |
| PostgreSQL | Persist problems, practice sessions, architecture submissions, simulation configurations, and evaluation records | `DATABASE_URL` | `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/sdlearn` | Essential |
| Azure OpenAI | Optional AI judge provider; provider adapters can be configured for other vendors | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` | Unset; use an explicitly labelled demo/unavailable evaluation path | Enhancement |

---

## 5. Prerequisites

The Docker Desktop CLI and Compose are present, but the Docker engine did not respond during detection. Verify that Docker Desktop is running before using the one-container local package. Chrome was detected; the user should double-check any `❓` entries before proceeding.

### Run

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Node.js | * | ✅ | v24.20.0 |
| npm | * | ✅ | 11.19.0 |
| Docker | * | ❓ | CLI v29.7.2; engine unavailable |
| Docker Compose | * | ❓ | CLI v5.5.0; engine unavailable |

### Debug

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Docker | * | ❓ | CLI v29.7.2; engine unavailable |
| Docker Compose | * | ❓ | CLI v5.5.0; engine unavailable |
| Chrome | frontend | ✅ | 155.0.8059.85 |

---

## 6. Design System & UI

**Component Library**: Fluent UI v9
**Style Direction**: A focused system-design workbench: deep ink surfaces and restrained violet brand accents, balanced by crisp lime/teal signals for reliability and simulation health. Keep the library and session workflows dense and scannable; give the architecture canvas generous working space, with compact 4–8px control corners and clear status contrast.
**Typography**: Segoe UI Variable, system-ui

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#8B5CF6` | SDLearn violet for selected navigation, primary actions, and focused editor controls |
| `accent` | `#A3E635` | Lime signal for healthy systems, simulation readiness, and positive progress |
| `surface` | `#171923` | Main workbench background behind library, session, and evaluation views |
| `text` | `#F4F4F5` | High-contrast interface text and problem content |
| `muted` | `#A1A1AA` | Supporting metadata, timestamps, and secondary descriptions |
| `border` | `#353744` | Panel divisions, editor boundaries, and compact control outlines |

### Pages

| Page | Route | Purpose | Layout |
|------|-------|---------|--------|
| Dashboard | `/` | Resume the latest system-design session, see practice momentum, and jump into the full problem library. | `header + sidebar + main + hero + grid + list + footer` |
| Problem Library | `/problems` | Search and filter the complete problem catalog by system domain, difficulty, and estimated time. | `header + sidebar + main + actions + table + footer` |
| Practice Session | `/sessions/:sessionId` | Work through requirements and tradeoffs, record an architecture submission, and configure a chaos run. | `header + main + tabs + split(form|card-list) + actions + footer` |
| Architecture Studio | `/sessions/:sessionId/architecture` | Edit the architecture canvas and Mermaid source together with a synchronized component inventory. | `header + main + tabs + two-column(form+main) + actions + footer` |
| Chaos Lab | `/chaos` | Configure repeatable failure simulations and inspect scenario outcomes without daily feature limits. | `header + sidebar + main + form + card-list + footer` |
| Evaluations | `/evaluations` | Compare independent judge scores, verdicts, written feedback, and consensus for completed submissions. | `header + sidebar + main + table + tabs + footer` |

### Sample Content

Dashboard — practice session:
| System | Focus | Score | State |
|---|---|---:|---|
| Global URL Shortener | Partitioning and hot keys | 82 | Borderline |
| Event Ingestion Platform | Backpressure and replay | 91 | Pass |
| Collaborative Whiteboard | Presence and conflict resolution | — | In progress |

Problem Library — system design problem:
| Problem | Domain | Difficulty | Time |
|---|---|---|---|
| Global URL Shortener | Storage and caching | Intermediate | 45 min |
| Event Ingestion Platform | Streaming systems | Advanced | 60 min |
| Collaborative Whiteboard | Realtime collaboration | Advanced | 60 min |
| Multi-Region Feature Flag Service | Reliability and consistency | Intermediate | 45 min |

Practice Session — session prompt:
| System | Requirement | Constraint | State |
|---|---|---|---|
| Global URL Shortener | Redirect p99 under 100 ms | 100M new links per month | In progress |
| Global URL Shortener | 99.99% read availability | Hot-key traffic spikes | Open |
| Global URL Shortener | Idempotent link creation | Custom aliases may collide | Open |

Architecture Studio — component:
| Component | Responsibility | Technology | Status |
|---|---|---|---|
| Redirect API | Resolve short codes | TypeScript service | Ready |
| Link Store | Map codes to destinations | PostgreSQL | Proposed |
| Hot-Key Cache | Accelerate popular redirects | Redis-compatible cache | Proposed |

Chaos Lab — scenario:
| Scenario | Fault | Duration | State |
|---|---|---:|---|
| Cache node unavailable | Remove one cache replica | 90 sec | Ready |
| Primary region latency | Add 250 ms to writes | 3 min | Ready |
| Queue consumer restart | Stop one consumer | 2 min | Ready |

Evaluations — judge result:
| Session | Judge | Score | Verdict |
|---|---|---:|---|
| Global URL Shortener | Scalability Judge | 84 | Pass |
| Global URL Shortener | Reliability Judge | 76 | Borderline |
| Event Ingestion Platform | Scalability Judge | 92 | Pass |
| Event Ingestion Platform | Reliability Judge | 90 | Pass |

---

## 7. Project Structure

```text
sdlearn/
├── .azure/
│   └── project-plan.md
├── .env.example
├── Dockerfile
├── package.json
├── docker-compose.yml
├── services/
│   ├── sdlearn-api/
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── problems/
│   │   │   ├── sessions/
│   │   │   ├── architecture/
│   │   │   ├── chaos/
│   │   │   ├── evaluations/
│   │   │   ├── judges/
│   │   │   ├── persistence/
│   │   │   └── common/
│   │   └── test/
│   ├── sdlearn-web/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── api/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── features/
│   │       └── test/
│   └── shared/
│       ├── package.json
│       ├── types/
│       └── schemas/
└── infra/
    └── container-apps/
```

---

## 8. Route Definitions

| # | Method | Path | Description | Request Body | Response Body | Status Codes |
|---|--------|------|-------------|-------------|--------------|-------------|
| 1 | GET | `/api/health` | Health check for API and essential database | — | `{ status, services }` | 200, 503 |
| 2 | GET | `/api/problems` | Search/filter the full problem library | query: `q`, `domain`, `difficulty`, `cursor` | `{ items, nextCursor }` | 200, 422 |
| 3 | GET | `/api/problems/:problemId` | Read problem statement and requirements | — | `{ problem }` | 200, 404 |
| 4 | POST | `/api/sessions` | Start an unlimited practice session | `{ problemId }` | `{ session }` | 201, 404, 422 |
| 5 | GET | `/api/sessions` | List recent practice sessions | query: `cursor`, `limit` | `{ items, nextCursor }` | 200, 422 |
| 6 | GET | `/api/sessions/:sessionId` | Read session, prompts, and current progress | — | `{ session }` | 200, 404 |
| 7 | PATCH | `/api/sessions/:sessionId` | Save notes, decisions, and session progress | `{ notes?, decisions?, status? }` | `{ session }` | 200, 404, 422 |
| 8 | PUT | `/api/sessions/:sessionId/architecture` | Save canvas model and Mermaid source | `{ diagram, mermaid }` | `{ architecture }` | 200, 404, 422 |
| 9 | GET | `/api/sessions/:sessionId/architecture` | Load saved architecture artifacts | — | `{ architecture }` | 200, 404 |
| 10 | GET | `/api/chaos/scenarios` | List configurable chaos scenarios | query: `category?` | `{ items }` | 200, 422 |
| 11 | POST | `/api/sessions/:sessionId/chaos-runs` | Start a configured daily chaos simulation | `{ scenarioId, parameters }` | `{ run }` | 202, 404, 422 |
| 12 | GET | `/api/chaos-runs/:runId` | Read simulation status and outcome | — | `{ run }` | 200, 404 |
| 13 | POST | `/api/sessions/:sessionId/evaluations` | Request independent judge evaluations | `{ submission }` | `{ evaluation }` | 202, 404, 422 |
| 14 | GET | `/api/evaluations` | List evaluation results and consensus | query: `sessionId?`, `cursor?` | `{ items, nextCursor }` | 200, 422 |
| 15 | GET | `/api/evaluations/:evaluationId` | Read scores, verdicts, feedback, and consensus | — | `{ evaluation }` | 200, 404 |

---

## 9. Next Steps

1. Run **azure-project-scaffold** to execute this plan
2. Run **azure-project-integrate** to wire the frontend to live data, smoke-test the backend, and create the migrations
3. Run **azure-debug-plan** → **azure-debug-generate** for Docker emulators and VS Code debugging
4. Run the **azure-deploy** agent when ready; it uses **azure-app-onboard** for architecture, cost estimation, IaC generation, provisioning, and health verification
