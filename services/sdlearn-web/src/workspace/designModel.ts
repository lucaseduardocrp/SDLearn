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
