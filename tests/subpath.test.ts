import test from 'node:test';
import assert from 'node:assert/strict';

import { describeZoom, listHeadings, resolveSubpath, resolveZoom } from '../src/outline.ts';

const NOTE = [
  '# Title',
  'intro',
  '## First',
  'first body',
  '### Deep',
  'deep body',
  '## Second',
  'second body',
  '### Deep',
  'other deep',
  '',
  '- item one ^one',
  '  - child a',
  '- item two',
  '',
  'a paragraph ^para',
  '',
  '```',
  '# fake',
  '- not ^code',
  '```',
  '## Third: Q&A **now**',
  'third body',
].join('\n');

const at = (sub: string, text = NOTE) => {
  const r = resolveSubpath(text, sub);
  return r ? text.slice(r.from, r.to) : null;
};

test('a heading link resolves to its section', () => {
  assert.equal(at('#First'), '## First\nfirst body\n### Deep\ndeep body');
  assert.equal(at('#deep'), '### Deep\ndeep body');
});

test('matching ignores case, spacing and the characters links cannot hold', () => {
  assert.equal(at('#THIRD Q&A now'), '## Third: Q&A **now**\nthird body');
  assert.equal(at('#Third Q&A **now**'), '## Third: Q&A **now**\nthird body');
  assert.equal(at('#  first  '), '## First\nfirst body\n### Deep\ndeep body');
});

test('nested headings are looked for under the one before', () => {
  assert.equal(at('#Second#Deep')?.split('\n\n')[0], '### Deep\nother deep');
  assert.equal(at('#First#Deep'), '### Deep\ndeep body');
  assert.equal(at('#Third#Deep'), null);
  // A heading of the same or a higher level is not "under" it.
  assert.equal(at('#Deep#First'), null);
  assert.equal(at('#Title#Second#Deep')?.split('\n\n')[0], '### Deep\nother deep');
});

test('a block link to a list item zooms to the item and what is nested in it', () => {
  assert.equal(at('#^one'), '- item one ^one\n  - child a');
  assert.equal(at('#^ONE'), '- item one ^one\n  - child a');
  assert.equal(at('#Second#^one'), '- item one ^one\n  - child a');
});

test('a block link outside the named section, to a paragraph, or inside code does not resolve', () => {
  assert.equal(at('#First#^one'), null);
  assert.equal(at('#^para'), null);
  assert.equal(at('#^code'), null);
  assert.equal(at('#^missing'), null);
});

test('empty and unknown subpaths do not resolve', () => {
  assert.equal(at(''), null);
  assert.equal(at('#'), null);
  assert.equal(at('#^'), null);
  assert.equal(at('#Nope'), null);
  assert.equal(at('#fake'), null);
});

test('a heading without a body and a link in a note with properties', () => {
  const text = '---\ntitle: x\n---\n# Top\n## Empty\n## Next';
  assert.equal(at('#Empty', text), '## Empty');
  assert.equal(at('#title', text), null);
});

test('listHeadings gives levels and clean labels, skipping code', () => {
  const hs = listHeadings(NOTE);
  assert.deepEqual(
    hs.map((h) => [h.level, h.label]),
    [[1, 'Title'], [2, 'First'], [3, 'Deep'], [2, 'Second'], [3, 'Deep'], [2, 'Third: Q&A now']],
  );
  assert.equal(NOTE.slice(hs[1].from, hs[1].from + 8), '## First');
});

test('a zoom is described by its line and found again after the lines above change', () => {
  const second = NOTE.indexOf('### Deep', NOTE.indexOf('## Second'));
  const ref = describeZoom(NOTE, second);
  assert.deepEqual(ref, { line: '### Deep', nth: 1 });
  const edited = 'new first line\n\n' + NOTE;
  const r = resolveZoom(edited, ref!)!;
  assert.equal(edited.slice(r.from, r.to).split('\n\n')[0], '### Deep\nother deep');
});

test('a zoom into a list item is described and found as well', () => {
  const ref = describeZoom(NOTE, NOTE.indexOf('- item two'));
  assert.deepEqual(ref, { line: '- item two', nth: 0 });
  const r = resolveZoom(NOTE, ref!)!;
  assert.equal(NOTE.slice(r.from, r.to), '- item two');
});

test('a zoom whose heading is gone, renamed or no longer a heading is dropped', () => {
  const ref = describeZoom(NOTE, NOTE.indexOf('## First'))!;
  assert.equal(resolveZoom(NOTE.replace('## First', '## Renamed'), ref), null);
  assert.equal(resolveZoom(NOTE.replace('## First', 'First'), ref), null);
  assert.equal(resolveZoom(NOTE.replace('### Deep\ndeep body\n', ''), { line: '### Deep', nth: 1 }), null);
  assert.equal(resolveZoom('', ref), null);
});

test('only the start of a heading or list item can be described', () => {
  assert.equal(describeZoom(NOTE, NOTE.indexOf('intro')), null);
  assert.equal(describeZoom(NOTE, NOTE.indexOf('## First') + 1), null);
  assert.equal(describeZoom(NOTE, NOTE.indexOf('# fake')), null);
});
