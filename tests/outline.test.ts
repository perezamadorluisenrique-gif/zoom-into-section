import test from 'node:test';
import assert from 'node:assert/strict';

import { breadcrumbs, cleanLabel, parentRange, zoomRange } from '../src/outline.ts';

/** The text a zoom range shows. */
const shown = (text: string, at: string) => {
  const r = zoomRange(text, text.indexOf(at));
  return r ? text.slice(r.from, r.to) : null;
};

const NOTE = [
  '# Title',
  'intro',
  '## First',
  'first body',
  '### Deep',
  'deep body',
  '## Second',
  'second body',
  '',
  '- item one',
  '  - child a',
  '    - grandchild',
  '  - child b',
  '- item two',
  '',
  '## Third',
].join('\n');

test('a heading zooms to its section, nested headings included', () => {
  assert.equal(shown(NOTE, '## First'), '## First\nfirst body\n### Deep\ndeep body');
  assert.equal(shown(NOTE, '### Deep'), '### Deep\ndeep body');
  assert.equal(shown(NOTE, '# Title'), NOTE);
});

test('the last section stops at the last non-blank line', () => {
  assert.equal(shown(NOTE, '## Second'), '## Second\nsecond body\n\n- item one\n  - child a\n    - grandchild\n  - child b\n- item two');
  assert.equal(shown('## A\ntext\n\n\n', '## A'), '## A\ntext');
});

test('a paragraph zooms to the section it is in', () => {
  assert.equal(shown(NOTE, 'first body'), '## First\nfirst body\n### Deep\ndeep body');
  assert.equal(shown(NOTE, 'deep body'), '### Deep\ndeep body');
});

test('a list item zooms to itself and what is nested in it', () => {
  assert.equal(shown(NOTE, '- item one'), '- item one\n  - child a\n    - grandchild\n  - child b');
  assert.equal(shown(NOTE, '  - child a'), '  - child a\n    - grandchild');
  assert.equal(shown(NOTE, '    - grandchild'), '    - grandchild');
  assert.equal(shown(NOTE, '- item two'), '- item two');
});

test('numbered and task items zoom too, and a continuation line belongs to its item', () => {
  const note = '1. one\n   more of one\n   - [ ] sub\n2. two';
  assert.equal(shown(note, '1. one'), '1. one\n   more of one\n   - [ ] sub');
  assert.equal(shown(note, 'more of one'), '1. one\n   more of one\n   - [ ] sub');
  assert.equal(shown(note, '- [ ] sub'), '   - [ ] sub');
});

test('a blank line inside an item keeps the rest of it', () => {
  const note = '- item\n\n  second paragraph\n- next';
  assert.equal(shown(note, '- item'), '- item\n\n  second paragraph');
});

test('code blocks hide fake headings and items', () => {
  const note = '# Real\n```\n# not a heading\n- not an item\n```\ntext\n# Next';
  assert.equal(shown(note, '# Real'), '# Real\n```\n# not a heading\n- not an item\n```\ntext');
  assert.equal(shown(note, '# not a heading'), '# Real\n```\n# not a heading\n- not an item\n```\ntext');
});

test('an indented code block stays with its item', () => {
  const note = '- item\n  ```js\n  const a = 1;\n  ```\n- next';
  assert.equal(shown(note, '- item'), '- item\n  ```js\n  const a = 1;\n  ```');
});

test('front matter is not a heading or a list', () => {
  const note = '---\ntitle: x\n# not\n---\n# Real\ntext';
  assert.equal(shown(note, '# Real'), '# Real\ntext');
  assert.equal(shown(note, 'title'), null);
});

test('nothing to zoom into above the first heading', () => {
  assert.equal(shown('plain text\n\n# Later', 'plain'), null);
  assert.equal(zoomRange('', 0), null);
});

test('Windows line endings do not leak into the range', () => {
  const note = '# A\r\ntext\r\n## B\r\nmore';
  const r = zoomRange(note, 0);
  assert.equal(note.slice(r!.from, r!.to), '# A\r\ntext\r\n## B\r\nmore'.replace(/\r$/, ''));
  const b = zoomRange(note, note.indexOf('## B'));
  assert.equal(note.slice(b!.from, b!.to), '## B\r\nmore');
});

test('one level up: the parent heading, or the item an item is nested in', () => {
  const up = (text: string, at: string) => {
    const from = zoomRange(text, text.indexOf(at))!.from;
    const p = parentRange(text, from);
    return p ? text.slice(p.from, p.to) : null;
  };
  assert.equal(up(NOTE, '### Deep'), '## First\nfirst body\n### Deep\ndeep body');
  assert.equal(up(NOTE, '## First')!.startsWith('# Title'), true);
  assert.equal(up(NOTE, '# Title'), null);
  assert.equal(up(NOTE, '    - grandchild'), '  - child a\n    - grandchild');
  assert.equal(up(NOTE, '  - child a'), '- item one\n  - child a\n    - grandchild\n  - child b');
  assert.equal(up(NOTE, '- item one')!.startsWith('## Second'), true);
  assert.equal(up('- a\n- b', '- b'), null);
});

test('breadcrumbs run from the top to where you are', () => {
  const at = (s: string) => NOTE.indexOf(s);
  assert.deepEqual(breadcrumbs(NOTE, at('### Deep')), [
    { from: 0, label: 'Title' },
    { from: at('## First'), label: 'First' },
    { from: at('### Deep'), label: 'Deep' },
  ]);
  assert.deepEqual(breadcrumbs(NOTE, at('    - grandchild')).map((c) => c.label), ['Title', 'Second', 'item one', 'child a', 'grandchild']);
  assert.deepEqual(breadcrumbs('- a\n  - b', 4).map((c) => c.label), ['a', 'b']);
});

test('labels lose their markup', () => {
  assert.equal(cleanLabel('## **Bold** and [[Note|alias]] ##'), 'Bold and alias');
  assert.equal(cleanLabel('  - [ ] Call [Bob](https://x.y) ^abc'), 'Call Bob');
  assert.equal(cleanLabel('3. `code` [[Other]]'), 'code Other');
  assert.equal(cleanLabel('## '), '(empty)');
});
