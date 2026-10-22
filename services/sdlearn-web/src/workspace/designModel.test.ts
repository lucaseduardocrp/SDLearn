import { describe, expect, it } from 'vitest';
import { fromFlow, newComponentNode, toFlow } from './designModel';
import type { Design } from '../types';

const design: Design = {
  nodes: [
    { id: 'client', type: 'component', position: { x: 0, y: 0 }, data: { kind: 'client', label: 'Client', replicas: 1 } },
    { id: 'api', type: 'component', position: { x: 240, y: 0 }, data: { kind: 'service', label: 'API', replicas: 3, notes: 'stateless' } },
    { id: 'note-1', type: 'note', position: { x: 0, y: 200 }, data: { label: 'Cache-aside com TTL' } },
  ],
  edges: [
    { id: 'e1', source: 'client', target: 'api', label: 'HTTPS' },
    { id: 'e2', source: 'api', target: 'client', async: true },
  ],
  mermaid: '',
  notes: '',
};

describe('designModel', () => {
  it('round-trips a saved design through the React Flow representation', () => {
    const flow = toFlow(design);
    expect(flow.edges[1].animated).toBe(true);
    expect(fromFlow(flow.nodes, flow.edges)).toEqual({ nodes: design.nodes, edges: design.edges });
  });

  it('gives new components unique labels', () => {
    const { nodes } = toFlow(design);
    const first = newComponentNode('service', { x: 0, y: 0 }, nodes);
    const second = newComponentNode('service', { x: 0, y: 0 }, [...nodes, first]);
    expect([first.data.label, second.data.label]).toEqual(['Service', 'Service 2']);
  });
});
