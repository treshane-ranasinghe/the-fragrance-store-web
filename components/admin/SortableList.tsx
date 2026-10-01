'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { reorderAction } from '@/lib/actions/admin/settings';

/** Drag to reorder (or use the arrows); saves the new order immediately */
type Item = { id: string; node: React.ReactNode };

/** Items are rendered on the server and passed in as nodes (functions can't cross to client components) */
export function SortableList({ items, table }: { items: Item[]; table: Parameters<typeof reorderAction>[0] }) {
  const router = useRouter();
  const [list, setList] = useState(items);
  const [drag, setDrag] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Only the grip starts a drag, so text in the row's inputs can still be selected and edited
  const [armed, setArmed] = useState<number | null>(null);
  useEffect(() => setList(items), [items]);

  const commit = async (next: Item[]) => {
    setList(next); setSaving(true);
    await reorderAction(table, next.map((x) => x.id));
    setSaving(false); router.refresh();
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const n = [...list]; const [m] = n.splice(from, 1); n.splice(to, 0, m); commit(n);
  };

  return (
    <ul className={`space-y-2 ${saving ? 'opacity-70' : ''}`} aria-busy={saving}>
      {list.map((item, i) => (
        <li key={item.id} draggable={armed === i} onDragStart={() => setDrag(i)} onDragEnd={() => { setArmed(null); setDrag(null); }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag != null) move(drag, i); setDrag(null); setArmed(null); }}
          className="flex items-start gap-3 rounded-card border border-brand-beige bg-white p-3">
          <div className="flex flex-col items-center pt-1 text-brand-muted">
            <span className="cursor-move" title="Drag to reorder" onMouseDown={() => setArmed(i)} onMouseUp={() => setArmed(null)} onTouchStart={() => setArmed(i)}><Icon name="grip" className="h-5 w-5" /></span>
            <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up" className="text-xs disabled:opacity-30">▲</button>
            <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label="Move down" className="text-xs disabled:opacity-30">▼</button>
          </div>
          <div className="min-w-0 flex-1">{item.node}</div>
        </li>
      ))}
    </ul>
  );
}
