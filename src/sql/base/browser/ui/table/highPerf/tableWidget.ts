/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITableEvent, ITableRenderer, ITableMouseEvent, ITableContextMenuEvent, ITableDataSource, IStaticTableRenderer, IStaticColumn, ITableColumn, TableError } from 'sql/base/browser/ui/table/highPerf/table';

import { IDisposable, dispose, DisposableStore } from 'vs/base/common/lifecycle';
import { memoize } from 'vs/base/common/decorators';
import { Event, Emitter, EventBufferer } from 'vs/base/common/event';
import * as DOM from 'vs/base/browser/dom';
import { TableView, ITableViewOptions } from 'sql/base/browser/ui/table/highPerf/tableView';
import { ScrollEvent } from 'vs/base/common/scrollable';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { domEvent } from 'vs/base/browser/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as platform from 'vs/base/common/platform';
import { IListStyles, IStyleController } from 'vs/base/browser/ui/list/listWidget';
import { Color } from 'vs/base/common/color';
import { getOrDefault } from 'vs/base/common/objects';
import { isNumber } from 'vs/base/common/types';
import { clamp } from 'vs/base/common/numbers';
import { GlobalMouseMoveMonitor } from 'vs/base/browser/globalMouseMoveMonitor';
import { GridPosition } from 'sql/base/common/gridPosition';
import { GridRange, IGridRange } from 'sql/base/common/gridRange';

interface ITraitChangeEvent {
	indexes: IGridRange[];
	browserEvent?: UIEvent;
}

type ITraitTemplateData = HTMLElement;

interface IRenderedContainer {
	templateData: ITraitTemplateData;
	index: GridPosition;
}

class TraitRenderer<T> implements ITableRenderer<T, ITraitTemplateData>
{
	private renderedElements: IRenderedContainer[] = [];

	constructor(private trait: Trait<T>) { }

	get templateId(): string {
		return `template:${this.trait.trait}`;
	}

	renderTemplate(container: HTMLElement): ITraitTemplateData {
		return container;
	}

	renderCell(element: T, row: number, cell: number, columnId: string, templateData: ITraitTemplateData): void {
		const renderedElementIndex = this.renderedElements.findIndex(el => el.templateData === templateData);

		if (renderedElementIndex >= 0) {
			const rendered = this.renderedElements[renderedElementIndex];
			this.trait.unrender(templateData);
			rendered.index = new GridPosition(row, cell);
		} else {
			const rendered = { index: new GridPosition(row, cell), templateData };
			this.renderedElements.push(rendered);
		}

		this.trait.renderIndex(new GridPosition(row, cell), templateData);
	}

	renderIndexes(indexes: IGridRange[]): void {
		for (const { index, templateData } of this.renderedElements) {
			if (!!indexes.find(v => GridRange.containsPosition(v, index))) {
				this.trait.renderIndex(index, templateData);
			}
		}
	}

	disposeTemplate(templateData: ITraitTemplateData): void {
		const index = this.renderedElements.findIndex(el => el.templateData === templateData);

		if (index < 0) {
			return;
		}

		this.renderedElements.splice(index, 1);
	}
}

class DOMFocusController<T> implements IDisposable {

	private disposables: IDisposable[] = [];

	constructor(
		private list: Table<T>,
		private view: TableView<T>
	) {
		this.disposables = [];

		const onKeyDown = Event.chain(domEvent(view.domNode, 'keydown'))
			.map(e => new StandardKeyboardEvent(e));

		onKeyDown.filter(e => e.keyCode === KeyCode.Tab && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey)
			.on(this.onTab, this, this.disposables);
	}

	private onTab(e: StandardKeyboardEvent): void {
		if (e.target !== this.view.domNode) {
			return;
		}

		const focus = this.list.getFocus();

		if (focus.length === 0) {
			return;
		}

		const focusedDomElement = this.view.domElement(focus[0].startRow, focus[0].startColumn);

		if (!focusedDomElement) {
			return;
		}

		const tabIndexElement = focusedDomElement.querySelector('[tabIndex]');

		if (!tabIndexElement || !(tabIndexElement instanceof HTMLElement) || tabIndexElement.tabIndex === -1) {
			return;
		}

		const style = window.getComputedStyle(tabIndexElement);
		if (style.visibility === 'hidden' || style.display === 'none') {
			return;
		}

		e.preventDefault();
		e.stopPropagation();
		tabIndexElement.focus();
	}

	dispose() {
		this.disposables = dispose(this.disposables);
	}
}

class Trait<T> implements IDisposable {

	private indexes: Array<IGridRange> = [];
	private sortedIndexes: Array<IGridRange> = [];

	private _onChange = new Emitter<ITraitChangeEvent>();
	get onChange(): Event<ITraitChangeEvent> { return this._onChange.event; }

	get trait(): string { return this._trait; }

	@memoize
	get renderer(): TraitRenderer<T> {
		return new TraitRenderer<T>(this);
	}

	constructor(private _trait: string) { }

	renderIndex(index: GridPosition, container: HTMLElement): void {
		container.classList.toggle(this._trait, this.contains(index));
	}

	unrender(container: HTMLElement): void {
		container.classList.remove(this._trait);
	}

	/**
	 * Sets the indexes which should have this trait.
	 *
	 * @param indexes Indexes which should have this trait.
	 * @return The old indexes which had this trait.
	 */
	set(indexes: Array<IGridRange>, browserEvent?: UIEvent): Array<IGridRange> {
		return this._set(indexes, indexes, browserEvent);
	}

	private _set(indexes: Array<IGridRange>, sortedIndexes: Array<IGridRange>, browserEvent?: UIEvent): Array<IGridRange> {
		const result = this.indexes;
		const sortedResult = this.sortedIndexes;

		this.indexes = indexes;
		this.sortedIndexes = sortedIndexes;

		// const toRender = disjunction(sortedResult, indexes);
		this.renderer.renderIndexes(indexes.concat(sortedResult));

		this._onChange.fire({ indexes, browserEvent });
		return result;
	}

	get(): Array<IGridRange> {
		return this.indexes;
	}

	contains(index: GridPosition): boolean {
		return !!this.indexes.find(v => GridRange.containsPosition(v, index));
	}

	dispose() {
		this._onChange = dispose(this._onChange);
	}
}

class FocusTrait<T> extends Trait<T> {

	constructor() {
		super('focused');
	}

	override renderIndex(index: GridPosition, container: HTMLElement): void {
		super.renderIndex(index, container);

		if (this.contains(index)) {
			container.setAttribute('aria-selected', 'true');
		} else {
			container.removeAttribute('aria-selected');
		}
	}
}

class PipelineRenderer<T> implements ITableRenderer<T, any> {

	constructor(
		private renderers: ITableRenderer<any /* TODO@joao */, any>[]
	) { }

	renderTemplate(container: HTMLElement): any[] {
		return this.renderers.map(r => r.renderTemplate(container));
	}

	renderCell(element: T, index: number, cell: number, columnId: string, templateData: any[], height: number | undefined): void {
		let i = 0;

		for (const renderer of this.renderers) {
			renderer.renderCell(element, index, cell, columnId, templateData[i++], height);
		}
	}

	disposeCell(element: T, index: number, cell: number, columnId: string, templateData: any[], height: number | undefined): void {
		let i = 0;

		for (const renderer of this.renderers) {
			if (renderer.disposeCell) {
				renderer.disposeCell(element, index, cell, columnId, templateData[i], height);
			}

			i += 1;
		}
	}

	disposeTemplate(templateData: any[]): void {
		let i = 0;

		for (const renderer of this.renderers) {
			renderer.disposeTemplate(templateData[i++]);
		}
	}
}

export function isSelectionSingleChangeEvent(event: ITableMouseEvent<any>): boolean {
	return platform.isMacintosh ? event.browserEvent.metaKey : event.browserEvent.ctrlKey;
}

export function isSelectionRangeChangeEvent(event: ITableMouseEvent<any>): boolean {
	return event.browserEvent.shiftKey;
}

function isMouseRightClick(event: UIEvent): boolean {
	return event instanceof MouseEvent && event.button === 2;
}

const DefaultMultipleSelectionController = {
	isSelectionSingleChangeEvent,
	isSelectionRangeChangeEvent
};

export interface IOpenController {
	shouldOpen(event: UIEvent): boolean;
}

const DefaultOpenController: IOpenController = {
	shouldOpen: (event: UIEvent) => {
		if (event instanceof MouseEvent) {
			return !isMouseRightClick(event);
		}

		return true;
	}
};

export interface IMultipleSelectionController<T> {
	isSelectionSingleChangeEvent(event: ITableMouseEvent<T>): boolean;
	isSelectionRangeChangeEvent(event: ITableMouseEvent<T>): boolean;
}

class RowCountRenderer implements IStaticTableRenderer<any, HTMLElement> {
	renderTemplate(container: HTMLElement): HTMLElement {
		return DOM.append(container, DOM.$('.row-count'));
	}

	renderCell(element: undefined, index: number, ccell: number, olumnId: string, templateData: HTMLElement, width: number): void {
		templateData.innerText = `${index}`;
	}

	disposeTemplate(templateData: HTMLElement): void {
		throw new Error('Method not implemented.');
	}
}

const rowCountColumnDef: IStaticColumn<any, HTMLElement> = {
	id: 'rowCount',
	name: '',
	renderer: new RowCountRenderer(),
	cellClass: 'row-count-cell',
	static: true,
	width: 30,
	resizeable: false
};

function rowCountFilter(column: ITableColumn<any, any>): boolean {
	return column.id !== rowCountColumnDef.id;
}

class KeyboardController<T> implements IDisposable {

	private disposables: IDisposable[];
	// private openController: IOpenController;

	constructor(
		private table: Table<T>,
		private view: TableView<T>,
		options?: ITableOptions<T>
	) {
		// const multipleSelectionSupport = !(options.multipleSelectionSupport === false);
		this.disposables = [];

		// this.openController = options.openController || DefaultOpenController;

		const onKeyDown = Event.chain(domEvent(view.domNode, 'keydown'))
			// .filter(e => !isInputElement(e.target as HTMLElement))
			.map(e => new StandardKeyboardEvent(e));

		onKeyDown.filter(e => e.keyCode === KeyCode.Enter).on(this.onEnter, this, this.disposables);
		onKeyDown.filter(e => e.keyCode === KeyCode.UpArrow).on(this.onUpArrow, this, this.disposables);
		onKeyDown.filter(e => e.keyCode === KeyCode.DownArrow).on(this.onDownArrow, this, this.disposables);
		onKeyDown.filter(e => e.keyCode === KeyCode.LeftArrow).on(this.onLeftArrow, this, this.disposables);
		onKeyDown.filter(e => e.keyCode === KeyCode.RightArrow).on(this.onRightArrow, this, this.disposables);
		onKeyDown.filter(e => e.keyCode === KeyCode.PageUp).on(this.onPageUpArrow, this, this.disposables);
		onKeyDown.filter(e => e.keyCode === KeyCode.PageDown).on(this.onPageDownArrow, this, this.disposables);
		onKeyDown.filter(e => e.keyCode === KeyCode.Escape).on(this.onEscape, this, this.disposables);

		// if (multipleSelectionSupport) {
		onKeyDown.filter(e => (platform.isMacintosh ? e.metaKey : e.ctrlKey) && e.keyCode === KeyCode.KEY_A).on(this.onCtrlA, this, this.disposables);
		// }
	}

	private onEnter(e: StandardKeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
		this.table.setSelection(this.table.getFocus(), e.browserEvent);

		// if (this.openController.shouldOpen(e.browserEvent)) {
		// 	this.list.open(this.list.getFocus(), e.browserEvent);
		// }
	}

	private onUpArrow(e: StandardKeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
		this.table.focusPreviousRow(1, false, e.browserEvent);
		this.table.reveal(this.table.getFocus()[0].startRow);
		this.view.domNode.focus();
	}

	private onDownArrow(e: StandardKeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
		this.table.focusNextRow(1, false, e.browserEvent);
		this.table.reveal(this.table.getFocus()[0].startRow);
		this.view.domNode.focus();
	}

	private onRightArrow(e: StandardKeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
		this.table.focusNextCell(1, false, e.browserEvent);
		this.table.reveal(this.table.getFocus()[0].startRow);
		this.view.domNode.focus();
	}

	private onLeftArrow(e: StandardKeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
		this.table.focusPreviousCell(1, false, e.browserEvent);
		this.table.reveal(this.table.getFocus()[0].startRow);
		this.view.domNode.focus();
	}

	private onPageUpArrow(e: StandardKeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
		// this.table.focusPreviousPage(e.browserEvent);
		// this.table.reveal(this.table.getFocus()[0]);
		this.view.domNode.focus();
	}

	private onPageDownArrow(e: StandardKeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
		// this.table.focusNextPage(e.browserEvent);
		// this.table.reveal(this.table.getFocus()[0]);
		this.view.domNode.focus();
	}

	private onCtrlA(e: StandardKeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
		// this.table.setSelection(range(this.table.length), e.browserEvent);
		this.view.domNode.focus();
	}

	private onEscape(e: StandardKeyboardEvent): void {
		e.preventDefault();
		e.stopPropagation();
		this.table.setSelection([], e.browserEvent);
		this.view.domNode.focus();
	}

	dispose() {
		this.disposables = dispose(this.disposables);
	}
}

export class MouseController<T> implements IDisposable {

	private multipleSelectionSupport: boolean;
	readonly multipleSelectionController?: IMultipleSelectionController<T>;
	private openController: IOpenController;
	private disposables: IDisposable[] = [];
	private readonly _mouseMoveMonitor = new GlobalMouseMoveMonitor<ITableMouseEvent<T>>();

	private startMouseEvent?: ITableMouseEvent<T>;

	constructor(protected table: Table<T>, protected view: TableView<T>) {
		this.multipleSelectionSupport = true;

		if (this.multipleSelectionSupport) {
			this.multipleSelectionController = DefaultMultipleSelectionController;
		}

		this.openController = DefaultOpenController;

		this.disposables.push(this._mouseMoveMonitor);

		table.onMouseDown(this.onMouseDown, this, this.disposables);
		// table.onMouseClick(this.onPointer, this, this.disposables);
		table.onContextMenu(this.onContextMenu, this, this.disposables);
	}

	protected isSelectionSingleChangeEvent(event: ITableMouseEvent<any>): boolean {
		if (this.multipleSelectionController) {
			return this.multipleSelectionController.isSelectionSingleChangeEvent(event);
		}

		return platform.isMacintosh ? event.browserEvent.metaKey : event.browserEvent.ctrlKey;
	}

	protected isSelectionRangeChangeEvent(event: ITableMouseEvent<any>): boolean {
		if (this.multipleSelectionController) {
			return this.multipleSelectionController.isSelectionRangeChangeEvent(event);
		}

		return event.browserEvent.shiftKey;
	}

	private isSelectionChangeEvent(event: ITableMouseEvent<any>): boolean {
		return this.isSelectionSingleChangeEvent(event) || this.isSelectionRangeChangeEvent(event);
	}

	private onMouseDown(e: ITableMouseEvent<T>): void {
		if (document.activeElement !== e.browserEvent.target) {
			this.table.domFocus();
		}
		const merger = (lastEvent: ITableMouseEvent<T> | null, currentEvent: MouseEvent): ITableMouseEvent<T> => {
			return this.view.toMouseEvent(currentEvent);
		};
		this._mouseMoveMonitor.startMonitoring(e.browserEvent.target as HTMLElement, e.buttons, merger, e => this.onMouseMove(e), () => this.onMouseStop());
		this.onPointer(e);
	}

	private onContextMenu(e: ITableContextMenuEvent<T>): void {
		const focus = typeof e.index === 'undefined' ? [] : [new GridRange(e.index.row, e.index.column)];
		this.table.setFocus(focus, e.browserEvent);
	}

	protected onMouseMove(event: ITableMouseEvent<T>): void {
		if (event.index) {
			this.startMouseEvent = this.startMouseEvent || event;
			this.table.setSelection([new GridRange(this.startMouseEvent.index!.row, this.startMouseEvent.index!.column, event.index.row, event.index.column)]);
		}
	}

	protected onMouseStop(): void {
		this.startMouseEvent = undefined;
	}

	protected onPointer(e: ITableMouseEvent<T>): void {

		let reference = this.table.getFocus();
		const selection = this.table.getSelection();
		reference = reference === undefined ? selection : reference;

		const focus = e.index;

		if (typeof focus === 'undefined') {
			this.table.setFocus([], e.browserEvent);
			this.table.setSelection([], e.browserEvent);
			return;
		}

		if (this.multipleSelectionSupport && this.isSelectionRangeChangeEvent(e)) {
			return this.changeSelection(e, reference);
		}

		if (this.multipleSelectionSupport && this.isSelectionChangeEvent(e)) {
			return this.changeSelection(e, reference);
		}

		this.table.setFocus([new GridRange(focus.row, focus.column)], e.browserEvent);

		if (!isMouseRightClick(e.browserEvent)) {
			this.table.setSelection([new GridRange(focus.row, focus.column)], e.browserEvent);

			if (this.openController.shouldOpen(e.browserEvent)) {
				// this.table.open([focus], e.browserEvent);
			}
		}
	}

	private changeSelection(e: ITableMouseEvent<T>, reference: IGridRange[] | undefined): void {
		const focus = e.index!;

		if (this.isSelectionRangeChangeEvent(e) && reference !== undefined) {
			const selection = this.table.getSelection();
			const lastSelection = selection.pop();
			if (lastSelection) {
				this.table.setSelection([...selection, GridRange.plusRange(lastSelection, new GridRange(focus.row, focus.column))]);
			} else {
				this.table.setSelection([...selection, new GridRange(focus.row, focus.column)]);
			}
		} else if (this.isSelectionSingleChangeEvent(e)) {
			const selection = this.table.getSelection();
			selection.push(new GridRange(focus.row, focus.column));
			this.table.setSelection(selection);
		}
	}

	dispose() {
		this.disposables = dispose(this.disposables);
	}
}

export interface ITableOptions<T> extends ITableViewOptions<T> {
	keyboardSupport?: boolean;
	dnd?: boolean;
}

export interface ITableStyles extends IListStyles {
	cellOutlineColor?: Color;
	tableHeaderAndRowCountColor?: Color;
}

export class DefaultStyleController implements IStyleController {

	constructor(private styleElement: HTMLStyleElement, private selectorSuffix?: string) { }

	style(styles: ITableStyles): void {
		const suffix = this.selectorSuffix ? `.${this.selectorSuffix}` : '';
		const content: string[] = [];

		if (styles.listFocusBackground) {
			content.push(`.monaco-perftable${suffix}:focus .monaco-perftable-cell.focused { background-color: ${styles.listFocusBackground}; }`);
			content.push(`.monaco-perftable${suffix}:focus .monaco-perftable-cell.focused:hover { background-color: ${styles.listFocusBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listFocusForeground) {
			content.push(`.monaco-perftable${suffix}:focus .monaco-perftable-cell.focused { color: ${styles.listFocusForeground}; }`);
		}

		if (styles.listActiveSelectionBackground) {
			content.push(`.monaco-perftable${suffix}:focus .monaco-perftable-cell.selected { background-color: ${styles.listActiveSelectionBackground}; }`);
			content.push(`.monaco-perftable${suffix}:focus .monaco-perftable-cell.selected:hover { background-color: ${styles.listActiveSelectionBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listActiveSelectionForeground) {
			content.push(`.monaco-perftable${suffix}:focus .monaco-perftable-cell.selected { color: ${styles.listActiveSelectionForeground}; }`);
		}

		if (styles.listFocusAndSelectionBackground) {
			content.push(`
				.monaco-drag-image,
				.monaco-perftable${suffix}:focus .monaco-perftable-cell.selected.focused { background-color: ${styles.listFocusAndSelectionBackground}; }
			`);
		}

		if (styles.listFocusAndSelectionForeground) {
			content.push(`
				.monaco-drag-image,
				.monaco-perftable${suffix}:focus .monaco-perftable-cell.selected.focused { color: ${styles.listFocusAndSelectionForeground}; }
			`);
		}

		if (styles.listInactiveFocusBackground) {
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell.focused { background-color:  ${styles.listInactiveFocusBackground}; }`);
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell.focused:hover { background-color:  ${styles.listInactiveFocusBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listInactiveSelectionBackground) {
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell.selected { background-color:  ${styles.listInactiveSelectionBackground}; }`);
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell.selected:hover { background-color:  ${styles.listInactiveSelectionBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listInactiveSelectionForeground) {
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell.selected { color: ${styles.listInactiveSelectionForeground}; }`);
		}

		if (styles.listHoverBackground) {
			content.push(`.monaco-perftable${suffix}:not(.drop-target) .monaco-perftable-cell:hover:not(.selected):not(.focused) { background-color:  ${styles.listHoverBackground}; }`);
		}

		if (styles.listHoverForeground) {
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell:hover:not(.selected):not(.focused) { color:  ${styles.listHoverForeground}; }`);
		}

		if (styles.listSelectionOutline) {
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell.selected { outline: 1px dotted ${styles.listSelectionOutline}; outline-offset: -1px; }`);
		}

		if (styles.listFocusOutline) {
			content.push(`
				.monaco-drag-image,
				.monaco-perftable${suffix}:focus .monaco-perftable-cell.focused { outline: 1px solid ${styles.listFocusOutline}; outline-offset: -1px; }
			`);
		}

		if (styles.listInactiveFocusOutline) {
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell.focused { outline: 1px dotted ${styles.listInactiveFocusOutline}; outline-offset: -1px; }`);
		}

		if (styles.listHoverOutline) {
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell:hover { outline: 1px dashed ${styles.listHoverOutline}; outline-offset: -1px; }`);
		}

		if (styles.listDropBackground) {
			content.push(`
				.monaco-perftable${suffix}.drop-target,
				.monaco-perftable${suffix} .monaco-perftable-cell.drop-target { background-color: ${styles.listDropBackground} !important; color: inherit !important; }
			`);
		}

		if (styles.listFilterWidgetBackground) {
			content.push(`.monaco-perftable-type-filter { background-color: ${styles.listFilterWidgetBackground} }`);
		}

		if (styles.listFilterWidgetOutline) {
			content.push(`.monaco-perftable-type-filter { border: 1px solid ${styles.listFilterWidgetOutline}; }`);
		}

		if (styles.listFilterWidgetNoMatchesOutline) {
			content.push(`.monaco-perftable-type-filter.no-matches { border: 1px solid ${styles.listFilterWidgetNoMatchesOutline}; }`);
		}

		if (styles.listMatchesShadow) {
			content.push(`.monaco-perftable-type-filter { box-shadow: 1px 1px 1px ${styles.listMatchesShadow}; }`);
		}

		if (styles.cellOutlineColor) {
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell { border: 1px solid ${styles.cellOutlineColor}; }`);
			content.push(`.monaco-perftable${suffix} .monaco-perftable-header-cell { border: 1px solid ${styles.cellOutlineColor}; }`);
		}

		if (styles.tableHeaderAndRowCountColor) {
			content.push(`.monaco-perftable${suffix} .monaco-perftable-header-cell { background-color: ${styles.tableHeaderAndRowCountColor}; }`);
			content.push(`.monaco-perftable${suffix} .monaco-perftable-cell.row-count-cell { background-color: ${styles.tableHeaderAndRowCountColor}; }`);
		}

		const newStyles = content.join('\n');
		if (newStyles !== this.styleElement.innerHTML) {
			this.styleElement.innerHTML = newStyles;
		}
	}
}

const DefaultOptions = {
	rowCountColumn: true,
};

export class Table<T> implements IDisposable {

	private focus: Trait<T>;
	private selection: Trait<T>;
	private eventBufferer = new EventBufferer();
	private view: TableView<T>;
	private styleElement: HTMLStyleElement;
	private styleController: IStyleController;

	public inDrag = false;

	protected readonly disposables = new DisposableStore();

	@memoize get onFocusChange(): Event<ITableEvent<T>> {
		return Event.map(this.eventBufferer.wrapEvent(this.focus.onChange), e => this.toTableEvent(e));
	}

	@memoize get onSelectionChange(): Event<ITableEvent<T>> {
		return Event.map(this.eventBufferer.wrapEvent(this.selection.onChange), e => this.toTableEvent(e));
	}

	private toTableEvent({ indexes, browserEvent }: ITraitChangeEvent) {
		return { indexes, elements: indexes.map(i => this.view.element(i.startRow)!), browserEvent };
	}

	get onDidScroll(): Event<ScrollEvent> { return this.view.onDidScroll; }
	get onMouseClick(): Event<ITableMouseEvent<T>> { return this.view.onMouseClick; }
	get onMouseDblClick(): Event<ITableMouseEvent<T>> { return this.view.onMouseDblClick; }
	get onMouseMiddleClick(): Event<ITableMouseEvent<T>> { return this.view.onMouseMiddleClick; }
	get onMouseUp(): Event<ITableMouseEvent<T>> { return this.view.onMouseUp; }
	get onMouseDown(): Event<ITableMouseEvent<T>> { return this.view.onMouseDown; }
	get onMouseOver(): Event<ITableMouseEvent<T>> { return this.view.onMouseOver; }
	get onMouseMove(): Event<ITableMouseEvent<T>> { return this.view.onMouseMove; }
	get onMouseOut(): Event<ITableMouseEvent<T>> { return this.view.onMouseOut; }

	private didJustPressContextMenuKey: boolean = false;
	@memoize get onContextMenu(): Event<ITableContextMenuEvent<T>> {
		const fromKeydown = Event.chain(domEvent(this.view.domNode, 'keydown'))
			.map(e => new StandardKeyboardEvent(e))
			.filter(e => this.didJustPressContextMenuKey = e.keyCode === KeyCode.ContextMenu || (e.shiftKey && e.keyCode === KeyCode.F10))
			.filter(e => { e.preventDefault(); e.stopPropagation(); return false; })
			.event as Event<any>;

		const fromKeyup = Event.chain(domEvent(this.view.domNode, 'keyup'))
			.filter(() => {
				const didJustPressContextMenuKey = this.didJustPressContextMenuKey;
				this.didJustPressContextMenuKey = false;
				return didJustPressContextMenuKey;
			})
			.filter(() => this.getFocus().length > 0 && !!this.view.domElement(this.getFocus()[0].startRow, this.getFocus()[0].startColumn))
			.map(browserEvent => {
				const index = this.getFocus()[0];
				const element = this.view.element(index.startRow);
				const anchor = this.view.domElement(index.startRow, index.startColumn) as HTMLElement;
				return { index: GridRange.lift(index).getStartPosition(), element, anchor, browserEvent };
			})
			.event;

		const fromMouse = Event.chain(this.view.onContextMenu)
			.filter(() => !this.didJustPressContextMenuKey)
			.map(({ element, index, browserEvent }) => ({ element, index, anchor: { x: browserEvent.clientX + 1, y: browserEvent.clientY }, browserEvent }))
			.event;

		return Event.any<ITableContextMenuEvent<T>>(fromKeydown, fromKeyup, fromMouse);
	}

	get onKeyDown(): Event<KeyboardEvent> { return domEvent(this.view.domNode, 'keydown'); }
	get onKeyUp(): Event<KeyboardEvent> { return domEvent(this.view.domNode, 'keyup'); }
	get onKeyPress(): Event<KeyboardEvent> { return domEvent(this.view.domNode, 'keypress'); }

	readonly onDidFocus: Event<void>;
	readonly onDidBlur: Event<void>;

	private readonly _onDidDispose = new Emitter<void>();
	readonly onDidDispose: Event<void> = this._onDidDispose.event;

	constructor(
		private readonly user: string,
		container: HTMLElement,
		columns: ITableColumn<T, any>[],
		dataSource: ITableDataSource<T>,
		options: ITableOptions<T> = DefaultOptions
	) {
		this.focus = new FocusTrait();
		this.selection = new Trait('selected');

		const baseRenderers: ITableRenderer<T, ITraitTemplateData>[] = [this.focus.renderer, this.selection.renderer];

		columns = columns.map(r => {
			r.renderer = new PipelineRenderer([...baseRenderers, r.renderer]);
			return r;
		});

		options.rowCountColumn = getOrDefault(options, o => o.rowCountColumn, DefaultOptions.rowCountColumn);

		if (options.rowCountColumn) {
			columns.unshift(rowCountColumnDef);
		}

		this.view = new TableView(container, columns, dataSource, options);

		this.view.domNode.setAttribute('aria-multiselectable', 'true');

		this.styleElement = DOM.createStyleSheet(this.view.domNode);

		this.styleController = new DefaultStyleController(this.styleElement, this.view.domId);

		this.disposables.add(new DOMFocusController(this, this.view));

		if (!options || typeof options.keyboardSupport !== 'boolean' || options.keyboardSupport) {
			const controller = new KeyboardController(this, this.view, options);
			this.disposables.add(controller);
		}

		this.onDidFocus = Event.map(domEvent(this.view.domNode, 'focus', true), () => null!);
		this.onDidBlur = Event.map(domEvent(this.view.domNode, 'blur', true), () => null!);

		this.disposables.add(this.createMouseController());

		this.onFocusChange(this._onFocusChange, this, this.disposables);
		this.onSelectionChange(this._onSelectionChange, this, this.disposables);
	}

	protected createMouseController(): MouseController<T> {
		return new MouseController(this, this.view);
	}

	get length(): number {
		return this.view.length;
	}

	set length(length: number) {
		this.view.length = length;
	}

	get columnLength(): number {
		return this.view.columnLength;
	}

	layout(height?: number, width?: number): void {
		this.view.layout(height, width);
	}

	domFocus(): void {
		this.view.domNode.focus();
	}

	setSelection(indexes: IGridRange[], browserEvent?: UIEvent): void {
		// for (const index of indexes) {
		// 	if (index < 0 || index >= this.length) {
		// 		throw new Error(`Invalid index ${index}`);
		// 	}
		// }

		this.selection.set(indexes, browserEvent);
	}

	getSelection(): IGridRange[] {
		return this.selection.get();
	}

	setFocus(indexes: IGridRange[], browserEvent?: UIEvent): void {
		// for (const index of indexes) {
		// 	if (index < 0 || index >= this.length) {
		// 		throw new Error(`Invalid index ${index}`);
		// 	}
		// }

		this.focus.set(indexes, browserEvent);
		this.selection.set(indexes, browserEvent);
	}

	reveal(index: number, relativeTop?: number): void {
		if (index < 0 || index >= this.length) {
			throw new TableError(this.user, `Invalid index ${index}`);
		}

		const scrollTop = this.view.getScrollTop();
		const elementTop = this.view.elementTop(index);
		const elementHeight = this.view.rowHeight;

		if (isNumber(relativeTop)) {
			// y = mx + b
			const m = elementHeight - this.view.renderHeight;
			this.view.setScrollTop(m * clamp(relativeTop, 0, 1) + elementTop);
		} else {
			const viewItemBottom = elementTop + elementHeight;
			const wrapperBottom = scrollTop + this.view.renderHeight;

			if (elementTop < scrollTop) {
				this.view.setScrollTop(elementTop);
			} else if (viewItemBottom >= wrapperBottom) {
				this.view.setScrollTop(viewItemBottom - this.view.renderHeight);
			}
		}
	}


	focusNextCell(n = 1, loop = false, browserEvent?: UIEvent, filter: (column: ITableColumn<T, any>) => boolean = rowCountFilter): void {
		if (this.length === 0) { return; }

		const focus = this.focus.get();
		const cellIndex = focus.length > 0 ? focus[0].startColumn! : 0;
		const targetColumn = this.findNextColumn(cellIndex + n, loop, filter);
		const targetRow = focus.length > 0 ? focus[0].startRow : 0;

		if (targetColumn > -1) {
			this.setFocus([new GridRange(targetRow, targetColumn)], browserEvent);
		}
	}

	focusPreviousCell(n = 1, loop = false, browserEvent?: UIEvent, filter: (column: ITableColumn<T, any>) => boolean = rowCountFilter): void {
		if (this.length === 0) { return; }

		const focus = this.focus.get();
		const cellIndex = focus.length > 0 ? focus[0].startColumn! : 0;
		const targetColumn = this.findPreviousColumn(cellIndex - n, loop, filter);
		const targetRow = focus.length > 0 ? focus[0].startRow : 0;

		if (targetColumn > -1) {
			this.setFocus([new GridRange(targetRow, targetColumn)], browserEvent);
		}
	}

	focusNextRow(n = 1, loop = false, browserEvent?: UIEvent, filter?: (element: T) => boolean): void {
		if (this.length === 0) { return; }

		const focus = this.focus.get();
		const index = this.findNextRowIndex(focus.length > 0 ? focus[0].startRow + n : 0, loop, filter);

		const targetColumn = focus.length > 0 ? focus[0].startColumn : 0;

		if (index > -1) {
			this.setFocus([new GridRange(index, targetColumn)], browserEvent);
		}
	}

	focusPreviousRow(n = 1, loop = false, browserEvent?: UIEvent, filter?: (element: T) => boolean): void {
		if (this.length === 0) { return; }

		const focus = this.focus.get();
		const index = this.findPreviousRowIndex(focus.length > 0 ? focus[0].startRow - n : 0, loop, filter);

		const targetColumn = focus.length > 0 ? focus[0].startColumn : 0;

		if (index > -1) {
			this.setFocus([new GridRange(index, targetColumn)], browserEvent);
		}
	}

	private findNextColumn(index: number, loop = false, filter?: (column: ITableColumn<T, any>) => boolean): number {
		for (let i = 0; i < this.columnLength; i++) {
			if (index >= this.columnLength && !loop) {
				return -1;
			}

			index = index % this.columnLength;

			if (!filter || filter(this.view.column(index)!)) {
				return index;
			}

			index++;
		}

		return -1;
	}

	private findPreviousColumn(index: number, loop = false, filter?: (column: ITableColumn<T, any>) => boolean): number {
		for (let i = 0; i < this.columnLength; i++) {
			if (index < 0 && !loop) {
				return -1;
			}

			index = (this.columnLength + (index % this.columnLength)) % this.columnLength;

			if (!filter || filter(this.view.column(index)!)) {
				return index;
			}

			index--;
		}

		return -1;
	}

	private findNextRowIndex(index: number, loop = false, filter?: (element: T) => boolean): number {
		for (let i = 0; i < this.length; i++) {
			if (index >= this.length && !loop) {
				return -1;
			}

			index = index % this.length;

			// if (!filter || filter(this.view.element(index))) {
			return index;
			// }
		}

		return -1;
	}

	private findPreviousRowIndex(index: number, loop = false, filter?: (element: T) => boolean): number {
		for (let i = 0; i < this.length; i++) {
			if (index < 0 && !loop) {
				return -1;
			}

			index = (this.length + (index % this.length)) % this.length;

			// if (!filter || filter(this.view.element(index))) {
			return index;
			//
		}

		return -1;
	}

	getFocus(): Array<IGridRange> {
		return this.focus.get();
	}

	style(styles: ITableStyles): void {
		this.styleController.style(styles);
	}

	getHTMLElement(): HTMLElement {
		return this.view.domNode;
	}

	private _onFocusChange(): void {
		const focus = this.focus.get();

		if (focus.length > 0) {
			this.view.domNode.setAttribute('aria-activedescendant', this.view.getElementDomId(focus[0].startRow, focus[0].startColumn));
		} else {
			this.view.domNode.removeAttribute('aria-activedescendant');
		}

		this.view.domNode.setAttribute('role', 'tree');
		this.view.domNode.classList.toggle('element-focused', focus.length > 0);
	}

	private _onSelectionChange(): void {
		const selection = this.selection.get();

		this.view.domNode.classList.toggle('selection-none', selection.length === 0);
		this.view.domNode.classList.toggle('selection-single', selection.length === 1);
		this.view.domNode.classList.toggle('selection-multiple', selection.length > 1);
	}

	dispose(): void {
		this._onDidDispose.fire();
		this.disposables.dispose();

		this._onDidDispose.dispose();
	}
}
