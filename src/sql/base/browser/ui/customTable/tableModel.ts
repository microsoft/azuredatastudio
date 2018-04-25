/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as _ from './table';
import Event, { Emitter, once, EventMultiplexer, Relay } from 'vs/base/common/event';

interface IMap<T> { [id: string]: T; }
interface IItemMap extends IMap<Cell> { }
interface ITraitMap extends IMap<IItemMap> { }

export class Cell {
	private element: any;

	private visible: boolean;

	public getElement(): any {
		return this.element;
	}

	public isVisible(): boolean {
		return this.visible;
	}

	public setVisible(value: boolean): void {
		this.visible = value;
	}
}

export class Row {
	private element: any;
	public getElement(): any {
		return this.element;
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
