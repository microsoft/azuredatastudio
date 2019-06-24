/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITableEvent, ITableRenderer, ITableMouseEvent, ITableContextMenuEvent, ITableDataSource, ICellIndex } from 'sql/base/browser/ui/table/highPerf/table';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { memoize } from 'vs/base/common/decorators';
import { Event, Emitter, EventBufferer } from 'vs/base/common/event';
import { firstIndex, binarySearch } from 'vs/base/common/arrays';
import * as DOM from 'vs/base/browser/dom';
import { TableView, ITableViewOptions, IColumn } from 'sql/base/browser/ui/table/highPerf/tableView';
import { ScrollEvent } from 'vs/base/common/scrollable';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { domEvent } from 'vs/base/browser/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as platform from 'vs/base/common/platform';
import { IListStyles, IStyleController } from 'vs/base/browser/ui/list/listWidget';
import { Color } from 'vs/base/common/color';

interface ITraitChangeEvent {
	indexes: ICellIndex[];
	browserEvent?: UIEvent;
}

type ITraitTemplateData = HTMLElement;

interface IRenderedContainer {
	templateData: ITraitTemplateData;
	index: ICellIndex;
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

	renderCell(element: T, row: number, columnId: string, templateData: ITraitTemplateData): void {
		const renderedElementIndex = firstIndex(this.renderedElements, el => el.templateData === templateData);

		if (renderedElementIndex >= 0) {
			const rendered = this.renderedElements[renderedElementIndex];
			this.trait.unrender(templateData);
			rendered.index = { row, columnId };
		} else {
			const rendered = { index: { row, columnId }, templateData };
			this.renderedElements.push(rendered);
		}

		this.trait.renderIndex({ row, columnId }, templateData);
	}

	renderIndexes(indexes: ICellIndex[]): void {
		for (const { index, templateData } of this.renderedElements) {
			if (!!indexes.find(v => v.columnId === index.columnId && v.row === v.row)) {
				this.trait.renderIndex(index, templateData);
			}
		}
	}

	disposeTemplate(templateData: ITraitTemplateData): void {
		const index = firstIndex(this.renderedElements, el => el.templateData === templateData);

		if (index < 0) {
			return;
		}

		this.renderedElements.splice(index, 1);
	}
}

const numericSort = (a: { row: number, column: number }, b: { row: number, column: number }) => {
	if (a.row === b.row) {
		return a.column - b.column;
	} else {
		return a.row - b.row;
	}
};

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

		const focusedDomElement = this.view.domElement(focus[0].row, focus[0].columnId);

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

	private indexes: Array<ICellIndex> = [];
	private sortedIndexes: Array<ICellIndex> = [];

	private _onChange = new Emitter<ITraitChangeEvent>();
	get onChange(): Event<ITraitChangeEvent> { return this._onChange.event; }

	get trait(): string { return this._trait; }

	@memoize
	get renderer(): TraitRenderer<T> {
		return new TraitRenderer<T>(this);
	}

	constructor(private _trait: string) { }

	renderIndex(index: ICellIndex, container: HTMLElement): void {
		DOM.toggleClass(container, this._trait, this.contains(index));
	}

	unrender(container: HTMLElement): void {
		DOM.removeClass(container, this._trait);
	}

	/**
	 * Sets the indexes which should have this trait.
	 *
	 * @param indexes Indexes which should have this trait.
	 * @return The old indexes which had this trait.
	 */
	set(indexes: Array<ICellIndex>, browserEvent?: UIEvent): Array<ICellIndex> {
		return this._set(indexes, indexes, browserEvent);
	}

	private _set(indexes: Array<ICellIndex>, sortedIndexes: Array<ICellIndex>, browserEvent?: UIEvent): Array<ICellIndex> {
		const result = this.indexes;
		const sortedResult = this.sortedIndexes;

		this.indexes = indexes;
		this.sortedIndexes = sortedIndexes;

		// const toRender = disjunction(sortedResult, indexes);
		this.renderer.renderIndexes(indexes.concat(sortedResult));

		this._onChange.fire({ indexes, browserEvent });
		return result;
	}

	get(): Array<ICellIndex> {
		return this.indexes;
	}

	contains(index: ICellIndex): boolean {
		return !!this.indexes.find(v => v.columnId === index.columnId && v.row === index.row);
	}

	dispose() {
		this._onChange = dispose(this._onChange);
	}
}

/**
 * Given two sorted collections of numbers, returns the intersection
 * between them (OR).
 */
// function disjunction(one: { row: number, column: number }[], other: { row: number, column: number }[]): { row: number, column: number }[] {
// 	const result: number[] = [];
// 	let i = 0, j = 0;

// 	while (i < one.length || j < other.length) {
// 		if (i >= one.length) {
// 			result.push(other[j++]);
// 		} else if (j >= other.length) {
// 			result.push(one[i++]);
// 		} else if (one[i] === other[j]) {
// 			result.push(one[i]);
// 			i++;
// 			j++;
// 			continue;
// 		} else if (one[i] < other[j]) {
// 			result.push(one[i++]);
// 		} else {
// 			result.push(other[j++]);
// 		}
// 	}

// 	return result;
// }


class FocusTrait<T> extends Trait<T> {

	constructor() {
		super('focused');
	}

	renderIndex(index: ICellIndex, container: HTMLElement): void {
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

	renderCell(element: T, index: number, columnId: string, templateData: any[], height: number | undefined): void {
		let i = 0;

		for (const renderer of this.renderers) {
			renderer.renderCell(element, index, columnId, templateData[i++], height);
		}
	}

	disposeCell(element: T, index: number, columnId: string, templateData: any[], height: number | undefined): void {
		let i = 0;

		for (const renderer of this.renderers) {
			if (renderer.disposeCell) {
				renderer.disposeCell(element, index, columnId, templateData[i], height);
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

export class MouseController<T> implements IDisposable {

	private multipleSelectionSupport: boolean;
	readonly multipleSelectionController: IMultipleSelectionController<T>;
	private openController: IOpenController;
	private mouseSupport: boolean;
	private disposables: IDisposable[] = [];

	constructor(protected table: Table<T>) {
		this.multipleSelectionSupport = true;

		if (this.multipleSelectionSupport) {
			this.multipleSelectionController = DefaultMultipleSelectionController;
		}

		this.openController = DefaultOpenController;
		this.mouseSupport = true;

		if (this.mouseSupport) {
			table.onMouseDown(this.onMouseDown, this, this.disposables);
			table.onContextMenu(this.onContextMenu, this, this.disposables);
			table.onMouseDblClick(this.onDoubleClick, this, this.disposables);
		}

		table.onMouseClick(this.onPointer, this, this.disposables);
		table.onMouseMiddleClick(this.onPointer, this, this.disposables);
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
	}

	private onContextMenu(e: ITableContextMenuEvent<T>): void {
		const focus = typeof e.index === 'undefined' ? [] : [e.index];
		this.table.setFocus(focus, e.browserEvent);
	}

	protected onPointer(e: ITableMouseEvent<T>): void {
		if (!this.mouseSupport) {
			return;
		}

		let reference = this.table.getFocus()[0];
		const selection = this.table.getSelection();
		reference = reference === undefined ? selection[0] : reference;

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

		this.table.setFocus([focus], e.browserEvent);

		if (!isMouseRightClick(e.browserEvent)) {
			this.table.setSelection([focus], e.browserEvent);

			if (this.openController.shouldOpen(e.browserEvent)) {
				// this.table.open([focus], e.browserEvent);
			}
		}
	}

	private onDoubleClick(e: ITableMouseEvent<T>): void {

		if (this.multipleSelectionSupport && this.isSelectionChangeEvent(e)) {
			return;
		}

		const focus = this.table.getFocus();
		this.table.setSelection(focus, e.browserEvent);
		// this.table.pin(focus);
	}

	private changeSelection(e: ITableMouseEvent<T>, reference: ICellIndex | undefined): void {
		const focus = e.index!;

		/*
		if (this.isSelectionRangeChangeEvent(e) && reference !== undefined) {
			const min = Math.min(reference, focus);
			const max = Math.max(reference, focus);
			const rangeSelection = range(min, max + 1);
			const selection = this.table.getSelection();
			const contiguousRange = getContiguousRangeContaining(disjunction(selection, [reference]), reference);

			if (contiguousRange.length === 0) {
				return;
			}

			const newSelection = disjunction(rangeSelection, relativeComplement(selection, contiguousRange));
			this.table.setSelection(newSelection, e.browserEvent);

		} else if (this.isSelectionSingleChangeEvent(e)) { */
		const selection = this.table.getSelection();
		const newSelection = selection.filter(i => i !== focus);

		if (selection.length === newSelection.length) {
			this.table.setSelection([...newSelection, focus], e.browserEvent);
		} else {
			this.table.setSelection(newSelection, e.browserEvent);
		}
		// }
	}

	dispose() {
		this.disposables = dispose(this.disposables);
	}
}

export interface ITableStyles extends IListStyles {
	cellOutlineColor?: Color;
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
		}

		const newStyles = content.join('\n');
		if (newStyles !== this.styleElement.innerHTML) {
			this.styleElement.innerHTML = newStyles;
		}
	}
}

export class Table<T> implements IDisposable {

	private focus: Trait<T>;
	private selection: Trait<T>;
	private eventBufferer = new EventBufferer();
	private view: TableView<T>;
	private styleElement: HTMLStyleElement;
	private styleController: IStyleController;

	protected disposables: IDisposable[] = [];

	@memoize get onFocusChange(): Event<ITableEvent<T>> {
		return Event.map(this.eventBufferer.wrapEvent(this.focus.onChange), e => this.toTableEvent(e));
	}

	@memoize get onSelectionChange(): Event<ITableEvent<T>> {
		return Event.map(this.eventBufferer.wrapEvent(this.selection.onChange), e => this.toTableEvent(e));
	}

	private toTableEvent({ indexes, browserEvent }: ITraitChangeEvent) {
		return { indexes, elements: indexes.map(i => this.view.element(i.row)), browserEvent };
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
			.filter(() => this.getFocus().length > 0 && !!this.view.domElement(this.getFocus()[0].row, this.getFocus()[0].columnId))
			.map(browserEvent => {
				const index = this.getFocus()[0];
				const element = this.view.element(index.row);
				const anchor = this.view.domElement(index.row, index.columnId) as HTMLElement;
				return { index, element, anchor, browserEvent };
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

	constructor(
		container: HTMLElement,
		columns: IColumn<T, any>[],
		dataSource: ITableDataSource<T>,
		options?: ITableViewOptions<T>
	) {
		this.focus = new FocusTrait();
		this.selection = new Trait('selected');

		const baseRenderers: ITableRenderer<T, ITraitTemplateData>[] = [this.focus.renderer, this.selection.renderer];

		columns = columns.map(r => {
			r.renderer = new PipelineRenderer([...baseRenderers, r.renderer]);
			return r;
		});

		this.view = new TableView(container, columns, dataSource, options);

		this.styleElement = DOM.createStyleSheet(this.view.domNode);

		this.styleController = new DefaultStyleController(this.styleElement, this.view.domId);

		this.disposables.push(new DOMFocusController(this, this.view));

		this.disposables.push(this.createMouseController(options));

		this.onFocusChange(this._onFocusChange, this, this.disposables);
		this.onSelectionChange(this._onSelectionChange, this, this.disposables);
	}

	protected createMouseController(options: ITableViewOptions<T>): MouseController<T> {
		return new MouseController(this);
	}

	get length(): number {
		return this.view.length;
	}

	set length(length: number) {
		this.view.length = length;
	}

	layout(height?: number, width?: number): void {
		this.view.layout(height, width);
	}

	domFocus(): void {
		this.view.domNode.focus();
	}

	setSelection(indexes: ICellIndex[], browserEvent?: UIEvent): void {
		// for (const index of indexes) {
		// 	if (index < 0 || index >= this.length) {
		// 		throw new Error(`Invalid index ${index}`);
		// 	}
		// }

		this.selection.set(indexes, browserEvent);
	}

	getSelection(): ICellIndex[] {
		return this.selection.get();
	}

	setFocus(indexes: ICellIndex[], browserEvent?: UIEvent): void {
		// for (const index of indexes) {
		// 	if (index < 0 || index >= this.length) {
		// 		throw new Error(`Invalid index ${index}`);
		// 	}
		// }

		this.focus.set(indexes, browserEvent);
	}

	getFocus(): Array<ICellIndex> {
		return this.focus.get();
	}

	style(styles: ITableStyles): void {
		this.styleController.style(styles);
	}

	private _onFocusChange(): void {
		const focus = this.focus.get();

		if (focus.length > 0) {
			this.view.domNode.setAttribute('aria-activedescendant', this.view.getElementDomId(focus[0].row, focus[0].columnId));
		} else {
			this.view.domNode.removeAttribute('aria-activedescendant');
		}

		this.view.domNode.setAttribute('role', 'tree');
		DOM.toggleClass(this.view.domNode, 'element-focused', focus.length > 0);
	}

	private _onSelectionChange(): void {
		const selection = this.selection.get();

		DOM.toggleClass(this.view.domNode, 'selection-none', selection.length === 0);
		DOM.toggleClass(this.view.domNode, 'selection-single', selection.length === 1);
		DOM.toggleClass(this.view.domNode, 'selection-multiple', selection.length > 1);
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}
