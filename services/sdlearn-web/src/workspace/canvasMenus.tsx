import { ArrowLeftRight, Copy, Cpu, Layers, Network, Plus, Settings2, StickyNote, Trash2, Unlink, Workflow, Maximize } from 'lucide-react';
import { componentCategories, componentList, componentSpecs } from '@shared/catalog/components';
import { componentOptions, findProtocol, findTechnology, protocols, resolveConfig, technologiesFor } from '@shared/catalog/technologies';
import { engineMessages } from '@shared/i18n/engine';
import type { Locale } from '@shared/i18n/locale';
import type { MenuEntry } from '../components/ContextMenu';
import type { Messages } from '../i18n';
import type { ComponentKind } from '../types';
import type { ComponentNodeData, FlowEdge, FlowNode } from './designModel';
import { kindIcons } from './kindIcons';

const REPLICA_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 20];

interface Text { t: Messages; locale: Locale }

export interface NodeMenuActions {
  change: (patch: Partial<ComponentNodeData>) => void;
  duplicate: () => void;
  disconnect: () => void;
  remove: () => void;
  inspect: () => void;
  connectionCount: number;
}

/** Picking a technology resets options to its defaults and renames components that still have a generated name. */
export function technologyPatch(data: ComponentNodeData, techId: string | undefined): Partial<ComponentNodeData> {
  const previous = findTechnology(data.tech);
  const next = findTechnology(techId);
  const generated = [componentSpecs[data.kind].label, previous?.label].filter(Boolean).some((name) => data.label === name || data.label.startsWith(`${name} `));
  return { tech: next?.id, config: undefined, ...(generated ? { label: next?.label ?? componentSpecs[data.kind].label } : {}) };
}

export function nodeMenu(node: FlowNode, { t, locale }: Text, actions: NodeMenuActions): MenuEntry[] {
  const m = t.canvasMenu;
  const tail: MenuEntry[] = [
    { type: 'separator' },
    { type: 'action', label: m.duplicate, icon: <Copy size={14} />, shortcut: 'Ctrl+D', onSelect: actions.duplicate },
    ...(node.type === 'component' ? [{ type: 'action', label: m.disconnect, icon: <Unlink size={14} />, disabled: actions.connectionCount === 0, onSelect: actions.disconnect } satisfies MenuEntry] : []),
    { type: 'action', label: m.delete, icon: <Trash2 size={14} />, shortcut: 'Del', danger: true, onSelect: actions.remove },
  ];
  if (node.type !== 'component') return [{ type: 'header', label: m.note }, ...tail];

  const data = node.data;
  const spec = componentSpecs[data.kind];
  const technology = findTechnology(data.tech);
  const config = resolveConfig(data.kind, technology?.id, data.config);
  const techs = technologiesFor(data.kind);
  const entries: MenuEntry[] = [{ type: 'header', label: data.label || spec.label, detail: technology?.label ?? spec.label }];

  if (techs.length) {
    entries.push({
      type: 'submenu', label: m.technology, icon: <Layers size={14} />, value: technology?.label ?? '—',
      items: [
        { type: 'check', radio: true, label: m.generic, checked: !technology, onSelect: () => actions.change(technologyPatch(data, undefined)) },
        { type: 'separator' },
        ...techs.map((item): MenuEntry => ({ type: 'check', radio: true, label: item.label, checked: technology?.id === item.id, onSelect: () => actions.change(technologyPatch(data, item.id)) })),
      ],
    });
  }
  if (!spec.entry) {
    entries.push({
      type: 'submenu', label: m.replicas, icon: <Network size={14} />, value: `×${data.replicas}`,
      items: [...new Set([...REPLICA_CHOICES, data.replicas])].sort((a, b) => a - b).map((count): MenuEntry => ({
        type: 'check', radio: true, label: `×${count}`, checked: data.replicas === count, onSelect: () => actions.change({ replicas: count }),
      })),
    });
  }

  const quick = componentOptions[data.kind].filter((option) => option.quick && option.type !== 'number');
  if (quick.length) entries.push({ type: 'separator' });
  for (const option of quick) {
    const setValue = (value: string | boolean) => actions.change({ config: { ...data.config, [option.id]: value } });
    if (option.type === 'toggle') {
      entries.push({ type: 'check', label: option.label[locale], checked: config[option.id] === true, onSelect: () => setValue(config[option.id] !== true) });
    } else {
      const current = option.choices?.find((item) => item.value === config[option.id]);
      entries.push({
        type: 'submenu', label: option.label[locale], value: current?.label[locale],
        items: (option.choices ?? []).map((item): MenuEntry => ({ type: 'check', radio: true, label: item.label[locale], checked: item.value === config[option.id], onSelect: () => setValue(item.value) })),
      });
    }
  }
  entries.push({ type: 'separator' }, { type: 'action', label: m.allSettings, icon: <Settings2 size={14} />, onSelect: actions.inspect });
  return [...entries, ...tail];
}

export interface EdgeMenuActions {
  change: (patch: { async?: boolean; protocol?: string | null; reverse?: boolean }) => void;
  remove: () => void;
  inspect: () => void;
  sourceLabel: string;
  targetLabel: string;
}

export function edgeMenu(edge: FlowEdge, { t }: Text, actions: EdgeMenuActions): MenuEntry[] {
  const m = t.canvasMenu;
  const protocol = findProtocol(edge.data?.protocol);
  return [
    { type: 'header', label: `${actions.sourceLabel} → ${actions.targetLabel}`, detail: protocol?.label },
    {
      type: 'submenu', label: m.protocol, icon: <Workflow size={14} />, value: protocol?.label ?? '—',
      items: [
        { type: 'check', radio: true, label: m.noProtocol, checked: !protocol, onSelect: () => actions.change({ protocol: null }) },
        { type: 'separator' },
        ...protocols.map((item): MenuEntry => ({ type: 'check', radio: true, label: item.label, detail: item.async ? 'async' : undefined, checked: protocol?.id === item.id, onSelect: () => actions.change({ protocol: item.id, async: Boolean(item.async) }) })),
      ],
    },
    { type: 'check', label: m.async, checked: Boolean(edge.data?.async), onSelect: () => actions.change({ async: !edge.data?.async }) },
    { type: 'action', label: m.reverse, icon: <ArrowLeftRight size={14} />, onSelect: () => actions.change({ reverse: true }) },
    { type: 'action', label: m.editLabel, icon: <Settings2 size={14} />, onSelect: actions.inspect },
    { type: 'separator' },
    { type: 'action', label: m.deleteLink, icon: <Trash2 size={14} />, shortcut: 'Del', danger: true, onSelect: actions.remove },
  ];
}

export interface PaneMenuActions {
  add: (kind: ComponentKind | 'note', tech?: string) => void;
  layout: () => void;
  fit: () => void;
}

export function paneMenu({ t, locale }: Text, actions: PaneMenuActions): MenuEntry[] {
  const catalog = engineMessages(locale);
  return [
    {
      type: 'submenu', label: t.canvasMenu.addComponent, icon: <Plus size={14} />,
      items: componentCategories.map((category): MenuEntry => ({
        type: 'submenu', label: catalog.componentCategories[category], icon: <Cpu size={14} />,
        items: componentList.filter((spec) => spec.category === category).map((spec): MenuEntry => {
          const Icon = kindIcons[spec.kind];
          const techs = technologiesFor(spec.kind);
          if (!techs.length) return { type: 'action', label: spec.label, icon: <Icon size={14} />, onSelect: () => actions.add(spec.kind) };
          return {
            type: 'submenu', label: spec.label, icon: <Icon size={14} />,
            items: [
              { type: 'action', label: t.canvasMenu.generic, onSelect: () => actions.add(spec.kind) },
              { type: 'separator' },
              ...techs.map((item): MenuEntry => ({ type: 'action', label: item.label, onSelect: () => actions.add(spec.kind, item.id) })),
            ],
          };
        }),
      })),
    },
    { type: 'action', label: t.canvasMenu.addNote, icon: <StickyNote size={14} />, onSelect: () => actions.add('note') },
    { type: 'separator' },
    { type: 'action', label: t.canvas.layout, icon: <Workflow size={14} />, onSelect: actions.layout },
    { type: 'action', label: t.canvas.fit, icon: <Maximize size={14} />, onSelect: actions.fit },
  ];
}
