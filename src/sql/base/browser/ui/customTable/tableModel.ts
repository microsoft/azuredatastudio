/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as _ from './table';
import * as Assert from 'vs/base/common/assert';
import Event, { Emitter, once, EventMultiplexer, Relay } from 'vs/base/common/event';
import { combinedDisposable, IDisposable } from 'vs/base/common/lifecycle';

export interface IBaseRowEvent {
	row: Row;
}

export interface IBaseCellEvent {
	cell: Cell;
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
interface IItemMap extends IMap<Cell> { }
interface ITraitMap extends IMap<IItemMap> { }

export class RowRegistry {

	private _isDisposed = false;
	private rows: IMap<{ row: Row; disposable: IDisposable; }> = {};

	private _onDidRevealItem = new EventMultiplexer<IRowRevealEvent>();
	readonly onDidRevealItem: Event<IRowRevealEvent> = this._onDidRevealItem.event;
	private _onDidAddTraitItem = new EventMultiplexer<IRowTraitEvent>();
	readonly onDidAddTraitItem: Event<IRowTraitEvent> = this._onDidAddTraitItem.event;
	private _onDidRemoveTraitItem = new EventMultiplexer<IRowTraitEvent>();
	readonly onDidRemoveTraitItem: Event<IRowTraitEvent> = this._onDidRemoveTraitItem.event;
	private _onDidRefreshItem = new EventMultiplexer<Row>();
	readonly onDidRefreshItem: Event<Row> = this._onDidRefreshItem.event;
	private _onDidDisposeItem = new EventMultiplexer<Row>();
	readonly onDidDisposeItem: Event<Row> = this._onDidDisposeItem.event;

	public register(row: Row): void {
		Assert.ok(!this.isRegistered(row.id), 'item already registered: ' + row.id);

		const disposable = combinedDisposable([
			this._onDidRevealItem.add(row.onDidReveal),
			this._onDidAddTraitItem.add(row.onDidAddTrait),
			this._onDidRemoveTraitItem.add(row.onDidRemoveTrait),
			this._onDidRefreshItem.add(row.onDidRefresh),
			this._onDidDisposeItem.add(row.onDidDispose)
		]);

		this.rows[row.id] = { row, disposable };
	}

	public deregister(row: Row): void {
		Assert.ok(this.isRegistered(row.id), 'item not registered: ' + row.id);
		this.rows[row.id].disposable.dispose();
		delete this.rows[row.id];
	}

	public isRegistered(id: string): boolean {
		return this.rows.hasOwnProperty(id);
	}

	public dispose(): void {
		this.rows = null;

		this._onDidRevealItem.dispose();
		this._onDidAddTraitItem.dispose();
		this._onDidRemoveTraitItem.dispose();
		this._onDidRefreshItem.dispose();

		this._isDisposed = true;
	}
}

export class Cell {
	private row: Row;

	private traits: { [trait: string]: boolean; };

	private _isDisposed: boolean;

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

	constructor(public id: string, /* private registry: RowRegistry, */ private context: _.ITableContext, private element: any) {
		// this.registry.register(this);

		// this.previous = null;
		// this.next = null;

		this.traits = {};

		this._onDidCreate.fire(this);

		this._isDisposed = false;
	}


	public addTrait(trait: string): void {
		var eventData: ICellTraitEvent = { cell: this, trait: trait };
		this.traits[trait] = true;
		this._onDidAddTrait.fire(eventData);
	}

	public removeTrait(trait: string): void {
		var eventData: ICellTraitEvent = { cell: this, trait: trait };
		delete this.traits[trait];
		this._onDidRemoveTrait.fire(eventData);
	}

	public hasTrait(trait: string): boolean {
		return this.traits[trait] || false;
	}

	public getAllTraits(): string[] {
		var result: string[] = [];
		var trait: string;
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

	public isVisible(): boolean {
		return this.row.isVisible();
	}

	public setVisible(value: boolean): void {
		this.row.setVisible(value);
	}
}

export class Row {
	private cells: Cell[];

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

	private _isDisposed: boolean;

	constructor(public id: string, private registry: RowRegistry, private context: _.ITableContext, private element: any) {
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
		var eventData: IRowTraitEvent = { row: this, trait: trait };
		this.traits[trait] = true;
		this._onDidAddTrait.fire(eventData);
	}

	public removeTrait(trait: string): void {
		var eventData: IRowTraitEvent = { row: this, trait: trait };
		delete this.traits[trait];
		this._onDidRemoveTrait.fire(eventData);
	}

	public hasTrait(trait: string): boolean {
		return this.traits[trait] || false;
	}

	public getAllTraits(): string[] {
		var result: string[] = [];
		var trait: string;
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

	public getElement(): any {
		return this.element;
	}

	public isVisible(): boolean {
		return this.visible;
	}

	public setVisible(value: boolean): void {
		this.visible = value;
	}

	/* protected */ public _getHeight(): number {
		return this.context.renderer.getHeight(this.context.table, this.element);
	}

	// /* protected */ public _isVisible(): boolean {
	// 	return this.context.filter.isVisible(this.context.tree, this.element);
	// }

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

export class TableModel {
	private context: _.ITableContext;
	private traitsToItems: ITraitMap;

	private _onDidFocus = new Emitter<_.IFocusEvent>();
	readonly onDidFocus: Event<_.IFocusEvent> = this._onDidFocus.event;
	private _onDidSelect = new Emitter<_.ISelectionEvent>();
	readonly onDidSelect: Event<_.ISelectionEvent> = this._onDidSelect.event;
	private _onDidHighlight = new Emitter<_.IHighlightEvent>();
	readonly onDidHighlight: Event<_.IHighlightEvent> = this._onDidHighlight.event;

	constructor(context: _.ITableContext) {
		this.context = context;
		this.traitsToItems = {};
	}

	public getFocus(includeHidden?: boolean): any {
		var result = this.getElementsWithTrait('focused', includeHidden);
		return result.length === 0 ? null : result[0];
	}

	private getElementsWithTrait(trait: string, includeHidden: boolean): any[] {
		var elements = [];
		var items = this.traitsToItems[trait] || {};
		var id: string;
		for (id in items) {
			if (items.hasOwnProperty(id) && (items[id].isVisible() || includeHidden)) {
				elements.push(items[id].getElement());
			}
		}
		return elements;
	}
}
