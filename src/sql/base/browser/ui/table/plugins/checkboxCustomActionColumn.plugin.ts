/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { mixin } from 'vs/base/common/objects';
import * as nls from 'vs/nls';
import * as strings from 'vs/base/common/strings';
import { Emitter, Event as vsEvent } from 'vs/base/common/event';
import { ICheckboxSelectColumnOptions } from './checkboxSelectColumn.plugin';

const defaultOptions: ICheckboxSelectColumnOptions = {
	columnId: '_checkbox_selector',
	cssClass: undefined,
	toolTip: nls.localize('selectDeselectAll', 'Select/Deselect All'),
	width: 30
};

export interface IRowCheckboxChangedArg {
	checked: boolean;
	row: number;
}

const checkboxTemplate = `
							<div style="display: flex; align-items: center; flex-direction: column">
								<input type="checkbox" {0}>
							</div>
`;

export class CheckboxCustomActionColumn<T> implements Slick.Plugin<T> {
	private _options: ICheckboxSelectColumnOptions;
	private _grid: Slick.Grid<T>;
	private _handler = new Slick.EventHandler();
	private _selectedRowsLookup = {};
	private _initialized: boolean = false;

	private _onChange = new Emitter<IRowCheckboxChangedArg>();
	public readonly onChange: vsEvent<IRowCheckboxChangedArg> = this._onChange.event;

	constructor(options?: ICheckboxSelectColumnOptions) {
		this._options = mixin(options, defaultOptions, false);
	}

	public init(grid: Slick.Grid<T>): void {
		this._grid = grid;
		let rows = this._grid.getDataLength();

		this._handler
			.subscribe(this._grid.onClick, (e, args) => this.handleClick(e, args));
	}

	public destroy(): void {
		this._handler.unsubscribeAll();
	}

	private handleClick(e: Event, args: Slick.OnClickEventArgs<T>): void {
		// clicking on a row select checkbox
		if (this._grid.getColumns()[args.cell].id === this._options.columnId && jQuery(e.target!).is('input[type="checkbox"]')) {
			// if editing, try to commit
			if (this._grid.getEditorLock().isActive() && !this._grid.getEditorLock().commitCurrentEdit()) {
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			this.toggleCheckBox(args.row);
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	}

	private toggleCheckBox(row: number): void {
		// if its been toggled once that means selected rows is initialized
		this._initialized = true;

		if (this._selectedRowsLookup[row]) {
			this._onChange.fire({ checked: false, row: row });
			delete this._selectedRowsLookup[row];
		} else {
			this._selectedRowsLookup[row] = true;
			this._onChange.fire({ checked: true, row: row });
		}
	}

	public getColumnDefinition(): Slick.Column<T> {
		return {
			id: this._options.columnId,
			name: this._options.title || strings.format(checkboxTemplate, ''),
			toolTip: this._options.toolTip,
			field: 'sel',
			width: this._options.width,
			resizable: false,
			sortable: false,
			cssClass: this._options.cssClass,
			formatter: (r, c, v, cd, dc) => this.checkboxSelectionFormatter(r, c, v, cd, dc)
		};
	}

	private checkboxSelectionFormatter(row, cell, value, columnDef: Slick.Column<T>, dataContext): string {
		if (this._options.defaultChecked && !this._initialized) {
			this._selectedRowsLookup[row] = true;
		}
		return this._selectedRowsLookup[row]
			? strings.format(checkboxTemplate, 'checked')
			: strings.format(checkboxTemplate, '');
	}
}
