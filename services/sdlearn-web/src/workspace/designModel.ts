import type { Edge, Node } from '@xyflow/react';
import { componentSpecs } from '@shared/catalog/components';
import { findTechnology } from '@shared/catalog/technologies';
import type { Messages } from '../i18n';
import type { CanvasEdge, CanvasNode, ComponentKind, ComponentOptionValue, Design } from '../types';

export type ComponentNodeData = { kind: ComponentKind; label: string; replicas: number; notes?: string; tech?: string; config?: Record<string, ComponentOptionValue> };
export type NoteNodeData = { label: string };
export type ComponentFlowNode = Node<ComponentNodeData, 'component'>;
export type NoteFlowNode = Node<NoteNodeData, 'note'>;
export type FlowNode = ComponentFlowNode | NoteFlowNode;
export type FlowEdge = Edge<{ async?: boolean; protocol?: string }>;

export function decorateEdge(edge: FlowEdge): FlowEdge {
  const async = Boolean(edge.data?.async);
  // Floating edges attach to the nearest sides of both nodes; the arrow head is drawn by the edge itself.
  return { ...edge, type: 'floating', animated: async, className: async ? 'edge-async' : undefined };
}

export function toFlow(design: Pick<Design, 'nodes' | 'edges'>): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes = design.nodes.map((node): FlowNode => node.type === 'note'
    ? { id: node.id, type: 'note', position: node.position, data: { label: node.data.label } }
    : { id: node.id, type: 'component', position: node.position, data: { kind: node.data.kind ?? 'service', label: node.data.label, replicas: node.data.replicas ?? 1, notes: node.data.notes, tech: node.data.tech, config: node.data.config } });
  const edges = design.edges.map((edge) => decorateEdge({ id: edge.id, source: edge.source, target: edge.target, label: edge.label, data: { async: edge.async, protocol: edge.protocol } }));
  return { nodes, edges };
}

export function fromFlow(nodes: FlowNode[], edges: FlowEdge[]): Pick<Design, 'nodes' | 'edges'> {
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    nodes: nodes.map((node): CanvasNode => node.type === 'note'
      ? { id: node.id, type: 'note', position: { x: round(node.position.x), y: round(node.position.y) }, data: { label: node.data.label } }
      : { id: node.id, type: 'component', position: { x: round(node.position.x), y: round(node.position.y) }, data: { kind: node.data.kind, label: node.data.label, replicas: node.data.replicas, ...(node.data.notes ? { notes: node.data.notes } : {}), ...(node.data.tech ? { tech: node.data.tech } : {}), ...(node.data.config && Object.keys(node.data.config).length ? { config: node.data.config } : {}) } }),
    edges: edges.map((edge): CanvasEdge => ({
      id: edge.id, source: edge.source, target: edge.target,
      ...(typeof edge.label === 'string' && edge.label.trim() ? { label: edge.label.trim() } : {}),
      ...(edge.data?.async ? { async: true } : {}),
      ...(edge.data?.protocol ? { protocol: edge.data.protocol } : {}),
    })),
  };
}

export function uniqueLabel(base: string, existing: FlowNode[]): string {
  const taken = new Set(existing.map((node) => node.data.label));
  let label = base;
  for (let index = 2; taken.has(label); index += 1) label = `${base} ${index}`;
  return label;
}

export function newComponentNode(kind: ComponentKind, position: { x: number; y: number }, existing: FlowNode[], tech?: string): ComponentFlowNode {
  const technology = findTechnology(tech);
  const usable = technology?.kind === kind ? technology : undefined;
  const label = uniqueLabel(usable?.label ?? componentSpecs[kind].label, existing);
  return { id: `${kind}-${crypto.randomUUID().slice(0, 8)}`, type: 'component', position, data: { kind, label, replicas: 1, ...(usable ? { tech: usable.id } : {}) }, selected: true };
}

/** Copy of a node (component or note) offset on the canvas, with a fresh id and label. */
export function duplicateNode(node: FlowNode, existing: FlowNode[]): FlowNode {
  const id = `${node.type === 'note' ? 'note' : node.data.kind}-${crypto.randomUUID().slice(0, 8)}`;
  const position = { x: node.position.x + 40, y: node.position.y + 40 };
  if (node.type === 'note') return { id, type: 'note', position, data: { ...node.data }, selected: true };
  return { id, type: 'component', position, data: { ...node.data, label: uniqueLabel(node.data.label, existing), config: node.data.config && { ...node.data.config } }, selected: true };
}

export function newNoteNode(position: { x: number; y: number }): NoteFlowNode {
  return { id: `note-${crypto.randomUUID().slice(0, 8)}`, type: 'note', position, data: { label: '' }, selected: true };
}

export interface DesignWarning { id: string; text: string; nodeId?: string; edgeId?: string }

/** Cheap structural hints that help users read their own diagram. */
export function designWarnings(nodes: FlowNode[], edges: FlowEdge[], text: Messages['workspace']['warnings']): DesignWarning[] {
  const warnings: DesignWarning[] = [];
  const components = nodes.filter((node): node is ComponentFlowNode => node.type === 'component');
  const byId = new Map(components.map((node) => [node.id, node]));
  for (const edge of edges) {
    const target = byId.get(edge.target);
    const source = byId.get(edge.source);
    if (target?.data.kind === 'client' && source && source.data.kind !== 'client') {
      warnings.push({ id: `into-client-${edge.id}`, edgeId: edge.id, text: text.intoClient(source.data.label, target.data.label) });
    }
  }
  for (const client of components.filter((node) => node.data.kind === 'client')) {
    if (components.length > 1 && !edges.some((edge) => edge.source === client.id)) {
      warnings.push({ id: `idle-client-${client.id}`, nodeId: client.id, text: text.idleClient(client.data.label) });
    }
  }
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  for (const node of components) {
    if (components.length > 1 && !connected.has(node.id)) warnings.push({ id: `isolated-${node.id}`, nodeId: node.id, text: text.isolated(node.data.label) });
  }
  return warnings;
}
