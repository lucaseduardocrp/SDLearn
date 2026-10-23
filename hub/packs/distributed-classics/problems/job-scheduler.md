---
title: Distributed Job Scheduler
difficulty: Hard
summary: Run millions of scheduled and recurring jobs exactly when they are due.
tags: [scheduling, leases, queues]
estimatedMinutes: 60
functionalRequirements:
  - Schedule one-off jobs at a timestamp and recurring jobs with cron expressions
  - Execute each job on a worker fleet and record the result
  - Retry failed jobs with backoff and a maximum attempt count
  - Cancel or pause jobs and query their history
nonFunctionalRequirements:
  - A due job starts within 2 seconds of its scheduled time
  - Each run executes at least once and is not run concurrently by two workers
  - Scheduler nodes can crash without losing or duplicating schedules
  - Scales to 10 million scheduled jobs and 50k executions per second at peak
scale:
  - { label: Scheduled jobs, value: 10M }
  - { label: Peak executions, value: 50k / s }
  - { label: Workers, value: "~2000" }
peakRps: 50000
latencyBudgetMs: 2000
expectedKinds: [client, service, scheduler, sql, queue, worker]
hints:
  - Partition the time wheel or the due-jobs index so many scheduler nodes share the work.
  - A worker should hold a lease with a deadline; an expired lease makes the run eligible again.
  - Idempotent job handlers turn at-least-once delivery into effectively-once execution.
relatedArticles: [consensus-and-leases, message-queues, idempotency]
keyPoints:
  - id: due-index
    point: Stores schedules in a durable store indexed by next run time and partitions that index across scheduler nodes.
    weight: 5
  - id: dispatch-queue
    point: Separates scheduling from execution by pushing due jobs to a queue consumed by a worker pool.
    weight: 4
  - id: leases
    point: Prevents concurrent execution of the same run with leases/locks that expire (fencing tokens or conditional updates).
    weight: 5
  - id: retries
    point: Retries with backoff, caps attempts and moves exhausted jobs to a dead-letter state.
    weight: 3
  - id: idempotency
    point: Requires idempotent job handlers or run ids so at-least-once delivery is safe.
    weight: 4
  - id: recurring
    point: Computes the next occurrence of recurring jobs atomically when a run is dispatched.
    weight: 3
  - id: failover
    point: Reassigns partitions when a scheduler node dies (leader election / consensus / lease-based ownership).
    weight: 4
---
A platform team needs a shared scheduler. Product services register jobs ("send this reminder at 09:00", "rebuild this report every hour") through an API. The scheduler must start each job on time on a fleet of workers, survive node failures, and never run the same execution on two workers at once.
