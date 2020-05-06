/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextWithIconColumnDefinition } from 'sql/base/browser/ui/table/plugins/textWithIconColumn';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Emitter } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';

export interface ButtonColumnDefinition<T extends Slick.SlickData> extends TextWithIconColumnDefinition<T> {
}

export interface ButtonColumnOptions {
	iconCssClass?: string;
	title?: string;
	width?: number;
	id?: string;
}

export interface ButtonClickEventArgs<T extends Slick.SlickData> {
	item: T;
	position: { x: number, y: number };
}

export class ButtonColumn<T extends Slick.SlickData> implements Slick.Plugin<T> {
	private _handler = new Slick.EventHandler();
	private _definition: ButtonColumnDefinition<T>;
	private _grid: Slick.Grid<T>;
	private _onClick = new Emitter<ButtonClickEventArgs<T>>();
	public onClick = this._onClick.event;

	constructor(private options: ButtonColumnOptions) {
		this._definition = {
			id: options.id,
			resizable: false,
			name: '',
			formatter: (row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T): string => {
				return this.formatter(row, cell, value, columnDef, dataContext);
			},
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
			this._grid.setActiveCell(args.row, args.cell);
			this.fireClickEvent();
		}
	}

	private handleKeyboardEvent(e: KeyboardEvent, args: Slick.OnKeyDownEventArgs<T>): void {
		let event = new StandardKeyboardEvent(e);
		if ((event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) && this.shouldFireClickEvent(args.cell)) {
			event.stopPropagation();
			event.preventDefault();
			this.fireClickEvent();
		}
	}

	public get definition(): ButtonColumnDefinition<T> {
		return this._definition;
	}

	private fireClickEvent(): void {
		const activeCell = this._grid.getActiveCell();
		const activeCellPosition = this._grid.getActiveCellPosition();
		if (activeCell && activeCellPosition) {
			this._onClick.fire({
				item: this._grid.getDataItem(activeCell.row),
				position: {
					x: (activeCellPosition.left + activeCellPosition.right) / 2,
					y: (activeCellPosition.bottom + activeCellPosition.top) / 2
				}
			});
		}
	}

	private shouldFireClickEvent(columnIndex: number): boolean {
		return this._grid.getColumns()[columnIndex].id === this.definition.id;
	}

	private formatter(row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T): string {
		const buttonColumn = columnDef as ButtonColumnDefinition<T>;
		return `<div class="codicon icon slick-button-cell-content ${buttonColumn.iconCssClassField}" aria-label="${this.options.title}"></div>`;
	}
}
