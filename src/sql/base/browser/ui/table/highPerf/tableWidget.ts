/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITableEvent, ITableRenderer, ITableMouseEvent, ITableContextMenuEvent, ITableDataSource } from 'sql/base/browser/ui/table/highPerf/table';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { memoize } from 'vs/base/common/decorators';
import { Event, Emitter, EventBufferer } from 'vs/base/common/event';
import { ISpliceable } from 'vs/base/common/sequence';
import { firstIndex, binarySearch } from 'vs/base/common/arrays';
import * as DOM from 'vs/base/browser/dom';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { TableView, ITableViewOptions, IColumn } from 'sql/base/browser/ui/table/highPerf/tableView';
import { ScrollEvent } from 'vs/base/common/scrollable';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { domEvent } from 'vs/base/browser/event';
import { KeyCode } from 'vs/base/common/keyCodes';

interface ITraitChangeEvent {
	indexes: number[];
	browserEvent?: UIEvent;
}

type ITraitTemplateData = HTMLElement;

interface IRenderedContainer {
	templateData: ITraitTemplateData;
	index: number;
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

	renderCell(element: T, index: number, templateData: ITraitTemplateData): void {
		const renderedElementIndex = firstIndex(this.renderedElements, el => el.templateData === templateData);

		if (renderedElementIndex >= 0) {
			const rendered = this.renderedElements[renderedElementIndex];
			this.trait.unrender(templateData);
			rendered.index = index;
		} else {
			const rendered = { index, templateData };
			this.renderedElements.push(rendered);
		}

		this.trait.renderIndex(index, templateData);
	}

	splice(start: number, deleteCount: number, insertCount: number): void {
		const rendered: IRenderedContainer[] = [];

		for (const renderedElement of this.renderedElements) {

			if (renderedElement.index < start) {
				rendered.push(renderedElement);
			} else if (renderedElement.index >= start + deleteCount) {
				rendered.push({
					index: renderedElement.index + insertCount - deleteCount,
					templateData: renderedElement.templateData
				});
			}
		}

		this.renderedElements = rendered;
	}

	renderIndexes(indexes: number[]): void {
		for (const { index, templateData } of this.renderedElements) {
			if (indexes.indexOf(index) > -1) {
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

const numericSort = (a: number, b: number) => a - b;

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

		const focusedDomElement = this.view.domElement(focus[0]);

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

class Trait<T> implements ISpliceable<boolean>, IDisposable {

	private indexes: number[] = [];
	private sortedIndexes: number[] = [];

	private _onChange = new Emitter<ITraitChangeEvent>();
	get onChange(): Event<ITraitChangeEvent> { return this._onChange.event; }

	get trait(): string { return this._trait; }

	@memoize
	get renderer(): TraitRenderer<T> {
		return new TraitRenderer<T>(this);
	}

	constructor(private _trait: string) { }

	splice(start: number, deleteCount: number, elements: boolean[]): void {
		const diff = elements.length - deleteCount;
		const end = start + deleteCount;
		const indexes = [
			...this.sortedIndexes.filter(i => i < start),
			...elements.map((hasTrait, i) => hasTrait ? i + start : -1).filter(i => i !== -1),
			...this.sortedIndexes.filter(i => i >= end).map(i => i + diff)
		];

		this.renderer.splice(start, deleteCount, elements.length);
		this._set(indexes, indexes);
	}

	renderIndex(index: number, container: HTMLElement): void {
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
	set(indexes: number[], browserEvent?: UIEvent): number[] {
		return this._set(indexes, [...indexes].sort(numericSort), browserEvent);
	}

	private _set(indexes: number[], sortedIndexes: number[], browserEvent?: UIEvent): number[] {
		const result = this.indexes;
		const sortedResult = this.sortedIndexes;

		this.indexes = indexes;
		this.sortedIndexes = sortedIndexes;

		const toRender = disjunction(sortedResult, indexes);
		this.renderer.renderIndexes(toRender);

		this._onChange.fire({ indexes, browserEvent });
		return result;
	}

	get(): number[] {
		return this.indexes;
	}

	contains(index: number): boolean {
		return binarySearch(this.sortedIndexes, index, numericSort) >= 0;
	}

	dispose() {
		this._onChange = dispose(this._onChange);
	}
}

/**
 * Given two sorted collections of numbers, returns the intersection
 * between them (OR).
 */
function disjunction(one: number[], other: number[]): number[] {
	const result: number[] = [];
	let i = 0, j = 0;

	while (i < one.length || j < other.length) {
		if (i >= one.length) {
			result.push(other[j++]);
		} else if (j >= other.length) {
			result.push(one[i++]);
		} else if (one[i] === other[j]) {
			result.push(one[i]);
			i++;
			j++;
			continue;
		} else if (one[i] < other[j]) {
			result.push(one[i++]);
		} else {
			result.push(other[j++]);
		}
	}

	return result;
}


class FocusTrait<T> extends Trait<T> {

	constructor() {
		super('focused');
	}

	renderIndex(index: number, container: HTMLElement): void {
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

	renderCell(element: T, index: number, templateData: any[], height: number | undefined): void {
		let i = 0;

		for (const renderer of this.renderers) {
			renderer.renderCell(element, index, templateData[i++], height);
		}
	}

	disposeCell(element: T, index: number, templateData: any[], height: number | undefined): void {
		let i = 0;

		for (const renderer of this.renderers) {
			if (renderer.disposeCell) {
				renderer.disposeCell(element, index, templateData[i], height);
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

export class Table<T> implements IDisposable {

	private focus: Trait<T>;
	private selection: Trait<T>;
	private eventBufferer = new EventBufferer();
	private view: TableView<T>;
	protected disposables: IDisposable[];

	@memoize get onFocusChange(): Event<ITableEvent<T>> {
		return Event.map(this.eventBufferer.wrapEvent(this.focus.onChange), e => this.toTableEvent(e));
	}

	@memoize get onSelectionChange(): Event<ITableEvent<T>> {
		return Event.map(this.eventBufferer.wrapEvent(this.selection.onChange), e => this.toTableEvent(e));
	}

	private toTableEvent({ indexes, browserEvent }: ITraitChangeEvent) {
		return { indexes, elements: indexes.map(i => this.view.element(i)), browserEvent };
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
			.filter(() => this.getFocus().length > 0 && !!this.view.domElement(this.getFocus()[0]))
			.map(browserEvent => {
				const index = this.getFocus()[0];
				const element = this.view.element(index);
				const anchor = this.view.domElement(index) as HTMLElement;
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
		options: ITableViewOptions<T>
	) {
		this.focus = new FocusTrait();
		this.selection = new Trait('selected');

		const baseRenderers: ITableRenderer<T, ITraitTemplateData>[] = [this.focus.renderer, this.selection.renderer];

		columns = columns.map(r => {
			r.renderer = new PipelineRenderer([...baseRenderers, r.renderer]);
			return r;
		});

		this.view = new TableView(container, columns, dataSource, options);

		this.disposables.push(new DOMFocusController(this, this.view));

		this.onFocusChange(this._onFocusChange, this, this.disposables);
		this.onSelectionChange(this._onSelectionChange, this, this.disposables);
	}

	get length(): number {
		return this.view.length;
	}

	domFocus(): void {
		this.view.domNode.focus();
	}

	getSelection(): number[] {
		return this.selection.get();
	}

	setFocus(indexes: number[], browserEvent?: UIEvent): void {
		for (const index of indexes) {
			if (index < 0 || index >= this.length) {
				throw new Error(`Invalid index ${index}`);
			}
		}

		this.focus.set(indexes, browserEvent);
	}

	getFocus(): number[] {
		return this.focus.get();
	}

	private _onFocusChange(): void {
		const focus = this.focus.get();

		if (focus.length > 0) {
			this.view.domNode.setAttribute('aria-activedescendant', this.view.getElementDomId(focus[0]));
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
