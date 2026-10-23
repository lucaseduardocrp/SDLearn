import type { ChaosScenarioId, ComponentKind } from '../types/entities';
import type { ComponentCategory } from '../catalog/components';
import { defaultLocale, type Locale } from './locale';

/** Text produced by the deterministic engine (chaos simulator, rubric, Mermaid import, component catalog). */
export interface EngineMessages {
  number: (value: number) => string;
  scenarios: Record<ChaosScenarioId, { name: string; description: string; magnitude?: string }>;
  componentCategories: Record<ComponentCategory, string>;
  componentDescriptions: Record<ComponentKind, string>;
  chaos: {
    selectNode: string;
    selectEdge: string;
    emptyCanvas: string;
    allReplicasDown: string;
    consumerDown: (names: string) => string;
    softDependencyDown: (names: string) => string;
    hardDependencyDown: (names: string) => string;
    replicasLost: (lost: number, total: number) => string;
    overload: (load: string, capacity: string, percent: number) => string;
    backlog: (rate: string) => string;
    extraLatency: (ms: number) => string;
    unreachable: string;
    served: (percent: number, traffic: string) => string;
    latencyOverBudget: (latency: number, budget: number) => string;
    latencyWithinBudget: (latency: number, budget: number) => string;
    redundancyAbsorbed: (label: string) => string;
    entriesDisconnected: string;
    noClient: string;
    singlePointsOfFailure: (labels: string) => string;
  };
  rubric: {
    coverage: string;
    coverageMissing: (kinds: string) => string;
    coverageComplete: string;
    connected: string;
    connectedTooFew: string;
    connectedIsolated: (labels: string) => string;
    connectedAll: string;
    dataPath: string;
    dataPathReached: string;
    dataPathMissing: string;
    spof: string;
    spofFound: (labels: string) => string;
    spofNone: string;
    spofTooFew: string;
    capacity: (peak: string) => string;
    capacityDetail: (percent: number) => string;
    latency: (budget: number) => string;
    latencyDetail: (latency: number) => string;
    tradeoffs: string;
    tradeoffsPresent: string;
    tradeoffsMissing: string;
  };
  mermaid: {
    emptyCanvas: string;
    lineIgnored: (line: number, text: string) => string;
    edgeWithoutTarget: (line: number) => string;
    unrecognized: (line: number, text: string) => string;
  };
}

const ptBR: EngineMessages = {
  number: (value) => value.toLocaleString('pt-BR'),
  scenarios: {
    'node-failure': { name: 'Derrubar componente', description: 'Todas as réplicas do alvo ficam indisponíveis — falha de zona, deploy quebrado ou disco cheio.' },
    'replica-loss': { name: 'Perder réplicas', description: 'Algumas instâncias do alvo caem; as restantes precisam absorver a carga.', magnitude: 'Réplicas perdidas' },
    'network-partition': { name: 'Partição de rede', description: 'A conexão selecionada para de funcionar entre os dois componentes.' },
    'traffic-spike': { name: 'Pico de tráfego', description: 'O pico de requisições do problema é multiplicado.', magnitude: 'Multiplicador' },
    'latency-injection': { name: 'Injetar latência', description: 'O alvo responde mais devagar em cada chamada.', magnitude: 'Latência extra' },
    'chaos-monkey': { name: 'Chaos Monkey', description: 'Uma instância aleatória de algum componente é derrubada.' },
  },
  componentCategories: { Edge: 'Borda', Compute: 'Computação', Data: 'Dados', Messaging: 'Mensageria', Other: 'Outros' },
  componentDescriptions: {
    client: 'Navegador, app mobile ou chamador externo.',
    dns: 'Resolução de nomes e roteamento geográfico.',
    cdn: 'Cache de borda para conteúdo estático e cacheável.',
    'load-balancer': 'Distribui o tráfego entre réplicas saudáveis.',
    'api-gateway': 'Roteamento, autenticação e tratamento de requisições.',
    'rate-limiter': 'Aplica cotas por cliente.',
    service: 'Serviço de aplicação stateless.',
    websocket: 'Conexões persistentes para push.',
    worker: 'Consumidor em segundo plano / job em lote.',
    scheduler: 'Disparo de jobs agendados (cron) ou atrasados.',
    cache: 'Cache chave-valor em memória (Redis, Memcached).',
    sql: 'Banco relacional com transações.',
    nosql: 'Banco chave-valor / wide-column particionado.',
    'object-storage': 'Blobs: mídia, arquivos, backups (S3).',
    search: 'Índice invertido (Elasticsearch, OpenSearch).',
    queue: 'Fila de trabalho durável (SQS, RabbitMQ).',
    stream: 'Log particionado (Kafka, Kinesis).',
    external: 'Dependência de terceiros (pagamentos, SMS, e-mail).',
    auth: 'Autenticação e emissão de tokens (OIDC / OAuth 2.0).',
    workflow: 'Orquestração durável de processos longos com várias etapas.',
    'stream-processor': 'Processamento com estado de streams de eventos (janelas, joins, agregações).',
    'data-warehouse': 'Armazenamento colunar analítico para relatórios e BI.',
    'vector-db': 'Busca por similaridade em embeddings (busca semântica, RAG).',
    observability: 'Coleta de métricas, logs e traces com alertas.',
  },
  chaos: {
    selectNode: 'Selecione um componente do canvas como alvo.',
    selectEdge: 'Selecione uma conexão do canvas como alvo.',
    emptyCanvas: 'O canvas está vazio: adicione componentes e conexões antes de injetar falhas.',
    allReplicasDown: 'Todas as réplicas estão indisponíveis.',
    consumerDown: (names) => `Consumidor ${names} indisponível — mensagens se acumulam.`,
    softDependencyDown: (names) => `${names} indisponível; operando degradado.`,
    hardDependencyDown: (names) => `Depende de ${names}, que está inacessível.`,
    replicasLost: (lost, total) => `${lost} de ${total} réplicas perdidas.`,
    overload: (load, capacity, percent) => `Sobrecarga: ${load} req/s para capacidade de ${capacity} req/s (${percent}%).`,
    backlog: (rate) => `Backlog cresce ~${rate} msg/s: consumidores não acompanham.`,
    extraLatency: (ms) => `+${ms} ms por chamada.`,
    unreachable: 'Nenhum caminho a partir das entradas alcança este componente.',
    served: (percent, traffic) => `${percent.toLocaleString('pt-BR')}% das requisições atendidas com ${traffic} req/s de tráfego.`,
    latencyOverBudget: (latency, budget) => `Latência estimada de ${latency} ms excede o orçamento de ${budget} ms.`,
    latencyWithinBudget: (latency, budget) => `Latência estimada de ${latency} ms dentro do orçamento de ${budget} ms.`,
    redundancyAbsorbed: (label) => `A redundância absorveu a falha em ${label}.`,
    entriesDisconnected: 'As entradas não estão conectadas a nenhum componente: nenhuma requisição é atendida.',
    noClient: 'Nenhum Client no canvas: as entradas foram inferidas pelos componentes sem conexões de entrada.',
    singlePointsOfFailure: (labels) => `Pontos únicos de falha: ${labels}.`,
  },
  rubric: {
    coverage: 'Componentes essenciais',
    coverageMissing: (kinds) => `Faltando: ${kinds}.`,
    coverageComplete: 'Todos os blocos esperados para este problema estão presentes.',
    connected: 'Componentes conectados',
    connectedTooFew: 'O design precisa de pelo menos dois componentes conectados.',
    connectedIsolated: (labels) => `Sem conexões: ${labels}.`,
    connectedAll: 'Todo componente participa de algum fluxo.',
    dataPath: 'Caminho até os dados',
    dataPathReached: 'As entradas alcançam ao menos um armazenamento.',
    dataPathMissing: 'Nenhum armazenamento é alcançado a partir das entradas.',
    spof: 'Sem pontos únicos de falha',
    spofFound: (labels) => `Perder uma instância de ${labels} derruba o sistema.`,
    spofNone: 'Nenhuma falha de instância isolada derruba o serviço.',
    spofTooFew: 'Sem componentes suficientes para avaliar.',
    capacity: (peak) => `Aguenta o pico (${peak} req/s)`,
    capacityDetail: (percent) => `${percent.toLocaleString('pt-BR')}% das requisições atendidas no pico estimado.`,
    latency: (budget) => `Latência ≤ ${budget} ms`,
    latencyDetail: (latency) => `Estimativa do caminho síncrono: ${latency} ms.`,
    tradeoffs: 'Trade-offs documentados',
    tradeoffsPresent: 'Há notas explicando as decisões.',
    tradeoffsMissing: 'Escreva ao menos um parágrafo com decisões e trade-offs.',
  },
  mermaid: {
    emptyCanvas: 'Adicione componentes no canvas',
    lineIgnored: (line, text) => `Linha ${line} ignorada: ${text}`,
    edgeWithoutTarget: (line) => `Linha ${line}: conexão sem destino.`,
    unrecognized: (line, text) => `Linha ${line}: trecho não reconhecido "${text}".`,
  },
};

const en: EngineMessages = {
  number: (value) => value.toLocaleString('en-US'),
  scenarios: {
    'node-failure': { name: 'Take component down', description: 'Every replica of the target becomes unavailable — zone outage, bad deploy or full disk.' },
    'replica-loss': { name: 'Lose replicas', description: 'Some instances of the target crash; the remaining ones must absorb the load.', magnitude: 'Replicas lost' },
    'network-partition': { name: 'Network partition', description: 'The selected connection stops working between the two components.' },
    'traffic-spike': { name: 'Traffic spike', description: 'The problem\'s peak request rate is multiplied.', magnitude: 'Multiplier' },
    'latency-injection': { name: 'Inject latency', description: 'The target answers more slowly on every call.', magnitude: 'Extra latency' },
    'chaos-monkey': { name: 'Chaos Monkey', description: 'A random instance of some component is taken down.' },
  },
  componentCategories: { Edge: 'Edge', Compute: 'Compute', Data: 'Data', Messaging: 'Messaging', Other: 'Other' },
  componentDescriptions: {
    client: 'Browser, mobile app or upstream caller.',
    dns: 'Name resolution and geo routing.',
    cdn: 'Edge cache for static and cacheable content.',
    'load-balancer': 'Spreads traffic across healthy replicas.',
    'api-gateway': 'Routing, auth, request shaping.',
    'rate-limiter': 'Enforces per-client quotas.',
    service: 'Stateless application service.',
    websocket: 'Long-lived connections for push.',
    worker: 'Background consumer / batch job.',
    scheduler: 'Cron / delayed job trigger.',
    cache: 'In-memory key-value cache (Redis, Memcached).',
    sql: 'Relational store with transactions.',
    nosql: 'Partitioned key-value / wide-column store.',
    'object-storage': 'Blobs: media, files, backups (S3).',
    search: 'Inverted index (Elasticsearch, OpenSearch).',
    queue: 'Durable work queue (SQS, RabbitMQ).',
    stream: 'Partitioned log (Kafka, Kinesis).',
    external: 'Third-party dependency (payments, SMS, email).',
    auth: 'Authentication and token issuing (OIDC / OAuth 2.0).',
    workflow: 'Durable orchestration of long-running, multi-step processes.',
    'stream-processor': 'Stateful processing of event streams (windows, joins, aggregations).',
    'data-warehouse': 'Columnar analytics store for reporting and BI.',
    'vector-db': 'Similarity search over embeddings (semantic search, RAG).',
    observability: 'Metrics, logs and traces collection with alerting.',
  },
  chaos: {
    selectNode: 'Select a component on the canvas as the target.',
    selectEdge: 'Select a connection on the canvas as the target.',
    emptyCanvas: 'The canvas is empty: add components and connections before injecting failures.',
    allReplicasDown: 'Every replica is unavailable.',
    consumerDown: (names) => `Consumer ${names} unavailable — messages pile up.`,
    softDependencyDown: (names) => `${names} unavailable; running degraded.`,
    hardDependencyDown: (names) => `Depends on ${names}, which is unreachable.`,
    replicasLost: (lost, total) => `${lost} of ${total} replicas lost.`,
    overload: (load, capacity, percent) => `Overloaded: ${load} req/s against a capacity of ${capacity} req/s (${percent}%).`,
    backlog: (rate) => `Backlog grows ~${rate} msg/s: consumers cannot keep up.`,
    extraLatency: (ms) => `+${ms} ms per call.`,
    unreachable: 'No path from the entry points reaches this component.',
    served: (percent, traffic) => `${percent}% of requests served at ${traffic} req/s of traffic.`,
    latencyOverBudget: (latency, budget) => `Estimated latency of ${latency} ms exceeds the ${budget} ms budget.`,
    latencyWithinBudget: (latency, budget) => `Estimated latency of ${latency} ms is within the ${budget} ms budget.`,
    redundancyAbsorbed: (label) => `Redundancy absorbed the failure in ${label}.`,
    entriesDisconnected: 'The entry points are not connected to any component: no request is served.',
    noClient: 'No Client on the canvas: entry points were inferred from components without incoming connections.',
    singlePointsOfFailure: (labels) => `Single points of failure: ${labels}.`,
  },
  rubric: {
    coverage: 'Essential components',
    coverageMissing: (kinds) => `Missing: ${kinds}.`,
    coverageComplete: 'Every building block expected for this problem is present.',
    connected: 'Connected components',
    connectedTooFew: 'The design needs at least two connected components.',
    connectedIsolated: (labels) => `No connections: ${labels}.`,
    connectedAll: 'Every component takes part in some flow.',
    dataPath: 'Path to the data',
    dataPathReached: 'The entry points reach at least one data store.',
    dataPathMissing: 'No data store is reachable from the entry points.',
    spof: 'No single points of failure',
    spofFound: (labels) => `Losing one instance of ${labels} takes the system down.`,
    spofNone: 'No single instance failure takes the service down.',
    spofTooFew: 'Not enough components to evaluate.',
    capacity: (peak) => `Handles the peak (${peak} req/s)`,
    capacityDetail: (percent) => `${percent}% of requests served at the estimated peak.`,
    latency: (budget) => `Latency ≤ ${budget} ms`,
    latencyDetail: (latency) => `Synchronous path estimate: ${latency} ms.`,
    tradeoffs: 'Documented trade-offs',
    tradeoffsPresent: 'There are notes explaining the decisions.',
    tradeoffsMissing: 'Write at least one paragraph with decisions and trade-offs.',
  },
  mermaid: {
    emptyCanvas: 'Add components to the canvas',
    lineIgnored: (line, text) => `Line ${line} ignored: ${text}`,
    edgeWithoutTarget: (line) => `Line ${line}: connection without a target.`,
    unrecognized: (line, text) => `Line ${line}: unrecognized fragment "${text}".`,
  },
};

const catalogs: Record<Locale, EngineMessages> = { 'pt-BR': ptBR, en };

export function engineMessages(locale: Locale = defaultLocale): EngineMessages {
  return catalogs[locale] ?? catalogs[defaultLocale];
}
