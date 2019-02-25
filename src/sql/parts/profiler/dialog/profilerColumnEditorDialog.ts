/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import 'vs/css!sql/parts/profiler/media/profiler';

import { Modal } from 'sql/workbench/browser/modal/modal';
import { attachModalDialogStyler } from 'sql/platform/theme/common/styler';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';
import * as TelemetryKeys from 'sql/common/telemetryKeys';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import * as nls from 'vs/nls';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Builder } from 'sql/base/browser/builder';
import { SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import * as DOM from 'vs/base/browser/dom';
import { IDataSource, ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { TPromise } from 'vs/base/common/winjs.base';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { Event, Emitter } from 'vs/base/common/event';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';

class EventItem {

	constructor(
		private _name: string,
		private _parent: SessionItem,
		private _columns?: Array<ColumnItem>,
	) {
		if (!_columns) {
			this._columns = new Array<ColumnItem>();
		}
	}

	public hasChildren(): boolean {
		return this._columns && this._columns.length > 0;
	}

	public getChildren(): Array<ColumnItem> {
		return this._columns;
	}

	public get id(): string {
		return this._name;
	}

	public addColumn(...columns: Array<ColumnItem>) {
		this._columns = this._columns.concat(columns);
	}

	public get parent(): SessionItem {
		return this._parent;
	}

	public get selected(): boolean {
		return this._columns.every(i => i.selected);
	}

	public set selected(val: boolean) {
		this._columns.forEach(i => i.selected = val);
	}

	public get indeterminate(): boolean {
		return this._columns.some(i => i.selected) && !this.selected;
	}
}

class ColumnItem {
	public selected: boolean;
	public readonly indeterminate = false;
	constructor(
		private _name: string,
		private _parent: EventItem
	) { }

	public get id(): string {
		return this._name;
	}

	public get parent(): EventItem {
		return this._parent;
	}
}

class ColumnSortedColumnItem {
	constructor(
		private _name: string,
		private _parent: SessionItem
	) { }

	public get id(): string {
		return this._name;
	}

	public get parent(): SessionItem {
		return this._parent;
	}

	public get selected(): boolean {
		return this._parent.getUnsortedChildren()
			.every(e => e.getChildren().filter(c => c.id === this.id)
				.every(c => c.selected));
	}

	public set selected(val: boolean) {
		this._parent.getUnsortedChildren()
			.forEach(e => e.getChildren()
				.filter(c => c.id === this.id)
				.forEach(c => c.selected = val));
	}

	public get indeterminate(): boolean {
		return this._parent.getUnsortedChildren()
			.some(e => e.getChildren()
				.filter(c => c.id === this.id)
				.some(c => c.selected))
			&& !this.selected;
	}
}

class SessionItem {
	private _sortedColumnItems: Array<ColumnSortedColumnItem> = [];
	constructor(
		private _name: string,
		private _sort: 'event' | 'column',
		private _events?: Array<EventItem>
	) {
		if (!_events) {
			this._events = new Array<EventItem>();
		} else {
			_events.forEach(e => {
				e.getChildren().forEach(c => {
					if (!this._sortedColumnItems.some(i => i.id === c.id)) {
						this._sortedColumnItems.push(new ColumnSortedColumnItem(c.id, this));
					}
				});
			});
		}
	}

	public get id(): string {
		return this._name;
	}

	public hasChildren(): boolean {
		if (this._sort === 'event') {
			return this._events && this._events.length > 0;
		} else {
			return this._events && this._events.some(i => i.hasChildren());
		}
	}

	public getUnsortedChildren(): Array<EventItem> {
		return this._events;
	}

	public getChildren(): Array<EventItem | ColumnSortedColumnItem> {
		if (this._sort === 'event') {
			return this._events;
		} else {
			return this._sortedColumnItems;
		}
	}

	public addEvents(...events: Array<EventItem>) {
		this._events = this._events.concat(events);
		events.forEach(e => {
			e.getChildren().forEach(c => {
				if (!this._sortedColumnItems.some(i => i.id === c.id)) {
					this._sortedColumnItems.push(new ColumnSortedColumnItem(c.id, this));
				}
			});
		});
	}

	public changeSort(type: 'event' | 'column'): void {
		this._sort = type;
	}
}

class TreeRenderer implements IRenderer {

	private _onSelectedChange = new Emitter<any>();
	public onSelectedChange: Event<any> = this._onSelectedChange.event;

	getHeight(tree: ITree, element: any): number {
		return 22;
	}

	getTemplateId(tree: ITree, element: any): string {
		if (element instanceof SessionItem) {
			return 'session';
		} else if (element instanceof EventItem) {
			return 'event';
		} else if (element instanceof ColumnItem) {
			return 'column';
		} else if (element instanceof ColumnSortedColumnItem) {
			return 'columnSorted';
		} else {
			return undefined;
		}
	}

	renderTemplate(tree: ITree, templateId: string, container: HTMLElement): RenderTemplate {
		let data = Object.create(null);
		let row = document.createElement('div');
		row.className = 'tree-row';
		DOM.append(container, row);
		data.toDispose = [];
		data.checkbox = document.createElement('input');
		DOM.append(row, data.checkbox);
		data.checkbox.type = 'checkbox';
		data.toDispose.push(DOM.addStandardDisposableListener(data.checkbox, 'change', () => {
			data.context.selected = !data.context.selected;
			this._onSelectedChange.fire(data.context);
		}));
		data.label = document.createElement('div');
		DOM.append(row, data.label);
		return data;
	}

	renderElement(tree: ITree, element: any, templateId: string, templateData: RenderTemplate): void {
		templateData.context = element;
		templateData.label.innerText = element.id;
		templateData.checkbox.checked = element.selected;
		templateData.checkbox.indeterminate = element.indeterminate;
	}

	disposeTemplate(tree: ITree, templateId: string, templateData: RenderTemplate): void {
		dispose(templateData.toDispose);
	}
}

interface RenderTemplate {
	label: HTMLElement;
	toDispose: Array<IDisposable>;
	checkbox: HTMLInputElement;
	context?: any;
}

class TreeDataSource implements IDataSource {

	getId(tree: ITree, element: any): string {
		if (element instanceof EventItem) {
			return element.parent.id + element.id;
		} else if (element instanceof ColumnItem) {
			return element.parent.parent.id + element.parent.id + element.id;
		} else if (element instanceof SessionItem) {
			return element.id;
		} else if (element instanceof ColumnSortedColumnItem) {
			return element.id;
		} else {
			return undefined;
		}
	}

	hasChildren(tree: ITree, element: any): boolean {
		if (element instanceof SessionItem) {
			return element.hasChildren();
		} else if (element instanceof EventItem) {
			return element.hasChildren();
		} else {
			return undefined;
		}
	}

	getChildren(tree: ITree, element: any): TPromise<Array<any>> {
		if (element instanceof EventItem) {
			return TPromise.as(element.getChildren());
		} else if (element instanceof SessionItem) {
			return TPromise.as(element.getChildren());
		} else {
			return TPromise.as(null);
		}
	}

	getParent(tree: ITree, element: any): TPromise<any> {
		if (element instanceof ColumnItem) {
			return TPromise.as(element.parent);
		} else if (element instanceof EventItem) {
			return TPromise.as(element.parent);
		} else if (element instanceof ColumnSortedColumnItem) {
			return TPromise.as(element.parent);
		} else {
			return TPromise.as(null);
		}
	}

	shouldAutoexpand?(tree: ITree, element: any): boolean {
		return false;
	}
}

export class ProfilerColumnEditorDialog extends Modal {

	private _selectBox: SelectBox;
	private _selectedValue: number = 0;
	private readonly _options = [
		nls.localize('eventSort', "Sort by event"),
		nls.localize('nameColumn', "Sort by column")
	];
	private _tree: Tree;
	private _input: ProfilerInput;
	private _element: SessionItem;
	private _treeContainer: HTMLElement;

	constructor(
		@IPartService _partService: IPartService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IClipboardService clipboardService: IClipboardService
	) {
		super(nls.localize('profilerColumnDialog.profiler', 'Profiler'), TelemetryKeys.Profiler, _partService, telemetryService, clipboardService, themeService, contextKeyService);
	}

	public render(): void {
		super.render();
		this._register(attachModalDialogStyler(this, this._themeService));
		this.addFooterButton(nls.localize('profilerColumnDialog.ok', "OK"), () => this.onAccept(undefined));
		this.addFooterButton(nls.localize('profilerColumnDialog.cancel', "Cancel"), () => this.onClose(undefined));
	}

	protected renderBody(container: HTMLElement): void {
		let builder = new Builder(container);
		builder.div({}, b => {
			this._selectBox = new SelectBox(this._options, 0, this._contextViewService);
			this._selectBox.render(b.getHTMLElement());
			this._register(this._selectBox.onDidSelect(e => {
				this._selectedValue = e.index;
				this._element.changeSort(e.index === 0 ? 'event' : 'column');
				this._tree.refresh(this._element, true);
			}));
		});

		builder.div({ 'class': 'profiler-column-tree' }, b => {
			this._treeContainer = b.getHTMLElement();
			let renderer = new TreeRenderer();
			this._tree = new Tree(this._treeContainer, { dataSource: new TreeDataSource(), renderer });
			this._register(renderer.onSelectedChange(e => this._tree.refresh(e, true)));
			this._register(attachListStyler(this._tree, this._themeService));
		});
	}

	public open(input: ProfilerInput): void {
		super.show();
		this._input = input;
		this._updateList();
	}

	protected onAccept(e: StandardKeyboardEvent): void {
		this._updateInput();
		super.onAccept(e);
	}

	// currently not used, this dialog is a work in progress
	// tracked in issue #1545 https://github.com/Microsoft/azuredatastudio/issues/1545
	private _updateInput(): void {
		/*
		this._element.getUnsortedChildren().forEach(e => {
			let origEvent = this._input.sessionTemplate.view.events.find(i => i.name === e.id);
			if (e.indeterminate) {
				e.getChildren().forEach(c => {
					if (origEvent.columns.includes(c.id) && !c.selected) {
						origEvent.columns = origEvent.columns.filter(i => i !== c.id);
					} else if (!origEvent.columns.includes(c.id) && c.selected) {
						origEvent.columns.push(c.id);
					}
				});
			} else {
				origEvent.columns = e.getChildren()
					.filter(c => c.selected)
					.map(c => c.id);
			}
		});
		let newColumns = this._input.sessionTemplate.view.events.reduce<Array<string>>((p, e) => {
			e.columns.forEach(c => {
				if (!p.includes(c)) {
					p.push(c);
				}
			});
			return p;
		}, []);
		newColumns.unshift('EventClass');
		this._input.setColumns(newColumns);
		*/
	}

	// currently not used, this dialog is a work in progress
	// tracked in issue #1545 https://github.com/Microsoft/azuredatastudio/issues/1545
	private _updateList(): void {
		/*
		this._element = new SessionItem(this._input.sessionTemplate.name, this._selectedValue === 0 ? 'event' : 'column');
		this._input.sessionTemplate.events.forEach(item => {
			let event = new EventItem(item.name, this._element);
			item.optionalColumns.forEach(col => {
				let column = new ColumnItem(col, event);
				column.selected = this._input.sessionTemplate.view.events.find(i => i.name === event.id).columns.includes(col);
				event.addColumn(column);
			});
			this._element.addEvents(event);
		});
		this._tree.setInput(this._element);
		this._tree.layout(DOM.getTotalHeight(this._treeContainer));
		*/
	}

	protected layout(height?: number): void {
		this._tree.layout(DOM.getContentHeight(this._treeContainer));
	}

}
