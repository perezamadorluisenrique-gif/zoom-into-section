# Changelog

The release workflow uses the section named after the version being released
as the release description, so every version needs one. `npm version <x.y.z>`
renames the `Unreleased` heading below to that version.

## Unreleased

- Links to a heading, a nested heading or a list item (`[[Note#Heading]]`, `[[#Heading]]`, `[[Note#^id]]`) can open the note zoomed into that section: turn on "Open links to a heading zoomed in" (off by default). New command "Zoom into a heading…" picks a heading from a list and zooms into it.
- Each tab remembers the zoom of the notes it showed: go back to a zoomed note, or restart Obsidian, and it is zoomed again (setting "Remember the zoom in each tab", on by default). Turning the plugin on while notes are open no longer logs an error.

## 0.1.2

- Build the breadcrumb bar with Obsidian's own element helpers, which the directory review asks for. No change in behavior.

## 0.1.1

- Add the setting "Escape zooms out" (off by default): while zoomed, Escape in the editor goes up one level, and out of the zoom at the top.

## 0.1.0

- First release.
