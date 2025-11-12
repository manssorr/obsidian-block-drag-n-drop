[![Project Status: Inactive – The project has reached a stable, usable state but is no longer being actively developed; support/maintenance will be provided as time allows.](https://www.repostatus.org/badges/latest/inactive.svg)](https://www.repostatus.org/#inactive)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/artem-barmin/obsidian-block-drag-n-drop)

> **Note:** This is a modified version of the original plugin with bug fixes and enhancements. The original plugin can be found at: [artem-barmin/obsidian-block-drag-n-drop](https://github.com/artem-barmin/obsidian-block-drag-n-drop)

# Demo

![Demo](https://raw.githubusercontent.com/artem-barmin/obsidian-block-drag-n-drop/master/demo/demo.gif)

# Features

-   ✅ Drag-n-drop for list items in the same pane and between different panes
-   ✅ 3 modes:
    -   embed block - default for moving between different panes
    -   move block - default for moving in the same pane
    -   copy block - Shift + drag
-   ✅ Ability to reorder items keeping their nested level(like Notion)
    -   Drop to the **right** of intendation dot • to nest dragged item under the previous item
    -   Drop to the **left** of intendation dot • to keep intendation level and just reorder items
-   ✅ Automatic reference link generation for dragged block
-   ✅ Live editor support

# No planned

-   [ ] Support for arbitrary block dragging - paragraphs, headings etc

Feel free to create feature requests HERE: https://github.com/artem-barmin/obsidian-block-drag-n-drop/issues

# How to use

You can see a drag-n-drop handler in the gutter. You can drag it and drop at line you want.

For now you can drag only list items, so handler will appear only near lines that belongs to list

## Defaults

-   Drag and drop from one pane to another without modifiers will create embed link for the block. Id for block will be automatically created.
-   Drag and drop in the same pane without modifiers will move the block.
-   Drag and drop with "Shift" modifier will copy the block.

You can change behavior for settings in the plugin settings tab.

# How to install

## From within Obsidian

You can activate this plugin within Obsidian by doing the following:

-   Open Settings > Third-party plugin
-   Make sure Safe mode is off
-   Click Browse community plugins
-   Search for "Drag-n-Drop"
-   Click Install
-   Once installed, close the community plugins window and activate the newly installed plugin

## Manual installation

Download main.js, manifest.json, styles.css from the latest release and put them into <vault>/.obsidian/plugins/obsidian-outliner folder.

# Limitations

Plugin was developed and tested only with Live preview editor. Legacy editor not supported

# Changelog

## Enhanced Version (Modified Fork)

This version includes significant bug fixes and improvements over the original plugin:

### Bug Fixes

- **Fixed highlight persistence bug**: Highlights now properly clear when:
  - Dragging outside the editor area
  - Switching windows or applications
  - Pressing Escape during drag
  - Clicking anywhere after a drag operation
  - Releasing mouse button after drag
  - Window loses focus or becomes hidden
- **Fixed TypeScript compilation errors**: Updated dependencies and type annotations
- **Fixed build configuration**: Corrected ESBuild setup for proper plugin bundling

### UI Enhancements

- **Notion-style drag handle**: Replaced text-based handle with a modern 6-dot SVG handle
- **Custom drag preview**: Added shadow effect to drag preview for better visual feedback
- **Handle visibility toggle**: Added setting to show handles on hover or always visible

### Technical Improvements

- **Optimized highlight clearing**: Implemented efficient decoration set reuse
- **Comprehensive event handling**: Added multiple event listeners (dragend, blur, visibilitychange, mouseup, pointerup) to ensure highlights always clear properly
- **Better Electron compatibility**: Improved event handling for Electron/Obsidian environment
- **Code quality**: Improved type safety and error handling

### Original Plugin

The original plugin by Artem Barmin can be found at:
- **Repository**: https://github.com/artem-barmin/obsidian-block-drag-n-drop
- **Author**: Artem Barmin
- **License**: GPLV3
