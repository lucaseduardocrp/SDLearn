import { useCallback, useMemo, useRef, type DragEvent } from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, Controls, MiniMap, ReactFlow, useReactFlow,
  type EdgeChange, type NodeChange, type OnConnect, type OnSelectionChangeParams,
} from '@xyflow/react';
import { StickyNote } from 'lucide-react';
import { componentCategories, componentList } from '@shared/catalog/components';
import type { ChaosResult, ComponentKind } from '../types';
import type { FlowEdge, FlowNode } from './designModel';
import { kindIcons } from './kindIcons';
import { ChaosOverlayContext, nodeTypes } from './nodes';

const DRAG_TYPE = 'application/x-archon-component';

interface CanvasEditorProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  overlay: ChaosResult | null;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: OnConnect;
  onAdd: (kind: ComponentKind | 'note', position: { x: number; y: number }) => void;
  onSelectionChange: (selection: { nodeId?: string; edgeId?: string }) => void;
}

export function CanvasEditor({ nodes, edges, overlay, onNodesChange, onEdgesChange, onConnect, onAdd, onSelectionChange }: CanvasEditorProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const displayEdges = useMemo(() => {
    if (!overlay) return edges;
    const cut = new Set(overlay.cutEdges);
    const down = new Set(overlay.nodes.filter((node) => node.health === 'down').map((node) => node.id));
    return edges.map((edge) => cut.has(edge.id) || down.has(edge.target) || down.has(edge.source) ? { ...edge, className: `${edge.className ?? ''} edge-cut`, animated: false } : edge);
  }, [edges, overlay]);

  const addAtCenter = useCallback((kind: ComponentKind | 'note') => {
    const bounds = wrapper.current?.getBoundingClientRect();
    const jitter = () => Math.round((Math.random() - 0.5) * 80);
    const position = bounds
      ? screenToFlowPosition({ x: bounds.left + bounds.width / 2 + jitter(), y: bounds.top + bounds.height / 2 + jitter() })
      : { x: 0, y: 0 };
    onAdd(kind, { x: position.x - 80, y: position.y - 24 });
  }, [onAdd, screenToFlowPosition]);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData(DRAG_TYPE) as ComponentKind | 'note';
    if (!kind) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onAdd(kind, { x: position.x - 80, y: position.y - 24 });
  }, [onAdd, screenToFlowPosition]);

  const handleSelection = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
    onSelectionChange({ nodeId: selectedNodes.length === 1 ? selectedNodes[0].id : undefined, edgeId: selectedNodes.length === 0 && selectedEdges.length === 1 ? selectedEdges[0].id : undefined });
  }, [onSelectionChange]);

  return (
    <div className="canvas-shell">
      <aside className="palette" aria-label="Componentes">
        {componentCategories.map((category) => (
          <div key={category} className="palette-group">
            <span className="palette-title">{category}</span>
            {componentList.filter((spec) => spec.category === category).map((spec) => {
              const Icon = kindIcons[spec.kind];
              return (
                <button
                  key={spec.kind}
                  className={`palette-item category-${category.toLowerCase()}`}
                  draggable
                  onDragStart={(event) => { event.dataTransfer.setData(DRAG_TYPE, spec.kind); event.dataTransfer.effectAllowed = 'move'; }}
                  onClick={() => addAtCenter(spec.kind)}
                  title={`${spec.description} Arraste para o canvas ou clique para adicionar.`}
                >
                  <Icon size={14} /><span>{spec.label}</span>
                </button>
              );
            })}
          </div>
        ))}
        <div className="palette-group">
          <span className="palette-title">Anotação</span>
          <button className="palette-item category-note" draggable onDragStart={(event) => event.dataTransfer.setData(DRAG_TYPE, 'note')} onClick={() => addAtCenter('note')}>
            <StickyNote size={14} /><span>Nota</span>
          </button>
        </div>
      </aside>
      <div className="canvas" ref={wrapper} onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}>
        <ChaosOverlayContext.Provider value={overlay}>
          <ReactFlow<FlowNode, FlowEdge>
            nodes={nodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={handleSelection}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
            minZoom={0.2}
            maxZoom={2}
            snapToGrid
            snapGrid={[8, 8]}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#2c2742" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={2} maskColor="rgba(11, 10, 20, 0.7)" nodeColor={(node) => node.type === 'note' ? '#5b4a1f' : '#3b3459'} />
          </ReactFlow>
        </ChaosOverlayContext.Provider>
        {nodes.length <= 1 && (
          <div className="canvas-hint">
            <strong>Comece pelo fluxo principal</strong>
            <span>Arraste componentes da paleta e ligue a saída (direita) de um à entrada (esquerda) de outro.</span>
          </div>
        )}
      </div>
    </div>
  );
}
