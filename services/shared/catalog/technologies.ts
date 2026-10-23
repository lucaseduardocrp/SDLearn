import { componentSpecs, type ComponentSpec } from './components';
import { localized as L, type Locale, type Localized } from '../i18n/locale';
import type { CanvasNode, ComponentKind, ComponentOptionValue } from '../types/entities';

/**
 * Concrete technologies and per-kind options. A canvas component keeps its generic kind (queue, cache…)
 * and may pick a technology plus options; both feed the chaos model and the judges' brief.
 */

export interface OptionChoice { value: string; label: Localized }

export interface ComponentOption {
  id: string;
  label: Localized;
  help?: Localized;
  type: 'select' | 'toggle' | 'number';
  choices?: OptionChoice[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  default: ComponentOptionValue;
  /** Shown directly in the canvas context menu (selects and toggles only). */
  quick?: boolean;
}

export interface Technology {
  id: string;
  kind: ComponentKind;
  label: string;
  description: Localized;
  /** Overrides of the generic kind's capacity model. */
  capacityPerReplica?: number;
  latencyMs?: number;
  /** What one "replica" means for this technology (shards, throughput units…). */
  unit?: Localized;
  managed?: boolean;
  /** Option values that describe how this technology behaves out of the box. */
  defaults?: Record<string, ComponentOptionValue>;
  /** Extra label patterns used to recognise the technology in Mermaid labels. */
  match?: RegExp;
}

const choice = (value: string, pt: string, en = pt): OptionChoice => ({ value, label: L(pt, en) });

const delivery: ComponentOption = {
  id: 'delivery', label: L('Garantia de entrega', 'Delivery guarantee'), type: 'select', quick: true, default: 'at-least-once',
  choices: [choice('at-most-once', 'No máximo uma vez', 'At most once'), choice('at-least-once', 'Pelo menos uma vez', 'At least once'), choice('exactly-once', 'Exatamente uma vez', 'Exactly once')],
};
const deliveryMode: ComponentOption = {
  id: 'consumption', label: L('Modo de consumo', 'Consumption mode'), type: 'select', quick: true, default: 'push',
  choices: [choice('push', 'Push (broker entrega)', 'Push (broker delivers)'), choice('pull', 'Pull (consumidor busca)', 'Pull (consumer polls)')],
};
const replicationFactor = (value: number): ComponentOption => ({ id: 'replicationFactor', label: L('Fator de replicação', 'Replication factor'), type: 'number', min: 1, max: 7, step: 1, default: value });

export const componentOptions: Record<ComponentKind, ComponentOption[]> = {
  client: [
    { id: 'type', label: L('Tipo de cliente', 'Client type'), type: 'select', quick: true, default: 'web', choices: [choice('web', 'Navegador web', 'Web browser'), choice('mobile', 'App mobile', 'Mobile app'), choice('iot', 'Dispositivo IoT', 'IoT device'), choice('service', 'Serviço upstream', 'Upstream service'), choice('desktop', 'App desktop', 'Desktop app')] },
  ],
  dns: [
    { id: 'routing', label: L('Política de roteamento', 'Routing policy'), type: 'select', quick: true, default: 'latency', choices: [choice('simple', 'Simples', 'Simple'), choice('latency', 'Por latência', 'Latency-based'), choice('geo', 'Geolocalização', 'Geolocation'), choice('weighted', 'Ponderado', 'Weighted'), choice('failover', 'Failover')] },
    { id: 'ttl', label: L('TTL', 'TTL'), type: 'number', min: 5, max: 86_400, step: 5, unit: 's', default: 60 },
    { id: 'healthChecks', label: L('Health checks', 'Health checks'), type: 'toggle', quick: true, default: true },
  ],
  cdn: [
    { id: 'hitRatio', label: L('Taxa de acerto', 'Hit ratio'), help: L('Fração das requisições servidas pela borda. Usada pelo chaos.', 'Share of requests served at the edge. Used by chaos.'), type: 'number', min: 0, max: 99, step: 1, unit: '%', default: 60 },
    { id: 'cacheTtl', label: L('TTL do cache', 'Cache TTL'), type: 'number', min: 0, max: 31_536_000, step: 60, unit: 's', default: 3600 },
    { id: 'originShield', label: L('Origin shield', 'Origin shield'), type: 'toggle', quick: true, default: false },
    { id: 'content', label: L('Conteúdo', 'Content'), type: 'select', quick: true, default: 'static', choices: [choice('static', 'Estático', 'Static'), choice('media', 'Mídia / vídeo', 'Media / video'), choice('dynamic', 'Dinâmico (edge compute)', 'Dynamic (edge compute)')] },
  ],
  'load-balancer': [
    { id: 'layer', label: L('Camada', 'Layer'), type: 'select', quick: true, default: 'l7', choices: [choice('l4', 'L4 (TCP/UDP)'), choice('l7', 'L7 (HTTP)')] },
    { id: 'algorithm', label: L('Algoritmo', 'Algorithm'), type: 'select', quick: true, default: 'round-robin', choices: [choice('round-robin', 'Round robin'), choice('least-connections', 'Menos conexões', 'Least connections'), choice('ip-hash', 'Hash de IP', 'IP hash'), choice('consistent-hash', 'Hash consistente', 'Consistent hashing'), choice('weighted', 'Ponderado', 'Weighted')] },
    { id: 'healthChecks', label: L('Health checks', 'Health checks'), type: 'toggle', quick: true, default: true },
    { id: 'stickySessions', label: L('Sessões fixas (sticky)', 'Sticky sessions'), type: 'toggle', quick: true, default: false },
    { id: 'tlsTermination', label: L('Termina TLS', 'TLS termination'), type: 'toggle', default: true },
  ],
  'api-gateway': [
    { id: 'auth', label: L('Autenticação', 'Authentication'), type: 'select', quick: true, default: 'jwt', choices: [choice('none', 'Nenhuma', 'None'), choice('api-key', 'API key'), choice('jwt', 'JWT / OAuth 2.0'), choice('mtls', 'mTLS')] },
    { id: 'rateLimiting', label: L('Rate limiting', 'Rate limiting'), type: 'toggle', quick: true, default: true },
    { id: 'responseCaching', label: L('Cache de respostas', 'Response caching'), type: 'toggle', quick: true, default: false },
    { id: 'requestValidation', label: L('Validação de schema', 'Schema validation'), type: 'toggle', default: false },
  ],
  'rate-limiter': [
    { id: 'algorithm', label: L('Algoritmo', 'Algorithm'), type: 'select', quick: true, default: 'token-bucket', choices: [choice('token-bucket', 'Token bucket'), choice('leaky-bucket', 'Leaky bucket'), choice('fixed-window', 'Janela fixa', 'Fixed window'), choice('sliding-log', 'Janela deslizante (log)', 'Sliding window log'), choice('sliding-counter', 'Janela deslizante (contador)', 'Sliding window counter')] },
    { id: 'scope', label: L('Escopo', 'Scope'), type: 'select', quick: true, default: 'per-key', choices: [choice('per-key', 'Por chave / usuário', 'Per key / user'), choice('per-ip', 'Por IP', 'Per IP'), choice('global', 'Global')] },
    { id: 'failMode', label: L('Se o limitador falhar', 'When the limiter fails'), type: 'select', quick: true, default: 'open', choices: [choice('open', 'Fail-open (deixa passar)', 'Fail-open (let through)'), choice('closed', 'Fail-closed (bloqueia)', 'Fail-closed (block)')] },
  ],
  service: [
    { id: 'autoscaling', label: L('Autoscaling', 'Autoscaling'), type: 'toggle', quick: true, default: true },
    { id: 'stateless', label: L('Stateless', 'Stateless'), type: 'toggle', quick: true, default: true },
    { id: 'deployment', label: L('Estratégia de deploy', 'Deployment strategy'), type: 'select', quick: true, default: 'rolling', choices: [choice('rolling', 'Rolling'), choice('blue-green', 'Blue/green'), choice('canary', 'Canary')] },
    { id: 'timeoutMs', label: L('Timeout para dependências', 'Dependency timeout'), type: 'number', min: 10, max: 60_000, step: 10, unit: 'ms', default: 1000 },
  ],
  websocket: [
    { id: 'transport', label: L('Transporte', 'Transport'), type: 'select', quick: true, default: 'websocket', choices: [choice('websocket', 'WebSocket'), choice('sse', 'Server-Sent Events'), choice('long-polling', 'Long polling')] },
    { id: 'fanout', label: L('Distribuição entre nós', 'Cross-node fan-out'), type: 'select', quick: true, default: 'pubsub', choices: [choice('pubsub', 'Pub/sub (Redis, NATS…)'), choice('sticky', 'Sticky + roteamento por usuário', 'Sticky + per-user routing'), choice('managed', 'Serviço gerenciado', 'Managed service')] },
    { id: 'presence', label: L('Presença online', 'Online presence'), type: 'toggle', default: false },
  ],
  worker: [
    { id: 'concurrency', label: L('Concorrência por instância', 'Concurrency per instance'), type: 'number', min: 1, max: 1000, step: 1, default: 8 },
    { id: 'retry', label: L('Política de retry', 'Retry policy'), type: 'select', quick: true, default: 'exponential', choices: [choice('none', 'Sem retry', 'No retry'), choice('fixed', 'Intervalo fixo', 'Fixed interval'), choice('exponential', 'Backoff exponencial + jitter', 'Exponential backoff + jitter')] },
    { id: 'idempotent', label: L('Processamento idempotente', 'Idempotent processing'), type: 'toggle', quick: true, default: true },
  ],
  scheduler: [
    { id: 'trigger', label: L('Disparo', 'Trigger'), type: 'select', quick: true, default: 'cron', choices: [choice('cron', 'Cron'), choice('interval', 'Intervalo fixo', 'Fixed interval'), choice('delayed', 'Job atrasado (delay)', 'Delayed job')] },
    { id: 'distributedLock', label: L('Lock distribuído (uma execução)', 'Distributed lock (single run)'), type: 'toggle', quick: true, default: true },
    { id: 'catchUp', label: L('Recupera execuções perdidas', 'Catch up missed runs'), type: 'toggle', default: false },
  ],
  cache: [
    { id: 'hitRatio', label: L('Taxa de acerto', 'Hit ratio'), help: L('Fração das leituras servidas pelo cache. Usada pelo chaos.', 'Share of reads served by the cache. Used by chaos.'), type: 'number', min: 0, max: 99, step: 1, unit: '%', default: 80 },
    { id: 'strategy', label: L('Estratégia', 'Strategy'), type: 'select', quick: true, default: 'cache-aside', choices: [choice('cache-aside', 'Cache-aside'), choice('read-through', 'Read-through'), choice('write-through', 'Write-through'), choice('write-behind', 'Write-behind')] },
    { id: 'eviction', label: L('Política de remoção', 'Eviction policy'), type: 'select', quick: true, default: 'lru', choices: [choice('lru', 'LRU'), choice('lfu', 'LFU'), choice('ttl', 'Só TTL', 'TTL only')] },
    { id: 'ttl', label: L('TTL', 'TTL'), type: 'number', min: 0, max: 604_800, step: 10, unit: 's', default: 300 },
    { id: 'topology', label: L('Topologia', 'Topology'), type: 'select', quick: true, default: 'replicated', choices: [choice('single', 'Nó único', 'Single node'), choice('replicated', 'Primário + réplicas', 'Primary + replicas'), choice('cluster', 'Cluster particionado', 'Sharded cluster')] },
  ],
  sql: [
    { id: 'replication', label: L('Replicação', 'Replication'), type: 'select', quick: true, default: 'primary-replica', choices: [choice('none', 'Nenhuma', 'None'), choice('primary-replica', 'Primário + réplicas de leitura', 'Primary + read replicas'), choice('multi-primary', 'Multi-primário', 'Multi-primary')] },
    { id: 'replicationMode', label: L('Modo de replicação', 'Replication mode'), type: 'select', quick: true, default: 'async', choices: [choice('async', 'Assíncrona', 'Asynchronous'), choice('semi-sync', 'Semi-síncrona', 'Semi-synchronous'), choice('sync', 'Síncrona', 'Synchronous')] },
    { id: 'isolation', label: L('Isolamento', 'Isolation level'), type: 'select', quick: true, default: 'read-committed', choices: [choice('read-committed', 'Read committed'), choice('repeatable-read', 'Repeatable read'), choice('serializable', 'Serializable')] },
    { id: 'sharding', label: L('Particionamento', 'Sharding'), type: 'select', quick: true, default: 'none', choices: [choice('none', 'Nenhum', 'None'), choice('hash', 'Por hash da chave', 'Hash of key'), choice('range', 'Por faixa', 'Range')] },
    { id: 'connectionPool', label: L('Pool de conexões (PgBouncer, RDS Proxy…)', 'Connection pooling (PgBouncer, RDS Proxy…)'), type: 'toggle', default: true },
  ],
  nosql: [
    { id: 'model', label: L('Modelo de dados', 'Data model'), type: 'select', quick: true, default: 'wide-column', choices: [choice('key-value', 'Chave-valor', 'Key-value'), choice('document', 'Documento', 'Document'), choice('wide-column', 'Wide-column'), choice('graph', 'Grafo', 'Graph')] },
    { id: 'consistency', label: L('Consistência', 'Consistency'), type: 'select', quick: true, default: 'eventual', choices: [choice('eventual', 'Eventual'), choice('session', 'Sessão / read-your-writes', 'Session / read-your-writes'), choice('quorum', 'Quórum', 'Quorum'), choice('strong', 'Forte', 'Strong')] },
    replicationFactor(3),
    { id: 'multiRegion', label: L('Multi-região', 'Multi-region'), type: 'toggle', quick: true, default: false },
    { id: 'partitionKey', label: L('Chave de partição', 'Partition key'), type: 'select', default: 'entity-id', choices: [choice('entity-id', 'ID da entidade', 'Entity id'), choice('user-id', 'ID do usuário', 'User id'), choice('tenant-id', 'Tenant'), choice('time-bucket', 'Faixa de tempo', 'Time bucket'), choice('composite', 'Composta', 'Composite')] },
  ],
  'object-storage': [
    { id: 'storageClass', label: L('Classe de armazenamento', 'Storage class'), type: 'select', quick: true, default: 'hot', choices: [choice('hot', 'Quente', 'Hot'), choice('cool', 'Fria', 'Cool / infrequent'), choice('archive', 'Arquivo', 'Archive')] },
    { id: 'replication', label: L('Redundância', 'Redundancy'), type: 'select', quick: true, default: 'zone', choices: [choice('local', 'Local (uma zona)', 'Local (one zone)'), choice('zone', 'Entre zonas', 'Across zones'), choice('geo', 'Geo-replicada', 'Geo-replicated')] },
    { id: 'versioning', label: L('Versionamento', 'Versioning'), type: 'toggle', quick: true, default: false },
    { id: 'presignedUrls', label: L('Upload/download direto (URLs assinadas)', 'Direct upload/download (signed URLs)'), type: 'toggle', quick: true, default: true },
  ],
  search: [
    { id: 'shards', label: L('Shards primários', 'Primary shards'), type: 'number', min: 1, max: 200, step: 1, default: 5 },
    replicationFactor(2),
    { id: 'indexing', label: L('Indexação', 'Indexing'), type: 'select', quick: true, default: 'async', choices: [choice('sync', 'Síncrona na escrita', 'Synchronous on write'), choice('async', 'Assíncrona (fila/CDC)', 'Asynchronous (queue/CDC)'), choice('batch', 'Em lote', 'Batch')] },
    { id: 'refreshSeconds', label: L('Intervalo de refresh', 'Refresh interval'), type: 'number', min: 0, max: 300, step: 1, unit: 's', default: 1 },
  ],
  queue: [
    { id: 'pattern', label: L('Padrão', 'Pattern'), type: 'select', quick: true, default: 'point-to-point', choices: [choice('point-to-point', 'Ponto a ponto (fila de trabalho)', 'Point-to-point (work queue)'), choice('pub-sub', 'Pub/sub (tópicos e assinaturas)', 'Pub/sub (topics and subscriptions)'), choice('request-reply', 'Request/reply')] },
    delivery,
    { id: 'ordering', label: L('Ordenação', 'Ordering'), type: 'select', quick: true, default: 'none', choices: [choice('none', 'Sem garantia', 'Not guaranteed'), choice('fifo', 'FIFO na fila', 'FIFO per queue'), choice('per-key', 'Por chave / sessão', 'Per key / session')] },
    deliveryMode,
    { id: 'deadLetter', label: L('Dead-letter queue', 'Dead-letter queue'), type: 'toggle', quick: true, default: true },
    { id: 'durable', label: L('Mensagens persistentes', 'Durable messages'), type: 'toggle', quick: true, default: true },
    { id: 'maxRetries', label: L('Tentativas antes da DLQ', 'Attempts before DLQ'), type: 'number', min: 1, max: 100, step: 1, default: 5 },
    { id: 'visibilityTimeout', label: L('Timeout de visibilidade / lock', 'Visibility / lock timeout'), type: 'number', min: 1, max: 43_200, step: 1, unit: 's', default: 30 },
  ],
  stream: [
    { id: 'partitions', label: L('Partições', 'Partitions'), type: 'number', min: 1, max: 10_000, step: 1, default: 12 },
    replicationFactor(3),
    delivery,
    { id: 'retention', label: L('Retenção', 'Retention'), type: 'select', quick: true, default: '7d', choices: [choice('1d', '1 dia', '1 day'), choice('7d', '7 dias', '7 days'), choice('30d', '30 dias', '30 days'), choice('forever', 'Indefinida (compactação/tiered)', 'Indefinite (compaction/tiered)')] },
    { id: 'partitionKey', label: L('Chave de partição', 'Partition key'), type: 'select', quick: true, default: 'entity-id', choices: [choice('entity-id', 'ID da entidade', 'Entity id'), choice('user-id', 'ID do usuário', 'User id'), choice('round-robin', 'Sem chave (round robin)', 'No key (round robin)')] },
    { id: 'consumerGroups', label: L('Grupos de consumidores', 'Consumer groups'), type: 'number', min: 1, max: 100, step: 1, default: 1 },
  ],
  external: [
    { id: 'timeoutMs', label: L('Timeout', 'Timeout'), type: 'number', min: 10, max: 60_000, step: 10, unit: 'ms', default: 2000 },
    { id: 'retries', label: L('Retries', 'Retries'), type: 'number', min: 0, max: 10, step: 1, default: 2 },
    { id: 'circuitBreaker', label: L('Circuit breaker com fallback', 'Circuit breaker with fallback'), help: L('Quem chama degrada em vez de falhar quando o provedor cai. Usado pelo chaos.', 'Callers degrade instead of failing when the provider is down. Used by chaos.'), type: 'toggle', quick: true, default: false },
    { id: 'idempotencyKeys', label: L('Chaves de idempotência', 'Idempotency keys'), type: 'toggle', quick: true, default: false },
  ],
  auth: [
    { id: 'protocol', label: L('Protocolo', 'Protocol'), type: 'select', quick: true, default: 'oidc', choices: [choice('oidc', 'OpenID Connect'), choice('oauth2', 'OAuth 2.0'), choice('saml', 'SAML 2.0')] },
    { id: 'tokenValidation', label: L('Validação de token', 'Token validation'), help: L('Com JWT validado localmente, a queda do IdP só afeta novos logins. Usado pelo chaos.', 'With locally validated JWTs an IdP outage only affects new logins. Used by chaos.'), type: 'select', quick: true, default: 'local-jwt', choices: [choice('local-jwt', 'JWT validado localmente (JWKS)', 'JWT validated locally (JWKS)'), choice('introspection', 'Introspecção a cada requisição', 'Introspection on every request')] },
    { id: 'mfa', label: L('MFA', 'MFA'), type: 'toggle', quick: true, default: false },
    { id: 'tokenTtl', label: L('Validade do access token', 'Access token lifetime'), type: 'number', min: 60, max: 86_400, step: 60, unit: 's', default: 900 },
  ],
  workflow: [
    { id: 'style', label: L('Estilo', 'Style'), type: 'select', quick: true, default: 'orchestration', choices: [choice('orchestration', 'Orquestração', 'Orchestration'), choice('choreography', 'Coreografia (eventos)', 'Choreography (events)'), choice('saga', 'Saga com compensações', 'Saga with compensations')] },
    { id: 'retry', label: L('Retry de atividades', 'Activity retries'), type: 'select', quick: true, default: 'exponential', choices: [choice('none', 'Sem retry', 'No retry'), choice('fixed', 'Intervalo fixo', 'Fixed interval'), choice('exponential', 'Backoff exponencial', 'Exponential backoff')] },
    { id: 'timeoutMinutes', label: L('Timeout do workflow', 'Workflow timeout'), type: 'number', min: 1, max: 525_600, step: 1, unit: 'min', default: 60 },
  ],
  'stream-processor': [
    { id: 'windowing', label: L('Janelas', 'Windowing'), type: 'select', quick: true, default: 'tumbling', choices: [choice('none', 'Sem janela (por evento)', 'None (per event)'), choice('tumbling', 'Tumbling'), choice('sliding', 'Sliding'), choice('session', 'Sessão', 'Session')] },
    delivery,
    { id: 'stateBackend', label: L('Estado', 'State backend'), type: 'select', quick: true, default: 'rocksdb', choices: [choice('memory', 'Memória', 'In memory'), choice('rocksdb', 'RocksDB + checkpoints'), choice('external', 'Store externo', 'External store')] },
    { id: 'checkpointSeconds', label: L('Intervalo de checkpoint', 'Checkpoint interval'), type: 'number', min: 1, max: 3600, step: 1, unit: 's', default: 60 },
  ],
  'data-warehouse': [
    { id: 'ingestion', label: L('Ingestão', 'Ingestion'), type: 'select', quick: true, default: 'batch', choices: [choice('batch', 'Lote (ETL/ELT)', 'Batch (ETL/ELT)'), choice('micro-batch', 'Micro-lote', 'Micro-batch'), choice('streaming', 'Streaming / CDC')] },
    { id: 'freshness', label: L('Atualização dos dados', 'Data freshness'), type: 'select', quick: true, default: 'hourly', choices: [choice('realtime', 'Segundos', 'Seconds'), choice('hourly', 'Horária', 'Hourly'), choice('daily', 'Diária', 'Daily')] },
    { id: 'partitioning', label: L('Particionamento por data', 'Date partitioning'), type: 'toggle', default: true },
  ],
  'vector-db': [
    { id: 'index', label: L('Índice', 'Index'), type: 'select', quick: true, default: 'hnsw', choices: [choice('hnsw', 'HNSW'), choice('ivf', 'IVF'), choice('flat', 'Flat (exato)', 'Flat (exact)')] },
    { id: 'metric', label: L('Métrica', 'Distance metric'), type: 'select', quick: true, default: 'cosine', choices: [choice('cosine', 'Cosseno', 'Cosine'), choice('dot', 'Produto interno', 'Dot product'), choice('euclidean', 'Euclidiana', 'Euclidean')] },
    { id: 'dimensions', label: L('Dimensões', 'Dimensions'), type: 'number', min: 2, max: 8192, step: 1, default: 1536 },
    { id: 'hybrid', label: L('Busca híbrida (vetor + texto)', 'Hybrid search (vector + keyword)'), type: 'toggle', quick: true, default: false },
  ],
  observability: [
    { id: 'signals', label: L('Sinais', 'Signals'), type: 'select', quick: true, default: 'all', choices: [choice('metrics', 'Métricas', 'Metrics'), choice('logs', 'Logs'), choice('traces', 'Traces'), choice('all', 'Métricas + logs + traces', 'Metrics + logs + traces')] },
    { id: 'alerting', label: L('Alertas / SLOs', 'Alerting / SLOs'), type: 'toggle', quick: true, default: true },
    { id: 'sampling', label: L('Amostragem de traces', 'Trace sampling'), type: 'number', min: 0, max: 100, step: 1, unit: '%', default: 10 },
  ],
};

const tech = (kind: ComponentKind, id: string, label: string, pt: string, en: string, extra: Partial<Technology> = {}): Technology => ({ id, kind, label, description: L(pt, en), ...extra });
const unit = (pt: string, en: string) => L(pt, en);

export const technologies: Technology[] = [
  // Clients
  tech('client', 'web-browser', 'Web browser', 'SPA ou páginas renderizadas no servidor, via HTTPS.', 'SPA or server-rendered pages over HTTPS.', { defaults: { type: 'web' } }),
  tech('client', 'mobile-app', 'Mobile app', 'iOS/Android: rede instável, push notifications e versões antigas em produção.', 'iOS/Android: flaky networks, push notifications and old versions in the wild.', { defaults: { type: 'mobile' } }),
  tech('client', 'iot-device', 'IoT device', 'Dispositivos com pouca banda; costumam usar MQTT e enviar telemetria em rajadas.', 'Low-bandwidth devices; usually MQTT and bursty telemetry.', { defaults: { type: 'iot' }, match: /\biot\b|device|sensor/i }),
  tech('client', 'partner-service', 'Partner / upstream service', 'Outro sistema chamando sua API (B2B, webhooks).', 'Another system calling your API (B2B, webhooks).', { defaults: { type: 'service' } }),

  // DNS
  tech('dns', 'route53', 'Amazon Route 53', 'DNS gerenciado com roteamento por latência, geo, ponderado e failover com health checks.', 'Managed DNS with latency, geo, weighted and failover routing plus health checks.', { managed: true, match: /route ?53/i }),
  tech('dns', 'cloudflare-dns', 'Cloudflare DNS', 'DNS anycast global com resolução muito rápida e proteção DDoS.', 'Global anycast DNS with very fast resolution and DDoS protection.', { managed: true }),
  tech('dns', 'azure-dns', 'Azure DNS', 'Hospedagem de zonas DNS no Azure; roteamento avançado fica no Traffic Manager.', 'DNS zone hosting on Azure; advanced routing lives in Traffic Manager.', { managed: true, defaults: { routing: 'simple' } }),
  tech('dns', 'azure-traffic-manager', 'Azure Traffic Manager', 'Balanceamento global baseado em DNS (prioridade, desempenho, geográfico).', 'DNS-based global load balancing (priority, performance, geographic).', { managed: true, defaults: { routing: 'latency' }, match: /traffic manager/i }),
  tech('dns', 'cloud-dns', 'Google Cloud DNS', 'DNS gerenciado do GCP com 100% de SLA.', 'GCP managed DNS with a 100% SLA.', { managed: true }),

  // CDN
  tech('cdn', 'cloudfront', 'Amazon CloudFront', 'CDN da AWS integrada a S3 e Lambda@Edge.', 'AWS CDN integrated with S3 and Lambda@Edge.', { managed: true, match: /cloudfront/i }),
  tech('cdn', 'cloudflare', 'Cloudflare', 'CDN anycast com WAF, Workers (edge compute) e cache em camadas.', 'Anycast CDN with WAF, Workers (edge compute) and tiered caching.', { managed: true, defaults: { originShield: true } }),
  tech('cdn', 'akamai', 'Akamai', 'Maior rede de borda; forte em mídia e grandes eventos.', 'Largest edge network; strong at media and large events.', { managed: true, defaults: { content: 'media', hitRatio: 85 } }),
  tech('cdn', 'azure-front-door', 'Azure Front Door', 'Entrada global L7 com CDN, WAF e roteamento por latência para origens em várias regiões.', 'Global L7 entry point with CDN, WAF and latency routing to multi-region origins.', { managed: true, match: /front ?door/i }),
  tech('cdn', 'fastly', 'Fastly', 'CDN programável (VCL/Compute) com purge quase instantâneo.', 'Programmable CDN (VCL/Compute) with near-instant purge.', { managed: true }),

  // Load balancers
  tech('load-balancer', 'nginx', 'NGINX', 'Proxy reverso L7 auto-gerenciado; também faz cache e TLS.', 'Self-managed L7 reverse proxy; also caches and terminates TLS.', { match: /nginx/i }),
  tech('load-balancer', 'haproxy', 'HAProxy', 'Balanceador L4/L7 de altíssimo desempenho, auto-gerenciado.', 'Very high-performance self-managed L4/L7 balancer.', { capacityPerReplica: 300_000, match: /haproxy/i }),
  tech('load-balancer', 'envoy', 'Envoy', 'Proxy L7 moderno com retries, circuit breaking e observabilidade; base de service meshes.', 'Modern L7 proxy with retries, circuit breaking and observability; powers service meshes.', { match: /envoy/i }),
  tech('load-balancer', 'aws-alb', 'AWS Application Load Balancer', 'L7 gerenciado com roteamento por caminho/host; escala sozinho.', 'Managed L7 with path/host routing; scales on its own.', { managed: true, latencyMs: 2, match: /\balb\b/i }),
  tech('load-balancer', 'aws-nlb', 'AWS Network Load Balancer', 'L4 gerenciado para milhões de req/s com latência ultrabaixa e IP estático.', 'Managed L4 for millions of req/s with ultra-low latency and static IPs.', { managed: true, capacityPerReplica: 1_000_000, latencyMs: 0.5, defaults: { layer: 'l4', algorithm: 'consistent-hash' }, match: /\bnlb\b/i }),
  tech('load-balancer', 'azure-lb', 'Azure Load Balancer', 'L4 gerenciado do Azure (TCP/UDP) com alta disponibilidade entre zonas.', 'Azure managed L4 (TCP/UDP) with zone-redundant high availability.', { managed: true, capacityPerReplica: 1_000_000, latencyMs: 0.5, defaults: { layer: 'l4', algorithm: 'ip-hash' } }),
  tech('load-balancer', 'azure-app-gateway', 'Azure Application Gateway', 'L7 regional do Azure com WAF e afinidade por cookie.', 'Azure regional L7 with WAF and cookie affinity.', { managed: true, latencyMs: 3, match: /application gateway|app gateway/i }),
  tech('load-balancer', 'gcp-lb', 'Google Cloud Load Balancing', 'Balanceador global anycast (L4/L7) com IP único para todas as regiões.', 'Global anycast balancer (L4/L7) with one IP for every region.', { managed: true }),

  // API gateways
  tech('api-gateway', 'kong', 'Kong Gateway', 'Gateway open-source sobre NGINX com plugins (auth, rate limit, transformação).', 'Open-source gateway on NGINX with plugins (auth, rate limits, transforms).', { match: /kong/i }),
  tech('api-gateway', 'aws-api-gateway', 'Amazon API Gateway', 'Gerenciado e serverless; limite padrão de ~10k req/s por região e integração com Lambda.', 'Managed and serverless; ~10k req/s default regional limit and Lambda integration.', { managed: true, capacityPerReplica: 10_000, latencyMs: 10, defaults: { auth: 'jwt' } }),
  tech('api-gateway', 'azure-apim', 'Azure API Management', 'Gateway gerenciado com portal do desenvolvedor, políticas e versionamento de APIs.', 'Managed gateway with developer portal, policies and API versioning.', { managed: true, latencyMs: 6, unit: unit('unidades', 'units'), match: /api management|\bapim\b/i }),
  tech('api-gateway', 'apigee', 'Apigee', 'Gestão de APIs do Google com monetização e analytics.', 'Google API management with monetisation and analytics.', { managed: true, latencyMs: 8 }),
  tech('api-gateway', 'envoy-gateway', 'Envoy Gateway / Istio ingress', 'Gateway baseado em Envoy, nativo de Kubernetes.', 'Envoy-based, Kubernetes-native gateway.', { latencyMs: 2 }),

  // Rate limiters
  tech('rate-limiter', 'redis-limiter', 'Redis (Lua / INCR)', 'Contadores atômicos compartilhados entre todos os gateways; adiciona um round-trip ao Redis.', 'Atomic counters shared by every gateway; adds a Redis round-trip.', { latencyMs: 1.5 }),
  tech('rate-limiter', 'envoy-ratelimit', 'Envoy rate limit service', 'Serviço gRPC central consultado pelos proxies Envoy (backed by Redis).', 'Central gRPC service queried by Envoy proxies (backed by Redis).', { latencyMs: 2 }),
  tech('rate-limiter', 'nginx-limit-req', 'NGINX limit_req', 'Limite local por instância (leaky bucket): sem coordenação entre nós.', 'Local per-instance limit (leaky bucket): no cross-node coordination.', { latencyMs: 0.2, defaults: { algorithm: 'leaky-bucket', scope: 'per-ip' } }),
  tech('rate-limiter', 'cloudflare-rl', 'Cloudflare Rate Limiting', 'Limites aplicados na borda, antes do tráfego chegar à origem.', 'Limits enforced at the edge before traffic reaches the origin.', { managed: true, latencyMs: 0.5, defaults: { scope: 'per-ip' } }),

  // Compute
  tech('service', 'kubernetes', 'Kubernetes Deployment', 'Containers com HPA, rolling updates e service discovery.', 'Containers with HPA, rolling updates and service discovery.', { match: /k8s|kubernetes/i }),
  tech('service', 'aws-lambda', 'AWS Lambda', 'Serverless por requisição: escala a zero, mas tem cold start e limite de concorrência por conta.', 'Per-request serverless: scales to zero but has cold starts and per-account concurrency limits.', { managed: true, latencyMs: 25, capacityPerReplica: 1_000, unit: unit('concorrência ×1000', 'concurrency ×1000'), match: /lambda/i }),
  tech('service', 'azure-functions', 'Azure Functions', 'Serverless do Azure com triggers (HTTP, filas, timers) e Durable Functions.', 'Azure serverless with triggers (HTTP, queues, timers) and Durable Functions.', { managed: true, latencyMs: 25, capacityPerReplica: 1_000, match: /azure functions?/i }),
  tech('service', 'azure-container-apps', 'Azure Container Apps', 'Containers serverless com KEDA (escala por eventos) e Dapr.', 'Serverless containers with KEDA (event-driven scale) and Dapr.', { managed: true, latencyMs: 18, match: /container apps/i }),
  tech('service', 'azure-app-service', 'Azure App Service', 'PaaS para apps web com slots de deploy e autoscale.', 'PaaS for web apps with deployment slots and autoscale.', { managed: true, latencyMs: 18, match: /app service/i }),
  tech('service', 'cloud-run', 'Google Cloud Run', 'Containers serverless com concorrência por instância e escala a zero.', 'Serverless containers with per-instance concurrency and scale to zero.', { managed: true, latencyMs: 20, match: /cloud run/i }),
  tech('service', 'ecs-fargate', 'AWS ECS Fargate', 'Containers gerenciados sem servidores para administrar.', 'Managed containers without servers to manage.', { managed: true, match: /fargate|\becs\b/i }),
  tech('service', 'vm', 'Virtual machines', 'VMs atrás de um auto scaling group; mais controle e mais operação.', 'VMs behind an auto scaling group; more control, more operations.', { capacityPerReplica: 8_000, defaults: { autoscaling: false }, match: /\bvms?\b|ec2/i }),

  // Real-time
  tech('websocket', 'socketio', 'Node.js + Socket.IO', 'Servidor próprio; precisa de adapter Redis para entregar entre nós.', 'Self-hosted; needs a Redis adapter to deliver across nodes.', { defaults: { fanout: 'pubsub' }, match: /socket\.?io/i }),
  tech('websocket', 'azure-web-pubsub', 'Azure Web PubSub', 'WebSockets gerenciados: o serviço segura as conexões e o backend só publica.', 'Managed WebSockets: the service holds connections and the backend only publishes.', { managed: true, capacityPerReplica: 100_000, latencyMs: 8, unit: unit('unidades', 'units'), defaults: { fanout: 'managed' }, match: /web ?pubsub/i }),
  tech('websocket', 'azure-signalr', 'Azure SignalR Service', 'SignalR gerenciado com fallback automático para SSE/long polling.', 'Managed SignalR with automatic fallback to SSE/long polling.', { managed: true, capacityPerReplica: 100_000, latencyMs: 8, unit: unit('unidades', 'units'), defaults: { fanout: 'managed' }, match: /signalr/i }),
  tech('websocket', 'aws-apigw-ws', 'API Gateway WebSocket APIs', 'Conexões gerenciadas pela AWS; mensagens viram invocações (ex.: Lambda).', 'AWS-managed connections; messages become invocations (e.g. Lambda).', { managed: true, latencyMs: 15, defaults: { fanout: 'managed' } }),
  tech('websocket', 'phoenix', 'Elixir Phoenix Channels', 'BEAM aguenta milhões de conexões por nó, com PubSub distribuído nativo.', 'The BEAM holds millions of connections per node with built-in distributed PubSub.', { capacityPerReplica: 60_000, latencyMs: 3, match: /phoenix|elixir/i }),
  tech('websocket', 'ably', 'Ably / Pusher', 'Pub/sub em tempo real como serviço, com presença e histórico.', 'Real-time pub/sub as a service with presence and history.', { managed: true, latencyMs: 25, defaults: { fanout: 'managed', presence: true } }),

  // Workers
  tech('worker', 'k8s-worker', 'Kubernetes workers (KEDA)', 'Consumidores em containers que escalam pelo tamanho da fila.', 'Containerised consumers that scale on queue depth.', { match: /keda/i }),
  tech('worker', 'lambda-worker', 'AWS Lambda (event source)', 'Lambda acionada por SQS/Kinesis; escala por lote, limite de 15 min por execução.', 'Lambda triggered by SQS/Kinesis; scales per batch, 15-minute execution limit.', { managed: true, capacityPerReplica: 1_000 }),
  tech('worker', 'azure-functions-worker', 'Azure Functions (queue trigger)', 'Functions acionadas por Service Bus/Storage Queue/Event Hubs.', 'Functions triggered by Service Bus/Storage Queue/Event Hubs.', { managed: true, capacityPerReplica: 1_000 }),
  tech('worker', 'celery', 'Celery', 'Fila de tarefas em Python (broker RabbitMQ ou Redis).', 'Python task queue (RabbitMQ or Redis broker).', { capacityPerReplica: 800, match: /celery/i }),
  tech('worker', 'sidekiq', 'Sidekiq', 'Jobs em Ruby sobre Redis, com retries automáticos.', 'Ruby jobs on Redis with automatic retries.', { capacityPerReplica: 1_500, match: /sidekiq/i }),
  tech('worker', 'spark-batch', 'Apache Spark (batch)', 'Processamento distribuído em lote para grandes volumes.', 'Distributed batch processing for large volumes.', { capacityPerReplica: 20_000, match: /spark/i }),

  // Schedulers
  tech('scheduler', 'k8s-cronjob', 'Kubernetes CronJob', 'Cron nativo do cluster; concurrencyPolicy evita execuções sobrepostas.', 'Cluster-native cron; concurrencyPolicy prevents overlapping runs.', { match: /cronjob/i }),
  tech('scheduler', 'eventbridge-scheduler', 'Amazon EventBridge Scheduler', 'Milhões de agendamentos únicos ou recorrentes, gerenciados.', 'Millions of one-off or recurring managed schedules.', { managed: true, match: /eventbridge/i }),
  tech('scheduler', 'azure-timer', 'Azure Functions timer trigger', 'Cron em Functions; uma única instância dispara por vez.', 'Cron on Functions; a single instance fires at a time.', { managed: true }),
  tech('scheduler', 'quartz', 'Quartz Scheduler', 'Agendador Java com cluster via banco de dados.', 'Java scheduler clustered through a database.', { match: /quartz/i }),
  tech('scheduler', 'airflow', 'Apache Airflow', 'DAGs de pipelines de dados com dependências e backfill.', 'Data pipeline DAGs with dependencies and backfill.', { defaults: { catchUp: true }, match: /airflow/i }),

  // Caches
  tech('cache', 'redis', 'Redis', 'Estruturas ricas (hashes, sorted sets, streams), replicação e Redis Cluster.', 'Rich data structures (hashes, sorted sets, streams), replication and Redis Cluster.', { match: /redis(?! stream)/i }),
  tech('cache', 'valkey', 'Valkey', 'Fork open-source do Redis, compatível com o protocolo.', 'Open-source Redis fork, protocol compatible.', { match: /valkey/i }),
  tech('cache', 'memcached', 'Memcached', 'Multi-thread e simples: só chave-valor, sem persistência nem replicação.', 'Multi-threaded and simple: key-value only, no persistence or replication.', { capacityPerReplica: 200_000, defaults: { topology: 'cluster', eviction: 'lru' }, match: /memcache/i }),
  tech('cache', 'azure-cache-redis', 'Azure Cache for Redis', 'Redis gerenciado com geo-replicação e clustering no tier Premium/Enterprise.', 'Managed Redis with geo-replication and clustering in Premium/Enterprise.', { managed: true, capacityPerReplica: 80_000, match: /azure cache/i }),
  tech('cache', 'elasticache', 'Amazon ElastiCache', 'Redis/Valkey/Memcached gerenciado com failover automático.', 'Managed Redis/Valkey/Memcached with automatic failover.', { managed: true, match: /elasticache/i }),
  tech('cache', 'hazelcast', 'Hazelcast', 'Data grid em memória com near-cache e computação distribuída.', 'In-memory data grid with near cache and distributed compute.', { capacityPerReplica: 60_000, defaults: { topology: 'cluster' }, match: /hazelcast/i }),
  tech('cache', 'in-process', 'In-process (Caffeine / Guava)', 'Cache dentro do processo: zero rede, mas cada réplica tem sua cópia (inconsistência).', 'Cache inside the process: no network hop, but every replica has its own copy (inconsistency).', { capacityPerReplica: 1_000_000, latencyMs: 0.05, defaults: { topology: 'single', hitRatio: 60 }, match: /caffeine|guava|in.?process|local cache/i }),

  // Relational
  tech('sql', 'postgresql', 'PostgreSQL', 'Relacional open-source com MVCC, JSONB e extensões (PostGIS, pgvector).', 'Open-source relational with MVCC, JSONB and extensions (PostGIS, pgvector).', { match: /postgres|\bpg\b/i }),
  tech('sql', 'mysql', 'MySQL', 'Relacional popular; replicação assíncrona binlog e InnoDB.', 'Popular relational; async binlog replication and InnoDB.', { capacityPerReplica: 12_000, match: /mysql|mariadb/i }),
  tech('sql', 'sql-server', 'SQL Server', 'Relacional da Microsoft com Always On availability groups.', 'Microsoft relational with Always On availability groups.', { match: /sql server|mssql/i }),
  tech('sql', 'aurora', 'Amazon Aurora', 'Storage distribuído em 6 cópias por 3 zonas, até 15 réplicas de leitura com lag baixo.', 'Distributed storage with 6 copies across 3 zones, up to 15 low-lag read replicas.', { managed: true, capacityPerReplica: 25_000, latencyMs: 6, match: /aurora/i }),
  tech('sql', 'azure-sql', 'Azure SQL Database', 'SQL Server gerenciado com réplicas de leitura e geo-replicação ativa.', 'Managed SQL Server with read replicas and active geo-replication.', { managed: true, match: /azure sql/i }),
  tech('sql', 'spanner', 'Google Cloud Spanner', 'SQL distribuído globalmente com consistência externa (TrueTime).', 'Globally distributed SQL with external consistency (TrueTime).', { managed: true, capacityPerReplica: 10_000, latencyMs: 10, unit: unit('nós', 'nodes'), defaults: { replication: 'multi-primary', replicationMode: 'sync', isolation: 'serializable', sharding: 'range' }, match: /spanner/i }),
  tech('sql', 'cockroachdb', 'CockroachDB', 'SQL distribuído compatível com Postgres; consenso Raft por faixa.', 'Postgres-compatible distributed SQL; Raft consensus per range.', { capacityPerReplica: 8_000, latencyMs: 10, unit: unit('nós', 'nodes'), defaults: { replication: 'multi-primary', replicationMode: 'sync', isolation: 'serializable', sharding: 'range' }, match: /cockroach/i }),

  // NoSQL
  tech('nosql', 'cassandra', 'Apache Cassandra', 'Wide-column sem mestre, escrita barata e consistência ajustável por consulta.', 'Masterless wide-column, cheap writes and per-query tunable consistency.', { defaults: { model: 'wide-column', consistency: 'quorum' }, match: /cassandra/i }),
  tech('nosql', 'scylladb', 'ScyllaDB', 'Compatível com Cassandra em C++: muito mais throughput por nó.', 'Cassandra-compatible in C++: far more throughput per node.', { capacityPerReplica: 100_000, latencyMs: 2, defaults: { model: 'wide-column', consistency: 'quorum' }, match: /scylla/i }),
  tech('nosql', 'dynamodb', 'Amazon DynamoDB', 'Chave-valor gerenciado, latência de um dígito em ms; partições quentes limitam a ~3k leituras/s.', 'Managed key-value, single-digit ms latency; hot partitions cap at ~3k reads/s.', { managed: true, defaults: { model: 'key-value' }, match: /dynamo/i }),
  tech('nosql', 'mongodb', 'MongoDB', 'Documentos JSON com replica sets e sharding por chave.', 'JSON documents with replica sets and key-based sharding.', { capacityPerReplica: 25_000, defaults: { model: 'document', consistency: 'session' }, match: /mongo/i }),
  tech('nosql', 'cosmosdb', 'Azure Cosmos DB', 'Multi-modelo, multi-região, com 5 níveis de consistência e capacidade em RU/s.', 'Multi-model, multi-region, with 5 consistency levels and RU/s capacity.', { managed: true, unit: unit('partições físicas', 'physical partitions'), defaults: { model: 'document', consistency: 'session', multiRegion: true }, match: /cosmos/i }),
  tech('nosql', 'bigtable', 'Google Bigtable', 'Wide-column para grandes volumes e séries temporais (base do HBase).', 'Wide-column for huge volumes and time series (HBase lineage).', { managed: true, capacityPerReplica: 10_000, latencyMs: 6, unit: unit('nós', 'nodes'), defaults: { model: 'wide-column', consistency: 'strong' }, match: /bigtable|hbase/i }),
  tech('nosql', 'neo4j', 'Neo4j', 'Banco de grafos para relacionamentos (recomendações, fraude).', 'Graph database for relationships (recommendations, fraud).', { capacityPerReplica: 8_000, latencyMs: 6, defaults: { model: 'graph', consistency: 'strong' }, match: /neo4j|graph db/i }),

  // Object storage
  tech('object-storage', 's3', 'Amazon S3', '11 noves de durabilidade; ~5,5k GET/s por prefixo, URLs pré-assinadas.', '11 nines of durability; ~5.5k GET/s per prefix, presigned URLs.', { managed: true, match: /\bs3\b/i }),
  tech('object-storage', 'azure-blob', 'Azure Blob Storage', 'Blobs com tiers quente/frio/arquivo e redundância LRS/ZRS/GRS.', 'Blobs with hot/cool/archive tiers and LRS/ZRS/GRS redundancy.', { managed: true, match: /azure blob/i }),
  tech('object-storage', 'gcs', 'Google Cloud Storage', 'Objetos com buckets multi-região e consistência forte.', 'Objects with multi-region buckets and strong consistency.', { managed: true, match: /\bgcs\b|cloud storage/i }),
  tech('object-storage', 'minio', 'MinIO', 'Compatível com S3 e auto-hospedado (on-prem ou Kubernetes).', 'S3-compatible and self-hosted (on-prem or Kubernetes).', { latencyMs: 10, match: /minio/i }),

  // Search
  tech('search', 'elasticsearch', 'Elasticsearch', 'Índice invertido distribuído; quase tempo real (refresh de ~1 s).', 'Distributed inverted index; near real time (~1 s refresh).', { match: /elastic/i }),
  tech('search', 'opensearch', 'OpenSearch', 'Fork open-source do Elasticsearch, gerenciado na AWS.', 'Open-source Elasticsearch fork, managed on AWS.', { match: /opensearch/i }),
  tech('search', 'azure-ai-search', 'Azure AI Search', 'Busca gerenciada com ranking semântico e busca vetorial.', 'Managed search with semantic ranking and vector search.', { managed: true, unit: unit('réplicas × partições', 'replicas × partitions'), match: /azure (ai|cognitive) search/i }),
  tech('search', 'solr', 'Apache Solr', 'Busca sobre Lucene com SolrCloud.', 'Lucene-based search with SolrCloud.', { match: /solr/i }),
  tech('search', 'meilisearch', 'Meilisearch / Typesense', 'Busca instantânea com tolerância a erros, ideal para autocomplete.', 'Instant, typo-tolerant search, ideal for autocomplete.', { capacityPerReplica: 5_000, latencyMs: 5, defaults: { indexing: 'async' }, match: /meili|typesense/i }),

  // Queues
  tech('queue', 'rabbitmq', 'RabbitMQ', 'Broker AMQP com push e acks; exchanges direct/topic/fanout roteiam para filas; quorum queues para HA. FIFO por fila com um consumidor.', 'AMQP broker with push and acks; direct/topic/fanout exchanges route to queues; quorum queues for HA. FIFO per queue with a single consumer.', { capacityPerReplica: 40_000, latencyMs: 2, unit: unit('nós do cluster', 'cluster nodes'), defaults: { consumption: 'push', ordering: 'fifo', delivery: 'at-least-once' }, match: /rabbit/i }),
  tech('queue', 'sqs', 'Amazon SQS (Standard)', 'Gerenciado e praticamente ilimitado; consumo por pull (long polling), entrega pelo menos uma vez e ordem best-effort.', 'Managed and practically unlimited; pull consumption (long polling), at-least-once delivery and best-effort ordering.', { managed: true, capacityPerReplica: 100_000, latencyMs: 10, defaults: { consumption: 'pull', ordering: 'none', delivery: 'at-least-once' }, match: /\bsqs\b(?!.*fifo)/i }),
  tech('queue', 'sqs-fifo', 'Amazon SQS FIFO', 'Ordem por message group e deduplicação de 5 min; ~300 msg/s por API (3.000 com lotes).', 'Order per message group and 5-minute deduplication; ~300 msg/s per API (3,000 batched).', { managed: true, capacityPerReplica: 3_000, latencyMs: 12, defaults: { consumption: 'pull', ordering: 'per-key', delivery: 'exactly-once' }, match: /sqs.*fifo/i }),
  tech('queue', 'azure-service-bus', 'Azure Service Bus', 'Broker corporativo gerenciado: filas e tópicos com assinaturas, sessões (FIFO por chave), detecção de duplicatas, DLQ nativa e transações.', 'Managed enterprise broker: queues and topics with subscriptions, sessions (FIFO per key), duplicate detection, native DLQ and transactions.', { managed: true, capacityPerReplica: 8_000, latencyMs: 8, unit: unit('messaging units', 'messaging units'), defaults: { consumption: 'pull', ordering: 'per-key', delivery: 'at-least-once', deadLetter: true, pattern: 'pub-sub' }, match: /service ?bus/i }),
  tech('queue', 'azure-storage-queue', 'Azure Storage Queue', 'Fila simples e barata: mensagens de até 64 KB e ~2.000 msg/s por fila, sem ordenação nem tópicos.', 'Simple, cheap queue: messages up to 64 KB and ~2,000 msg/s per queue, no ordering or topics.', { managed: true, capacityPerReplica: 2_000, latencyMs: 10, defaults: { consumption: 'pull', ordering: 'none', deadLetter: false }, match: /storage queue/i }),
  tech('queue', 'gcp-pubsub', 'Google Cloud Pub/Sub', 'Pub/sub global gerenciado: push ou pull, ordering keys e entrega exatamente uma vez opcional.', 'Managed global pub/sub: push or pull, ordering keys and optional exactly-once delivery.', { managed: true, capacityPerReplica: 100_000, latencyMs: 20, defaults: { pattern: 'pub-sub', consumption: 'pull', ordering: 'per-key' }, match: /pub\/?sub/i }),
  tech('queue', 'activemq', 'ActiveMQ Artemis', 'Broker JMS com filas e tópicos, muito usado em Java corporativo.', 'JMS broker with queues and topics, common in enterprise Java.', { capacityPerReplica: 30_000, latencyMs: 2, defaults: { consumption: 'push', ordering: 'fifo' }, match: /activemq|artemis|\bjms\b/i }),
  tech('queue', 'nats', 'NATS JetStream', 'Mensageria leve com latência sub-milissegundo; JetStream adiciona persistência e replay.', 'Lightweight messaging with sub-millisecond latency; JetStream adds persistence and replay.', { capacityPerReplica: 150_000, latencyMs: 0.5, defaults: { pattern: 'pub-sub', consumption: 'push' }, match: /\bnats\b|jetstream/i }),

  // Streams
  tech('stream', 'kafka', 'Apache Kafka', 'Log particionado e replicado: ordem por partição, consumer groups, replay pela retenção e exactly-once com transações.', 'Partitioned, replicated log: per-partition order, consumer groups, replay through retention and exactly-once with transactions.', { capacityPerReplica: 200_000, latencyMs: 5, unit: unit('brokers', 'brokers'), match: /kafka/i }),
  tech('stream', 'kinesis', 'Amazon Kinesis Data Streams', 'Cada shard aceita 1 MB/s ou 1.000 registros/s de escrita; retenção de 24 h a 365 dias.', 'Each shard takes 1 MB/s or 1,000 records/s of writes; 24 h to 365 days retention.', { managed: true, capacityPerReplica: 1_000, latencyMs: 70, unit: unit('shards', 'shards'), defaults: { retention: '1d' }, match: /kinesis/i }),
  tech('stream', 'event-hubs', 'Azure Event Hubs', 'Ingestão de eventos gerenciada e compatível com o protocolo Kafka; capacidade por throughput units (1.000 eventos/s cada).', 'Managed event ingestion, Kafka-protocol compatible; capacity by throughput units (1,000 events/s each).', { managed: true, capacityPerReplica: 1_000, latencyMs: 20, unit: unit('throughput units', 'throughput units'), defaults: { retention: '1d', partitions: 4 }, match: /event ?hubs?/i }),
  tech('stream', 'pulsar', 'Apache Pulsar', 'Separa computação (brokers) de armazenamento (BookKeeper); filas e streams no mesmo sistema, geo-replicação nativa.', 'Separates compute (brokers) from storage (BookKeeper); queues and streams in one system, native geo-replication.', { capacityPerReplica: 150_000, latencyMs: 5, defaults: { retention: 'forever' }, match: /pulsar/i }),
  tech('stream', 'redis-streams', 'Redis Streams', 'Log em memória com consumer groups; durabilidade limitada à persistência do Redis.', 'In-memory log with consumer groups; durability limited to Redis persistence.', { capacityPerReplica: 100_000, latencyMs: 1, defaults: { retention: '1d', partitions: 1 }, match: /redis stream/i }),
  tech('stream', 'redpanda', 'Redpanda', 'Compatível com Kafka em C++, sem ZooKeeper/JVM, menor latência de cauda.', 'Kafka-compatible in C++, no ZooKeeper/JVM, lower tail latency.', { capacityPerReplica: 300_000, latencyMs: 2, unit: unit('brokers', 'brokers'), match: /redpanda/i }),

  // External
  tech('external', 'stripe', 'Stripe', 'Pagamentos; aceita Idempotency-Key e notifica por webhooks.', 'Payments; accepts Idempotency-Key and notifies through webhooks.', { latencyMs: 300, defaults: { idempotencyKeys: true }, match: /stripe/i }),
  tech('external', 'adyen', 'Adyen / PSP', 'Processador de pagamentos com várias formas de pagamento por país.', 'Payment processor with many local payment methods.', { latencyMs: 400, match: /adyen|\bpsp\b/i }),
  tech('external', 'twilio', 'Twilio', 'SMS e voz; entrega assíncrona com callbacks de status.', 'SMS and voice; asynchronous delivery with status callbacks.', { latencyMs: 200, match: /twilio/i }),
  tech('external', 'sendgrid', 'SendGrid / Amazon SES', 'Envio de e-mail transacional com limites por conta.', 'Transactional email sending with account rate limits.', { latencyMs: 150, match: /sendgrid|\bses\b/i }),
  tech('external', 'fcm-apns', 'FCM / APNs', 'Push notifications para Android e iOS; entrega best-effort.', 'Android and iOS push notifications; best-effort delivery.', { latencyMs: 100, match: /\bfcm\b|apns|firebase/i }),
  tech('external', 'maps', 'Google Maps Platform', 'Geocodificação, rotas e tempos estimados; cobrança por chamada.', 'Geocoding, routes and ETAs; billed per call.', { latencyMs: 120, match: /maps/i }),
  tech('external', 'llm-api', 'LLM API (OpenAI, Anthropic…)', 'Latência alta e variável, limites de tokens/min; respostas podem ser transmitidas.', 'High, variable latency and tokens/min limits; responses can be streamed.', { capacityPerReplica: 500, latencyMs: 1500, match: /openai|anthropic|claude|\bllm\b|gpt/i }),

  // Identity
  tech('auth', 'auth0', 'Auth0 / Okta', 'Identidade como serviço com login social, MFA e regras.', 'Identity as a service with social login, MFA and rules.', { managed: true, latencyMs: 40, match: /auth0|okta/i }),
  tech('auth', 'entra-id', 'Microsoft Entra ID', 'Identidade corporativa (ex-Azure AD) com acesso condicional; B2C para clientes.', 'Corporate identity (formerly Azure AD) with conditional access; B2C for customers.', { managed: true, latencyMs: 40, match: /entra|azure ad|\baad\b/i }),
  tech('auth', 'cognito', 'Amazon Cognito', 'User pools e federação para apps na AWS.', 'User pools and federation for AWS apps.', { managed: true, latencyMs: 40, match: /cognito/i }),
  tech('auth', 'keycloak', 'Keycloak', 'IdP open-source auto-hospedado (OIDC/SAML).', 'Self-hosted open-source IdP (OIDC/SAML).', { latencyMs: 15, match: /keycloak/i }),

  // Workflow
  tech('workflow', 'temporal', 'Temporal', 'Workflows como código com histórico de eventos; retoma exatamente de onde parou.', 'Workflows as code with event history; resumes exactly where it stopped.', { match: /temporal/i }),
  tech('workflow', 'step-functions', 'AWS Step Functions', 'Máquinas de estado gerenciadas (Standard: até 1 ano; Express: alto volume).', 'Managed state machines (Standard: up to 1 year; Express: high volume).', { managed: true, latencyMs: 25, match: /step functions/i }),
  tech('workflow', 'durable-functions', 'Azure Durable Functions', 'Orquestrações com estado sobre Azure Functions (fan-out/fan-in, timers, aprovação humana).', 'Stateful orchestrations on Azure Functions (fan-out/fan-in, timers, human approval).', { managed: true, latencyMs: 25, match: /durable functions/i }),
  tech('workflow', 'logic-apps', 'Azure Logic Apps', 'Integrações low-code com centenas de conectores.', 'Low-code integrations with hundreds of connectors.', { managed: true, latencyMs: 60, capacityPerReplica: 1_000, match: /logic apps/i }),

  // Stream processing
  tech('stream-processor', 'flink', 'Apache Flink', 'Processamento com estado, event time e exactly-once via checkpoints.', 'Stateful processing with event time and exactly-once through checkpoints.', { defaults: { delivery: 'exactly-once' }, match: /flink/i }),
  tech('stream-processor', 'kafka-streams', 'Kafka Streams', 'Biblioteca embarcada na sua aplicação; estado local em RocksDB com changelog no Kafka.', 'Library embedded in your app; local RocksDB state with a Kafka changelog.', { match: /kafka streams|ksql/i }),
  tech('stream-processor', 'spark-streaming', 'Spark Structured Streaming', 'Micro-batches com a API do Spark; latência de segundos.', 'Micro-batches with the Spark API; seconds of latency.', { capacityPerReplica: 80_000, match: /spark streaming|structured streaming/i }),
  tech('stream-processor', 'azure-stream-analytics', 'Azure Stream Analytics', 'Consultas SQL contínuas gerenciadas sobre Event Hubs/IoT Hub.', 'Managed continuous SQL queries over Event Hubs/IoT Hub.', { managed: true, unit: unit('streaming units', 'streaming units'), match: /stream analytics/i }),
  tech('stream-processor', 'dataflow', 'Google Dataflow (Beam)', 'Apache Beam gerenciado com autoscaling para batch e streaming.', 'Managed Apache Beam with autoscaling for batch and streaming.', { managed: true, match: /dataflow|\bbeam\b/i }),

  // Analytics
  tech('data-warehouse', 'snowflake', 'Snowflake', 'Armazenamento e computação separados; warehouses escalam de forma independente.', 'Separate storage and compute; warehouses scale independently.', { managed: true, match: /snowflake/i }),
  tech('data-warehouse', 'bigquery', 'Google BigQuery', 'Serverless, cobrado por bytes lidos; streaming inserts em segundos.', 'Serverless, billed by bytes scanned; streaming inserts within seconds.', { managed: true, match: /bigquery/i }),
  tech('data-warehouse', 'redshift', 'Amazon Redshift', 'Warehouse colunar MPP na AWS.', 'MPP columnar warehouse on AWS.', { managed: true, match: /redshift/i }),
  tech('data-warehouse', 'synapse-fabric', 'Microsoft Fabric / Synapse', 'Analytics unificado da Microsoft sobre OneLake.', 'Microsoft unified analytics on OneLake.', { managed: true, match: /synapse|fabric/i }),
  tech('data-warehouse', 'clickhouse', 'ClickHouse', 'OLAP colunar muito rápido para analytics em tempo real.', 'Very fast columnar OLAP for real-time analytics.', { capacityPerReplica: 5_000, latencyMs: 50, defaults: { ingestion: 'streaming', freshness: 'realtime' }, match: /clickhouse/i }),

  // Vector
  tech('vector-db', 'pgvector', 'PostgreSQL + pgvector', 'Vetores no mesmo Postgres dos dados transacionais.', 'Vectors in the same Postgres as transactional data.', { capacityPerReplica: 1_500, latencyMs: 20, match: /pgvector/i }),
  tech('vector-db', 'pinecone', 'Pinecone', 'Banco vetorial serverless gerenciado.', 'Managed serverless vector database.', { managed: true, latencyMs: 30, match: /pinecone/i }),
  tech('vector-db', 'qdrant', 'Qdrant / Weaviate', 'Bancos vetoriais open-source com filtros por metadados.', 'Open-source vector databases with metadata filtering.', { capacityPerReplica: 5_000, latencyMs: 8, match: /qdrant|weaviate|milvus/i }),
  tech('vector-db', 'azure-ai-search-vector', 'Azure AI Search (vector)', 'Busca vetorial e híbrida gerenciada com ranking semântico.', 'Managed vector and hybrid search with semantic ranking.', { managed: true, latencyMs: 25, defaults: { hybrid: true } }),

  // Observability
  tech('observability', 'prometheus-grafana', 'Prometheus + Grafana', 'Métricas por scraping, PromQL e dashboards; Loki/Tempo para logs e traces.', 'Scraped metrics, PromQL and dashboards; Loki/Tempo for logs and traces.', { defaults: { signals: 'metrics' }, match: /prometheus|grafana/i }),
  tech('observability', 'opentelemetry', 'OpenTelemetry Collector', 'Coleta neutra de fornecedor para métricas, logs e traces.', 'Vendor-neutral collection of metrics, logs and traces.', { match: /opentelemetry|otel/i }),
  tech('observability', 'datadog', 'Datadog', 'APM, logs e métricas como serviço.', 'APM, logs and metrics as a service.', { managed: true, match: /datadog/i }),
  tech('observability', 'azure-monitor', 'Azure Monitor / App Insights', 'Telemetria nativa do Azure com Log Analytics (KQL).', 'Azure-native telemetry with Log Analytics (KQL).', { managed: true, match: /azure monitor|app insights|application insights/i }),
  tech('observability', 'cloudwatch', 'Amazon CloudWatch', 'Métricas, logs e alarmes nativos da AWS.', 'AWS-native metrics, logs and alarms.', { managed: true, match: /cloudwatch/i }),
];

const byId = new Map(technologies.map((item) => [item.id, item]));

export function findTechnology(id: string | undefined): Technology | undefined {
  return id ? byId.get(id) : undefined;
}

export function technologiesFor(kind: ComponentKind): Technology[] {
  return technologies.filter((item) => item.kind === kind);
}

/** Recognises a technology of the given kind by name in a free-text label ("Orders RabbitMQ"). */
export function detectTechnology(kind: ComponentKind, label: string): Technology | undefined {
  const normalized = label.toLowerCase();
  return technologiesFor(kind).find((item) => (item.match ? item.match.test(label) : normalized.includes(item.label.toLowerCase())));
}

/** Option values with the precedence: user choice → technology default → option default. */
export function resolveConfig(kind: ComponentKind, techId?: string, config?: Record<string, ComponentOptionValue>): Record<string, ComponentOptionValue> {
  const defaults = findTechnology(techId)?.defaults ?? {};
  return Object.fromEntries(componentOptions[kind].map((option) => [option.id, config?.[option.id] ?? defaults[option.id] ?? option.default]));
}

export interface EffectiveSpec extends ComponentSpec {
  technology?: Technology;
  /** Fraction of requests a cache or CDN absorbs, from its hit ratio option. */
  hitRatio: number;
}

/** The capacity model of one component after applying its technology and options. */
export function effectiveSpec(data: Pick<CanvasNode['data'], 'kind' | 'tech' | 'config'>): EffectiveSpec {
  const kind = data.kind ?? 'service';
  const base = componentSpecs[kind];
  const technology = findTechnology(data.tech);
  const usable = technology?.kind === kind ? technology : undefined;
  const config = resolveConfig(kind, usable?.id, data.config);
  const percent = typeof config.hitRatio === 'number' ? config.hitRatio : kind === 'cdn' ? 60 : 80;
  let soft = base.soft;
  if (kind === 'external' && config.circuitBreaker === true) soft = true;
  if (kind === 'auth') soft = config.tokenValidation === 'local-jwt';
  return {
    ...base,
    capacityPerReplica: usable?.capacityPerReplica ?? base.capacityPerReplica,
    latencyMs: usable?.latencyMs ?? base.latencyMs,
    soft,
    technology: usable,
    hitRatio: Math.min(0.99, Math.max(0, percent / 100)),
  };
}

export interface Protocol { id: string; label: string; async?: boolean }

/** Protocols offered for a connection; async ones flip the connection to asynchronous when picked. */
export const protocols: Protocol[] = [
  { id: 'https', label: 'HTTPS / REST' },
  { id: 'grpc', label: 'gRPC' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'websocket', label: 'WebSocket' },
  { id: 'sql', label: 'SQL (TCP)' },
  { id: 'resp', label: 'Redis (RESP)' },
  { id: 'amqp', label: 'AMQP', async: true },
  { id: 'kafka', label: 'Kafka protocol', async: true },
  { id: 'mqtt', label: 'MQTT', async: true },
  { id: 'webhook', label: 'Webhook', async: true },
  { id: 'cdc', label: 'CDC (change data capture)', async: true },
  { id: 'batch', label: 'Batch / ETL', async: true },
];

export function findProtocol(id: string | undefined): Protocol | undefined {
  return id ? protocols.find((item) => item.id === id) : undefined;
}

/** Text for a resolved option value, in the given locale. */
export function formatOptionValue(option: ComponentOption, value: ComponentOptionValue, locale: Locale): string {
  if (option.type === 'toggle') return value ? (locale === 'en' ? 'yes' : 'sim') : (locale === 'en' ? 'no' : 'não');
  if (option.type === 'select') return option.choices?.find((item) => item.value === value)?.label[locale] ?? String(value);
  return `${value}${option.unit ? ` ${option.unit}` : ''}`;
}
