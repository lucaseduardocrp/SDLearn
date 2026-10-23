---
title: Collaborative Editor (Google Docs)
difficulty: Hard
summary: Let many people edit the same document at once without losing anyone's changes.
tags: [crdt, websockets, conflict resolution]
estimatedMinutes: 60
functionalRequirements:
  - Several users edit the same document concurrently and see each other's changes live
  - Show collaborators' cursors and presence
  - Work offline and merge changes on reconnect
  - Keep version history and allow restoring a version
nonFunctionalRequirements:
  - Remote edits appear in under 200 ms for users in the same region
  - All replicas converge to the same document; no edit is silently lost
  - Up to 100 simultaneous editors per document
  - Documents are durable once the server acknowledges an edit
scale:
  - { label: Documents, value: 1B }
  - { label: Concurrent editors, value: 5M }
  - { label: Peak operations, value: 200k / s }
peakRps: 200000
latencyBudgetMs: 200
expectedKinds: [client, load-balancer, websocket, service, nosql, cache, object-storage]
hints:
  - Route every editor of a document to the same session server so ordering is decided in one place.
  - Compare operational transformation (OT) with CRDTs for convergence and offline support.
  - Keep an append-only operation log and take periodic snapshots.
relatedArticles: [crdt-and-ot, realtime, replication-consistency]
keyPoints:
  - id: convergence
    point: Chooses OT or a CRDT and explains how concurrent edits converge without losing changes.
    weight: 5
  - id: realtime-channel
    point: Uses persistent connections (WebSocket) to broadcast operations to collaborators.
    weight: 4
  - id: document-affinity
    point: Routes all editors of a document to the same session server (consistent hashing / directory) or explains how ordering works without it.
    weight: 4
  - id: op-log
    point: Persists an append-only operation log plus periodic snapshots for durability, history and fast loading.
    weight: 4
  - id: offline
    point: Supports offline edits that merge on reconnect.
    weight: 3
  - id: presence
    point: Handles cursors and presence as ephemeral, best-effort state.
    weight: 2
---
Design the real-time collaboration backend for a document editor. People open the same document from browsers around the world, type at the same time, see each other's cursors and keep working through flaky connections. When everyone stops typing, every copy of the document must be identical.
