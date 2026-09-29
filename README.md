# Zoom Into Section

Focus on one heading or one list item. Everything else in the note disappears
until you zoom back out.

![A note zoomed into its "First" section: only that heading and the one under it show, with a bar above reading Zoom, Title, First](https://raw.githubusercontent.com/perezamadorluisenrique-gif/zoom-into-section/main/docs/heading.png)

Put the cursor on a heading, or anywhere in its section, and run **Zoom in on
the heading or list item at the cursor**. Put it on a list item and you get that
item with everything nested under it.

![A list item zoomed: only "item one" and its nested items show, with the crumbs Zoom, Title, Second, item one](https://raw.githubusercontent.com/perezamadorluisenrique-gif/zoom-into-section/main/docs/list.png)

The bar above the note shows where you are, from the note's name down. Click
any crumb to zoom to that level, or the first one to see the whole note again.
Nothing in your note changes: zooming only hides lines.

Works in Live Preview and in source mode, with no fold settings to turn on
first. In reading view the note shows in full.

## What you can do

| To | Do this |
|---|---|
| Zoom in | Run the command, use **Zoom in** in the editor's right-click menu, or click a list bullet. |
| Zoom to a parent | Click a crumb in the bar. |
| Go up one level | The command **Zoom out one level**. From the top level it shows the whole note. |
| Zoom out | Click the first crumb, run **Zoom out to the whole note**, or use the right-click menu. |

The commands have no hotkeys by default; set the ones you want in **Settings →
Hotkeys**, for example Ctrl/Cmd + `.` to zoom in.

## Good to know

- **The cursor stays inside.** The arrow keys, a click or Ctrl+End cannot move
  it out of what you see. Jumping to something hidden from elsewhere, such as
  the outline, a link or a search result, leaves the zoom instead, so you
  always see where you landed.
- **Headings and list items are found from the text**, ignoring `#` lines
  inside code blocks and the properties block.
- **Editing works as usual** while zoomed, and the bar follows renamed headings.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Zoom in when clicking a bullet | on | Click the bullet of a list item in Live Preview to zoom into it. |
| Escape zooms out | off | While zoomed, Escape goes up one level, and out of the zoom at the top. Leave it off with Vim key bindings. |

## Coming from Zoom

This plugin does what [Zoom](https://github.com/vslinko/obsidian-zoom) does and
adds Zoom-out-one-level, clickable crumbs and the editor menu entry, and it
works without turning on **Fold heading** and **Fold indent** in Editor
settings. Turn the old plugin off first, or two bars will show. The old
plugin's hotkeys do not carry over, since plugins cannot read each other's
hotkeys: set new ones in Hotkeys.

## Installation

In Obsidian, open **Settings → Community plugins → Browse** and search for
"Zoom Into Section".

## More plugins by Siulved54

| Plugin | What it does | Source |
| --- | --- | --- |
| [Shared Blocks](https://obsidian.md/plugins?id=shared-blocks) | Write a block of text once and reuse it in any note. Edit the source and every reference re-renders live. | [shared-blocks](https://github.com/perezamadorluisenrique-gif/shared-blocks) |
| [Text Case and Cleanup](https://obsidian.md/plugins?id=text-format) | Change case, make camelCase or slugs, sort lines and remove duplicates, and repair text pasted out of a PDF, without touching code or URLs. | [text-format](https://github.com/perezamadorluisenrique-gif/text-format) |
| [Typography as You Type](https://obsidian.md/plugins?id=typography-as-you-type) | Curly quotes, dashes and ellipses as you type, kept out of code and maths, with Backspace to take one back. | [smart-typography-plugin](https://github.com/perezamadorluisenrique-gif/smart-typography-plugin) |
| [Section Numbering](https://obsidian.md/plugins?id=section-numbering) | Number headings as an outline (1, 1.1, 1.2) and keep every link to them working when they renumber. | [section-numbering](https://github.com/perezamadorluisenrique-gif/section-numbering) |
| [Spreadsheet to Table](https://obsidian.md/plugins?id=spreadsheet-to-table) | Paste cells from Excel or Google Sheets as a Markdown table with a real header, insert CSV files, and copy tables back out. | [spreadsheet-to-table](https://github.com/perezamadorluisenrique-gif/spreadsheet-to-table) |
| [Hybrid Line Numbers](https://obsidian.md/plugins?id=hybrid-line-numbers) | Relative and hybrid line numbers for Vim-style jumps, where a folded section counts as one line. | [hybrid-line-numbers](https://github.com/perezamadorluisenrique-gif/hybrid-line-numbers) |
| [List Item Callouts](https://obsidian.md/plugins?id=list-item-callouts) | Colour a single list item as a callout by starting it with a character such as `&`, `!` or `?`. | [list-item-callouts](https://github.com/perezamadorluisenrique-gif/list-item-callouts) |
| [Folder Counts](https://obsidian.md/plugins?id=folder-counts) | See how many notes each folder holds, right in the file explorer. | [folder-counts](https://github.com/perezamadorluisenrique-gif/folder-counts) |
| [Task Rollover](https://obsidian.md/plugins?id=task-rollover) | Move the unfinished tasks of your last daily note into today's note when it is created. | [task-rollover](https://github.com/perezamadorluisenrique-gif/task-rollover) |

## License

MIT
