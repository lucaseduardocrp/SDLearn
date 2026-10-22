import { componentSpecs } from '../catalog/components';
import type { CanvasEdge, CanvasNode, ComponentKind, Design } from '../types/entities';

const keywordKinds: [RegExp, ComponentKind][] = [
  [/\b(client|user|users|browser|mobile|app|driver|rider|agent|host)s?\b/i, 'client'],
  [/\bdns\b/i, 'dns'],
  [/\bcdn\b|cloudfront|akamai|edge cache/i, 'cdn'],
  [/load ?balancer|\blb\b|\belb\b|\balb\b|haproxy|nginx/i, 'load-balancer'],
  [/rate ?limit/i, 'rate-limiter'],
  [/gateway/i, 'api-gateway'],
  [/websocket|\bws\b|socket|realtime|real-time|presence/i, 'websocket'],
  [/cron|scheduler|frontier/i, 'scheduler'],
  [/worker|consumer|processor|transcod|crawler|fetcher|job/i, 'worker'],
  [/cache|redis|memcache/i, 'cache'],
  [/kafka|kinesis|stream|pulsar|event log|\blog\b/i, 'stream'],
  [/queue|\bsqs\b|rabbit|\bmq\b/i, 'queue'],
  [/elastic|search|solr|\bindex\b|opensearch/i, 'search'],
  [/\bs3\b|blob|object|bucket|storage/i, 'object-storage'],
  [/postgres|mysql|\bsql\b|rdbms|aurora|ledger|spanner/i, 'sql'],
  [/cassandra|dynamo|mongo|nosql|bigtable|hbase|\bkv\b|key.?value|scylla|tsdb|time.?series/i, 'nosql'],
  [/\b(db|database|store)\b/i, 'sql'],
  [/external|stripe|twilio|sendgrid|apns|fcm|\bpsp\b|third.?party|provider/i, 'external'],
];

export function inferKind(label: string, shapeHint?: ComponentKind): ComponentKind {
  for (const [pattern, kind] of keywordKinds) if (pattern.test(label)) return kind === 'sql' && shapeHint === 'nosql' ? 'nosql' : kind;
  return shapeHint ?? 'service';
}

function mermaidId(id: string, index: number): string {
  const cleaned = id.replace(/[^A-Za-z0-9_]/g, '');
  return /^[A-Za-z]/.test(cleaned) && cleaned.length <= 24 ? cleaned : `n${index + 1}`;
}

function mermaidLabel(text: string): string {
  return `"${text.replace(/"/g, '#quot;').replace(/[\r\n]+/g, ' ')}"`;
}

export function designToMermaid(design: Pick<Design, 'nodes' | 'edges'>): string {
  const components = design.nodes.filter((node) => node.type === 'component');
  if (components.length === 0) return 'flowchart LR\n  %% Adicione componentes no canvas';
  const ids = new Map<string, string>();
  const used = new Set<string>();
  components.forEach((node, index) => {
    let id = mermaidId(node.id, index);
    while (used.has(id)) id = `${id}_${index}`;
    used.add(id);
    ids.set(node.id, id);
  });
  const lines = ['flowchart LR'];
  for (const node of components) {
    const kind = node.data.kind ?? 'service';
    const replicas = (node.data.replicas ?? 1) > 1 ? ` ×${node.data.replicas}` : '';
    const label = mermaidLabel(`${node.data.label || componentSpecs[kind].label}${replicas}`);
    const id = ids.get(node.id)!;
    const shape = kind === 'sql' || kind === 'nosql' || kind === 'object-storage' ? `[(${label})]`
      : kind === 'client' ? `([${label}])`
        : kind === 'queue' || kind === 'stream' ? `[/${label}/]`
          : kind === 'cache' ? `[[${label}]]`
            : kind === 'cdn' || kind === 'dns' ? `{{${label}}}`
              : `[${label}]`;
    lines.push(`  ${id}${shape}`);
  }
  for (const edge of design.edges) {
    const source = ids.get(edge.source);
    const target = ids.get(edge.target);
    if (!source || !target) continue;
    const arrow = edge.async ? '-.->' : '-->';
    const label = edge.label?.trim() ? `|${edge.label.replace(/[|"]/g, '')}|` : '';
    lines.push(`  ${source} ${arrow}${label} ${target}`);
  }
  return lines.join('\n');
}

const NODE = /\s*([A-Za-z0-9_][\w-]*)\s*(\(\[[^\]]*\]\)|\[\[[^\]]*\]\]|\[\([^)]*\)\]|\(\([^)]*\)\)|\{\{[^}]*\}\}|\[\/[^\]]*\/\]|\[\\[^\]]*\\\]|\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|>[^\]]*\])?/y;
const ARROW = /\s*(?:(--|==|-\.)\s*([^>|\-=.\s][^>]*?)\s*)?(<?-{2,}>|<?-\.+->|<?={2,}>|-{3,}|={3,}|-\.+-)\s*(?:\|([^|]*)\|)?/y;
const AMPERSAND = /\s*&/y;
const SKIP = /^(flowchart|graph|subgraph|end\b|style|classDef|class |linkStyle|click|direction|%%)/;

interface ParsedNode { id: string; label: string; hint?: ComponentKind }

function parseShape(raw: string | undefined): { label: string | null; hint?: ComponentKind } {
  if (!raw) return { label: null };
  const pairs: [string, string, ComponentKind | undefined][] = [
    ['([', '])', 'client'], ['[[', ']]', 'cache'], ['[(', ')]', 'sql'], ['((', '))', undefined], ['{{', '}}', 'cdn'],
    ['[/', '/]', 'queue'], ['[\\', '\\]', undefined], ['[', ']', undefined], ['(', ')', undefined], ['{', '}', undefined], ['>', ']', undefined],
  ];
  for (const [open, close, hint] of pairs) {
    if (raw.startsWith(open) && raw.endsWith(close)) {
      const label = raw.slice(open.length, raw.length - close.length).trim().replace(/^"|"$/g, '').replace(/#quot;/g, '"').replace(/<br\s*\/?>/gi, ' ');
      return { label, hint };
    }
  }
  return { label: raw };
}

export interface MermaidImport { nodes: CanvasNode[]; edges: CanvasEdge[]; warnings: string[] }

export function mermaidToDesign(source: string): MermaidImport {
  const parsed = new Map<string, ParsedNode>();
  const edges: { source: string; target: string; label?: string; async: boolean }[] = [];
  const warnings: string[] = [];

  function readNodes(line: string, start: number): { ids: string[]; end: number } | null {
    const ids: string[] = [];
    let position = start;
    for (;;) {
      NODE.lastIndex = position;
      const match = NODE.exec(line);
      if (!match) return ids.length ? { ids, end: position } : null;
      const [, id, rawShape] = match;
      const { label, hint } = parseShape(rawShape);
      const existing = parsed.get(id);
      if (!existing) parsed.set(id, { id, label: label ?? id, hint });
      else if (label) parsed.set(id, { id, label, hint: hint ?? existing.hint });
      ids.push(id);
      position = NODE.lastIndex;
      AMPERSAND.lastIndex = position;
      if (!AMPERSAND.exec(line)) return { ids, end: position };
      position = AMPERSAND.lastIndex;
    }
  }

  source.split(/\r?\n|;/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || SKIP.test(line)) return;
    let current = readNodes(line, 0);
    if (!current) { warnings.push(`Linha ${index + 1} ignorada: ${line}`); return; }
    for (;;) {
      ARROW.lastIndex = current.end;
      const arrow = ARROW.exec(line);
      if (!arrow) break;
      const next = readNodes(line, ARROW.lastIndex);
      if (!next) { warnings.push(`Linha ${index + 1}: conexão sem destino.`); break; }
      const label = (arrow[4] ?? arrow[2])?.trim() || undefined;
      const async = arrow[3].includes('.');
      for (const from of current.ids) for (const to of next.ids) edges.push({ source: from, target: to, label, async });
      current = next;
    }
    if (current.end < line.trim().length && !/^\s*$/.test(line.slice(current.end))) warnings.push(`Linha ${index + 1}: trecho não reconhecido "${line.slice(current.end).trim()}".`);
  });

  const nodes: CanvasNode[] = [];
  const depth = new Map<string, number>();
  const incoming = new Map<string, number>([...parsed.keys()].map((id) => [id, 0]));
  edges.forEach((edge) => incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1));
  const queue = [...parsed.keys()].filter((id) => incoming.get(id) === 0);
  if (queue.length === 0 && parsed.size) queue.push([...parsed.keys()][0]);
  queue.forEach((id) => depth.set(id, 0));
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of edges.filter((item) => item.source === id)) {
      if (!depth.has(edge.target)) { depth.set(edge.target, depth.get(id)! + 1); queue.push(edge.target); }
    }
  }
  const rows = new Map<number, number>();
  for (const node of parsed.values()) {
    const column = depth.get(node.id) ?? 0;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    const replicaMatch = node.label.match(/\s*[×x](\d{1,3})$/);
    const label = replicaMatch ? node.label.slice(0, replicaMatch.index).trim() : node.label;
    nodes.push({
      id: `m-${node.id}`, type: 'component', position: { x: column * 230, y: row * 120 },
      data: { kind: inferKind(label, node.hint), label, replicas: replicaMatch ? Math.max(1, Number(replicaMatch[1])) : 1 },
    });
  }
  const seen = new Set<string>();
  const canvasEdges: CanvasEdge[] = [];
  for (const edge of edges) {
    const id = `m-${edge.source}-${edge.target}`;
    if (seen.has(id)) continue;
    seen.add(id);
    canvasEdges.push({ id, source: `m-${edge.source}`, target: `m-${edge.target}`, label: edge.label, async: edge.async || undefined });
  }
  return { nodes, edges: canvasEdges, warnings };
}

export function describeDesign(design: Design): string {
  const components = design.nodes.filter((node) => node.type === 'component');
  const notes = design.nodes.filter((node) => node.type === 'note' && node.data.label.trim());
  const label = (id: string) => {
    const node = design.nodes.find((item) => item.id === id);
    return node ? node.data.label || componentSpecs[node.data.kind ?? 'service'].label : id;
  };
  const lines: string[] = ['Components:'];
  if (!components.length) lines.push('- (none)');
  for (const node of components) {
    const kind = node.data.kind ?? 'service';
    lines.push(`- ${node.data.label || componentSpecs[kind].label} [${componentSpecs[kind].label}] replicas=${node.data.replicas ?? 1}${node.data.notes ? ` — ${node.data.notes}` : ''}`);
  }
  lines.push('Connections:');
  if (!design.edges.length) lines.push('- (none)');
  for (const edge of design.edges) lines.push(`- ${label(edge.source)} -> ${label(edge.target)}${edge.async ? ' (async)' : ''}${edge.label ? ` "${edge.label}"` : ''}`);
  if (notes.length) {
    lines.push('Canvas annotations:');
    notes.forEach((note) => lines.push(`- ${note.data.label}`));
  }
  return lines.join('\n');
}
