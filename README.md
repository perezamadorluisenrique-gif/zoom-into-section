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
| Zoom into any heading | Run **Zoom into a heading…** and pick it from the list. |
| Zoom to a parent | Click a crumb in the bar. |
| Go up one level | The command **Zoom out one level**. From the top level it shows the whole note. |
| Zoom out | Click the first crumb, run **Zoom out to the whole note**, or use the right-click menu. |

The commands have no hotkeys by default; set the ones you want in **Settings →
Hotkeys**, for example Ctrl/Cmd + `.` to zoom in.

## Links, headings and tabs

- **Open links zoomed in.** Turn on **Open links to a heading zoomed in** and
  following `[[Note#Heading]]`, `[[#Heading]]`, a nested `[[Note#Heading#Subheading]]`
  or a link to a list item (`[[Note#^block-id]]`) opens the note zoomed into
  that section or item. It works for a click, Ctrl/Cmd + click in a new tab and
  anything else that opens a link. Links to a whole note, to a paragraph or to a
  heading that does not exist open the note as usual. It is off by default.
- **Zoom into a heading.** The command **Zoom into a heading…** lists the
  headings of the note; pick one to zoom straight into it, without moving the
  cursor first.
- **Each tab remembers its zoom.** Go to another note in a tab and come back, or
  use back and forward, and the note is zoomed as you left it. Tabs that are
  open when you quit are zoomed again when you start Obsidian. The zoom is kept
  as the heading's text, not a line number, so it follows the heading when the
  note changes above it, and is dropped if the heading is renamed or deleted.
  Leaving the zoom forgets it.

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
| Open links to a heading zoomed in | off | Following a link to a heading or list item opens the note zoomed into it. |
| Remember the zoom in each tab | on | Coming back to a note that was zoomed in a tab, also after restarting Obsidian, zooms it again. |

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
| [Folder Counts](https://obsidian.md/plugins?id=folder-counts) | See how many notes or files each folder holds, right in the file explorer, with a vault total and folder exclusions. | [folder-counts](https://github.com/perezamadorluisenrique-gif/folder-counts) |
| [Note Reading Time](https://obsidian.md/plugins?id=note-reading-time) | Reading time of the current note or your selection in the status bar, optionally saved to a property. | [note-reading-time](https://github.com/perezamadorluisenrique-gif/note-reading-time) |
| [Task Rollover](https://obsidian.md/plugins?id=task-rollover) | Roll unfinished tasks from your last daily note into today's when it is created, with a real undo. | [task-rollover](https://github.com/perezamadorluisenrique-gif/task-rollover) |
| [Link Title on Paste](https://obsidian.md/plugins?id=link-title-on-paste) | Paste a web address and get a Markdown link with the page's title, fetched in the background and undone in one step. | [link-title-on-paste](https://github.com/perezamadorluisenrique-gif/link-title-on-paste) |
| [Update Radar](https://obsidian.md/plugins?id=update-radar) | Checks your installed community plugins for updates in the background, shows what changed, and flags the ones that look abandoned. | [community-update-checker](https://github.com/perezamadorluisenrique-gif/community-update-checker) |
| [Dataview to Bases](https://obsidian.md/plugins?id=dataview-to-bases) | Convert Dataview queries into Bases blocks, and see which queries in your vault can be converted. | [dataview-to-bases](https://github.com/perezamadorluisenrique-gif/dataview-to-bases) |
| [Line Editing Commands](https://obsidian.md/plugins?id=line-editing-commands) | Duplicate, join, sort and reverse lines, insert blank lines and jump to a line number, with multi-cursor support. | [line-editing-commands](https://github.com/perezamadorluisenrique-gif/line-editing-commands) |
| [Note Mover Rules](https://obsidian.md/plugins?id=note-mover-rules) | Move notes into folders by ordered rules on tags, properties, titles and paths, with a preview before any bulk move. | [note-mover-rules](https://github.com/perezamadorluisenrique-gif/note-mover-rules) |
| [Tab History](https://obsidian.md/plugins?id=tab-history) | Keeps each tab's back and forward history across restarts, and adds commands to move, maximize and close tabs. | [tab-history](https://github.com/perezamadorluisenrique-gif/tab-history) |
| [URL Cards](https://obsidian.md/plugins?id=url-cards) | Shows web addresses as cards with title, description and image, and reads existing cardlink blocks. | [url-cards](https://github.com/perezamadorluisenrique-gif/url-cards) |
| [Vim Config](https://obsidian.md/plugins?id=vim-config) | Loads a vimrc-style file from your vault so your key mappings and editor commands are ready when vim mode starts. | [vim-config](https://github.com/perezamadorluisenrique-gif/vim-config) |
| [Task Archive](https://obsidian.md/plugins?id=task-archive) | Moves completed tasks, with their sub-items, into an archive section or note. | [task-archive](https://github.com/perezamadorluisenrique-gif/task-archive) |

All of them are in the community directory: Settings -> Community plugins ->
Browse, then search for the name.

## License

MIT
