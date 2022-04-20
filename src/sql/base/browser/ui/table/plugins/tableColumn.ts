/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Emitter } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';

export interface TableColumn<T extends Slick.SlickData> {
	readonly definition: Slick.Column<T>;
}

export interface TableCellClickEventArgs<T extends Slick.SlickData> {
	item: T;
	position: { x: number, y: number };
	row: number;
	column: number;
}

export abstract class BaseClickableColumn<T extends Slick.SlickData> implements Slick.Plugin<T>, TableColumn<T> {
	private _handler = new Slick.EventHandler();
	private _grid!: Slick.Grid<T>;
	private _onClick = new Emitter<TableCellClickEventArgs<T>>();
	public onClick = this._onClick.event;

	constructor() {
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

	/**
	 * Returns the column definition.
	 * Note when implementing this abstract getter:
	 * Make sure to set the tabindex to -1 for the element returned by the formatter. tabindex=-1 means it is only focusable programatically, when the cell becomes active, we will set to focus to the element inside it, the tab navigation experience is smooth.
	 * Otherwise, if we set tabindex to 0, the focus will go to the element first and then the first cell of the table.
	 */
	public abstract get definition(): Slick.Column<T>;

	private handleActiveCellChanged(args: Slick.OnActiveCellChangedEventArgs<T>): void {
		if (this.isCurrentColumn(args.cell)) {
			const cellElement = this._grid.getActiveCellNode();
			if (cellElement && cellElement.children) {
				const element = cellElement.children[0] as HTMLElement;
				element.focus();
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
		return this._grid.getColumns()[columnIndex]?.id === this.definition.id;
	}
}


/**
* Definition for table column.
*/
export interface BaseTableColumnOptions {
	/**
	 * Id of the column.
	 */
	id?: string,
	/**
	 * Width of the column in px.
	 */
	width?: number,
	/**
	 * Column header text.
	 */
	name?: string,
	/**
	 * The property name in the data object to pull content from. (This is assumed to be on the root of the data object.)
	 */
	field?: string,
	/**
	 * Whether the column is resizable. Default is true.
	 */
	resizable?: boolean,
	/**
	 * The CSS class for the column header.
	 */
	headerCssClass?: string;
}

/**
* Definition for table column with icon
*/
export interface IconColumnOptions extends BaseTableColumnOptions {
	/**
	 * The icon class to use for all the cells in this column. If the 'field' is provided, the cell values will overwrite this value.
	 */
	iconCssClass?: string;
	/**
	 * The title for all the cells. If the 'field' is provided, the cell values will overwrite this value.
	 */
	title?: string

	/**
	 * Whether the icon is font icon. If true, no other class names will be auto appended.
	 */
	isFontIcon?: boolean;
}

export interface IconCellValue {
	/**
	 * The icon css class.
	 */
	iconCssClass: string;
	/**
	 * The title of the cell.
	 */
	title: string
}

export function getIconCellValue(options: IconColumnOptions, dataContext: Slick.SlickData): IconCellValue {
	if (options.field && dataContext[options.field]) {
		const cellValue = dataContext[options.field];
		if (typeof cellValue === 'string') {
			return {
				iconCssClass: '',
				title: cellValue
			};
		} else {
			return cellValue as IconCellValue;
		}
	} else {
		return {
			iconCssClass: options.iconCssClass!,
			title: options.title!
		};
	}
}
