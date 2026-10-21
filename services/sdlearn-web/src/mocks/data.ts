import type {
  ArchitectureModel,
  ChaosRun,
  ChaosScenario,
  Evaluation,
  PracticeSession,
  Problem,
  Requirement,
} from '../types';

export const problems: Problem[] = [
  { id: 'url-shortener', name: 'Global URL Shortener', domain: 'Storage and caching', difficulty: 'Intermediate', estimatedMinutes: 45, summary: 'Design a globally available redirect service that stays fast under hot-key traffic.' },
  { id: 'event-ingestion', name: 'Event Ingestion Platform', domain: 'Streaming systems', difficulty: 'Advanced', estimatedMinutes: 60, summary: 'Ingest, validate, and replay high-volume events with predictable backpressure.' },
  { id: 'whiteboard', name: 'Collaborative Whiteboard', domain: 'Realtime collaboration', difficulty: 'Advanced', estimatedMinutes: 60, summary: 'Keep concurrent drawing and presence synchronized across regions.' },
  { id: 'feature-flags', name: 'Multi-Region Feature Flag Service', domain: 'Reliability and consistency', difficulty: 'Intermediate', estimatedMinutes: 45, summary: 'Distribute low-latency flag decisions with safe regional failover.' },
];

export const sessions: PracticeSession[] = [
  { id: 'session-url', problemId: 'url-shortener', system: 'Global URL Shortener', focus: 'Partitioning and hot keys', score: 82, verdict: 'Borderline', status: 'In progress', updatedAt: '2026-10-21T10:20:00.000Z', notes: 'Compare hash partitioning with regional routing.', decisions: ['Use stable short-code hashing'] },
  { id: 'session-events', problemId: 'event-ingestion', system: 'Event Ingestion Platform', focus: 'Backpressure and replay', score: 91, verdict: 'Pass', status: 'Completed', updatedAt: '2026-10-20T15:10:00.000Z', notes: 'Replay from durable offsets.', decisions: ['Partition by tenant'] },
  { id: 'session-board', problemId: 'whiteboard', system: 'Collaborative Whiteboard', focus: 'Presence and conflict resolution', score: null, verdict: null, status: 'In progress', updatedAt: '2026-10-19T09:45:00.000Z', notes: '', decisions: [] },
];

export const requirements: Requirement[] = [
  { id: 'r1', system: 'Global URL Shortener', requirement: 'Redirect p99 under 100 ms', constraint: '100M new links per month', state: 'In progress', category: 'Performance', decision: 'Cache popular redirects at the edge.' },
  { id: 'r2', system: 'Global URL Shortener', requirement: '99.99% read availability', constraint: 'Hot-key traffic spikes', state: 'Open', category: 'Reliability', decision: '' },
  { id: 'r3', system: 'Global URL Shortener', requirement: 'Idempotent link creation', constraint: 'Custom aliases may collide', state: 'Open', category: 'Consistency', decision: '' },
];

export const architecture: ArchitectureModel = {
  components: [
    { id: 'redirect-api', name: 'Redirect API', responsibility: 'Resolve short codes', technology: 'TypeScript service', status: 'Ready' },
    { id: 'link-store', name: 'Link Store', responsibility: 'Map codes to destinations', technology: 'PostgreSQL', status: 'Proposed' },
    { id: 'hot-key-cache', name: 'Hot-Key Cache', responsibility: 'Accelerate popular redirects', technology: 'Redis-compatible cache', status: 'Proposed' },
  ],
  mermaid: 'flowchart LR\n  Client --> Edge[Edge Router]\n  Edge --> API[Redirect API]\n  API --> Cache[Hot-Key Cache]\n  API --> Store[(Link Store)]',
};

export const chaosScenarios: ChaosScenario[] = [
  { id: 'cache-node', name: 'Cache node unavailable', fault: 'Remove one cache replica', duration: '90 sec', category: 'Dependency failure' },
  { id: 'primary-latency', name: 'Primary region latency', fault: 'Add 250 ms to writes', duration: '3 min', category: 'Latency' },
  { id: 'consumer-restart', name: 'Queue consumer restart', fault: 'Stop one consumer', duration: '2 min', category: 'Capacity' },
];

export const chaosRuns: ChaosRun[] = [
  { id: 'run-cache', sessionId: 'session-url', scenario: 'Cache node unavailable', status: 'Completed', outcome: 'Redirects remained available; p99 increased by 18 ms.', startedAt: '2026-10-21T09:12:00.000Z' },
];

export const evaluations: Evaluation[] = [
  { id: 'eval-url', sessionId: 'session-url', system: 'Global URL Shortener', focus: 'Partitioning and hot keys', score: 80, verdict: 'Borderline', feedback: 'Strong partitioning rationale. Clarify cache invalidation and regional failover behavior.', judges: [
    { judge: 'Scalability Judge', score: 84, verdict: 'Pass', feedback: 'Capacity model addresses growth and hot keys.' },
    { judge: 'Reliability Judge', score: 76, verdict: 'Borderline', feedback: 'Define regional recovery and cache invalidation guarantees.' },
  ] },
  { id: 'eval-events', sessionId: 'session-events', system: 'Event Ingestion Platform', focus: 'Backpressure and replay', score: 91, verdict: 'Pass', feedback: 'Clear replay strategy and thoughtful backpressure controls.', judges: [
    { judge: 'Scalability Judge', score: 92, verdict: 'Pass', feedback: 'Partitioning and consumer scaling are well justified.' },
    { judge: 'Reliability Judge', score: 90, verdict: 'Pass', feedback: 'Durable offsets make recovery behavior clear.' },
  ] },
];