// Canonical copy: obsidian-dev/tools/more-plugins/more-link.test.ts, written to `tests/more-link.test.ts`
// by tools/more-plugins/link-rollout.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';

import type { ButtonLike, SettingLike } from '../src/more-link.ts';
import { moreDefinitions, morePicks, moreText, moreUrl, renderMore } from '../src/more-link.ts';

test('at most three picks, each with an id, name and short description', () => {
	const picks = morePicks();
	assert.ok(picks.length <= 3);
	for (const p of picks) {
		assert.match(p.id, /^[a-z0-9-]+$/);
		assert.ok(p.name && p.desc && p.desc.length <= 60);
		assert.ok(!/[<>]/.test(p.name + p.desc));
	}
	assert.equal(new Set(morePicks().map((p) => p.id)).size, picks.length);
});

test('every link is an obsidian://show-plugin URL, never http(s)', () => {
	for (const p of morePicks()) assert.equal(moreUrl(p.id), `obsidian://show-plugin?id=${p.id}`);
});

test('texts exist for every language and fall back to English', () => {
	for (const lang of ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt-BR', 'ru']) {
		const t = moreText(lang);
		assert.ok(t.heading && t.button);
	}
	assert.equal(moreText('es-MX').button, moreText('es').button);
	assert.equal(moreText('xx').heading, moreText('en').heading);
});

test('renderMore draws a heading plus one row per pick, and nothing happens until a click', () => {
	const calls: string[] = [];
	class Button implements ButtonLike {
		setButtonText(text: string) { calls.push(`button:${text}`); return this; }
		onClick() { return this; }
	}
	class Row implements SettingLike {
		setName(name: string) { calls.push(`name:${name}`); return this; }
		setDesc(desc: string) { calls.push(`desc:${desc}`); return this; }
		setHeading() { calls.push('heading'); return this; }
		addButton(callback: (button: ButtonLike) => unknown) { callback(new Button()); return this; }
	}
	renderMore({} as HTMLElement, () => new Row(), 'en');
	assert.equal(calls.filter((c) => c === 'heading').length, morePicks().length ? 1 : 0);
	assert.equal(calls.filter((c) => c.startsWith('button:')).length, morePicks().length);
});

test('moreDefinitions is one group with a searchable:false row per pick', () => {
	const defs = moreDefinitions('en') as { type: string; items: { searchable: boolean }[] }[];
	if (!morePicks().length) return assert.deepEqual(defs, []);
	assert.equal(defs.length, 1);
	for (const group of defs) {
		assert.equal(group.type, 'group');
		assert.equal(group.items.length, morePicks().length);
		assert.ok(group.items.every((i) => i.searchable === false));
	}
});
