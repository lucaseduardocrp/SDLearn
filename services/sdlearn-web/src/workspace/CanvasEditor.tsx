import { useCallback, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Background, BackgroundVariant, ConnectionMode, Controls, MiniMap, ReactFlow, useReactFlow,
  type EdgeChange, type NodeChange, type OnConnect, type OnSelectionChangeParams,
} from '@xyflow/react';
import { ChevronRight, Maximize, Search, StickyNote, Workflow } from 'lucide-react';
import { componentCategories, componentList, componentSpecs } from '@shared/catalog/components';
import { technologies, technologiesFor } from '@shared/catalog/technologies';
import { engineMessages } from '@shared/i18n/engine';
import { useI18n } from '../i18n';
import { Button } from '../components/ui';
import { ContextMenu, type MenuEntry } from '../components/ContextMenu';
import type { ChaosResult, ComponentKind } from '../types';
import { edgeMenu, nodeMenu, paneMenu } from './canvasMenus';
import type { ComponentNodeData, FlowEdge, FlowNode } from './designModel';
import { EdgeMarkers, edgeTypes } from './edges';
import { kindIcons } from './kindIcons';
import { ChaosOverlayContext, nodeTypes } from './nodes';

const DRAG_TYPE = 'application/x-archon-component';
const FIT_OPTIONS = { padding: 0.25, minZoom: 0.65, maxZoom: 1.15, duration: 300 };

export type EdgePatch = { label?: string; async?: boolean; reverse?: boolean; protocol?: string | null };

interface CanvasEditorProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  overlay: ChaosResult | null;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: OnConnect;
  onAdd: (kind: ComponentKind | 'note', position: { x: number; y: number }, tech?: string) => void;
  onSelectionChange: (selection: { nodeId?: string; edgeId?: string }) => void;
  onLayout: () => void;
  onNodeChange: (id: string, patch: Partial<ComponentNodeData>) => void;
  onEdgeChange: (id: string, patch: EdgePatch) => void;
  onDelete: (target: { nodeId?: string; edgeId?: string }) => void;
  onDuplicate: (nodeId: string) => void;
  onDisconnect: (nodeId: string) => void;
  /** Selects the target; with `reveal` also switches the side panel to the inspector. */
  onInspect: (target: { nodeId?: string; edgeId?: string }, reveal: boolean) => void;
}

type MenuState = { x: number; y: number; items: MenuEntry[] } | null;

export function CanvasEditor(props: CanvasEditorProps) {
  const { nodes, edges, overlay, onNodesChange, onEdgesChange, onConnect, onAdd, onSelectionChange, onLayout } = props;
  const { t, locale } = useI18n();
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [menu, setMenu] = useState<MenuState>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const displayEdges = useMemo(() => {
    if (!overlay) return edges;
    const cut = new Set(overlay.cutEdges);
    const down = new Set(overlay.nodes.filter((node) => node.health === 'down').map((node) => node.id));
    return edges.map((edge) => cut.has(edge.id) || down.has(edge.target) || down.has(edge.source) ? { ...edge, className: `${edge.className ?? ''} edge-cut`, animated: false } : edge);
  }, [edges, overlay]);

  const addAt = useCallback((kind: ComponentKind | 'note', client: { x: number; y: number }, tech?: string) => {
    const position = screenToFlowPosition(client);
    onAdd(kind, { x: position.x - 80, y: position.y - 24 }, tech);
  }, [onAdd, screenToFlowPosition]);

  const addAtCenter = useCallback((kind: ComponentKind | 'note', tech?: string) => {
    const bounds = wrapper.current?.getBoundingClientRect();
    const jitter = () => Math.round((Math.random() - 0.5) * 80);
    if (!bounds) { onAdd(kind, { x: 0, y: 0 }, tech); return; }
    addAt(kind, { x: bounds.left + bounds.width / 2 + jitter(), y: bounds.top + bounds.height / 2 + jitter() }, tech);
  }, [addAt, onAdd]);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const [kind, tech] = event.dataTransfer.getData(DRAG_TYPE).split('|') as [ComponentKind | 'note', string | undefined];
    if (kind) addAt(kind, { x: event.clientX, y: event.clientY }, tech);
  }, [addAt]);

  const handleSelection = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
    onSelectionChange({ nodeId: selectedNodes.length === 1 ? selectedNodes[0].id : undefined, edgeId: selectedNodes.length === 0 && selectedEdges.length === 1 ? selectedEdges[0].id : undefined });
  }, [onSelectionChange]);

  const fit = useCallback(() => void fitView(FIT_OPTIONS), [fitView]);
  const labelOf = (id: string) => nodes.find((node) => node.id === id)?.data.label || id;

  const openNodeMenu = (event: ReactMouseEvent, node: FlowNode) => {
    event.preventDefault();
    props.onInspect({ nodeId: node.id }, false);
    setMenu({
      x: event.clientX, y: event.clientY,
      items: nodeMenu(node, { t, locale }, {
        change: (patch) => props.onNodeChange(node.id, patch),
        duplicate: () => props.onDuplicate(node.id),
        disconnect: () => props.onDisconnect(node.id),
        remove: () => props.onDelete({ nodeId: node.id }),
        inspect: () => props.onInspect({ nodeId: node.id }, true),
        connectionCount: edges.filter((edge) => edge.source === node.id || edge.target === node.id).length,
      }),
    });
  };

  const openEdgeMenu = (event: ReactMouseEvent, edge: FlowEdge) => {
    event.preventDefault();
    props.onInspect({ edgeId: edge.id }, false);
    setMenu({
      x: event.clientX, y: event.clientY,
      items: edgeMenu(edge, { t, locale }, {
        change: (patch) => props.onEdgeChange(edge.id, patch),
        remove: () => props.onDelete({ edgeId: edge.id }),
        inspect: () => props.onInspect({ edgeId: edge.id }, true),
        sourceLabel: labelOf(edge.source),
        targetLabel: labelOf(edge.target),
      }),
    });
  };

  const openPaneMenu = (event: ReactMouseEvent | MouseEvent) => {
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    setMenu({ ...point, items: paneMenu({ t, locale }, { add: (kind, tech) => addAt(kind, point, tech), layout: onLayout, fit }) });
  };

  return (
    <div className="canvas-shell">
      <Palette onAdd={addAtCenter} />
      <div className="canvas" ref={wrapper} onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}>
        <EdgeMarkers />
        <ChaosOverlayContext.Provider value={overlay}>
          <ReactFlow<FlowNode, FlowEdge>
            nodes={nodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={handleSelection}
            onNodeContextMenu={openNodeMenu}
            onEdgeContextMenu={openEdgeMenu}
            onPaneContextMenu={openPaneMenu}
            onMoveStart={closeMenu}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={28}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            fitViewOptions={FIT_OPTIONS}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#2c2742" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={2} maskColor="rgba(11, 10, 20, 0.7)" nodeColor={(node) => node.type === 'note' ? '#5b4a1f' : '#3b3459'} />
          </ReactFlow>
        </ChaosOverlayContext.Provider>
        <div className="canvas-toolbar">
          <Button size="sm" onClick={onLayout} title={t.canvas.layoutTitle}><Workflow size={14} />{t.canvas.layout}</Button>
          <Button size="sm" onClick={fit} title={t.canvas.fitTitle}><Maximize size={14} />{t.canvas.fit}</Button>
        </div>
        <div className="canvas-legend" aria-label={t.canvas.legend}>
          <span><i className="legend-dot in" />{t.canvas.legendIn}</span>
          <span><i className="legend-dot out" />{t.canvas.legendOut}</span>
          <span><i className="legend-line" />{t.canvas.legendSync}</span>
          <span><i className="legend-line async" />{t.canvas.legendAsync}</span>
        </div>
        {nodes.length <= 1 && (
          <div className="canvas-hint">
            <strong>{t.canvas.hintTitle}</strong>
            <span>{t.canvas.hintBody}</span>
          </div>
        )}
        {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} label={t.canvasMenu.label} />}
      </div>
    </div>
  );
}

/** Component palette: kinds by category, each expandable into concrete technologies, plus a search box. */
function Palette({ onAdd }: { onAdd: (kind: ComponentKind | 'note', tech?: string) => void }) {
  const { t, locale } = useI18n();
  const catalogText = engineMessages(locale);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ComponentKind | null>(null);
  const text = query.trim().toLowerCase();

  const dragProps = (payload: string, description: string) => ({
    draggable: true,
    title: t.canvas.paletteItemTitle(description),
    onDragStart: (event: DragEvent) => { event.dataTransfer.setData(DRAG_TYPE, payload); event.dataTransfer.effectAllowed = 'move'; },
  });

  const matches = useMemo(() => {
    if (!text) return null;
    const kinds = componentList.filter((spec) => `${spec.label} ${catalogText.componentDescriptions[spec.kind]}`.toLowerCase().includes(text));
    const techs = technologies.filter((item) => `${item.label} ${item.description[locale]}`.toLowerCase().includes(text));
    return { kinds, techs };
  }, [text, catalogText, locale]);

  return (
    <aside className="palette" aria-label={t.canvas.palette}>
      <label className="palette-search">
        <Search size={13} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.canvas.paletteSearch} aria-label={t.canvas.paletteSearchLabel} />
      </label>
      {matches ? (
        <div className="palette-group">
          {matches.kinds.map((spec) => {
            const Icon = kindIcons[spec.kind];
            return (
              <button key={spec.kind} className={`palette-item category-${spec.category.toLowerCase()}`} onClick={() => onAdd(spec.kind)} {...dragProps(spec.kind, catalogText.componentDescriptions[spec.kind])}>
                <Icon size={14} /><span>{spec.label}</span>
              </button>
            );
          })}
          {matches.techs.map((item) => {
            const spec = componentSpecs[item.kind];
            const Icon = kindIcons[item.kind];
            return (
              <button key={item.id} className={`palette-item palette-tech category-${spec.category.toLowerCase()}`} onClick={() => onAdd(item.kind, item.id)} {...dragProps(`${item.kind}|${item.id}`, item.description[locale])}>
                <Icon size={13} /><span>{item.label}<small>{spec.label}</small></span>
              </button>
            );
          })}
          {!matches.kinds.length && !matches.techs.length && <p className="palette-empty">{t.canvas.noResults}</p>}
        </div>
      ) : (
        <>
          {componentCategories.map((category) => (
            <div key={category} className="palette-group">
              <span className="palette-title">{catalogText.componentCategories[category]}</span>
              {componentList.filter((spec) => spec.category === category).map((spec) => {
                const Icon = kindIcons[spec.kind];
                const techs = technologiesFor(spec.kind);
                const open = expanded === spec.kind;
                return (
                  <div key={spec.kind} className="palette-row">
                    <div className="palette-line">
                      <button className={`palette-item category-${category.toLowerCase()}`} onClick={() => onAdd(spec.kind)} {...dragProps(spec.kind, catalogText.componentDescriptions[spec.kind])}>
                        <Icon size={14} /><span>{spec.label}</span>
                      </button>
                      {techs.length > 0 && (
                        <button className={`palette-expand${open ? ' open' : ''}`} aria-expanded={open} aria-label={t.canvas.showTechnologies(spec.label)} title={t.canvas.showTechnologies(spec.label)} onClick={() => setExpanded(open ? null : spec.kind)}>
                          <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                    {open && (
                      <div className="palette-techs">
                        {techs.map((item) => (
                          <button key={item.id} className="palette-item palette-tech" onClick={() => onAdd(spec.kind, item.id)} {...dragProps(`${spec.kind}|${item.id}`, item.description[locale])}>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="palette-group">
            <span className="palette-title">{t.canvas.annotation}</span>
            <button className="palette-item category-note" draggable onDragStart={(event) => event.dataTransfer.setData(DRAG_TYPE, 'note')} onClick={() => onAdd('note')}>
              <StickyNote size={14} /><span>{t.canvas.note}</span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
