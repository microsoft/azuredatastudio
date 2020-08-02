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
	id?: string;
}

export interface ButtonClickEventArgs<T extends Slick.SlickData> {
	item: T;
	position: { x: number, y: number };
	row: number;
	column: number;
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
			width: 30,
			selectable: false,
			iconCssClassField: options.iconCssClass
		};
	}

	public init(grid: Slick.Grid<T>): void {
		this._grid = grid;
		this._handler.subscribe(grid.onClick, (e: DOMEvent, args: Slick.OnClickEventArgs<T>) => this.handleClick(args));
		this._handler.subscribe(grid.onKeyDown, (e: DOMEvent, args: Slick.OnKeyDownEventArgs<T>) => this.handleKeyboardEvent(e as KeyboardEvent, args));
		this._handler.subscribe(grid.onActiveCellChanged, (e: DOMEvent, args: Slick.OnActiveCellChangedEventArgs<T>) => { this.handleActiveCellChanged(args); });
	}

	public destroy(): void {
		this._handler.unsubscribeAll();
	}

	private handleActiveCellChanged(args: Slick.OnActiveCellChangedEventArgs<T>): void {
		if (this.isCurrentColumn(args.cell)) {
			const cellElement = this._grid.getActiveCellNode();
			if (cellElement && cellElement.children) {
				const button = cellElement.children[0] as HTMLButtonElement;
				button.focus();
			}
		}
	}

	private handleClick(args: Slick.OnClickEventArgs<T>): void {
		if (this.isCurrentColumn(args.cell)) {
			// SlickGrid will automatically set active cell on mouse click event,
			// during the process of setting active cell, blur event will be triggered and handled in a setTimeout block,
			// on Windows platform, the context menu is html based which will respond the focus related events and hide the context menu.
			// If we call the fireClickEvent directly the menu will be set to hidden immediately, to workaround the issue we need to wrap it in a setTimeout block.
			setTimeout(() => {
				this.fireClickEvent();
			}, 0);
		}
	}

	private handleKeyboardEvent(e: KeyboardEvent, args: Slick.OnKeyDownEventArgs<T>): void {
		let event = new StandardKeyboardEvent(e);
		if ((event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) && this.isCurrentColumn(args.cell)) {
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
				row: activeCell.row,
				column: activeCell.cell,
				item: this._grid.getDataItem(activeCell.row),
				position: {
					x: (activeCellPosition.left + activeCellPosition.right) / 2,
					y: (activeCellPosition.bottom + activeCellPosition.top) / 2
				}
			});
		}
	}

	private isCurrentColumn(columnIndex: number): boolean {
		return this._grid?.getColumns()[columnIndex]?.id === this.definition.id;
	}

	private formatter(row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T): string {
		const buttonColumn = columnDef as ButtonColumnDefinition<T>;

		// tabindex=-1 means it is only focusable programatically, when the button column cell becomes active, we will set to focus to the button inside it, the tab navigation experience is smooth.
		// Otherwise, if we set tabindex to 0, the focus will go to the button first and then the first cell of the table.
		return `<button tabindex=-1 class="codicon icon slick-button-cell-content ${buttonColumn.iconCssClassField}" aria-label="${this.options.title}"></button>`;
	}
}
