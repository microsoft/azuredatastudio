/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/checkboxColumn.plugin';
import { BaseTableColumnOptions, TableColumn } from 'sql/base/browser/ui/table/plugins/tableColumn';
import { escape } from 'sql/base/common/strings';
import { Emitter } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { convertJQueryKeyDownEvent } from 'sql/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';

export interface CheckBoxCellValue {
	enabled?: boolean;
	checked: boolean;
}

export interface CheckBoxChangedEventArgs<T extends Slick.SlickData> {
	item: T;
	row: number;
	column: number;
	value: boolean;
}

export interface CheckBoxColumnOptions extends BaseTableColumnOptions {
}

export class CheckBoxColumn<T extends Slick.SlickData> extends Disposable implements Slick.Plugin<T>, TableColumn<T> {
	private _handler = new Slick.EventHandler();
	private _grid!: Slick.Grid<T>;
	private _onChange = this._register(new Emitter<CheckBoxChangedEventArgs<T>>());
	public onChange = this._onChange.event;

	constructor(private options: CheckBoxColumnOptions) {
		super();
	}

	public init(grid: Slick.Grid<T>): void {
		this._grid = grid;
		this._handler.subscribe(grid.onClick, (e: DOMEvent, args: Slick.OnClickEventArgs<T>) => this.handleClick(args));
		this._handler.subscribe(grid.onKeyDown, (e: DOMEvent, args: Slick.OnKeyDownEventArgs<T>) => this.handleKeyboardEvent(convertJQueryKeyDownEvent(e), args));
		this._handler.subscribe(grid.onActiveCellChanged, (e: DOMEvent, args: Slick.OnActiveCellChangedEventArgs<T>) => { this.handleActiveCellChanged(args); });
	}

	public destroy(): void {
		this._handler.unsubscribeAll();
	}

	public get definition(): Slick.Column<T> {
		return {
			id: this.options.field,
			formatter: (row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T): string => {
				const cellValue = dataContext[columnDef.field] as CheckBoxCellValue;
				const escapedTitle = escape(columnDef.name ?? '');
				const disabledAttribute = cellValue.enabled === false ? 'disabled' : '';
				const checkedAttribute = cellValue.checked ? 'checked' : '';
				return `<input type="checkbox" tabindex=-1 title="${escapedTitle}" aria-label="${escapedTitle}" ${checkedAttribute} ${disabledAttribute}/>`;
			},
			field: this.options.field,
			name: this.options.name,
			resizable: this.options.resizable,
			cssClass: 'slick-plugin-checkbox-column'
		};
	}

	private getCheckbox(): HTMLInputElement {
		const cellElement = this._grid.getActiveCellNode();
		return cellElement.children[0] as HTMLInputElement;
	}

	private handleActiveCellChanged(args: Slick.OnActiveCellChangedEventArgs<T>): void {
		if (this.isCurrentColumn(args.cell)) {
			this.getCheckbox().focus();
		}
	}

	private handleClick(args: Slick.OnClickEventArgs<T>): void {
		if (this.isCurrentColumn(args.cell)) {
			setTimeout(() => {
				this.fireOnChangeEvent();
			}, 0);
		}
	}

	private handleKeyboardEvent(e: StandardKeyboardEvent, args: Slick.OnKeyDownEventArgs<T>): void {
		if (e.equals(KeyCode.Space) && this.isCurrentColumn(args.cell)) {
			this.fireOnChangeEvent();
		}
	}

	private fireOnChangeEvent(): void {
		const cell = this._grid.getActiveCell();
		const checked = this.getCheckbox().checked;
		const item = this._grid.getDataItem(cell.row);
		const cellValue = item[this.options.field] as CheckBoxCellValue;
		if (checked !== cellValue.checked) {
			this._onChange.fire({
				row: cell.row,
				column: cell.cell,
				value: checked,
				item: item
			});
		}
	}

	private isCurrentColumn(columnIndex: number): boolean {
		return this._grid.getColumns()[columnIndex]?.id === this.definition.id;
	}
}
