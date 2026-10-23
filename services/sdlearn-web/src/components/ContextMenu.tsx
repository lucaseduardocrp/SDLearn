import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';

export type MenuEntry =
  | { type: 'action'; label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; shortcut?: string }
  | { type: 'check'; label: string; checked: boolean; onSelect: () => void; radio?: boolean; detail?: string }
  | { type: 'submenu'; label: string; icon?: ReactNode; value?: string; items: MenuEntry[] }
  | { type: 'header'; label: string; detail?: string }
  | { type: 'separator' };

interface Anchor { x: number; y: number; /** Width of the trigger when the menu opens beside another item. */ flipWidth?: number }

const MARGIN = 8;

/** Fixed-position context menu with nested submenus. Closes on outside click, Escape, resize or blur. */
export function ContextMenu({ x, y, items, onClose, label }: { x: number; y: number; items: MenuEntry[]; onClose: () => void; label?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose(); };
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  return (
    <div ref={root} className="ctx-root" onContextMenu={(event) => event.preventDefault()}>
      <MenuList items={items} anchor={{ x, y }} onClose={onClose} label={label} autoFocus />
    </div>
  );
}

function MenuList({ items, anchor, onClose, onBack, label, autoFocus }: { items: MenuEntry[]; anchor: Anchor; onClose: () => void; onBack?: () => void; label?: string; autoFocus?: boolean }) {
  const list = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y, ready: false });
  const [open, setOpen] = useState<{ index: number; anchor: Anchor; focus: boolean } | null>(null);
  const triggers = useRef(new Map<number, HTMLButtonElement>());

  // Keep the menu inside the viewport: flip to the left of the trigger (or cursor) and clamp vertically.
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    let left = anchor.x;
    if (left + width > window.innerWidth - MARGIN) left = anchor.flipWidth !== undefined ? anchor.x - anchor.flipWidth - width + 8 : anchor.x - width;
    const top = Math.min(anchor.y, window.innerHeight - height - MARGIN);
    setPosition({ left: Math.max(MARGIN, left), top: Math.max(MARGIN, top), ready: true });
  }, [anchor.x, anchor.y, anchor.flipWidth]);

  useEffect(() => {
    if (autoFocus && position.ready) list.current?.querySelector<HTMLButtonElement>('.ctx-item:not(:disabled)')?.focus();
  }, [autoFocus, position.ready]);

  function openSubmenu(index: number, focus: boolean) {
    const trigger = triggers.current.get(index);
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setOpen({ index, anchor: { x: rect.right - 4, y: rect.top - 5, flipWidth: rect.width }, focus });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>(':scope > .ctx-item:not(:disabled)') ?? [])];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      buttons[(current + step + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'ArrowRight') {
      const index = Number((document.activeElement as HTMLElement)?.dataset.submenu);
      if (!Number.isNaN(index)) { event.preventDefault(); event.stopPropagation(); openSubmenu(index, true); }
    } else if (event.key === 'ArrowLeft' && onBack) {
      event.preventDefault();
      event.stopPropagation();
      onBack();
    }
  }

  const submenu = open ? items[open.index] : null;
  return (
    <>
      <div
        ref={list} role="menu" aria-label={label} className="ctx-menu" onKeyDown={onKeyDown}
        style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}
      >
        {items.map((item, index) => {
          if (item.type === 'separator') return <div key={index} className="ctx-separator" role="separator" />;
          if (item.type === 'header') return <div key={index} className="ctx-header"><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</div>;
          if (item.type === 'submenu') {
            return (
              <button
                key={index} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open?.index === index} data-submenu={index}
                ref={(element) => { if (element) triggers.current.set(index, element); else triggers.current.delete(index); }}
                className={`ctx-item${open?.index === index ? ' open' : ''}`}
                onPointerEnter={() => openSubmenu(index, false)} onClick={() => openSubmenu(index, true)}
              >
                <span className="ctx-icon">{item.icon}</span><span className="ctx-label">{item.label}</span>
                {item.value && <span className="ctx-value">{item.value}</span>}
                <ChevronRight size={13} className="ctx-chevron" />
              </button>
            );
          }
          if (item.type === 'check') {
            return (
              <button key={index} type="button" role={item.radio ? 'menuitemradio' : 'menuitemcheckbox'} aria-checked={item.checked} className={`ctx-item${item.checked ? ' checked' : ''}`}
                onPointerEnter={() => setOpen(null)} onClick={() => { item.onSelect(); onClose(); }}>
                <span className="ctx-icon">{item.checked && (item.radio ? <i className="ctx-dot" /> : <Check size={13} />)}</span>
                <span className="ctx-label">{item.label}</span>
                {item.detail && <span className="ctx-value">{item.detail}</span>}
              </button>
            );
          }
          return (
            <button key={index} type="button" role="menuitem" disabled={item.disabled} className={`ctx-item${item.danger ? ' danger' : ''}`}
              onPointerEnter={() => setOpen(null)} onClick={() => { item.onSelect(); onClose(); }}>
              <span className="ctx-icon">{item.icon}</span><span className="ctx-label">{item.label}</span>
              {item.shortcut && <kbd className="ctx-shortcut">{item.shortcut}</kbd>}
            </button>
          );
        })}
      </div>
      {submenu?.type === 'submenu' && open && (
        <MenuList
          key={open.index} items={submenu.items} anchor={open.anchor} onClose={onClose} label={submenu.label} autoFocus={open.focus}
          onBack={() => { const index = open.index; setOpen(null); triggers.current.get(index)?.focus(); }}
        />
      )}
    </>
  );
}
