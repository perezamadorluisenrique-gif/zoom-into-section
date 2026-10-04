// The CodeMirror side of zooming. It imports CodeMirror but not `obsidian`.
import { EditorSelection, EditorState, Facet, Prec, StateEffect, StateField } from '@codemirror/state';
import type { Range as CmRange, Extension, SelectionRange, TransactionSpec } from '@codemirror/state';
import { Decoration, EditorView, showPanel } from '@codemirror/view';
import type { DecorationSet, Panel } from '@codemirror/view';

import { breadcrumbs, parentRange, zoomRange } from './outline.ts';
import type { Range } from './outline.ts';

export interface ZoomOptions {
  /** The title shown as the first crumb, which zooms back out. */
  title: (view: EditorView) => string;
  /** Zoom in when a list bullet is clicked. */
  zoomOnBullet: () => boolean;
  /** Escape zooms out one level while zoomed. */
  escapeZoomsOut: () => boolean;
}

const setZoom = StateEffect.define<Range | null>({
  map: (value, changes) => (value ? { from: changes.mapPos(value.from, -1), to: changes.mapPos(value.to, 1) } : null),
});

/** What is showing, or null when the whole note is. It follows edits inside it. */
export const zoomField = StateField.define<Range | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setZoom)) return e.value;
    if (!value || !tr.docChanged) return value;
    return { from: tr.changes.mapPos(value.from, -1), to: tr.changes.mapPos(value.to, 1) };
  },
});

const hide = Decoration.replace({ block: true });

/** Cover everything before and after the zoomed range with one block each. */
function hiddenRanges(range: Range | null, length: number): DecorationSet {
  if (!range) return Decoration.none;
  const ranges: CmRange<Decoration>[] = [];
  // The line breaks next to the range stay, so the visible lines keep their separators.
  if (range.from - 1 > 0) ranges.push(hide.range(0, range.from - 1));
  if (range.to + 1 < length) ranges.push(hide.range(range.to + 1, length));
  return Decoration.set(ranges);
}

const hiddenField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    const before = tr.startState.field(zoomField);
    const after = tr.state.field(zoomField);
    if (before === after && !tr.docChanged) return value;
    return hiddenRanges(after, tr.state.doc.length);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const options = Facet.define<ZoomOptions, ZoomOptions>({
  combine: (values) => values[0] ?? { title: () => 'Note', zoomOnBullet: () => false, escapeZoomsOut: () => false },
});

function clamp(range: SelectionRange, zoom: Range): SelectionRange {
  const anchor = Math.max(zoom.from, Math.min(range.anchor, zoom.to));
  const head = Math.max(zoom.from, Math.min(range.head, zoom.to));
  return anchor === range.anchor && head === range.head ? range : EditorSelection.range(anchor, head);
}

/**
 * Keep the cursor inside what shows. A move by the person (a click, the arrow keys, typing) is held at the edge;
 * a jump from elsewhere (the outline, a link, search) leaves the zoom instead, so the target is not hidden.
 */
const keepSelectionInside = EditorState.transactionFilter.of((tr) => {
  const effect = tr.effects.find((e) => e.is(setZoom));
  const before = tr.startState.field(zoomField);
  let zoom: Range | null = before;
  if (effect) zoom = effect.value;
  else if (before) zoom = { from: tr.changes.mapPos(before.from, -1), to: tr.changes.mapPos(before.to, 1) };
  if (!zoom) return tr;
  const selection = tr.newSelection;
  const bounds = zoom;
  const clamped = selection.ranges.map((r) => clamp(r, bounds));
  if (clamped.every((r, i) => r === selection.ranges[i])) return tr;
  const byPerson = Boolean(effect) || ['select', 'input', 'delete', 'move'].some((e) => tr.isUserEvent(e));
  const fix: TransactionSpec = byPerson
    ? { selection: EditorSelection.create(clamped, selection.mainIndex), sequential: true }
    : { effects: setZoom.of(null), sequential: true };
  return [tr, fix];
});

function crumbBar(view: EditorView): Panel {
  // Made inside the editor so it belongs to the right window (pop-outs), then
  // detached: CodeMirror mounts it in the panel container.
  const dom = view.dom.createDiv({ cls: 'zoom-into-section-bar' });
  dom.detach();
  let timer: number | undefined;

  const render = () => {
    const zoom = view.state.field(zoomField);
    dom.replaceChildren();
    if (!zoom) return;
    const text = view.state.doc.toString();
    const crumbs = [{ from: -1, label: view.state.facet(options).title(view) }, ...breadcrumbs(text, zoom.from)];
    crumbs.forEach((crumb, i) => {
      if (i > 0) {
        const sep = dom.createSpan({ cls: 'zoom-into-section-sep', text: '›' });
        sep.setAttribute('aria-hidden', 'true');
      }
      const last = i === crumbs.length - 1;
      const el = dom.createSpan({ cls: 'zoom-into-section-crumb', text: crumb.label });
      if (last) {
        el.addClass('is-current');
        return;
      }
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      const go = () => (crumb.from === -1 ? zoomOut(view) : zoomAt(view, crumb.from));
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  };
  render();

  return {
    dom,
    top: true,
    update(update) {
      if (!update.docChanged && update.startState.field(zoomField) === update.state.field(zoomField)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(render, update.docChanged ? 250 : 0);
    },
    destroy() {
      window.clearTimeout(timer);
    },
  };
}

const bar = showPanel.from(zoomField, (zoom) => (zoom ? crumbBar : null));

const bulletClick = EditorView.domEventHandlers({
  click(event, view) {
    if (!view.state.facet(options).zoomOnBullet()) return false;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !(target.classList.contains('list-bullet') || target.classList.contains('cm-formatting-list'))) return false;
    const line = view.state.doc.lineAt(view.posAtDOM(target));
    view.dispatch({ selection: EditorSelection.cursor(line.to) });
    return zoomAt(view, line.from);
  },
});

/** Escape climbs one level, and leaves the zoom at the top. Plain Escape only, so Vim mode and menus keep theirs when the setting is off. */
const escapeKey = EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.key !== 'Escape' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return false;
    if (!currentZoom(view.state) || !view.state.facet(options).escapeZoomsOut()) return false;
    zoomParent(view);
    return true;
  },
});

export function zoomExtension(opts: ZoomOptions): Extension {
  return [options.of(opts), zoomField, hiddenField, keepSelectionInside, bar, bulletClick, Prec.high(escapeKey)];
}

export function currentZoom(state: EditorState): Range | null {
  return state.field(zoomField, false) ?? null;
}

function show(view: EditorView, range: Range | null, scroll: 'start' | 'center') {
  view.dispatch({
    effects: [setZoom.of(range), EditorView.scrollIntoView(range ? range.from : view.state.selection.main.head, { y: scroll })],
  });
}

/** Zoom into the heading section or list item at `pos`. False when there is nothing there to zoom into. */
export function zoomAt(view: EditorView, pos: number): boolean {
  const range = zoomRange(view.state.doc.toString(), pos);
  if (!range) return false;
  const current = currentZoom(view.state);
  if (current && current.from === range.from && current.to === range.to) return true;
  show(view, range, 'start');
  return true;
}

export function zoomIn(view: EditorView): boolean {
  return zoomAt(view, view.state.selection.main.head);
}

export function zoomOut(view: EditorView) {
  if (currentZoom(view.state)) show(view, null, 'center');
}

/** One level up, or all the way out from the top level. */
export function zoomParent(view: EditorView) {
  const current = currentZoom(view.state);
  if (!current) return;
  const parent = parentRange(view.state.doc.toString(), current.from);
  if (parent) show(view, parent, 'start');
  else zoomOut(view);
}
