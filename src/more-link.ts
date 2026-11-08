// Canonical copy: obsidian-dev/tools/more-plugins/more-link.ts. `node tools/more-plugins/link-rollout.mjs
// <clone>...` writes it to `src/more-link.ts` in each plugin, next to a generated `src/more-list.ts` (the
// three picks for that plugin, built from plugins.json). Edit it here, never in a plugin.
//
// A small "More plugins by Siulved54" block at the end of the settings tab: up to three other free plugins,
// each with a one-line description and a View button. The button opens that plugin's page inside Obsidian
// (obsidian://show-plugin). No pop-up, no notice, no network request, no counting: nothing happens until a click.
import { PICKS } from './more-list.ts';

export interface MorePick {
	id: string;
	name: string;
	desc: string;
}

/** The parts of Obsidian's `Setting` and `ButtonComponent` used here, so this file never imports `obsidian`. */
export interface ButtonLike {
	setButtonText(text: string): this;
	onClick(callback: () => unknown): this;
}
export interface SettingLike {
	setName(name: string): this;
	setDesc(desc: string): this;
	setHeading(): this;
	addButton(callback: (button: ButtonLike) => unknown): this;
}

interface MoreText {
	heading: string;
	button: string;
}

const ENGLISH: MoreText = { heading: 'More plugins by Siulved54', button: 'View' };

const TEXT: Record<string, MoreText | undefined> = {
	en: ENGLISH,
	zh: { heading: 'Siulved54 的更多插件', button: '查看' },
	ja: { heading: 'Siulved54 のその他のプラグイン', button: '表示' },
	ko: { heading: 'Siulved54의 다른 플러그인', button: '보기' },
	es: { heading: 'Más plugins de Siulved54', button: 'Ver' },
	de: { heading: 'Weitere Plugins von Siulved54', button: 'Ansehen' },
	fr: { heading: 'Autres plugins de Siulved54', button: 'Voir' },
	'pt-BR': { heading: 'Mais plugins do Siulved54', button: 'Ver' },
	ru: { heading: 'Другие плагины Siulved54', button: 'Открыть' },
};

/** The text for an Obsidian language code ("es", "pt-BR", "en-GB"...); English when unknown. */
export function moreText(lang: string = defaultLang()): MoreText {
	return TEXT[lang] ?? TEXT[lang.split('-')[0] ?? ''] ?? ENGLISH;
}

function defaultLang(): string {
	return (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
}

/** Fixed on purpose: Obsidian's own link to a community plugin's page, from the generated list only. */
export function moreUrl(id: string): string {
	return `obsidian://show-plugin?id=${encodeURIComponent(id)}`;
}

export function morePicks(): readonly MorePick[] {
	return PICKS;
}

/** Opens a plugin's page in Obsidian. Called only from a click handler. */
export function openMore(id: string): void {
	if (PICKS.some((p) => p.id === id)) window.open(moreUrl(id));
}

/** Pre-1.13 settings tab: appends the block to `display()`. `make` is `(el) => new Setting(el)`. */
export function renderMore(containerEl: HTMLElement, make: (el: HTMLElement) => SettingLike, lang?: string): void {
	if (!PICKS.length) return;
	const text = moreText(lang);
	make(containerEl).setName(text.heading).setHeading();
	for (const pick of PICKS) {
		make(containerEl)
			.setName(pick.name)
			.setDesc(pick.desc)
			.addButton((b) => b.setButtonText(text.button).onClick(() => openMore(pick.id)));
	}
}

/** Settings 1.13+: the same block as one group of definitions. Cast to `SettingDefinitionItem[]` in main.ts. */
export function moreDefinitions(lang?: string): unknown[] {
	if (!PICKS.length) return [];
	const text = moreText(lang);
	return [
		{
			type: 'group',
			heading: text.heading,
			items: PICKS.map((pick) => ({
				name: pick.name,
				desc: pick.desc,
				searchable: false,
				render: (setting: SettingLike) => {
					setting.addButton((b) => b.setButtonText(text.button).onClick(() => openMore(pick.id)));
				},
			})),
		},
	];
}
