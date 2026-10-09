import { App, Editor, FuzzySuggestModal, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionItem, WorkspaceLeaf } from 'obsidian';
import type { EditorView } from '@codemirror/view';

import { describeZoom, listHeadings, resolveSubpath, resolveZoom } from './src/outline.ts';
import type { Heading, ZoomRef } from './src/outline.ts';
import { currentZoom, zoomAt, zoomExtension, zoomIn, zoomOut, zoomParent, zoomTo } from './src/zoomExtension.ts';

interface ZoomSettings {
  /** Clicking the bullet of a list item zooms into it. */
  zoomOnBullet: boolean;
  /** Escape zooms out one level. */
  escapeZoomsOut: boolean;
  /** Following a link to a heading or list item opens the note zoomed into it. */
  zoomOnLink: boolean;
  /** Going back to a note that was zoomed in a tab zooms it again, also after a restart. */
  rememberZoom: boolean;
}

const DEFAULT_SETTINGS: ZoomSettings = { zoomOnBullet: true, escapeZoomsOut: false, zoomOnLink: false, rememberZoom: true };

/** The zoom of each note in each tab: tab id, then note path. Kept in data.json next to the settings. */
type TabZooms = Record<string, Record<string, ZoomRef>>;

/** Notes remembered per tab, so a tab that browses many notes does not grow without end. */
const MAX_PER_TAB = 30;

/** Names and descriptions shared by the 1.13+ declarative tab and the older `display()`. */
const TEXT = {
  zoomOnBullet: {
    name: 'Zoom in when clicking a bullet',
    desc: 'Click the bullet of a list item in Live Preview to zoom into it. Headings and list items also have the Zoom in command and the editor menu.',
  },
  escapeZoomsOut: {
    name: 'Escape zooms out',
    desc: 'While zoomed, pressing Escape in the editor goes up one level, and out of the zoom at the top. Leave it off if you use Vim key bindings.',
  },
  zoomOnLink: {
    name: 'Open links to a heading zoomed in',
    desc: 'Following a link such as [[Note#Heading]] or a link to a list item opens the note zoomed into that section or item. Links to a whole note are not affected.',
  },
  rememberZoom: {
    name: 'Remember the zoom in each tab',
    desc: 'Going back to a note that was zoomed in a tab zooms it again, also after restarting Obsidian. The zoom is dropped if its heading is gone.',
  },
};

/** Obsidian does not type the editor's CodeMirror view, but it is there in every markdown editor. */
function viewOf(editor: Editor): EditorView | null {
  return (editor as unknown as { cm?: EditorView }).cm ?? null;
}

/** Pick one heading of the note; choosing it zooms straight into it. */
class HeadingPicker extends FuzzySuggestModal<Heading> {
  constructor(
    app: App,
    private headings: Heading[],
    private choose: (heading: Heading) => void,
  ) {
    super(app);
    this.setPlaceholder('Zoom into a heading');
  }

  getItems(): Heading[] {
    return this.headings;
  }

  getItemText(heading: Heading): string {
    return `${'#'.repeat(heading.level)} ${heading.label}`;
  }

  onChooseItem(heading: Heading): void {
    this.choose(heading);
  }
}

type EphemeralSetter = (this: MarkdownView, state: unknown) => void;

/** The tab id Obsidian keeps in the layout. It is not in the typings. */
function leafId(leaf: WorkspaceLeaf): string | null {
  const id = (leaf as unknown as { id?: unknown }).id;
  return typeof id === 'string' && id !== '' ? id : null;
}

export default class ZoomIntoSectionPlugin extends Plugin {
  settings: ZoomSettings = { ...DEFAULT_SETTINGS };
  private tabs: TabZooms = {};
  private alive = false;
  private saveTimer: number | undefined;
  private editTimers = new Map<EditorView, number>();

  async onload() {
    this.alive = true;
    await this.loadSettings();
    this.applyBodyClass();
    this.addSettingTab(new ZoomSettingTab(this.app, this));

    this.registerEditorExtension(
      zoomExtension({
        title: (view) => this.titleOf(view),
        zoomOnBullet: () => this.settings.zoomOnBullet,
        escapeZoomsOut: () => this.settings.escapeZoomsOut,
        onZoom: (view, edited) => this.zoomChanged(view, edited),
      }),
    );

    this.addCommand({
      id: 'zoom-heading',
      name: 'Zoom into a heading…',
      icon: 'heading',
      editorCallback: (editor) => {
        const view = viewOf(editor);
        if (!view) return;
        const headings = listHeadings(editor.getValue());
        if (headings.length === 0) {
          new Notice('This note has no headings.');
          return;
        }
        new HeadingPicker(this.app, headings, (h) => {
          zoomAt(view, h.from);
          view.focus();
        }).open();
      },
    });

    this.addCommand({
      id: 'zoom-in',
      name: 'Zoom in on the heading or list item at the cursor',
      icon: 'zoom-in',
      editorCallback: (editor) => {
        const view = viewOf(editor);
        if (view) zoomIn(view);
      },
    });
    this.addCommand({
      id: 'zoom-parent',
      name: 'Zoom out one level',
      icon: 'corner-left-up',
      editorCheckCallback: (checking, editor) => {
        const view = viewOf(editor);
        if (!view || !currentZoom(view.state)) return false;
        if (!checking) zoomParent(view);
        return true;
      },
    });
    this.addCommand({
      id: 'zoom-out',
      name: 'Zoom out to the whole note',
      icon: 'zoom-out',
      editorCheckCallback: (checking, editor) => {
        const view = viewOf(editor);
        if (!view || !currentZoom(view.state)) return false;
        if (!checking) zoomOut(view);
        return true;
      },
    });

    this.watchLinks();
    this.registerEvent(this.app.workspace.on('file-open', () => {
      const leaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
      if (leaf) this.restore(leaf);
    }));
    this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => leaf && this.restore(leaf)));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.prune()));
    this.registerEvent(this.app.workspace.on('quit', () => void this.persist()));
    this.app.workspace.onLayoutReady(() => this.restoreAll());

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        const view = viewOf(editor);
        if (!view) return;
        const zoomed = currentZoom(view.state) !== null;
        menu.addItem((item) =>
          item
            .setTitle(zoomed ? 'Zoom out to the whole note' : 'Zoom in')
            .setIcon(zoomed ? 'zoom-out' : 'zoom-in')
            .setSection('selection')
            .onClick(() => (zoomed ? zoomOut(view) : zoomIn(view))),
        );
      }),
    );
  }

  /** The name of the note an editor is showing, for the first crumb. */
  private titleOf(view: EditorView): string {
    return this.markdownViewOf(view)?.file?.basename ?? 'Note';
  }

  private markdownViewOf(view: EditorView): MarkdownView | null {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const md = leaf.view;
      if (md instanceof MarkdownView && viewOf(md.editor) === view) return md;
    }
    return null;
  }

  // --- Links: open a heading or list item link zoomed in --------------------------------------------------

  /**
   * Obsidian hands a link's `#Heading` or `#^block` to the markdown view as the `subpath` of its ephemeral
   * state, after the note is loaded and for every way of following a link (click, new tab, switcher). That
   * is the one place the target is known, so it is wrapped for the time the plugin is on.
   */
  private watchLinks() {
    const proto = MarkdownView.prototype as unknown as { setEphemeralState: EphemeralSetter };
    const original = proto.setEphemeralState;
    const opened = (md: MarkdownView, state: unknown) => {
      if (!this.alive) return;
      try {
        this.linkOpened(md, state);
      } catch (e) {
        console.error('Zoom Into Section: could not zoom into the link', e);
      }
    };
    const patched: EphemeralSetter = function (this: MarkdownView, state: unknown) {
      original.call(this, state);
      opened(this, state);
    };
    proto.setEphemeralState = patched;
    this.register(() => {
      this.alive = false;
      if (proto.setEphemeralState === patched) proto.setEphemeralState = original;
    });
  }

  private linkOpened(md: MarkdownView, state: unknown) {
    if (!this.settings.zoomOnLink || md.getMode() !== 'source') return;
    const subpath = (state as { subpath?: unknown } | null)?.subpath;
    if (typeof subpath !== 'string' || subpath === '') return;
    const cm = viewOf(md.editor);
    if (!cm) return;
    const range = resolveSubpath(cm.state.doc.toString(), subpath);
    if (range) zoomTo(cm, range);
  }

  // --- Tabs: remember the zoom of each note ---------------------------------------------------------------

  private zoomChanged(cm: EditorView, edited: boolean) {
    if (!this.settings.rememberZoom) return;
    window.clearTimeout(this.editTimers.get(cm));
    if (!edited) {
      this.editTimers.delete(cm);
      this.remember(cm, true);
      return;
    }
    // Typing in the zoomed heading changes the text to look for later: refresh it once typing pauses.
    this.editTimers.set(
      cm,
      window.setTimeout(() => {
        this.editTimers.delete(cm);
        this.remember(cm, false);
      }, 1000),
    );
  }

  /** Store the zoom of this editor's note in its tab. `forget` also removes the entry when the zoom is off. */
  private remember(cm: EditorView, forget: boolean) {
    const md = this.markdownViewOf(cm);
    const id = md ? leafId(md.leaf) : null;
    const path = md?.file?.path;
    if (!id || !path) return;
    const zoom = currentZoom(cm.state);
    const ref = zoom ? describeZoom(cm.state.doc.toString(), zoom.from) : null;
    const notes = this.tabs[id] ?? {};
    if (ref) {
      delete notes[path];
      notes[path] = ref;
      for (const old of Object.keys(notes).slice(0, Math.max(0, Object.keys(notes).length - MAX_PER_TAB))) delete notes[old];
      this.tabs[id] = notes;
    } else if (forget && notes[path]) {
      delete notes[path];
      if (Object.keys(notes).length === 0) delete this.tabs[id];
    } else {
      return;
    }
    this.scheduleSave();
  }

  /** Zoom a tab again into what it had zoomed for the note it shows now. */
  private restore(leaf: WorkspaceLeaf, attempt = 0) {
    if (!this.alive || !this.settings.rememberZoom) return;
    const md = leaf.view;
    if (!(md instanceof MarkdownView)) return;
    const id = leafId(leaf);
    const path = md.file?.path;
    const ref = id && path ? this.tabs[id]?.[path] : undefined;
    if (!id || !path || !ref) return;
    const cm = viewOf(md.editor);
    const text = cm?.state.doc.toString() ?? '';
    if (!cm || text === '') {
      // The note is still loading.
      if (attempt < 20) window.setTimeout(() => this.restore(leaf, attempt + 1), 100);
      return;
    }
    if (currentZoom(cm.state)) return;
    const range = resolveZoom(text, ref);
    if (range) {
      zoomTo(cm, range);
    } else {
      delete this.tabs[id][path];
      this.scheduleSave();
    }
  }

  private restoreAll() {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) this.restore(leaf);
  }

  /** Forget tabs that are closed. Not before the layout is back, when tabs are still being created. */
  private prune() {
    if (!this.app.workspace.layoutReady) return;
    const open = new Set<string>();
    this.app.workspace.iterateAllLeaves((leaf) => {
      const id = leafId(leaf);
      if (id) open.add(id);
    });
    if (open.size === 0) return;
    let changed = false;
    for (const id of Object.keys(this.tabs)) {
      if (!open.has(id)) {
        delete this.tabs[id];
        changed = true;
      }
    }
    if (changed) this.scheduleSave();
  }

  private scheduleSave() {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.persist(), 500);
  }

  private async persist() {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    // Nothing is kept about the notes when remembering is off.
    if (!this.settings.rememberZoom) this.tabs = {};
    await this.saveData({ ...this.settings, tabs: this.tabs });
  }

  async loadSettings() {
    const data = (await this.loadData()) as (Partial<ZoomSettings> & { tabs?: unknown }) | null;
    const { tabs, ...saved } = data ?? {};
    this.settings = { ...DEFAULT_SETTINGS, ...saved };
    this.tabs = isTabZooms(tabs) ? tabs : {};
  }

  async saveSettings() {
    await this.persist();
    this.applyBodyClass();
  }

  onunload() {
    activeDocument.body.removeClass('zoom-into-section-bullets');
    for (const t of this.editTimers.values()) window.clearTimeout(t);
    this.editTimers.clear();
    if (this.saveTimer !== undefined) void this.persist();
  }

  private applyBodyClass() {
    activeDocument.body.toggleClass('zoom-into-section-bullets', this.settings.zoomOnBullet);
  }
}

function isTabZooms(value: unknown): value is TabZooms {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (notes) =>
      typeof notes === 'object' &&
      notes !== null &&
      Object.values(notes as Record<string, unknown>).every((r) => typeof r === 'object' && r !== null && typeof (r as ZoomRef).line === 'string' && Number.isInteger((r as ZoomRef).nth)),
  );
}

class ZoomSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: ZoomIntoSectionPlugin,
  ) {
    super(app, plugin);
  }

  /**
   * The settings, described rather than drawn. Obsidian 1.13 and later
   * renders this itself and indexes it for the settings search. Older
   * versions ignore it and call `display()`.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      { ...TEXT.zoomOnBullet, control: { type: 'toggle', key: 'zoomOnBullet', defaultValue: DEFAULT_SETTINGS.zoomOnBullet } },
      { ...TEXT.escapeZoomsOut, control: { type: 'toggle', key: 'escapeZoomsOut', defaultValue: DEFAULT_SETTINGS.escapeZoomsOut } },
      { ...TEXT.zoomOnLink, control: { type: 'toggle', key: 'zoomOnLink', defaultValue: DEFAULT_SETTINGS.zoomOnLink } },
      { ...TEXT.rememberZoom, control: { type: 'toggle', key: 'rememberZoom', defaultValue: DEFAULT_SETTINGS.rememberZoom } },
    ];
  }

  getControlValue(key: string): unknown {
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    Object.assign(this.plugin.settings, { [key]: value });
    await this.plugin.saveSettings();
  }

  /** The pre-1.13 rendering, from the same text. Obsidian skips it once `getSettingDefinitions()` returns anything. */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName(TEXT.zoomOnBullet.name)
      .setDesc(TEXT.zoomOnBullet.desc)
      .addToggle((t) => t.setValue(this.plugin.settings.zoomOnBullet).onChange((v) => this.setControlValue('zoomOnBullet', v)));
    new Setting(containerEl)
      .setName(TEXT.escapeZoomsOut.name)
      .setDesc(TEXT.escapeZoomsOut.desc)
      .addToggle((t) => t.setValue(this.plugin.settings.escapeZoomsOut).onChange((v) => this.setControlValue('escapeZoomsOut', v)));
    new Setting(containerEl)
      .setName(TEXT.zoomOnLink.name)
      .setDesc(TEXT.zoomOnLink.desc)
      .addToggle((t) => t.setValue(this.plugin.settings.zoomOnLink).onChange((v) => this.setControlValue('zoomOnLink', v)));
    new Setting(containerEl)
      .setName(TEXT.rememberZoom.name)
      .setDesc(TEXT.rememberZoom.desc)
      .addToggle((t) => t.setValue(this.plugin.settings.rememberZoom).onChange((v) => this.setControlValue('rememberZoom', v)));
  }
}
