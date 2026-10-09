// Pure logic: no `obsidian` or CodeMirror import, so tests/ can run it under plain Node.

export interface Range {
  /** Offset of the first character of the first line. */
  from: number;
  /** Offset of the end of the last line, without its line break. */
  to: number;
}

export interface Crumb {
  /** Offset of the start of the line this crumb zooms to. */
  from: number;
  label: string;
}

interface Line {
  text: string;
  from: number;
  to: number;
}

interface Outline {
  lines: Line[];
  /** Lines inside a fenced code block or the front matter: never headings or list items. */
  skip: boolean[];
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^(#{1,6})[ \t]+\S/;
const LIST = /^(\s*)([-*+]|\d+[.)])[ \t]+/;

function analyse(text: string): Outline {
  const lines: Line[] = [];
  let at = 0;
  for (const t of text.split('\n')) {
    lines.push({ text: t.endsWith('\r') ? t.slice(0, -1) : t, from: at, to: at + t.length - (t.endsWith('\r') ? 1 : 0) });
    at += t.length + 1;
  }
  const skip = new Array<boolean>(lines.length).fill(false);

  // Front matter: an opening --- on the very first line, closed by --- or ...
  if (lines.length > 0 && /^---[ \t]*$/.test(lines[0].text)) {
    for (let i = 1; i < lines.length; i++) {
      if (/^(---|\.\.\.)[ \t]*$/.test(lines[i].text)) {
        for (let j = 0; j <= i; j++) skip[j] = true;
        break;
      }
    }
  }

  let fence: string | null = null;
  let length = 0;
  for (let i = 0; i < lines.length; i++) {
    if (skip[i]) continue;
    const m = FENCE.exec(lines[i].text);
    if (fence === null) {
      if (m) {
        fence = m[1][0];
        length = m[1].length;
        skip[i] = true;
      }
    } else {
      skip[i] = true;
      if (m && m[1][0] === fence && m[1].length >= length && m[2].trim() === '') fence = null;
    }
  }
  return { lines, skip };
}

function level(o: Outline, i: number): number {
  return o.skip[i] ? 0 : (HEADING.exec(o.lines[i].text)?.[1].length ?? 0);
}

function width(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (ch === ' ') w++;
    else if (ch === '\t') w += 4;
    else break;
  }
  return w;
}

function isItem(o: Outline, i: number): boolean {
  return !o.skip[i] && level(o, i) === 0 && LIST.test(o.lines[i].text);
}

function blank(o: Outline, i: number): boolean {
  return !o.skip[i] && o.lines[i].text.trim() === '';
}

/** Last line (inclusive) of the section a heading opens: up to the next heading of the same or a higher level. */
function sectionEnd(o: Outline, i: number): number {
  const l = level(o, i);
  let end = i;
  for (let j = i + 1; j < o.lines.length; j++) {
    const lj = level(o, j);
    if (lj > 0 && lj <= l) break;
    if (!blank(o, j)) end = j;
  }
  return end;
}

/** Last line (inclusive) of a list item: its own line and everything indented deeper, blank lines between included. */
function itemEnd(o: Outline, i: number): number {
  const own = width(o.lines[i].text);
  let end = i;
  for (let j = i + 1; j < o.lines.length; j++) {
    if (o.skip[j]) {
      // A fenced block indented under the item belongs to it; anything else ends it.
      if (width(o.lines[j].text) > own) {
        end = j;
        continue;
      }
      break;
    }
    if (blank(o, j)) continue;
    if (width(o.lines[j].text) > own && level(o, j) === 0) end = j;
    else break;
  }
  return end;
}

/** The nearest heading above line `i`, or -1. */
function headingAbove(o: Outline, i: number): number {
  for (let j = i; j >= 0; j--) if (level(o, j) > 0) return j;
  return -1;
}

/** The line that `zoomRange` would zoom into for a cursor on line `i`, with its last line; null if there is none. */
function target(o: Outline, i: number): { start: number; end: number } | null {
  if (level(o, i) > 0) return { start: i, end: sectionEnd(o, i) };
  if (isItem(o, i)) return { start: i, end: itemEnd(o, i) };

  // A continuation line inside a list item: the nearest item above that still reaches this line.
  const here = width(o.lines[i].text);
  if (!o.skip[i] && here > 0 && !blank(o, i)) {
    for (let j = i - 1; j >= 0; j--) {
      if (o.skip[j] || blank(o, j)) continue;
      const w = width(o.lines[j].text);
      if (w >= here) continue;
      if (isItem(o, j) && itemEnd(o, j) >= i) return { start: j, end: itemEnd(o, j) };
      break;
    }
  }
  const h = headingAbove(o, i);
  return h === -1 ? null : { start: h, end: sectionEnd(o, h) };
}

function lineAt(o: Outline, pos: number): number {
  let lo = 0;
  let hi = o.lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (o.lines[mid].from <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function toRange(o: Outline, t: { start: number; end: number }): Range {
  return { from: o.lines[t.start].from, to: o.lines[t.end].to };
}

/** What to show when zooming in at `pos`: the heading section or list item at that line. Null if there is nothing to zoom into. */
export function zoomRange(text: string, pos: number): Range | null {
  const o = analyse(text);
  const t = target(o, lineAt(o, Math.max(0, Math.min(pos, text.length))));
  return t ? toRange(o, t) : null;
}

/** The line that contains line `i` one level up: a heading of a lower level or the item it is nested in. -1 for none. */
function parentLine(o: Outline, i: number): number {
  if (level(o, i) > 0) {
    const l = level(o, i);
    for (let j = i - 1; j >= 0; j--) if (level(o, j) > 0 && level(o, j) < l) return j;
    return -1;
  }
  if (isItem(o, i)) {
    const own = width(o.lines[i].text);
    for (let j = i - 1; j >= 0; j--) {
      if (o.skip[j] || blank(o, j)) continue;
      if (level(o, j) > 0) return j;
      if (width(o.lines[j].text) < own && isItem(o, j)) return j;
      if (width(o.lines[j].text) === 0 && !isItem(o, j)) break;
    }
    return headingAbove(o, i);
  }
  return -1;
}

/** The range one level above the one starting at `from`, or null when it is already the top. */
export function parentRange(text: string, from: number): Range | null {
  const o = analyse(text);
  const p = parentLine(o, lineAt(o, from));
  if (p === -1) return null;
  const t = target(o, p);
  return t ? toRange(o, t) : null;
}

/** "**Bold** [[Note|alias]]" becomes "Bold alias"; the marker of a heading or list item goes. */
export function cleanLabel(line: string): string {
  const label = line
    .replace(/^\s*#{1,6}[ \t]+/, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])[ \t]+(?:\[.\][ \t]+)?/, '')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|==|`)/g, '')
    .replace(/[ \t]\^[\w-]+$/, '')
    .replace(/[ \t]+#+[ \t]*$/, '')
    .trim();
  return label === '' ? '(empty)' : label;
}

/** From the top of the note down to the range starting at `from`; each crumb is somewhere to zoom to. */
export function breadcrumbs(text: string, from: number): Crumb[] {
  const o = analyse(text);
  const chain: number[] = [];
  for (let i = lineAt(o, from); i !== -1 && chain.length < 50; i = parentLine(o, i)) chain.push(i);
  return chain.reverse().map((i) => ({ from: o.lines[i].from, label: cleanLabel(o.lines[i].text) }));
}

export interface Heading {
  /** Offset of the start of the heading line. */
  from: number;
  /** 1 for `#`, up to 6. */
  level: number;
  /** The heading as shown, without the `#` marker and its formatting. */
  label: string;
}

/** Every heading of the note in order, leaving out `#` lines inside code blocks and the properties block. */
export function listHeadings(text: string): Heading[] {
  const o = analyse(text);
  const out: Heading[] = [];
  for (let i = 0; i < o.lines.length; i++) {
    const l = level(o, i);
    if (l > 0) out.push({ from: o.lines[i].from, level: l, label: cleanLabel(o.lines[i].text) });
  }
  return out;
}

/** How Obsidian compares a heading with the heading part of a link: case and link-breaking characters do not count. */
function normalize(s: string): string {
  return s
    .replace(/[#|^:%[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** The heading text exactly as typed, without the marker or a closing run of `#`. */
function rawHeading(line: string): string {
  return line.replace(/^\s*#{1,6}[ \t]+/, '').replace(/[ \t]+#+[ \t]*$/, '');
}

function sameHeading(line: string, wanted: string): boolean {
  const w = normalize(wanted);
  return w !== '' && (normalize(rawHeading(line)) === w || normalize(cleanLabel(line)) === w);
}

/** True when line `i` carries the block id `id` at its end. */
function hasBlockId(o: Outline, i: number, id: string): boolean {
  const m = /(?:^|[ \t])\^([A-Za-z0-9-]+)[ \t]*$/.exec(o.lines[i].text);
  return m !== null && m[1].toLowerCase() === id.toLowerCase();
}

/**
 * What a link's subpath points at, as a range to zoom into: `#Heading`, nested `#A#B` (B is looked for under A),
 * or `#^id` / `#A#^id` for a list item. Null when it does not resolve to a heading section or a list item,
 * so a block that is only a paragraph, a table or a quote is never zoomed.
 */
export function resolveSubpath(text: string, subpath: string): Range | null {
  const parts = subpath.split('#').map((p) => p.trim()).filter((p) => p !== '');
  if (parts.length === 0) return null;
  const o = analyse(text);

  let block: string | null = null;
  if (parts[parts.length - 1].startsWith('^')) block = parts.pop()!.slice(1);
  if (block === '' || (block === null && parts.length === 0)) return null;

  // Walk down the headings: each one must sit inside the section of the one before.
  let lo = 0;
  let hi = o.lines.length - 1;
  let found = -1;
  for (const part of parts) {
    let next = -1;
    for (let i = lo; i <= hi; i++) {
      if (level(o, i) > 0 && (found === -1 || level(o, i) > level(o, found)) && sameHeading(o.lines[i].text, part)) {
        next = i;
        break;
      }
    }
    if (next === -1) return null;
    found = next;
    lo = found + 1;
    hi = Math.max(found, sectionEnd(o, found));
  }

  if (block === null) return toRange(o, { start: found, end: sectionEnd(o, found) });
  for (let i = lo; i <= hi; i++) {
    if (o.skip[i] || !hasBlockId(o, i, block)) continue;
    const t = target(o, i);
    return t && isItem(o, t.start) ? toRange(o, t) : null;
  }
  return null;
}

/** Enough to find a zoom again later without a line number: the line's own text and which of the identical ones it is. */
export interface ZoomRef {
  line: string;
  nth: number;
}

function startsZoom(o: Outline, i: number): boolean {
  return level(o, i) > 0 || isItem(o, i);
}

/** Describe the zoom that starts at offset `from`; null when it does not start at a heading or list item. */
export function describeZoom(text: string, from: number): ZoomRef | null {
  const o = analyse(text);
  const at = lineAt(o, from);
  if (o.lines[at].from !== from || !startsZoom(o, at)) return null;
  const line = o.lines[at].text.trim();
  let nth = 0;
  for (let i = 0; i < at; i++) if (startsZoom(o, i) && o.lines[i].text.trim() === line) nth++;
  return { line, nth };
}

/** The range a stored zoom points at now, or null when that heading or item is gone. */
export function resolveZoom(text: string, ref: ZoomRef): Range | null {
  const o = analyse(text);
  let seen = 0;
  for (let i = 0; i < o.lines.length; i++) {
    if (!startsZoom(o, i) || o.lines[i].text.trim() !== ref.line) continue;
    if (seen++ === ref.nth) return toRange(o, target(o, i)!);
  }
  return null;
}
