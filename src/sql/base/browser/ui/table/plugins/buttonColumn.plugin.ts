/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IconColumnDefinition } from 'sql/base/browser/ui/table/plugins/iconColumn';
import { Emitter } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';

export interface ButtonColumnDefinition<T extends Slick.SlickData> extends IconColumnDefinition<T> {
}

export interface ButtonColumnOptions {
	iconCssClass?: string;
	title?: string;
	width?: number;
	id?: string;
}


export class ButtonColumn<T extends Slick.SlickData> implements Slick.Plugin<T> {
	private _handler = new Slick.EventHandler();
	private _definition: ButtonColumnDefinition<T>;
	private _grid: Slick.Grid<T>;
	private _onClick = new Emitter<T>();

	public onClick = this._onClick.event;


	constructor(options: ButtonColumnOptions) {
		this._definition = {
			id: options.id,
			resizable: false,
			name: '',
			formatter: this.formatter,
			width: options.width,
			selectable: false,
			iconCssClassField: options.iconCssClass
		};

	}

	public init(grid: Slick.Grid<T>): void {
		this._grid = grid;
		this._handler.subscribe(grid.onClick, (e: DOMEvent, args: Slick.OnClickEventArgs<T>) => this.handleClick(args));
		this._handler.subscribe(grid.onKeyDown, (e: DOMEvent, args: Slick.OnKeyDownEventArgs<T>) => this.handleKeyboardEvent(e as KeyboardEvent, args));

	}

	public destroy(): void {
		this._handler.unsubscribeAll();
	}

	private handleClick(args: Slick.OnClickEventArgs<T>): void {
		if (this.shouldFireClickEvent(args.cell)) {
			this.fireClickEvent(args.row);
		}
	}

	private handleKeyboardEvent(e: KeyboardEvent, args: Slick.OnKeyDownEventArgs<T>): void {
		let event = new StandardKeyboardEvent(e);
		if ((event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) && this.shouldFireClickEvent(args.cell)) {
			event.stopPropagation();
			this.fireClickEvent(args.row);
		}
	}

	public get definition(): ButtonColumnDefinition<T> {
		return this._definition;
	}

	private fireClickEvent(rowIndex: number): void {
		this._onClick.fire(this._grid.getDataItem(rowIndex));
	}

	private shouldFireClickEvent(columnIndex: number): boolean {
		return this._grid.getColumns()[columnIndex].id === this.definition.id;
	}

	private formatter(row: number, cell: number, value: any, columnDef: IconColumnDefinition<Slick.SlickData>, dataContext: Slick.SlickData): string {
		return `<div class="codicon slick-icon-column slick-button-column ${columnDef.iconCssClassField}"></div>`;
	}
}


