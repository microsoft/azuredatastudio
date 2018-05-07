/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as _ from './table';
import * as Lifecycle from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import * as Browser from 'vs/base/browser/browser';
import * as Touch from 'vs/base/browser/touch';
import * as Keyboard from 'vs/base/browser/keyboardEvent';
import * as Mouse from 'vs/base/browser/mouseEvent';
import * as Platform from 'vs/base/common/platform';
import * as Model from './tableModel';
import * as strings from 'vs/base/common/strings';
import Event, { Emitter } from 'vs/base/common/event';
import { HeightMap, IViewRow, IViewCell } from './tableViewModel';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { KeyCode } from 'vs/base/common/keyCodes';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { ArrayIterator } from 'vs/base/common/iterator';

export interface ICell {
	element: HTMLElement;
	templateId: string;
	templateData: any;
}

export interface IColumn {
	element: HTMLElement;
	templateId: string;
	templateData: any;
}

export interface IRow {
	element: HTMLElement;
}


function removeFromParent(element: HTMLElement): void {
	try {
		element.parentElement.removeChild(element);
	} catch (e) {
		// this will throw if this happens due to a blur event, nasty business
	}
}

export class CellCache implements Lifecycle.IDisposable {
	private _cache: { [templateId: string]: ICell[]; };

	constructor(private context: _.ITableContext) {
		this._cache = { '': [] };
	}

	public alloc(templateId: string): ICell {
		let result = this.cache(templateId).pop();

		if (!result) {
			let content = document.createElement('div');
			content.className = 'content';

			let cell = document.createElement('td');
			cell.appendChild(content);

			result = {
				element: cell,
				templateId: templateId,
				templateData: this.context.renderer.renderTemplate(this.context.table, templateId, content)
			};
		}

		return result;
	}

	public release(templateId: string, row: ICell): void {
		removeFromParent(row.element);
		this.cache(templateId).push(row);
	}

	private cache(templateId: string): ICell[] {
		return this._cache[templateId] || (this._cache[templateId] = []);
	}

	public garbageCollect(): void {
		if (this._cache) {
			Object.keys(this._cache).forEach(templateId => {
				this._cache[templateId].forEach(cachedRow => {
					this.context.renderer.disposeTemplate(this.context.table, templateId, cachedRow.templateData);
					cachedRow.element = null;
					cachedRow.templateData = null;
				});

				delete this._cache[templateId];
			});
		}
	}

	public dispose(): void {
		this.garbageCollect();
		this._cache = null;
		this.context = null;
	}
}

export class ColumnCache implements Lifecycle.IDisposable {
	private _cache: { [templateId: string]: IColumn[]; };

	constructor(private context: _.ITableContext) {
		this._cache = { '': [] };
	}

	public alloc(templateId: string): IColumn {
		let result = this.cache(templateId).pop();

		if (!result) {
			let content = document.createElement('div');
			content.className = 'content';

			let cell = document.createElement('th');
			cell.appendChild(content);

			result = {
				element: cell,
				templateId: templateId,
				templateData: this.context.renderer.renderColumnTemplate(this.context.table, templateId, content)
			};
		}

		return result;
	}

	public release(templateId: string, row: ICell): void {
		removeFromParent(row.element);
		this.cache(templateId).push(row);
	}

	private cache(templateId: string): ICell[] {
		return this._cache[templateId] || (this._cache[templateId] = []);
	}

	public garbageCollect(): void {
		if (this._cache) {
			Object.keys(this._cache).forEach(templateId => {
				this._cache[templateId].forEach(cachedRow => {
					this.context.renderer.disposeTemplate(this.context.table, templateId, cachedRow.templateData);
					cachedRow.element = null;
					cachedRow.templateData = null;
				});

				delete this._cache[templateId];
			});
		}
	}

	public dispose(): void {
		this.garbageCollect();
		this._cache = null;
		this.context = null;
	}
}

export interface IViewContext extends _.ITableContext {
	cellCache: CellCache;
	columnCache: ColumnCache;
}

export class ViewRow implements IViewRow {
	public id: number;
	protected row: IRow;

	protected cells: ViewCell[];

	public top: number;
	public height: number;

	public needsRender: boolean;

	public _styles: any;

	constructor(private context: IViewContext, public model: Model.Row) {
		this.id = this.model.id;
		this.row = null;

		this.top = 0;
		this.height = this.model.getHeight();

		this._styles = {};
		this.model.getAllTraits().forEach(t => this._styles[t] = true);

		this.cells = this.model.cells.map(e => new ViewCell(context, e, this));
	}

	public get element(): HTMLElement {
		return this.row && this.row.element;
	}

	public render(skipUserRender = false): void {
		if (!this.model || !this.element) {
			return;
		}

		let classes = ['monaco-table-row'];
		classes.push.apply(classes, Object.keys(this._styles));

		this.element.className = classes.join(' ');
		this.element.style.height = this.height + 'px';

		// ARIA
		// this.element.setAttribute('role', 'treeitem');
		// const accessibility = this.context.accessibilityProvider;
		// const ariaLabel = accessibility.getAriaLabel(this.context.table, this.model.getElement());
		// if (ariaLabel) {
		// 	this.element.setAttribute('aria-label', ariaLabel);
		// }
		// if (accessibility.getPosInSet && accessibility.getSetSize) {
		// 	this.element.setAttribute('aria-setsize', accessibility.getSetSize());
		// 	this.element.setAttribute('aria-posinset', accessibility.getPosInSet(this.context.tree, this.model.getElement()));
		// }
		if (this.model.hasTrait('focused')) {
			const base64Id = strings.safeBtoa(String(this.model.id));

			this.element.setAttribute('aria-selected', 'true');
			this.element.setAttribute('id', base64Id);
		} else {
			this.element.setAttribute('aria-selected', 'false');
			this.element.removeAttribute('id');
		}

		this.cells.forEach(c => c.render(skipUserRender));
	}

	public insertInDOM(container: HTMLElement, afterElement: HTMLElement): void {
		if (!this.row) {
			const rowNode = document.createElement('tr');
			this.row = { element: rowNode };
			this.cells.forEach(c => c.insertInDOM(rowNode, undefined));

			// used in reverse lookup from HTMLElement to Item
			(<any>this.element)[TableView.BINDING] = this;
		}

		if (this.element.parentElement) {
			return;
		}

		if (afterElement === null) {
			container.appendChild(this.element);
		} else {
			try {
				container.insertBefore(this.element, afterElement);
			} catch (e) {
				console.warn('Failed to locate previous tree element');
				container.appendChild(this.element);
			}
		}

		this.render();
	}

	public removeFromDOM(): void {
		if (!this.row) {
			return;
		}
		removeFromParent(this.element);

		(<any>this.element)[TableView.BINDING] = null;
		this.row = null;

		if (this.cells) {
			this.cells.forEach(c => c.removeFromDOM());
		}
	}

	public dispose(): void {
		this.row = null;
		this.model = null;
	}
}

export class ViewCell implements IViewCell {
	public top: number;
	public height: number;
	public id: string;
	protected cell: ICell;

	public _styles: any;

	private get columnId(): string {
		return this.model.columnId;
	}

	constructor(private context: IViewContext, public model: Model.Cell, private row: ViewRow) {
		this.id = this.model.id;

		this._styles = {};
		this.model.getAllTraits().forEach(t => this._styles[t] = true);
	}

	public get element(): HTMLElement {
		return this.cell && this.cell.element;
	}

	public render(skipUserRender = false): void {
		if (!this.model || !this.element) {
			return;
		}

		let classes = ['monaco-table-row'];
		classes.push.apply(classes, Object.keys(this._styles));

		this.element.className = classes.join(' ');
		this.element.style.height = this.height + 'px';

		// ARIA
		// this.element.setAttribute('role', 'treeitem');
		// const accessibility = this.context.accessibilityProvider;
		// const ariaLabel = accessibility.getAriaLabel(this.context.table, this.model.getElement());
		// if (ariaLabel) {
		// 	this.element.setAttribute('aria-label', ariaLabel);
		// }
		// if (accessibility.getPosInSet && accessibility.getSetSize) {
		// 	this.element.setAttribute('aria-setsize', accessibility.getSetSize());
		// 	this.element.setAttribute('aria-posinset', accessibility.getPosInSet(this.context.tree, this.model.getElement()));
		// }
		if (this.model.hasTrait('focused')) {
			const base64Id = strings.safeBtoa(this.model.id);

			this.element.setAttribute('aria-selected', 'true');
			this.element.setAttribute('id', base64Id);
		} else {
			this.element.setAttribute('aria-selected', 'false');
			this.element.removeAttribute('id');
		}

		if (!skipUserRender) {
			this.model.getElement().then(v => {
				this.context.renderer.renderElement(this.context.table, v, this.columnId, this.cell.templateData);
			});
		}
	}

	public insertInDOM(container: HTMLElement, afterElement: HTMLElement): void {
		if (!this.cell) {
			this.cell = this.context.cellCache.alloc(this.columnId);

			// used in reverse lookup from HTMLElement to Item
			(<any>this.element)[TableView.BINDING] = this;
		}

		if (this.element.parentElement) {
			return;
		}

		if (afterElement === null) {
			container.appendChild(this.element);
		} else {
			try {
				container.insertBefore(this.element, afterElement);
			} catch (e) {
				console.warn('Failed to locate previous tree element');
				container.appendChild(this.element);
			}
		}

		this.render();
	}

	public removeFromDOM(): void {
		if (!this.cell) {
			return;
		}

		this.context.cellCache.release(this.columnId, this.cell);
		this.cell = null;
	}
}

class ViewColumn {
	public left: number;
	public width: number;
	public id: string;
	protected column: IColumn;

	public _styles: any;

	constructor(private context: IViewContext, public model: Model.Column) {
		this.id = this.model.id;

		this._styles = {};
		this.model.getAllTraits().forEach(t => this._styles[t] = true);
	}

	public get element(): HTMLElement {
		return this.column && this.column.element;
	}

	public render(skipUserRender = false): void {
		if (!this.model || !this.element) {
			return;
		}

		let classes = ['monaco-table-column-header'];
		classes.push.apply(classes, Object.keys(this._styles));

		this.element.className = classes.join(' ');
		this.element.style.width = this.width + 'px';

		// ARIA
		// this.element.setAttribute('role', 'treeitem');
		// const accessibility = this.context.accessibilityProvider;
		// const ariaLabel = accessibility.getAriaLabel(this.context.table, this.model.getElement());
		// if (ariaLabel) {
		// 	this.element.setAttribute('aria-label', ariaLabel);
		// }
		// if (accessibility.getPosInSet && accessibility.getSetSize) {
		// 	this.element.setAttribute('aria-setsize', accessibility.getSetSize());
		// 	this.element.setAttribute('aria-posinset', accessibility.getPosInSet(this.context.tree, this.model.getElement()));
		// }
		if (this.model.hasTrait('focused')) {
			const base64Id = strings.safeBtoa(this.model.id);

			this.element.setAttribute('aria-selected', 'true');
			this.element.setAttribute('id', base64Id);
		} else {
			this.element.setAttribute('aria-selected', 'false');
			this.element.removeAttribute('id');
		}

		if (!skipUserRender) {
			this.context.renderer.renderElement(this.context.table, this.model.getElement(), this.id, this.column.templateData);
		}
	}

	public insertInDOM(container: HTMLElement, afterElement: HTMLElement): void {
		if (!this.column) {
			this.column = this.context.columnCache.alloc(this.id);

			// used in reverse lookup from HTMLElement to Item
			(<any>this.element)[TableView.BINDING] = this;
		}

		if (this.element.parentElement) {
			return;
		}

		if (afterElement === null) {
			container.appendChild(this.element);
		} else {
			try {
				container.insertBefore(this.element, afterElement);
			} catch (e) {
				console.warn('Failed to locate previous tree element');
				container.appendChild(this.element);
			}
		}

		this.render();
	}

	public removeFromDOM(): void {
		if (!this.column) {
			return;
		}

		this.context.columnCache.release(this.id, this.column);
		this.column = null;
	}

}

interface IThrottledGestureEvent {
	translationX: number;
	translationY: number;
}

export class TableView extends HeightMap {

	static BINDING = 'monaco-table-row';

	private static counter: number = 0;
	private instance: number;

	private context: IViewContext;
	private modelListeners: Lifecycle.IDisposable[];
	private model: Model.TableModel;

	private viewListeners: Lifecycle.IDisposable[];
	private domNode: HTMLElement;
	private rowWrapper: HTMLElement;
	private headerWrapper: HTMLElement;
	private tableNode: HTMLTableElement;
	private headerContainer: HTMLElement;
	private styleElement: HTMLStyleElement;
	private scrollableElement: ScrollableElement;
	private headerScrollable: ScrollableElement;
	private rowsContainer: HTMLElement;
	private msGesture: MSGesture;
	private lastPointerType: string;
	private lastClickTimeStamp: number = 0;

	private lastRenderTop: number;
	private lastRenderHeight: number;
	private lastRenderLeft: number;
	private lastRenderWidth: number;

	private rows: { [id: string]: ViewRow; } = {};

	private isRefreshing = false;

	private didJustPressContextMenuKey: boolean;

	private onHiddenScrollTop: number;

	private _onDOMFocus: Emitter<void> = new Emitter<void>();
	get onDOMFocus(): Event<void> { return this._onDOMFocus.event; }

	private _onDOMBlur: Emitter<void> = new Emitter<void>();
	get onDOMBlur(): Event<void> { return this._onDOMBlur.event; }

	constructor(context: _.ITableContext, container: HTMLElement) {
		super();

		TableView.counter++;
		this.instance = TableView.counter;

		this.context = {
			dataSource: context.dataSource,
			renderer: context.renderer,
			controller: context.controller,
			// filter: context.filter,
			// sorter: context.sorter,
			table: context.table,
			// accessibilityProvider: context.accessibilityProvider,
			options: context.options,
			cellCache: new CellCache(context),
			columnCache: new ColumnCache(context)
		};

		this.viewListeners = [];

		this.domNode = document.createElement('div');
		this.domNode.className = `monaco-table no-focused-item monaco-table-instance-${this.instance}`;

		this.styleElement = DOM.createStyleSheet(this.domNode);

		this.tableNode = document.createElement('table');
		this.domNode.appendChild(this.tableNode);

		if (this.context.options.ariaLabel) {
			this.domNode.setAttribute('aria-label', this.context.options.ariaLabel);
		}

		this.headerWrapper = document.createElement('div');
		this.headerWrapper.className = 'monaco-table-header-wrapper';
		this.headerScrollable = new ScrollableElement(this.headerWrapper, {
			alwaysConsumeMouseWheel: true,
			horizontal: ScrollbarVisibility.Auto,
			vertical: ScrollbarVisibility.Hidden,
			useShadows: context.options.useShadows
		});
		this.headerScrollable.onScroll((e) => {
			this.headerRender(e.scrollLeft, e.width);
		});

		this.rowWrapper = document.createElement('div');
		this.rowWrapper.className = 'monaco-table-wrapper';
		this.scrollableElement = new ScrollableElement(this.rowWrapper, {
			alwaysConsumeMouseWheel: true,
			horizontal: ScrollbarVisibility.Auto,
			vertical: ScrollbarVisibility.Auto,
			useShadows: context.options.useShadows
		});
		this.scrollableElement.onScroll((e) => {
			this.render(e.scrollTop, e.height);
		});

		if (Browser.isIE) {
			this.headerWrapper.style.msTouchAction = 'none';
			this.headerWrapper.style.msContentZooming = 'none';
			this.rowWrapper.style.msTouchAction = 'none';
			this.rowWrapper.style.msContentZooming = 'none';
		} else {
			Touch.Gesture.addTarget(this.headerWrapper);
			Touch.Gesture.addTarget(this.rowWrapper);
		}

		this.headerContainer = document.createElement('theader');

		this.rowsContainer = document.createElement('tbody');
		this.rowsContainer.className = 'monaco-table-rows';

		let focusTracker = DOM.trackFocus(this.domNode);
		this.viewListeners.push(focusTracker.onDidFocus(() => this.onFocus()));
		this.viewListeners.push(focusTracker.onDidBlur(() => this.onBlur()));
		this.viewListeners.push(focusTracker);

		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'keydown', (e) => this.onKeyDown(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'keyup', (e) => this.onKeyUp(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'mousedown', (e) => this.onMouseDown(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'mouseup', (e) => this.onMouseUp(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.rowWrapper, 'click', (e) => this.onClick(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.rowWrapper, 'auxclick', (e) => this.onClick(e))); // >= Chrome 56
		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'contextmenu', (e) => this.onContextMenu(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.rowWrapper, Touch.EventType.Tap, (e) => this.onTap(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.rowWrapper, Touch.EventType.Change, (e) => this.onTouchChange(e)));

		if (Browser.isIE) {
			this.viewListeners.push(DOM.addDisposableListener(this.rowWrapper, 'MSPointerDown', (e) => this.onMsPointerDown(e)));
			this.viewListeners.push(DOM.addDisposableListener(this.rowWrapper, 'MSGestureTap', (e) => this.onMsGestureTap(e)));

			// these events come too fast, we throttle them
			this.viewListeners.push(DOM.addDisposableThrottledListener<IThrottledGestureEvent>(this.rowWrapper, 'MSGestureChange', (e) => this.onThrottledMsGestureChange(e), (lastEvent: IThrottledGestureEvent, event: MSGestureEvent): IThrottledGestureEvent => {
				event.stopPropagation();
				event.preventDefault();

				let result = { translationY: event.translationY, translationX: event.translationX };

				if (lastEvent) {
					result.translationY += lastEvent.translationY;
					result.translationX += lastEvent.translationX;
				}

				return result;
			}));
		}

		this.headerWrapper.appendChild(this.headerContainer);
		this.tableNode.appendChild(this.headerScrollable.getDomNode());

		this.rowWrapper.appendChild(this.rowsContainer);
		this.tableNode.appendChild(this.scrollableElement.getDomNode());
		container.appendChild(this.domNode);

		this.lastRenderTop = 0;
		this.lastRenderHeight = 0;

		this.didJustPressContextMenuKey = false;


		this.onHiddenScrollTop = null;

		this.onRowsChanged();
		this.layout();

		this.setupMSGesture();

		this.applyStyles(context.options);

	}

	public applyStyles(styles: _.ITableStyles): void {
		const content: string[] = [];

		if (styles.listFocusBackground) {
			content.push(`.monaco-tree.monaco-tree-instance-${this.instance}.focused .monaco-tree-rows > .monaco-tree-row.focused:not(.highlighted) { background-color: ${styles.listFocusBackground}; }`);
		}

		if (styles.listFocusForeground) {
			content.push(`.monaco-tree.monaco-tree-instance-${this.instance}.focused .monaco-tree-rows > .monaco-tree-row.focused:not(.highlighted) { color: ${styles.listFocusForeground}; }`);
		}

		if (styles.listActiveSelectionBackground) {
			content.push(`.monaco-tree.monaco-tree-instance-${this.instance}.focused .monaco-tree-rows > .monaco-tree-row.selected:not(.highlighted) { background-color: ${styles.listActiveSelectionBackground}; }`);
		}

		if (styles.listActiveSelectionForeground) {
			content.push(`.monaco-tree.monaco-tree-instance-${this.instance}.focused .monaco-tree-rows > .monaco-tree-row.selected:not(.highlighted) { color: ${styles.listActiveSelectionForeground}; }`);
		}

		if (styles.listFocusAndSelectionBackground) {
			content.push(`
				.monaco-tree-drag-image,
				.monaco-tree.monaco-tree-instance-${this.instance}.focused .monaco-tree-rows > .monaco-tree-row.focused.selected:not(.highlighted) { background-color: ${styles.listFocusAndSelectionBackground}; }
			`);
		}

		if (styles.listFocusAndSelectionForeground) {
			content.push(`
				.monaco-tree-drag-image,
				.monaco-tree.monaco-tree-instance-${this.instance}.focused .monaco-tree-rows > .monaco-tree-row.focused.selected:not(.highlighted) { color: ${styles.listFocusAndSelectionForeground}; }
			`);
		}

		if (styles.listInactiveSelectionBackground) {
			content.push(`.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-rows > .monaco-tree-row.selected:not(.highlighted) { background-color: ${styles.listInactiveSelectionBackground}; }`);
		}

		if (styles.listInactiveSelectionForeground) {
			content.push(`.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-rows > .monaco-tree-row.selected:not(.highlighted) { color: ${styles.listInactiveSelectionForeground}; }`);
		}

		if (styles.listHoverBackground) {
			content.push(`.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-rows > .monaco-tree-row:hover:not(.highlighted):not(.selected):not(.focused) { background-color: ${styles.listHoverBackground}; }`);
		}

		if (styles.listHoverForeground) {
			content.push(`.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-rows > .monaco-tree-row:hover:not(.highlighted):not(.selected):not(.focused) { color: ${styles.listHoverForeground}; }`);
		}

		if (styles.listDropBackground) {
			content.push(`
				.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-wrapper.drop-target,
				.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-rows > .monaco-tree-row.drop-target { background-color: ${styles.listDropBackground} !important; color: inherit !important; }
			`);
		}

		if (styles.listFocusOutline) {
			content.push(`
				.monaco-tree-drag-image																															{ border: 1px solid ${styles.listFocusOutline}; background: #000; }
				.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-rows > .monaco-tree-row 														{ border: 1px solid transparent; }
				.monaco-tree.monaco-tree-instance-${this.instance}.focused .monaco-tree-rows > .monaco-tree-row.focused:not(.highlighted) 						{ border: 1px dotted ${styles.listFocusOutline}; }
				.monaco-tree.monaco-tree-instance-${this.instance}.focused .monaco-tree-rows > .monaco-tree-row.selected:not(.highlighted) 						{ border: 1px solid ${styles.listFocusOutline}; }
				.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-rows > .monaco-tree-row.selected:not(.highlighted)  							{ border: 1px solid ${styles.listFocusOutline}; }
				.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-rows > .monaco-tree-row:hover:not(.highlighted):not(.selected):not(.focused)  	{ border: 1px dashed ${styles.listFocusOutline}; }
				.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-wrapper.drop-target,
				.monaco-tree.monaco-tree-instance-${this.instance} .monaco-tree-rows > .monaco-tree-row.drop-target												{ border: 1px dashed ${styles.listFocusOutline}; }
			`);
		}

		this.styleElement.innerHTML = content.join('\n');
	}

	protected createViewRow(row: Model.Row): IViewRow {
		return new ViewRow(this.context, row);
	}

	private headerRender(scrollLeft: number, viewWidth: number): void {
	}

	private render(scrollTop: number, viewHeight: number): void {
		let i: number;
		let stop: number;

		let renderTop = scrollTop;
		let renderBottom = scrollTop + viewHeight;
		let thisRenderBottom = this.lastRenderTop + this.lastRenderHeight;

		// when view scrolls down, start rendering from the renderBottom
		for (i = this.indexAfter(renderBottom) - 1, stop = this.indexAt(Math.max(thisRenderBottom, renderTop)); i >= stop; i--) {
			this.insertRowInDOM(<ViewRow>this.rowAtIndex(i));
		}

		// when view scrolls up, start rendering from either this.renderTop or renderBottom
		for (i = Math.min(this.indexAt(this.lastRenderTop), this.indexAfter(renderBottom)) - 1, stop = this.indexAt(renderTop); i >= stop; i--) {
			this.insertRowInDOM(<ViewRow>this.rowAtIndex(i));
		}

		// when view scrolls down, start unrendering from renderTop
		for (i = this.indexAt(this.lastRenderTop), stop = Math.min(this.indexAt(renderTop), this.indexAfter(thisRenderBottom)); i < stop; i++) {
			this.removeRowFromDOM(<ViewRow>this.rowAtIndex(i));
		}

		// when view scrolls up, start unrendering from either renderBottom this.renderTop
		for (i = Math.max(this.indexAfter(renderBottom), this.indexAt(this.lastRenderTop)), stop = this.indexAfter(thisRenderBottom); i < stop; i++) {
			this.removeRowFromDOM(<ViewRow>this.rowAtIndex(i));
		}

		let topRow = this.rowAtIndex(this.indexAt(renderTop));

		if (topRow) {
			this.rowsContainer.style.top = (topRow.top - renderTop) + 'px';
		}

		this.lastRenderTop = renderTop;
		this.lastRenderHeight = renderBottom - renderTop;
	}

	public setModel(newModel: Model.TableModel): void {
		this.releaseModel();
		this.model = newModel;

		// this.model.onRefresh(this.onRefreshing, this, this.modelListeners);
		// this.model.onDidRefresh(this.onRefreshed, this, this.modelListeners);
		// this.model.onSetInput(this.onClearingInput, this, this.modelListeners);
		this.model.onDidSetInput(this.onSetInput, this, this.modelListeners);
		// this.model.onDidFocus(this.onModelFocusChange, this, this.modelListeners);

		// this.model.onDidRefreshRow(this.onRowRefresh, this, this.modelListeners);
		// this.model.onDidAddTraitRow(this.onRowAddTrait, this, this.modelListeners);
		// this.model.onDidRemoveTraitRow(this.onRowRemoveTrait, this, this.modelListeners);
	}

	private onSetInput(e: Model.IInputEvent): void {
		this.context.cellCache.garbageCollect();
		this.onInsertRows(new ArrayIterator(this.model.getRows({ startRow: 0, endRow: e.input.numberOfRows - 1 })));
	}

	private onRowsChanged(scrollTop: number = this.scrollTop): void {
		if (this.isRefreshing) {
			return;
		}

		this.scrollTop = scrollTop;
	}

	private getCellAround(element: HTMLElement): ViewCell {
		let candidate: ViewCell;/* = this.inputItem;*/
		do {
			if ((<any>element)[TableView.BINDING]) {
				candidate = (<any>element)[TableView.BINDING];
			}

			if (element === this.rowWrapper || element === this.domNode) {
				return candidate;
			}

			if (element === document.body) {
				return null;
			}
		} while (element = element.parentElement);
		return undefined;
	}

	public get scrollTop(): number {
		const scrollPosition = this.scrollableElement.getScrollPosition();
		return scrollPosition.scrollTop;
	}

	public set scrollTop(scrollTop: number) {
		this.scrollableElement.setScrollDimensions({
			scrollHeight: this.getTotalHeight()
		});
		this.scrollableElement.setScrollPosition({
			scrollTop: scrollTop
		});
	}

	public getScrollPosition(): number {
		const height = this.getTotalHeight() - this.viewHeight;
		return height <= 0 ? 1 : this.scrollTop / height;
	}

	public setScrollPosition(pos: number): void {
		const height = this.getTotalHeight() - this.viewHeight;
		this.scrollTop = height * pos;
	}

	public get viewHeight() {
		const scrollDimensions = this.scrollableElement.getScrollDimensions();
		return scrollDimensions.height;
	}

	public set viewHeight(viewHeight: number) {
		this.scrollableElement.setScrollDimensions({
			height: viewHeight,
			scrollHeight: this.getTotalHeight()
		});
	}

	private setupMSGesture(): void {
		if ((<any>window).MSGesture) {
			this.msGesture = new MSGesture();
			setTimeout(() => this.msGesture.target = this.rowWrapper, 100); // TODO@joh, TODO@IETeam
		}
	}

	// HeightMap "events"

	public onInsertRow(row: ViewRow): void {
		row.needsRender = true;
		this.refreshViewRow(row);
		this.rows[row.id] = row;
	}

	public onRefreshRow(row: ViewRow, needsRender = false): void {
		row.needsRender = row.needsRender || needsRender;
		this.refreshViewRow(row);
	}

	public onRemoveRow(row: ViewRow): void {
		this.removeRowFromDOM(row);
		row.dispose();
		delete this.rows[row.id];
	}

	// ViewRow refresh

	private refreshViewRow(row: ViewRow): void {
		row.render();

		if (this.shouldBeRendered(row)) {
			this.insertRowInDOM(row);
		} else {
			this.removeRowFromDOM(row);
		}
	}

	// DOM changes

	private insertRowInDOM(row: ViewRow): void {
		let elementAfter: HTMLElement = null;
		let rowAfter = <ViewRow>this.rowAfter(row);

		if (rowAfter && rowAfter.element) {
			elementAfter = rowAfter.element;
		}

		row.insertInDOM(this.rowsContainer, elementAfter);
	}

	private removeRowFromDOM(row: ViewRow): void {
		if (!row) {
			return;
		}

		row.removeFromDOM();
	}

	public onHidden(): void {
		this.onHiddenScrollTop = this.scrollTop;
	}

	private isTreeVisible(): boolean {
		return this.onHiddenScrollTop === null;
	}

	public layout(height?: number): void {
		if (!this.isTreeVisible()) {
			return;
		}

		this.viewHeight = height || DOM.getContentHeight(this.rowWrapper); // render
	}

	private onFocus(): void {
		// if (!this.context.options.alwaysFocused) {
		DOM.addClass(this.domNode, 'focused');
		// }

		this._onDOMFocus.fire();
	}

	private onBlur(): void {
		// if (!this.context.options.alwaysFocused) {
		DOM.removeClass(this.domNode, 'focused');
		// }

		// this.domNode.removeAttribute('aria-activedescendant'); // ARIA

		this._onDOMBlur.fire();
	}

	private onKeyDown(e: KeyboardEvent): void {
		let event = new Keyboard.StandardKeyboardEvent(e);

		this.didJustPressContextMenuKey = event.keyCode === KeyCode.ContextMenu || (event.shiftKey && event.keyCode === KeyCode.F10);

		if (this.didJustPressContextMenuKey) {
			event.preventDefault();
			event.stopPropagation();
		}

		if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === 'input') {
			return; // Ignore event if target is a form input field (avoids browser specific issues)
		}

		this.context.controller.onKeyDown(this.context.table, event);
	}

	private onKeyUp(e: KeyboardEvent): void {
		if (this.didJustPressContextMenuKey) {
			this.onContextMenu(e);
		}

		this.didJustPressContextMenuKey = false;
		this.context.controller.onKeyUp(this.context.table, new Keyboard.StandardKeyboardEvent(e));
	}

	private onMouseDown(e: MouseEvent): void {
		this.didJustPressContextMenuKey = false;

		if (!this.context.controller.onMouseDown) {
			return;
		}

		if (this.lastPointerType && this.lastPointerType !== 'mouse') {
			return;
		}

		let event = new Mouse.StandardMouseEvent(e);

		if (event.ctrlKey && Platform.isNative && Platform.isMacintosh) {
			return;
		}

		let row = this.getCellAround(event.target);

		if (!row) {
			return;
		}

		this.context.controller.onMouseDown(this.context.table, row.model.getElement(), event);
	}

	private onMouseUp(e: MouseEvent): void {
		if (!this.context.controller.onMouseUp) {
			return;
		}

		if (this.lastPointerType && this.lastPointerType !== 'mouse') {
			return;
		}

		let event = new Mouse.StandardMouseEvent(e);

		if (event.ctrlKey && Platform.isNative && Platform.isMacintosh) {
			return;
		}

		let row = this.getCellAround(event.target);

		if (!row) {
			return;
		}

		this.context.controller.onMouseUp(this.context.table, row.model.getElement(), event);
	}

	private onClick(e: MouseEvent): void {
		if (this.lastPointerType && this.lastPointerType !== 'mouse') {
			return;
		}

		let event = new Mouse.StandardMouseEvent(e);
		let row = this.getCellAround(event.target);

		if (!row) {
			return;
		}

		if (Browser.isIE && Date.now() - this.lastClickTimeStamp < 300) {
			// IE10+ doesn't set the detail property correctly. While IE10 simply
			// counts the number of clicks, IE11 reports always 1. To align with
			// other browser, we set the value to 2 if clicks events come in a 300ms
			// sequence.
			event.detail = 2;
		}
		this.lastClickTimeStamp = Date.now();

		this.context.controller.onClick(this.context.table, row.model.getElement(), event);
	}

	private onContextMenu(keyboardEvent: KeyboardEvent): void;
	private onContextMenu(mouseEvent: MouseEvent): void;
	private onContextMenu(event: KeyboardEvent | MouseEvent): void {
		let resultEvent: _.ContextMenuEvent;
		let element: any;

		if (event instanceof KeyboardEvent || this.didJustPressContextMenuKey) {
			this.didJustPressContextMenuKey = false;

			let keyboardEvent = new Keyboard.StandardKeyboardEvent(<KeyboardEvent>event);
			element = this.model.getFocus();

			let position: DOM.IDomNodePagePosition;

			// if (!element) {
			// 	element = this.model.getInput();
			// 	position = DOM.getDomNodePagePosition(this.inputItem.element);
			// } else {
			// 	let id = this.context.dataSource.getId(this.context.table, element);
			// 	let viewItem = this.items[id];
			// 	position = DOM.getDomNodePagePosition(viewItem.element);
			// }

			resultEvent = new _.KeyboardContextMenuEvent(position.left + position.width, position.top, keyboardEvent);

		} else {
			let mouseEvent = new Mouse.StandardMouseEvent(<MouseEvent>event);
			let row = this.getCellAround(mouseEvent.target);

			if (!row) {
				return;
			}

			element = row.model.getElement();
			resultEvent = new _.MouseContextMenuEvent(mouseEvent);
		}

		this.context.controller.onContextMenu(this.context.table, element, resultEvent);
	}

	private onTap(e: Touch.GestureEvent): void {
		let row = this.getCellAround(<HTMLElement>e.initialTarget);

		if (!row) {
			return;
		}

		this.context.controller.onTap(this.context.table, row.model.getElement(), e);
	}

	private onTouchChange(event: Touch.GestureEvent): void {
		event.preventDefault();
		event.stopPropagation();

		this.scrollTop -= event.translationY;
	}

	private onMsPointerDown(event: MSPointerEvent): void {
		if (!this.msGesture) {
			return;
		}

		// Circumvent IE11 breaking change in e.pointerType & TypeScript's stale definitions
		let pointerType = event.pointerType;
		if (pointerType === ((<any>event).MSPOINTER_TYPE_MOUSE || 'mouse')) {
			this.lastPointerType = 'mouse';
			return;
		} else if (pointerType === ((<any>event).MSPOINTER_TYPE_TOUCH || 'touch')) {
			this.lastPointerType = 'touch';
		} else {
			return;
		}

		event.stopPropagation();
		event.preventDefault();

		this.msGesture.addPointer(event.pointerId);
	}

	private onMsGestureTap(event: MSGestureEvent): void {
		(<any>event).initialTarget = document.elementFromPoint(event.clientX, event.clientY);
		this.onTap(<any>event);
	}

	private onThrottledMsGestureChange(event: IThrottledGestureEvent): void {
		this.scrollTop -= event.translationY;
	}

	// Helpers

	private shouldBeRendered(row: ViewRow): boolean {
		return row.top < this.lastRenderTop + this.lastRenderHeight && row.top + row.height > this.lastRenderTop;
	}

	// Cleanup

	private releaseModel(): void {
		if (this.model) {
			this.modelListeners = Lifecycle.dispose(this.modelListeners);
			this.model = null;
		}
	}

}
