import {
	Plugin,
	MarkdownView,
	PluginSettingTab,
	Setting,
	App,
	CachedMetadata,
	ListItemCache,
	SectionCache,
	DropdownComponent,
} from "obsidian";
import _ from "lodash";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit, Node } from "unist-util-visit";
import { RangeSetBuilder, Line } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	DecorationSet,
	BlockInfo,
	gutter,
	GutterMarker,
} from "@codemirror/view";

const dragHighlight = Decoration.line({ attributes: { class: "drag-over" } });
const dragDestination = Decoration.line({ attributes: { class: "drag-last" } });
const dragParentDestination = Decoration.line({
	attributes: { class: "drag-parent-last" },
});

type RemarkNode = {
	node: Node;
	parent: Node;
	height: number;
};

function findListItem(
	text: string,
	line: number,
	itemType: "listItem" | "paragraph"
): RemarkNode {
	const ast = unified().use(remarkParse).parse(text);
	const allItems: RemarkNode[] = [];
	visit(ast, itemType, (node, index, parent) => {
		const start = node.position.start.line;
		const end = node.position.end.line;
		if (start <= line && end >= line)
			allItems.push({
				node,
				parent,
				height: end - start,
			});
	});
	return _.minBy(allItems, "height");
}

function generateId(): string {
	return Math.random().toString(36).substr(2, 6);
}

function isRTLText(text: string): boolean {
	// RTL character ranges:
	// Arabic: \u0600-\u06FF
	// Hebrew: \u0590-\u05FF
	// Persian/Farsi: Uses Arabic script
	// Other RTL scripts
	const rtlPattern = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
	return rtlPattern.test(text);
}

const dragHandle = (line: number, app: App) =>
	new (class extends GutterMarker {
		toDOM(editor: EditorView) {
			const fileCache = findFile(app, editor);
			const block = (fileCache?.sections || []).find((s) =>
				findSection(s, line - 1)
			);
			const drag = document.createElement("div");
			if (!block || block.type !== "list") return drag;
			// TODO: think how to move paragraphs
			// if (!block || (block.type !== "list" && block.type !== "paragraph"))
			// 	return drag;
			
			// Detect RTL text direction
			const lineText = editor.state.doc.line(line).text;
			const isRTL = isRTLText(lineText);
			if (isRTL) {
				drag.setAttribute("data-rtl", "true");
			}
			
			// Create Notion-style 6-dot handle using SVG
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("viewBox", "0 0 10 16");
			svg.setAttribute("width", "10");
			svg.setAttribute("height", "16");
			svg.style.display = "block";
			svg.style.fill = "currentColor";
			svg.style.opacity = "0.3";
			
			// Create 6 dots in a 2x3 grid
			const dotPositions = [
				{ x: 2, y: 3 },  // top left
				{ x: 7, y: 3 },  // top right
				{ x: 2, y: 8 },  // middle left
				{ x: 7, y: 8 },  // middle right
				{ x: 2, y: 13 }, // bottom left
				{ x: 7, y: 13 }  // bottom right
			];
			
			dotPositions.forEach(pos => {
				const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
				circle.setAttribute("cx", pos.x.toString());
				circle.setAttribute("cy", pos.y.toString());
				circle.setAttribute("r", "1.5");
				svg.appendChild(circle);
			});
			
			drag.appendChild(svg);
			drag.className = "dnd-gutter-marker";
			drag.setAttribute("draggable", "true");
			
			drag.addEventListener("dragstart", (e: DragEvent) => {
				if (!e.dataTransfer) return;
				e.dataTransfer.setData("line", `${line}`);
				e.dataTransfer.effectAllowed = "copyMove";
				
				// Get line content for drag preview
				const lineContent = editor.state.doc.line(line).text.trim();
				const previewText = lineContent || "...";
				
				// Create drag preview shadow
				const preview = document.createElement("div");
				preview.className = "dnd-drag-preview";
				preview.textContent = previewText;
				document.body.appendChild(preview);
				
				// Set custom drag image with offset
				e.dataTransfer.setDragImage(preview, 10, 10);
				
				// Clean up preview after drag starts
				setTimeout(() => preview.remove(), 0);
				
				// Add dragging class to body for enhanced visual feedback
				document.body.classList.add("is-dragging");
			});
			
			drag.addEventListener("dragend", () => {
				document.body.classList.remove("is-dragging");
			});
			
			drag.addEventListener("mouseenter", () => {
				svg.style.opacity = "0.6";
			});
			
			drag.addEventListener("mouseleave", () => {
				svg.style.opacity = "0.3";
			});
			
			return drag;
		}
	})();

const dragLineMarker = (app: App) =>
	gutter({
		lineMarker(view: EditorView, line: BlockInfo) {
			return line.from == line.to
				? null
				: dragHandle(view.state.doc.lineAt(line.from).number, app);
		},
	});

function getAllChildrensOfBlock(
	parents: ListItemCache[],
	allItems: ListItemCache[]
): ListItemCache[] {
	if (!parents.length) return [];

	// Deconstruct hierarchy according to
	// https://github.com/obsidianmd/obsidian-api/blob/036708710c4a4b652d8166c5929d5ba1ffb7fb91/obsidian.d.ts#L1581
	// parentItem.position.start.line === childItem.parent
	const idx = new Set(_.map(parents, (parent) => parent.position.start.line));
	const childrens = _.filter(allItems, ({ parent }) => idx.has(parent));

	const nestedChildrens = getAllChildrensOfBlock(childrens, allItems);

	return [...parents, ...childrens, ...nestedChildrens];
}

function findSection(section: ListItemCache | SectionCache, line: number) {
	return (
		section.position.start.line <= line && section.position.end.line >= line
	);
}

function getBlock(line: number, fileCache: CachedMetadata) {
	const block: ListItemCache | SectionCache = _.concat(
		[],
		fileCache?.listItems
	).find((s) => findSection(s, line));
	if (!block) return;

	// generate and write block id
	const id = generateId();

	const allChildren = _.uniq(
		getAllChildrensOfBlock([block], fileCache.listItems)
	);

	const changes = {
		from: block.position.end.offset,
		insert: " ^" + id,
	};
	const fromLine = _.minBy(allChildren, "position.start.line").position.start;
	const toLine = _.maxBy(allChildren, "position.end.line").position.end;

	return {
		...block,
		fromLine,
		toLine,
		id: block.id || id,
		children: allChildren,
		changes: block.id ? [] : [changes],
	};
}

function defineOperationType(
	event: DragEvent,
	settings: DndPluginSettings,
	isSameEditor: boolean
) {
	const modifier = event.shiftKey ? "shift" : event.altKey ? "alt" : "simple";

	if (modifier === "simple") {
		if (isSameEditor) return settings["simple_same_pane"];
		else return settings["simple_different_panes"];
	} else return settings[modifier];
}

function processDrop(
	app: App,
	event: DragEvent,
	settings: DndPluginSettings,
	dropMode: "current" | "parent",
	targetEditor: EditorView
) {
	if (!event.dataTransfer) return;
	const sourceLineNum = parseInt(event.dataTransfer.getData("line"), 10);
	// @ts-ignore
	const targetLinePos = event.target.cmView.posAtStart;

	const view = app.workspace.getActiveViewOfType(MarkdownView);

	if (!view || !view.editor) return;

	// @ts-ignore
	const sourceEditor: EditorView = view.editor.cm;

	const targetLine = targetEditor.state.doc.lineAt(targetLinePos);

	const isSameEditor = sourceEditor == targetEditor;

	const type = defineOperationType(event, settings, isSameEditor);

	if (type === "none") return;

	const text = view.editor.getValue();
	const item = findListItem(text, sourceLineNum, "listItem");
	if (item) {
		const from = item.node.position.start.offset;
		const to = item.node.position.end.offset;
		let operations;

		const targetItem = findListItem(
			targetEditor.state.toJSON().doc,
			targetLine.number,
			"paragraph"
		);

		// if line was not moved or moved inside it's enclosing block - do nothing
		if (isSameEditor) {
			const pos = item.node.position;
			if (
				targetLine.number >= pos.start.line &&
				targetLine.number <= pos.end.line
			) {
				return;
			}
		}

		const targetItemLastLine =
			targetItem?.node?.position?.end?.offset || targetLine.to;

		if (type === "move" || type === "copy") {
			const sourceLine = sourceEditor.state.doc.lineAt(from);

			const textToInsert = "\n" + text.slice(sourceLine.from, to);

			// adjust indent for each line of the source block
			const computeIndent = (line: Line) =>
				line.text.match(/^\t*/)[0].length;

			const sourceIndent = computeIndent(sourceLine);
			const targetIndent = computeIndent(targetLine);

			const indentChange = dropMode === "current" ? 1 : 0;
			const addTabsNum = Math.max(
				targetIndent - sourceIndent + indentChange,
				0
			);
			const removeTabsNum = Math.max(
				sourceIndent - targetIndent - indentChange,
				0
			);

			const removeTabsRegex = new RegExp(
				"\n" + "\t".repeat(removeTabsNum),
				"g"
			);
			const addTabsRegex = "\n" + "\t".repeat(addTabsNum);

			const indentedText = textToInsert.replace(
				removeTabsRegex,
				addTabsRegex
			);

			// build operations for applying with editor
			const deleteOp = { from: Math.max(sourceLine.from - 1, 0), to };
			const insertOp = { from: targetItemLastLine, insert: indentedText };

			operations = {
				source: type === "move" ? [deleteOp] : [],
				target: [insertOp],
			};
		} else if (type === "embed") {
			const sourceFile = findFile(app, sourceEditor);
			const { id, changes } = getBlock(sourceLineNum - 1, sourceFile);
			const insertBlockOp = {
				from: targetItemLastLine,
				insert: ` ![[${view.file.basename}#^${id}]]`,
			};

			operations = { source: [changes], target: [insertBlockOp] };
		}

		const { source, target } = operations;
		if (sourceEditor == targetEditor)
			sourceEditor.dispatch({ changes: [...source, ...target] });
		else {
			sourceEditor.dispatch({ changes: source });
			targetEditor.dispatch({ changes: target });
		}
		targetEditor.focus();
	}
}

function findFile(app: App, targetEditor: EditorView) {
	const leafs = app.workspace.getLeavesOfType("markdown");
	const targetLeaf = _.find(leafs, (leaf) => {
		const view: MarkdownView = leaf.view as MarkdownView;
		// @ts-ignore
		return view?.editor?.cm === targetEditor;
	});
	if (targetLeaf)
		return app.metadataCache.getFileCache(
			(targetLeaf.view as MarkdownView).file
		);
}

function DOMtoLine(lineDom: globalThis.Node, targetEditor: EditorView) {
	const doc = targetEditor.state.doc;
	const posAtLine = targetEditor.posAtDOM(lineDom);
	const targetLine = doc.lineAt(posAtLine);
	return targetLine.number - 1;
}

function getBlockForLine(
	app: App,
	lineNumber: number,
	targetEditor: EditorView
) {
	return getBlock(lineNumber, findFile(app, targetEditor));
}

type LineOfEditor = {
	lineDom: globalThis.Node;
	line: Line;
	isTargetLine: boolean;
};

function getAllLinesForCurrentItem(
	app: App,
	lineNumber: number,
	targetEditor: EditorView,
	targetLine?: number
): LineOfEditor[] {
	const doc = targetEditor.state.doc;
	const block = getBlockForLine(app, lineNumber, targetEditor);
	if (!block) return;

	const targetItemLastLine = targetLine || block.position.end.line + 1;

	return _.range(block.fromLine.line + 1, block.toLine.line + 1 + 1)
		.map((lineNum) => ({
			lineDom: targetEditor.domAtPos(doc.line(lineNum).from).node,
			line: doc.line(lineNum),
			isTargetLine: lineNum === targetItemLastLine,
		}))
		.filter(({ line }) => !!line);
}

function emptyRange(): EditorHightlight {
	return {
		current: new RangeSetBuilder<Decoration>().finish(),
		parent: new RangeSetBuilder<Decoration>().finish(),
	};
}

type EditorHightlight = { current: DecorationSet; parent: DecorationSet };
let lineHightlight: EditorHightlight = emptyRange();
let highlightMode: "current" | "parent" = "current";

function buildLineDecorations(
	allLines: LineOfEditor[],
	dragDestination: Decoration
) {
	const builder = new RangeSetBuilder<Decoration>();
	_.forEach(allLines, ({ line, isTargetLine }) => {
		builder.add(line.from, line.from, dragHighlight);
		if (isTargetLine) builder.add(line.from, line.from, dragDestination);
	});
	return builder.finish();
}

function highlightWholeItem(app: App, target: Element, editor: EditorView) {
	try {
		// get all sub-items for current line
		const line = DOMtoLine(target.closest(".cm-line"), editor);
		const currentLines = getAllLinesForCurrentItem(app, line, editor);

		// get all sub-items for parent line
		const currentBlock = getBlockForLine(app, line, editor);
		const parentLines =
			currentBlock && currentBlock.parent > 0
				? getAllLinesForCurrentItem(
					app,
					currentBlock.parent,
					editor,
					line + 1
				)
				: currentLines;

		const currentDecorations = buildLineDecorations(currentLines, dragDestination);
		const parentDecorations = buildLineDecorations(parentLines, dragParentDestination);
		
		lineHightlight = {
			current: currentDecorations,
			parent: parentDecorations,
		};

		// Force view update to show decorations - use requestAnimationFrame to ensure DOM is ready
		// and create a proper transaction that CodeMirror will recognize
		requestAnimationFrame(() => {
			editor.dispatch({
				effects: [],
				annotations: []
			});
		});
	} catch (e) {
		if (
			e.message.match(
				/Trying to find position for a DOM position outside of the document/
			)
		)
			return;
		throw e;
	}
}

interface DndPluginSettings {
	simple_same_pane: OperationType;
	simple_different_panes: OperationType;
	shift: OperationType;
	alt: OperationType;
	show_handle_on_hover: boolean;
}

type OperationType = "move" | "embed" | "copy" | "none";

const DEFAULT_SETTINGS: DndPluginSettings = {
	simple_same_pane: "move",
	simple_different_panes: "embed",
	shift: "copy",
	alt: "none",
	show_handle_on_hover: true,
};

// ViewPlugin that shows drag highlights
// Uses fromClass with decorations function that reads module-level state
const showHighlight = ViewPlugin.fromClass(class {
	decorations() {
		// This method is called whenever the view updates
		// It reads the current highlight state from module-level variables
		return lineHightlight[highlightMode];
	}
});

const processDragOver = (element: HTMLElement, offsetX: number, editor: EditorView) => {
	const itemIndent = parseInt(element.style.paddingLeft, 10);
	const newMode = itemIndent + 2 < offsetX - element.getBoundingClientRect().left ? "current" : "parent";
	if (newMode !== highlightMode) {
		highlightMode = newMode;
		// Force view update when highlight mode changes
		editor.dispatch({});
	}
};

export default class DragNDropPlugin extends Plugin {
	settings: DndPluginSettings;

	async onload() {
		const app = this.app;
		const settings = await this.loadSettings();
		const dragEventHandlers = EditorView.domEventHandlers({
			dragover(event: DragEvent, editor: EditorView) {
				if (event.target instanceof HTMLElement) {
					const line = event.target.closest(".cm-line");
					processDragOver(line as HTMLElement, event.clientX, editor);
				}
				event.preventDefault();
			},
			dragenter(event: DragEvent, view: EditorView) {
				if (event.target instanceof Element)
					highlightWholeItem(app, event.target, view);
				event.preventDefault();
			},
			drop(event: DragEvent, view: EditorView) {
				processDrop(app, event, settings, highlightMode, view);
				lineHightlight = emptyRange();
			},
			dragend(event: DragEvent, view: EditorView) {
				// Clear highlights when drag ends (whether dropped or cancelled)
				lineHightlight = emptyRange();
				highlightMode = "current"; // Reset to default mode
				document.body.classList.remove("is-dragging");
				
				// Also remove any lingering CSS classes from DOM elements as a safety measure
				const editorElement = view.dom;
				const dragOverElements = editorElement.querySelectorAll(".drag-over, .drag-last, .drag-parent-last");
				dragOverElements.forEach(el => {
					el.classList.remove("drag-over", "drag-last", "drag-parent-last");
				});
				
				// Force view update with a transaction to ensure decorations refresh
				view.dispatch({
					effects: [],
					annotations: []
				});
			},
		});
		this.addSettingTab(new DragNDropSettings(this.app, this));
		this.registerEditorExtension([
			dragLineMarker(app),
			showHighlight,
			dragEventHandlers,
		]);
		// Apply handle visibility setting
		this.updateHandleVisibility();
	}
	
	updateHandleVisibility() {
		document.body.toggleClass('dnd-always-show-handles', !this.settings.show_handle_on_hover);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		return this.settings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.updateHandleVisibility();
	}
}

class DragNDropSettings extends PluginSettingTab {
	plugin: DragNDropPlugin;

	constructor(app: App, plugin: DragNDropPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {
			text: "Modifiers",
		});

		const addDropdownVariants =
			(settingName: "simple_same_pane" | "simple_different_panes" | "shift" | "alt") =>
				(dropDown: DropdownComponent) => {
					dropDown.addOption("none", "Do nothing");
					dropDown.addOption("embed", "Embed link");
					dropDown.addOption("copy", "Copy block");
					dropDown.addOption("move", "Move block");
					dropDown.setValue(this.plugin.settings[settingName]);
					dropDown.onChange(async (value: OperationType) => {
						this.plugin.settings[settingName] = value;
						await this.plugin.saveSettings();
					});
				};

		new Setting(containerEl)
			.setName("Drag'n'drop without modifiers in the same pane")
			.addDropdown(addDropdownVariants("simple_same_pane"));

		new Setting(containerEl)
			.setName("Drag'n'drop without modifiers in the different panes")
			.addDropdown(addDropdownVariants("simple_different_panes"));

		new Setting(containerEl)
			.setName("Drag'n'drop with Shift")
			.addDropdown(addDropdownVariants("shift"));

		new Setting(containerEl)
			.setName("Drag'n'drop with Alt/Meta")
			.addDropdown(addDropdownVariants("alt"));

		containerEl.createEl("h2", {
			text: "Appearance",
		});

		new Setting(containerEl)
			.setName("Drag handle visibility")
			.setDesc("Control when the six-dot drag handles are visible")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("hover", "Show on hover only")
					.addOption("always", "Always visible")
					.setValue(this.plugin.settings.show_handle_on_hover ? "hover" : "always")
					.onChange(async (value) => {
						this.plugin.settings.show_handle_on_hover = value === "hover";
						await this.plugin.saveSettings();
					});
			});
	}
}
