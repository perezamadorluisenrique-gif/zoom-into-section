import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type { EditorView } from '@codemirror/view';

import { currentZoom, zoomExtension, zoomIn, zoomOut, zoomParent } from './src/zoomExtension.ts';

interface ZoomSettings {
  /** Clicking the bullet of a list item zooms into it. */
  zoomOnBullet: boolean;
}

const DEFAULT_SETTINGS: ZoomSettings = { zoomOnBullet: true };

/** Names and descriptions shared by the 1.13+ declarative tab and the older `display()`. */
const TEXT = {
  zoomOnBullet: {
    name: 'Zoom in when clicking a bullet',
    desc: 'Click the bullet of a list item in Live Preview to zoom into it. Headings and list items also have the Zoom in command and the editor menu.',
  },
};

/** Obsidian does not type the editor's CodeMirror view, but it is there in every markdown editor. */
function viewOf(editor: Editor): EditorView | null {
  return (editor as unknown as { cm?: EditorView }).cm ?? null;
}

export default class ZoomIntoSectionPlugin extends Plugin {
  settings: ZoomSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    await this.loadSettings();
    this.applyBodyClass();
    this.addSettingTab(new ZoomSettingTab(this.app, this));

    this.registerEditorExtension(
      zoomExtension({
        title: (view) => this.titleOf(view),
        zoomOnBullet: () => this.settings.zoomOnBullet,
      }),
    );

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
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const md = leaf.view;
      if (md instanceof MarkdownView && viewOf(md.editor) === view) return md.file?.basename ?? 'Note';
    }
    return 'Note';
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<ZoomSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyBodyClass();
  }

  onunload() {
    document.body.removeClass('zoom-into-section-bullets');
  }

  private applyBodyClass() {
    document.body.toggleClass('zoom-into-section-bullets', this.settings.zoomOnBullet);
  }
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
    return [{ ...TEXT.zoomOnBullet, control: { type: 'toggle', key: 'zoomOnBullet', defaultValue: DEFAULT_SETTINGS.zoomOnBullet } }];
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
  }
}
