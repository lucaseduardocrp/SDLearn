import type { ComponentKind } from '../types/entities';

export type ComponentCategory = 'Edge' | 'Compute' | 'Data' | 'Messaging' | 'Other';

export interface ComponentSpec {
  kind: ComponentKind;
  label: string;
  category: ComponentCategory;
  description: string;
  /** Requests per second one replica can serve in the chaos capacity model. */
  capacityPerReplica: number;
  /** Latency one hop through this component adds on the synchronous path, in ms. */
  latencyMs: number;
  /** Callers keep working (degraded) when a soft dependency fails. */
  soft: boolean;
  /** Absorbs bursts: downstream consumers receive at most their own capacity. */
  buffers: boolean;
  /** Treated as an entry point that generates traffic. */
  entry: boolean;
}

const specs: ComponentSpec[] = [
  { kind: 'client', label: 'Client', category: 'Edge', description: 'Browser, mobile app or upstream caller.', capacityPerReplica: Infinity, latencyMs: 0, soft: false, buffers: false, entry: true },
  { kind: 'dns', label: 'DNS', category: 'Edge', description: 'Name resolution and geo routing.', capacityPerReplica: 1_000_000, latencyMs: 1, soft: false, buffers: false, entry: false },
  { kind: 'cdn', label: 'CDN', category: 'Edge', description: 'Edge cache for static and cacheable content.', capacityPerReplica: 500_000, latencyMs: 5, soft: true, buffers: false, entry: false },
  { kind: 'load-balancer', label: 'Load Balancer', category: 'Edge', description: 'Spreads traffic across healthy replicas.', capacityPerReplica: 200_000, latencyMs: 1, soft: false, buffers: false, entry: false },
  { kind: 'api-gateway', label: 'API Gateway', category: 'Edge', description: 'Routing, auth, request shaping.', capacityPerReplica: 50_000, latencyMs: 3, soft: false, buffers: false, entry: false },
  { kind: 'rate-limiter', label: 'Rate Limiter', category: 'Edge', description: 'Enforces per-client quotas.', capacityPerReplica: 100_000, latencyMs: 1, soft: false, buffers: false, entry: false },
  { kind: 'service', label: 'Service', category: 'Compute', description: 'Stateless application service.', capacityPerReplica: 5_000, latencyMs: 15, soft: false, buffers: false, entry: false },
  { kind: 'websocket', label: 'WebSocket Server', category: 'Compute', description: 'Long-lived connections for push.', capacityPerReplica: 20_000, latencyMs: 5, soft: false, buffers: false, entry: false },
  { kind: 'worker', label: 'Worker', category: 'Compute', description: 'Background consumer / batch job.', capacityPerReplica: 2_000, latencyMs: 0, soft: false, buffers: false, entry: false },
  { kind: 'scheduler', label: 'Scheduler', category: 'Compute', description: 'Cron / delayed job trigger.', capacityPerReplica: 10_000, latencyMs: 0, soft: false, buffers: false, entry: false },
  { kind: 'cache', label: 'Cache', category: 'Data', description: 'In-memory key-value cache (Redis, Memcached).', capacityPerReplica: 100_000, latencyMs: 1, soft: true, buffers: false, entry: false },
  { kind: 'sql', label: 'SQL Database', category: 'Data', description: 'Relational store with transactions.', capacityPerReplica: 10_000, latencyMs: 8, soft: false, buffers: false, entry: false },
  { kind: 'nosql', label: 'NoSQL Database', category: 'Data', description: 'Partitioned key-value / wide-column store.', capacityPerReplica: 40_000, latencyMs: 5, soft: false, buffers: false, entry: false },
  { kind: 'object-storage', label: 'Object Storage', category: 'Data', description: 'Blobs: media, files, backups (S3).', capacityPerReplica: 100_000, latencyMs: 30, soft: false, buffers: false, entry: false },
  { kind: 'search', label: 'Search Index', category: 'Data', description: 'Inverted index (Elasticsearch, OpenSearch).', capacityPerReplica: 8_000, latencyMs: 20, soft: true, buffers: false, entry: false },
  { kind: 'queue', label: 'Message Queue', category: 'Messaging', description: 'Durable work queue (SQS, RabbitMQ).', capacityPerReplica: 50_000, latencyMs: 2, soft: false, buffers: true, entry: false },
  { kind: 'stream', label: 'Event Stream', category: 'Messaging', description: 'Partitioned log (Kafka, Kinesis).', capacityPerReplica: 200_000, latencyMs: 2, soft: false, buffers: true, entry: false },
  { kind: 'auth', label: 'Identity Provider', category: 'Edge', description: 'Authentication and token issuing (OIDC / OAuth 2.0).', capacityPerReplica: 20_000, latencyMs: 10, soft: false, buffers: false, entry: false },
  { kind: 'workflow', label: 'Workflow Engine', category: 'Compute', description: 'Durable orchestration of long-running, multi-step processes.', capacityPerReplica: 5_000, latencyMs: 10, soft: false, buffers: true, entry: false },
  { kind: 'stream-processor', label: 'Stream Processor', category: 'Compute', description: 'Stateful processing of event streams (windows, joins, aggregations).', capacityPerReplica: 50_000, latencyMs: 0, soft: false, buffers: false, entry: false },
  { kind: 'data-warehouse', label: 'Data Warehouse', category: 'Data', description: 'Columnar analytics store for reporting and BI.', capacityPerReplica: 500, latencyMs: 400, soft: true, buffers: false, entry: false },
  { kind: 'vector-db', label: 'Vector Database', category: 'Data', description: 'Similarity search over embeddings (semantic search, RAG).', capacityPerReplica: 3_000, latencyMs: 15, soft: false, buffers: false, entry: false },
  { kind: 'observability', label: 'Observability', category: 'Other', description: 'Metrics, logs and traces collection with alerting.', capacityPerReplica: 100_000, latencyMs: 0, soft: true, buffers: false, entry: false },
  { kind: 'external', label: 'External API', category: 'Other', description: 'Third-party dependency (payments, SMS, email).', capacityPerReplica: 2_000, latencyMs: 120, soft: false, buffers: false, entry: false },
];

export const componentSpecs: Record<ComponentKind, ComponentSpec> = Object.fromEntries(specs.map((spec) => [spec.kind, spec])) as Record<ComponentKind, ComponentSpec>;
export const componentList = specs;
export const componentCategories: ComponentCategory[] = ['Edge', 'Compute', 'Data', 'Messaging', 'Other'];
