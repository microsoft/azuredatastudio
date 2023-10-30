/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { convertJQueryKeyDownEvent } from 'sql/base/browser/dom';
import { ICheckboxStyles } from 'sql/base/browser/ui/checkbox/checkbox';
import { mixin } from 'sql/base/common/objects';
import { escape } from 'sql/base/common/strings';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Emitter, Event as vsEvent } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Disposable } from 'vs/base/common/lifecycle';
import 'vs/css!./media/checkboxSelectColumn.plugin';
import * as nls from 'vs/nls';

export interface ICheckboxSelectColumnOptions extends Slick.PluginOptions, ICheckboxStyles {
	columnId?: string;
	cssClass?: string;
	headerCssClass?: string;
	toolTip?: string;
	width?: number;
	title?: string;
	columnIndex?: number;
	actionOnCheck?: ActionOnCheck;
}

export interface ICheckboxCellActionEventArgs {
	checked: boolean;
	row: number;
	column: number;
}

export interface ICheckAllActionEventArgs {
	checked: boolean;
	column: number;
}

// Actions expected on checkbox click
export enum ActionOnCheck {
	selectRow = 0,
	customAction = 1
}

interface ICheckboxColumnValue {
	enabled: boolean;
	checked: boolean;
}

const HeaderCheckboxTitle: string = nls.localize('selectDeselectAll', "Select/Deselect All");

const defaultOptions: ICheckboxSelectColumnOptions = {
	columnId: '_checkbox_selector',
	cssClass: 'slick-plugin-checkbox-select-column',
	headerCssClass: 'slick-plugin-checkbox-select-column',
	toolTip: undefined,
	width: 30
};

export class CheckboxSelectColumn<T extends Slick.SlickData> extends Disposable implements Slick.Plugin<T> {
	private _grid!: Slick.Grid<T>;
	private _handler = new Slick.EventHandler();
	private _options: ICheckboxSelectColumnOptions;
	public index: number;
	private _headerCheckbox: HTMLInputElement | undefined;
	private _onChange = this._register(new Emitter<ICheckboxCellActionEventArgs>());
	private _onCheckAllChange = this._register(new Emitter<ICheckAllActionEventArgs>());
	public readonly onChange: vsEvent<ICheckboxCellActionEventArgs> = this._onChange.event;
	public readonly onCheckAllChange: vsEvent<ICheckAllActionEventArgs> = this._onCheckAllChange.event;

	constructor(options?: ICheckboxSelectColumnOptions, columnIndex?: number) {
		super();
		this._options = mixin(options, defaultOptions, false);
		this._options.headerCssClass = options.headerCssClass ? options.headerCssClass + ' ' + defaultOptions.headerCssClass : defaultOptions.headerCssClass;
		this._options.cssClass = options.cssClass ? options.cssClass + ' ' + defaultOptions.cssClass : defaultOptions.cssClass;
		this.index = columnIndex ? columnIndex : 0;
	}

	public get definition(): Slick.Column<T> {
		return {
			id: this._options.columnId,
			name: this._options.title || `<input type="checkbox" tabIndex="0" title=${HeaderCheckboxTitle}/>`,
			toolTip: this._options.toolTip,
			field: 'sel',
			width: this._options.width,
			resizable: false,
			sortable: false,
			cssClass: this._options.cssClass,
			headerCssClass: this._options.headerCssClass,
			formatter: (r, c, v, cd, dc) => this.checkboxSelectionFormatter(r, c, v, cd, dc as T)
		};
	}

	private checkboxSelectionFormatter(row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T): string {
		const state = this.getCheckboxPropertyValue(row);
		const checked = state.checked ? 'checked' : '';
		const enable = state.enabled ? '' : 'disabled';
		const escapedTitle = escape(columnDef.name ?? '');
		return `<input type="checkbox" style="pointer-events: none;" aria-label="${escapedTitle}" tabIndex="-1" ${checked} ${enable}/>`;
	}


	public init(grid: Slick.Grid<T>): void {
		this._grid = grid;
		this._handler
			.subscribe(this._grid.onClick, (e: Event, args: Slick.OnClickEventArgs<T>) => this.handleClick(e, args))
			.subscribe(this._grid.onKeyDown, (e: DOMEvent, args: Slick.OnKeyDownEventArgs<T>) => this.handleKeyDown(convertJQueryKeyDownEvent(e), args))
			.subscribe(this._grid.onHeaderCellRendered, (e: Event, args: Slick.OnHeaderCellRenderedEventArgs<T>) => this.handleHeaderCellRendered(e, args))
			.subscribe(grid.onActiveCellChanged, (e: DOMEvent, args: Slick.OnActiveCellChangedEventArgs<T>) => { this.handleActiveCellChanged(args); });
		if (this.isCheckAllHeaderCheckboxShown()) {
			this._handler.subscribe(this._grid.onHeaderClick, (e: Event, args: Slick.OnHeaderClickEventArgs<T>) => this.handleHeaderClick(e, args));
		}
	}

	private handleClick(e: DOMEvent, args: Slick.OnClickEventArgs<T>): void {
		if (args.cell !== this.index) {
			return;
		}
		this.toggleCellCheckbox(args.row);
		e.stopPropagation();
		e.stopImmediatePropagation();
		e.preventDefault();
	}

	private handleKeyDown(e: StandardKeyboardEvent, args: Slick.OnKeyDownEventArgs<T>): void {
		if (args.cell !== this.index) {
			return;
		}
		if (e.equals(KeyCode.Enter) || e.equals(KeyCode.Space)) {
			this.toggleCellCheckbox(args.row);
			e.stopPropagation();
			e.preventDefault();
			e.browserEvent.stopImmediatePropagation();
		}
	}

	private handleActiveCellChanged(args: Slick.OnActiveCellChangedEventArgs<T>): void {
		if (args.cell === this.index) {
			const checkbox = this._grid.getActiveCellNode() as HTMLInputElement;
			if (checkbox) {
				checkbox.focus();
			}
		}
	}

	private toggleCellCheckbox(row: number): void {
		const currentValue = this.getCheckboxPropertyValue(row);
		if (currentValue.enabled) {
			this.setCheckboxPropertyValue(row, !currentValue.checked);
			this._grid.invalidateRow(row);
			this._grid.render();
			this._grid.setActiveCell(row, this.index);
			this.updateSelectAllCheckboxState();
			this._onChange.fire({ checked: !currentValue.checked, row: row, column: this.index });
		}
	}

	private handleHeaderClick(e: Event, args?: Slick.OnHeaderClickEventArgs<T>): void {
		this.onHeaderCheckboxStateChange();
		e.preventDefault();
		e.stopPropagation();
	}

	private isCheckAllHeaderCheckboxShown(): boolean {
		return !this._options.title;
	}

	private handleHeaderKeyDown(e: KeyboardEvent): void {
		const event = new StandardKeyboardEvent(e);
		if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
			this._headerCheckbox.checked = !this._headerCheckbox.checked;
			this.onHeaderCheckboxStateChange();
			this._headerCheckbox.focus();
			event.preventDefault();
			event.stopPropagation();
		}
	}

	public onHeaderCheckboxStateChange(): void {
		const rows = this._grid.getDataLength();
		for (let i = 0; i < rows; i++) {
			this.setCheckboxPropertyValue(i, this._headerCheckbox.checked);
		}
		this._grid.updateColumnHeader(this._options.columnId!, `<input type="checkbox" tabIndex="0" ${this._headerCheckbox.checked ? 'checked' : ''} title=${HeaderCheckboxTitle}/>`, this._options.toolTip);
		this._onCheckAllChange.fire({
			checked: this._headerCheckbox.checked,
			column: this.index
		});
		this._grid.invalidateAllRows();
		this._grid.render();
	}

	private handleHeaderCellRendered(e: Event, args: Slick.OnHeaderCellRenderedEventArgs<T>): void {
		if (args.column.id === this._options.columnId) {
			this._headerCheckbox = <HTMLInputElement>args.node.firstChild.firstChild;
			this._headerCheckbox.onkeydown = (e) => this.handleHeaderKeyDown(e);
		}
	}

	private updateSelectAllCheckboxState(): void {
		const rows = this._grid.getDataLength();
		let checked = true;
		for (let i = 0; i < rows; i++) {
			if (!this.getCheckboxPropertyValue(i).checked) {
				checked = false;
				break;
			}
		}
		if (this._headerCheckbox) {
			this._headerCheckbox.checked = checked;
		}
	}

	public destroy(): void {
		this._handler.unsubscribeAll();
	}

	// This call is to handle reactive changes in check box UI
	// This DOES NOT fire UI change Events
	public reactiveCheckboxCheck(row: number, value: boolean) {
		this.setCheckboxPropertyValue(row, value);
		// update row to call formatter
		this._grid.invalidateRow(row);
		this._grid.render();
		// ensure that grid reflects the change
		this._grid.scrollRowIntoView(row);
	}


	private getCheckboxPropertyValue(row: number): ICheckboxColumnValue {
		const dataItem = this._grid?.getDataItem(row);
		const propertyValue = dataItem[this._options.title];
		let checkboxEnabled: boolean = true;
		let checkboxChecked: boolean = false;

		if (typeof propertyValue === 'boolean') {
			checkboxEnabled = true;
			checkboxChecked = propertyValue;
		} else if (propertyValue !== undefined) {
			checkboxEnabled = propertyValue.enabled === undefined ? true : propertyValue.enabled;
			checkboxChecked = propertyValue.checked === undefined ? false : propertyValue.checked;
		} else if (propertyValue === undefined) { // If the value is undefined the checkbox will be enabled and unchecked
			checkboxEnabled = true;
			checkboxChecked = false;
		}

		return {
			checked: checkboxChecked,
			enabled: checkboxEnabled
		};
	}

	private setCheckboxPropertyValue(row: number, value: boolean): void {
		const dataItem = this._grid?.getDataItem(row);
		const propertyValue = dataItem[this._options.title];
		// If property value is undefined we treat the cell value as a boolean
		if (propertyValue === undefined || typeof propertyValue === 'boolean') {
			(<any>dataItem)[this._options.title] = value;
		} else {
			(<any>dataItem)[this._options.title] = {
				checked: value,
				enabled: propertyValue.enabled
			};
		}
	}
}
