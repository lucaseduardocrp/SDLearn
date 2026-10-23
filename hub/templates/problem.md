---
# The file name (without .md) is the problem id: lowercase letters, digits and dashes.
title: My Problem Title
difficulty: Medium            # Easy | Medium | Hard
summary: One sentence shown on the library card.
tags: [caching, queues]       # 1-8 short concept tags
estimatedMinutes: 45
functionalRequirements:
  - What the system must do
nonFunctionalRequirements:
  - Latency, availability, consistency or durability targets
scale:
  - { label: Daily users, value: 10M }
  - { label: Peak reads, value: "20k RPS" }   # quote values that contain commas or colons
# Used by the Chaos Lab and the automatic pre-check.
peakRps: 20000
latencyBudgetMs: 200
# Component kinds a reasonable design includes. Valid kinds:
# client, dns, cdn, load-balancer, api-gateway, rate-limiter, service, websocket, worker, scheduler,
# cache, sql, nosql, object-storage, search, queue, stream, external
expectedKinds: [client, load-balancer, service, cache, sql]
hints:
  - A nudge shown only when the candidate asks for it
# Article slugs from this pack or built-in ones (e.g. caching, sharding, message-queues).
relatedArticles: [caching]
# Grading key for the AI judges (3-15 items). Phrase each point as something checkable.
# weight: 1 = nice to have ... 5 = essential. Candidates only see this after submitting.
keyPoints:
  - id: read-cache
    point: Serves hot reads from a cache in front of the database.
    weight: 5
  - id: data-model
    point: Defines the data model and justifies the choice of store.
    weight: 4
  - id: capacity
    point: Backs decisions with capacity estimates.
    weight: 3
---
The problem statement in Markdown. Describe the product, who uses it and what makes it hard.
Keep requirements in the frontmatter lists above.
