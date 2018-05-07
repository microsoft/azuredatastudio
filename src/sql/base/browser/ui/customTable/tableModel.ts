/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as _ from './table';
import * as Assert from 'vs/base/common/assert';
import * as WinJS from 'vs/base/common/winjs.base';
import * as types from 'vs/base/common/types';
import Event, { Emitter, once, EventMultiplexer, Relay } from 'vs/base/common/event';
import { combinedDisposable, IDisposable } from 'vs/base/common/lifecycle';
import { generateUuid } from 'vs/base/common/uuid';

export interface IBaseRowEvent {
	row: Row;
}

export interface IBaseCellEvent {
	cell: Cell;
}

export interface IBaseColumnEvent {
	column: Column;
}

export interface IColumnTraitEvent extends IBaseColumnEvent {
	trait: string;
}

export interface IRowTraitEvent extends IBaseRowEvent {
	trait: string;
}

export interface ICellTraitEvent extends IBaseCellEvent {
	trait: string;
}

export interface IRowRevealEvent extends IBaseRowEvent {
	relativeTop: number;
}

export interface ICellRevealEvent extends IBaseCellEvent {
	relativeTop: number;
}

interface IMap<T> { [id: string]: T; }
interface IRowMap extends IMap<Row> { }
interface ICellMap extends IMap<Cell> { }
interface ITraitMap extends IMap<IRowMap> { }

export class RowRegistry {

	private _isDisposed = false;
	private rows: IMap<{ row: Row; disposable: IDisposable; }> = {};

	private _onDidRevealRow = new EventMultiplexer<IRowRevealEvent>();
	readonly onDidRevealRow: Event<IRowRevealEvent> = this._onDidRevealRow.event;
	private _onDidAddTraitRow = new EventMultiplexer<IRowTraitEvent>();
	readonly onDidAddTraitRow: Event<IRowTraitEvent> = this._onDidAddTraitRow.event;
	private _onDidRemoveTraitRow = new EventMultiplexer<IRowTraitEvent>();
	readonly onDidRemoveTraitRow: Event<IRowTraitEvent> = this._onDidRemoveTraitRow.event;
	private _onDidRefreshRow = new EventMultiplexer<Row>();
	readonly onDidRefreshRow: Event<Row> = this._onDidRefreshRow.event;
	private _onDidDisposeRow = new EventMultiplexer<Row>();
	readonly onDidDisposeRow: Event<Row> = this._onDidDisposeRow.event;

	public register(row: Row): void {
		Assert.ok(!this.isRegistered(row.id), 'row already registered: ' + row.id);

		const disposable = combinedDisposable([
			this._onDidRevealRow.add(row.onDidReveal),
			this._onDidAddTraitRow.add(row.onDidAddTrait),
			this._onDidRemoveTraitRow.add(row.onDidRemoveTrait),
			this._onDidRefreshRow.add(row.onDidRefresh),
			this._onDidDisposeRow.add(row.onDidDispose)
		]);

		this.rows[row.id] = { row, disposable };
	}

	public deregister(row: Row): void {
		Assert.ok(this.isRegistered(row.id), 'row not registered: ' + row.id);
		this.rows[row.id].disposable.dispose();
		delete this.rows[row.id];
	}

	public isRegistered(id: number): boolean {
		return this.rows.hasOwnProperty(id);
	}

	public getRow(index: number): Row {
		return this.rows[String(index)].row;
	}

	public getRows(range: _.IRowRange): Row[] {
		let ret: Row[] = [];
		const start = range ? range.startRow : 0;
		const end = range ? range.endRow : Object.keys(this.rows).length - 1;
		for (let i = start; i <= end; i++) {
			ret.push(this.rows[String(i)].row);
		}
		return ret;
	}

	public dispose(): void {
		this.rows = null;

		this._onDidRevealRow.dispose();
		this._onDidAddTraitRow.dispose();
		this._onDidRemoveTraitRow.dispose();
		this._onDidRefreshRow.dispose();

		this._isDisposed = true;
	}
}

export class Cell {
	private traits: { [trait: string]: boolean; };

	private _isDisposed: boolean;

	public element: any;

	private _onDidCreate = new Emitter<Cell>();
	readonly onDidCreate: Event<Cell> = this._onDidCreate.event;
	private _onDidReveal = new Emitter<ICellRevealEvent>();
	readonly onDidReveal: Event<ICellRevealEvent> = this._onDidReveal.event;
	private _onDidAddTrait = new Emitter<ICellTraitEvent>();
	readonly onDidAddTrait: Event<ICellTraitEvent> = this._onDidAddTrait.event;
	private _onDidRemoveTrait = new Emitter<ICellTraitEvent>();
	readonly onDidRemoveTrait: Event<ICellTraitEvent> = this._onDidRemoveTrait.event;
	private _onDidDispose = new Emitter<Cell>();
	readonly onDidDispose: Event<Cell> = this._onDidDispose.event;
	private _onDidRefresh = new Emitter<Cell>();
	readonly onDidRefresh: Event<Cell> = this._onDidRefresh.event;

	constructor(public id: string, /* private registry: RowRegistry, */ public columnId: string, private row: Row, private context: _.ITableContext) {
		// this.registry.register(this);

		// this.previous = null;
		// this.next = null;

		this.traits = {};

		this._onDidCreate.fire(this);

		this._isDisposed = false;
	}

	public addTrait(trait: string): void {
		let eventData: ICellTraitEvent = { cell: this, trait: trait };
		this.traits[trait] = true;
		this._onDidAddTrait.fire(eventData);
	}

	public removeTrait(trait: string): void {
		let eventData: ICellTraitEvent = { cell: this, trait: trait };
		delete this.traits[trait];
		this._onDidRemoveTrait.fire(eventData);
	}

	public hasTrait(trait: string): boolean {
		return this.traits[trait] || false;
	}

	public getElement(): WinJS.TPromise<any> {
		return this.element ? WinJS.TPromise.as(this.element) : this.row.getElement().then(() => {
			this.element;
		});
	}

	public getAllTraits(): string[] {
		let result: string[] = [];
		let trait: string;
		for (trait in this.traits) {
			if (this.traits.hasOwnProperty(trait) && this.traits[trait]) {
				result.push(trait);
			}
		}
		return result;
	}

	public isVisible(): boolean {
		return this.row.isVisible();
	}

	public setVisible(value: boolean): void {
		this.row.setVisible(value);
	}
}

export class Column {
	private width: number;

	private traits: { [trait: string]: boolean; };

	private _onDidCreate = new Emitter<Column>();
	readonly onDidCreate: Event<Column> = this._onDidCreate.event;
	private _onDidAddTrait = new Emitter<IColumnTraitEvent>();
	readonly onDidAddTrait: Event<IColumnTraitEvent> = this._onDidAddTrait.event;
	private _onDidRemoveTrait = new Emitter<IColumnTraitEvent>();
	readonly onDidRemoveTrait: Event<IColumnTraitEvent> = this._onDidRemoveTrait.event;

	private _isDisposed: boolean;

	constructor(public id: string, /*private registry: ColumnRegistry, */private context: _.ITableContext, private element: any) {
		// this.registry.register(this);

		// this.previous = null;
		// this.next = null;

		this.traits = {};

		this._onDidCreate.fire(this);

		this.width = this._getWidth();

		this._isDisposed = false;
	}

	/* protected */ public _getWidth(): number {
		return this.context.renderer.getColumnWidth(this.context.table, this.element);
	}

	public addTrait(trait: string): void {
		let eventData: IColumnTraitEvent = { column: this, trait: trait };
		this.traits[trait] = true;
		this._onDidAddTrait.fire(eventData);
	}

	public removeTrait(trait: string): void {
		let eventData: IColumnTraitEvent = { column: this, trait: trait };
		delete this.traits[trait];
		this._onDidRemoveTrait.fire(eventData);
	}

	public hasTrait(trait: string): boolean {
		return this.traits[trait] || false;
	}

	public getAllTraits(): string[] {
		let result: string[] = [];
		let trait: string;
		for (trait in this.traits) {
			if (this.traits.hasOwnProperty(trait) && this.traits[trait]) {
				result.push(trait);
			}
		}
		return result;
	}

	public getElement(): any {
		return this.element;
	}

}

export class Row {
	public cells: Cell[];

	private height: number;

	private visible: boolean;

	private traits: { [trait: string]: boolean; };

	private _onDidCreate = new Emitter<Row>();
	readonly onDidCreate: Event<Row> = this._onDidCreate.event;
	private _onDidReveal = new Emitter<IRowRevealEvent>();
	readonly onDidReveal: Event<IRowRevealEvent> = this._onDidReveal.event;
	private _onDidAddTrait = new Emitter<IRowTraitEvent>();
	readonly onDidAddTrait: Event<IRowTraitEvent> = this._onDidAddTrait.event;
	private _onDidRemoveTrait = new Emitter<IRowTraitEvent>();
	readonly onDidRemoveTrait: Event<IRowTraitEvent> = this._onDidRemoveTrait.event;
	private _onDidDispose = new Emitter<Row>();
	readonly onDidDispose: Event<Row> = this._onDidDispose.event;
	private _onDidRefresh = new Emitter<Row>();
	readonly onDidRefresh: Event<Row> = this._onDidRefresh.event;

	private _element: any;

	private _isDisposed: boolean;

	constructor(public id: number, private registry: RowRegistry, private context: _.ITableContext) {
		this.registry.register(this);

		// this.previous = null;
		// this.next = null;

		this.traits = {};

		this._onDidCreate.fire(this);

		this.visible = true;
		this.height = this._getHeight();

		this._isDisposed = false;
	}

	public addTrait(trait: string): void {
		let eventData: IRowTraitEvent = { row: this, trait: trait };
		this.traits[trait] = true;
		this._onDidAddTrait.fire(eventData);
	}

	public removeTrait(trait: string): void {
		let eventData: IRowTraitEvent = { row: this, trait: trait };
		delete this.traits[trait];
		this._onDidRemoveTrait.fire(eventData);
	}

	public hasTrait(trait: string): boolean {
		return this.traits[trait] || false;
	}

	public getAllTraits(): string[] {
		let result: string[] = [];
		let trait: string;
		for (trait in this.traits) {
			if (this.traits.hasOwnProperty(trait) && this.traits[trait]) {
				result.push(trait);
			}
		}
		return result;
	}

	public getHeight(): number {
		return this.height;
	}

	public getElement(): WinJS.TPromise<any> {
		return this._element ? WinJS.TPromise.as(this._element) : this.context.dataSource.getRows({ startRow: this.id, endRow: this.id }).then(r => {
			for (let key in r) {
				let cell = this.cells.find(c => c.columnId === key);
				cell.element = r[key];
			}
			this._element = r;
			return r;
		});
	}

	public isVisible(): boolean {
		return this.visible;
	}

	public setVisible(value: boolean): void {
		this.visible = value;
	}

	/* protected */ public _getHeight(): number {
		return this.context.renderer.getHeight(this.context.table /*, this.element */);
	}

	// /* protected */ public _isVisible(): boolean {
	// 	return this.context.filter.isVisible(this.context.tree, this.element);
	// }

	private doRefresh(): WinJS.Promise {
		this.height = this._getHeight();
		// this.setVisible(this._isVisible());

		this._onDidRefresh.fire(this);

		return WinJS.TPromise.as(void 0);
	}

	public refresh(): WinJS.Promise {
		return this.doRefresh();
	}

	public dispose(): void {
		// this.previous = null;
		// this.next = null;

		this._onDidDispose.fire(this);

		this.registry.deregister(this);

		this._onDidCreate.dispose();
		this._onDidReveal.dispose();
		this._onDidAddTrait.dispose();
		this._onDidRemoveTrait.dispose();
		this._onDidRefresh.dispose();
		this._onDidDispose.dispose();

		this._isDisposed = true;
	}
}

export interface IBaseEvent {
	rows: Row[];
}

export interface IInputEvent {
	input: _.ITableInput;
}

export interface IRefreshEvent extends IBaseEvent { }

export class TableModel {
	private traitsToRows: ITraitMap;
	private input: _.ITableInput;
	private registry: RowRegistry;
	private registryDisposable: IDisposable;

	private _onSetInput = new Emitter<IInputEvent>();
	readonly onSetInput: Event<IInputEvent> = this._onSetInput.event;
	private _onDidSetInput = new Emitter<IInputEvent>();
	readonly onDidSetInput: Event<IInputEvent> = this._onDidSetInput.event;
	private _onRefresh = new Emitter<IRefreshEvent>();
	readonly onRefresh: Event<IRefreshEvent> = this._onRefresh.event;
	private _onDidRefresh = new Emitter<IRefreshEvent>();
	readonly onDidRefresh: Event<IRefreshEvent> = this._onDidRefresh.event;
	private _onDidFocus = new Emitter<_.IFocusEvent>();
	readonly onDidFocus: Event<_.IFocusEvent> = this._onDidFocus.event;
	private _onDidSelect = new Emitter<_.ISelectionEvent>();
	readonly onDidSelect: Event<_.ISelectionEvent> = this._onDidSelect.event;
	private _onDidHighlight = new Emitter<_.IHighlightEvent>();
	readonly onDidHighlight: Event<_.IHighlightEvent> = this._onDidHighlight.event;

	private _onDidRevealRow = new Relay<IRowRevealEvent>();
	readonly onDidRevealRow: Event<IRowRevealEvent> = this._onDidRevealRow.event;
	private _onDidAddTraitRow = new Relay<IRowTraitEvent>();
	readonly onDidAddTraitRow: Event<IRowTraitEvent> = this._onDidAddTraitRow.event;
	private _onDidRemoveTraitRow = new Relay<IRowTraitEvent>();
	readonly onDidRemoveTraitRow: Event<IRowTraitEvent> = this._onDidRemoveTraitRow.event;
	private _onDidRefreshRow = new Relay<Row>();
	readonly onDidRefreshRow: Event<Row> = this._onDidRefreshRow.event;
	private _onDidDisposeRow = new Relay<Row>();
	readonly onDidDisposeRow: Event<Row> = this._onDidDisposeRow.event;

	constructor(private context: _.ITableContext) {
		this.traitsToRows = {};
	}

	public getFocus(includeHidden?: boolean): any {
		let result = this.getElementsWithTrait('focused', includeHidden);
		return result.length === 0 ? null : result[0];
	}

	private getElementsWithTrait(trait: string, includeHidden: boolean): any[] {
		let elements = [];
		let rows = this.traitsToRows[trait] || {};
		let id: string;
		for (id in rows) {
			if (rows.hasOwnProperty(id) && (rows[id].isVisible() || includeHidden)) {
				elements.push(rows[id].getElement());
			}
		}
		return elements;
	}

	public setInput(input: _.ITableInput): WinJS.Promise {
		let eventData: IInputEvent = { input: this.input };
		this._onSetInput.fire(eventData);

		this.setSelection([]);
		this.setFocus();
		this.setHighlight();

		// this.lock = new Lock();

		if (this.registry) {
			this.registry.dispose();
			this.registryDisposable.dispose();
		}

		this.registry = new RowRegistry();

		this._onDidRevealRow.input = this.registry.onDidRevealRow;
		this._onDidAddTraitRow.input = this.registry.onDidAddTraitRow;
		this._onDidRemoveTraitRow.input = this.registry.onDidRemoveTraitRow;
		this._onDidRefreshRow.input = this.registry.onDidRefreshRow;
		this._onDidDisposeRow.input = this.registry.onDidDisposeRow;

		this.registryDisposable = this.registry
			.onDidDisposeRow(item => item.getAllTraits().forEach(trait => delete this.traitsToRows[trait][item.id]));

		this.input = input;

		for (let i = 0; i < input.numberOfRows; i++) {
			let row = new Row(i, this.registry, this.context);
			row.cells = input.columns.map(c => new Cell(generateUuid(), c, row, this.context));
		}

		eventData = { input: this.input };
		this._onDidSetInput.fire(eventData);
		return this.refresh();
	}

	public refresh(rowRange?: _.IRowRange): WinJS.Promise {
		let rows = this.getRows(rowRange);

		if (!rows) {
			return WinJS.TPromise.as(null);
		}

		let eventData: IRefreshEvent = { rows: rows };
		this._onRefresh.fire(eventData);
		return WinJS.Promise.join(rows.map(c => c.refresh())).then(() => {
			this._onDidRefresh.fire(eventData);
		});
	}

	public getRows(row: number): Row;
	public getRows(rows: _.IRowRange): Row[];
	public getRows(input: number | _.IRowRange): Row | Row[] {
		if (input instanceof Row || (types.isArray(input))) {
			return input;
		} else if (types.isNumber(input)) {
			return this.registry.getRow(input);
		} else {
			return this.registry.getRows(input);
		}
	}

	public setSelection(elements: any[], eventPayload?: any): void {
		this.setTraits('selected', elements);
		let eventData: _.ISelectionEvent = { selection: this.getSelection(), payload: eventPayload };
		this._onDidSelect.fire(eventData);
	}

	public getSelection(includeHidden?: boolean): any[] {
		return this.getElementsWithTrait('selected', includeHidden);
	}

	public setFocus(element?: any, eventPayload?: any): void {
		this.setTraits('focused', element ? [element] : []);
		let eventData: _.IFocusEvent = { focus: this.getFocus(), payload: eventPayload };
		this._onDidFocus.fire(eventData);
	}

	public setHighlight(element?: any, eventPayload?: any): void {
		this.setTraits('highlighted', element ? [element] : []);
		let eventData: _.IHighlightEvent = { highlight: this.getHighlight(), payload: eventPayload };
		this._onDidHighlight.fire(eventData);
	}

	public getHighlight(includeHidden?: boolean): any {
		let result = this.getElementsWithTrait('highlighted', includeHidden);
		return result.length === 0 ? null : result[0];
	}

	private setTraits(trait: string, elements: any[]): void {
		if (elements.length === 0) {
			this.removeTraits(trait, elements);
		} else {
			let rows: { [id: string]: Row; } = {};
			let row: Row;

			for (let i = 0, len = elements.length; i < len; i++) {
				row = this.getRows(elements[i]);

				if (row) {
					rows[row.id] = row;
				}
			}

			let traitRows: IRowMap = this.traitsToRows[trait] || <IRowMap>{};
			let rowsToRemoveTrait: Row[] = [];
			let id: string;

			for (id in traitRows) {
				if (traitRows.hasOwnProperty(id)) {
					if (rows.hasOwnProperty(id)) {
						delete rows[id];
					} else {
						rowsToRemoveTrait.push(traitRows[id]);
					}
				}
			}

			for (let i = 0, len = rowsToRemoveTrait.length; i < len; i++) {
				row = rowsToRemoveTrait[i];
				row.removeTrait(trait);
				delete traitRows[row.id];
			}

			for (id in rows) {
				if (rows.hasOwnProperty(id)) {
					row = rows[id];
					row.addTrait(trait);
					traitRows[id] = row;
				}
			}

			this.traitsToRows[trait] = traitRows;
		}
	}

	public removeTraits(trait: string, elements: any[]): void {
		let rows: IRowMap = this.traitsToRows[trait] || <IRowMap>{};
		let row: Row;
		let id: string;

		if (elements.length === 0) {
			for (id in rows) {
				if (rows.hasOwnProperty(id)) {
					row = rows[id];
					row.removeTrait(trait);
				}
			}

			delete this.traitsToRows[trait];

		} else {
			for (let i = 0, len = elements.length; i < len; i++) {
				row = this.getRows(elements[i]);

				if (row) {
					row.removeTrait(trait);
					delete rows[row.id];
				}
			}
		}
	}
}
