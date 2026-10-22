import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { componentSpecs } from '@shared/catalog/components';
import type { CanvasEdge, CanvasNode, ComponentKind, Design } from '../types';

export type ComponentNodeData = { kind: ComponentKind; label: string; replicas: number; notes?: string };
export type NoteNodeData = { label: string };
export type ComponentFlowNode = Node<ComponentNodeData, 'component'>;
export type NoteFlowNode = Node<NoteNodeData, 'note'>;
export type FlowNode = ComponentFlowNode | NoteFlowNode;
export type FlowEdge = Edge<{ async?: boolean }>;

export function decorateEdge(edge: FlowEdge): FlowEdge {
  const async = Boolean(edge.data?.async);
  return {
    ...edge,
    animated: async,
    className: async ? 'edge-async' : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: async ? '#c084fc' : '#7d7898' },
  };
}

export function toFlow(design: Pick<Design, 'nodes' | 'edges'>): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes = design.nodes.map((node): FlowNode => node.type === 'note'
    ? { id: node.id, type: 'note', position: node.position, data: { label: node.data.label } }
    : { id: node.id, type: 'component', position: node.position, data: { kind: node.data.kind ?? 'service', label: node.data.label, replicas: node.data.replicas ?? 1, notes: node.data.notes } });
  const edges = design.edges.map((edge) => decorateEdge({ id: edge.id, source: edge.source, target: edge.target, label: edge.label, data: { async: edge.async } }));
  return { nodes, edges };
}

export function fromFlow(nodes: FlowNode[], edges: FlowEdge[]): Pick<Design, 'nodes' | 'edges'> {
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    nodes: nodes.map((node): CanvasNode => node.type === 'note'
      ? { id: node.id, type: 'note', position: { x: round(node.position.x), y: round(node.position.y) }, data: { label: node.data.label } }
      : { id: node.id, type: 'component', position: { x: round(node.position.x), y: round(node.position.y) }, data: { kind: node.data.kind, label: node.data.label, replicas: node.data.replicas, ...(node.data.notes ? { notes: node.data.notes } : {}) } }),
    edges: edges.map((edge): CanvasEdge => ({
      id: edge.id, source: edge.source, target: edge.target,
      ...(typeof edge.label === 'string' && edge.label.trim() ? { label: edge.label.trim() } : {}),
      ...(edge.data?.async ? { async: true } : {}),
    })),
  };
}

export function newComponentNode(kind: ComponentKind, position: { x: number; y: number }, existing: FlowNode[]): ComponentFlowNode {
  const base = componentSpecs[kind].label;
  const taken = new Set(existing.map((node) => node.data.label));
  let label = base;
  for (let index = 2; taken.has(label); index += 1) label = `${base} ${index}`;
  return { id: `${kind}-${crypto.randomUUID().slice(0, 8)}`, type: 'component', position, data: { kind, label, replicas: 1 }, selected: true };
}

export function newNoteNode(position: { x: number; y: number }): NoteFlowNode {
  return { id: `note-${crypto.randomUUID().slice(0, 8)}`, type: 'note', position, data: { label: '' }, selected: true };
}

export interface DesignWarning { id: string; text: string; nodeId?: string; edgeId?: string }

/** Cheap structural hints that help users read their own diagram. */
export function designWarnings(nodes: FlowNode[], edges: FlowEdge[]): DesignWarning[] {
  const warnings: DesignWarning[] = [];
  const components = nodes.filter((node): node is ComponentFlowNode => node.type === 'component');
  const byId = new Map(components.map((node) => [node.id, node]));
  for (const edge of edges) {
    const target = byId.get(edge.target);
    const source = byId.get(edge.source);
    if (target?.data.kind === 'client' && source && source.data.kind !== 'client') {
      warnings.push({ id: `into-client-${edge.id}`, edgeId: edge.id, text: `${source.data.label} → ${target.data.label}: a seta aponta para o cliente. As setas indicam quem chama quem; normalmente o fluxo começa no Client.` });
    }
  }
  for (const client of components.filter((node) => node.data.kind === 'client')) {
    if (components.length > 1 && !edges.some((edge) => edge.source === client.id)) {
      warnings.push({ id: `idle-client-${client.id}`, nodeId: client.id, text: `${client.data.label} não chama nenhum componente. Arraste da bolinha à direita dele até o primeiro componente.` });
    }
  }
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  for (const node of components) {
    if (components.length > 1 && !connected.has(node.id)) warnings.push({ id: `isolated-${node.id}`, nodeId: node.id, text: `${node.data.label} está solto: nenhuma conexão entra ou sai dele.` });
  }
  return warnings;
}
