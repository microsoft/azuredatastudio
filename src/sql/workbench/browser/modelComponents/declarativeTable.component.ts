/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/declarativeTable';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnDestroy } from '@angular/core';
import * as azdata from 'azdata';
import { convertSize } from 'sql/base/browser/dom';
import { ComponentEventType, IComponent, IComponentDescriptor, IModelStore, ModelViewAction } from 'sql/platform/dashboard/browser/interfaces';
import { ContainerBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { EventHelper } from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';
import { equals as arrayEquals } from 'vs/base/common/arrays';
import { KeyCode } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';
import { ILogService } from 'vs/platform/log/common/log';
import * as colorRegistry from 'vs/platform/theme/common/colorRegistry';
import { IColorTheme, IThemeService } from 'vs/platform/theme/common/themeService';
import { equals } from 'vs/base/common/objects';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { MenuItemAction, MenuRegistry } from 'vs/platform/actions/common/actions';
import { IAction, Separator } from 'vs/base/common/actions';

export enum DeclarativeDataType {
	string = 'string',
	category = 'category',
	boolean = 'boolean',
	editableCategory = 'editableCategory',
	component = 'component',
	menu = 'menu'
}

@Component({
	selector: 'modelview-declarativeTable',
	templateUrl: decodeURI(require.toUrl('./declarativeTable.component.html'))
})
export default class DeclarativeTableComponent extends ContainerBase<any, azdata.DeclarativeTableProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private _data: azdata.DeclarativeTableCellValue[][] = [];
	private _filteredRowIndexes: number[] | undefined = undefined;
	private columns: azdata.DeclarativeTableColumn[] = [];
	private _colorTheme: IColorTheme;
	private _hasFocus: boolean;

	/**
	 * The flag is set to true when the table gains focus. When a row is selected and the flag is true the row selected event will
	 * fire regardless whether the row is already selected.
	 *
	 */
	private _rowSelectionFocusFlag: boolean = false;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService,
		@Inject(IThemeService) themeService: IThemeService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService
	) {
		super(changeRef, el, logService);
		this._colorTheme = themeService.getColorTheme();
		this._register(themeService.onDidColorThemeChange((colorTheme) => {
			this._colorTheme = colorTheme;
		}));
	}

	ngAfterViewInit(): void {
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	public headerCheckboxVisible(colIdx: number): boolean {
		return this.columns[colIdx].showCheckAll && this.isCheckBox(colIdx);
	}

	public isHeaderChecked(colIdx: number): boolean {
		for (const row of this.data) {
			const cellData = row[colIdx];
			if (cellData.value === false && cellData.enabled !== false) {
				return false;
			}
		}
		return true;
	}

	public isCheckBox(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.valueType === DeclarativeDataType.boolean;
	}

	public isContextMenuColumn(colIdx: number): boolean {
		return this.columns[colIdx].valueType === DeclarativeDataType.menu;
	}

	public isControlEnabled(rowIdx: number, colIdx: number): boolean {
		const cellData = this.data[rowIdx][colIdx];
		const column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return !column.isReadOnly && cellData.enabled !== false;
	}

	private isLabel(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.isReadOnly && column.valueType === DeclarativeDataType.string;
	}

	public isChecked(rowIdx: number, colIdx: number): boolean {
		let cellData = this.data[rowIdx][colIdx];
		if (cellData?.value === false) {
			return false;
		}
		// Disabling it to check for null and undefined.
		// eslint-disable-next-line eqeqeq
		return cellData != undefined;
	}

	public onInputBoxChanged(e: string, rowIdx: number, colIdx: number): void {
		this.onCellDataChanged(e, rowIdx, colIdx);
	}

	public onCheckBoxChanged(e: boolean, rowIdx: number, colIdx: number): void {
		this.onCellDataChanged(e, rowIdx, colIdx);
		// If all of the rows in that column are now checked, let's update the header.
		if (this.columns[colIdx].showCheckAll) {
			this._changeRef.detectChanges();
		}
	}

	public onHeaderCheckBoxChanged(e: boolean, colIdx: number): void {
		this.data.forEach((row, rowIdx) => {
			const cellData = row[colIdx];
			if (cellData.value !== e && cellData.enabled !== false) {
				this.onCellDataChanged(e, rowIdx, colIdx);
			}
		});
		this._changeRef.detectChanges();
	}

	public trackByFnCols(index: number, _item: any): number {
		return index;
	}

	public onSelectBoxChanged(e: ISelectData | string, rowIdx: number, colIdx: number): void {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];

		if (column.categoryValues) {
			if (typeof e === 'string') {
				let category = column.categoryValues.find(c => c.displayName === e);
				if (category) {
					this.onCellDataChanged(category.name, rowIdx, colIdx);
				} else {
					this.onCellDataChanged(e, rowIdx, colIdx);
				}
			} else {
				this.onCellDataChanged(column.categoryValues[e.index].name, rowIdx, colIdx);
			}
		}
	}

	private onCellDataChanged(newValue: string | number | boolean | any, rowIdx: number, colIdx: number): void {
		this.data[rowIdx][colIdx].value = newValue;

		if (this.properties.data) {
			this.setPropertyFromUI<any[][]>((props, value) => props.data = value, this.data);
		} else {
			this.setPropertyFromUI<any[][]>((props, value) => props.dataValues = value, this.data);
		}

		let newCellData: azdata.TableCell = {
			row: rowIdx,
			column: colIdx,
			value: newValue
		};
		this.fireEvent({
			eventType: ComponentEventType.onDidChange,
			args: newCellData
		});
	}

	public isSelectBox(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.valueType === DeclarativeDataType.category;
	}

	private isEditableSelectBox(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.valueType === DeclarativeDataType.editableCategory;
	}

	public isInputBox(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.valueType === DeclarativeDataType.string && !column.isReadOnly;
	}

	public isComponent(colIdx: number): boolean {
		return this.columns[colIdx].valueType === DeclarativeDataType.component;
	}

	public getColumnWidth(col: number | azdata.DeclarativeTableColumn): string {
		let column = typeof col === 'number' ? this.columns[col] : col;
		return convertSize(column.width, '30px');
	}

	public getOptions(colIdx: number): string[] {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.categoryValues ? column.categoryValues.map(x => x.displayName) : [];
	}

	public getSelectedOptionDisplayName(rowIdx: number, colIdx: number): string {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		let cellData = this.data[rowIdx][colIdx];
		if (cellData && column.categoryValues) {
			let category = column.categoryValues.find(v => v.name === cellData.value);
			if (category) {
				return category.displayName;
			} else if (this.isEditableSelectBox(colIdx)) {
				return String(cellData.value);
			} else {
				return undefined;
			}
		} else {
			return '';
		}
	}

	public getAriaLabel(rowIdx: number, colIdx: number): string {
		const cellData = this.data[rowIdx][colIdx];
		if (this.isLabel(colIdx)) {
			if (cellData) {
				if (cellData.ariaLabel) {
					return cellData.ariaLabel;
				} else if (cellData.value) {
					return String(cellData.value);
				}
			} else {
				return localize('blankValue', "blank");
			}
		}

		return '';
	}

	public getCheckAllColumnAriaLabel(colIdx: number): string {
		return localize('checkAllColumnLabel', "check all checkboxes in column: {0}", this.columns[colIdx].displayName);
	}

	public getHeaderAriaLabel(colIdx: number): string {
		const column = this.columns[colIdx];
		return (column.ariaLabel) ? column.ariaLabel : column.displayName;
	}

	public getItemDescriptor(componentId: string): IComponentDescriptor {
		return this.modelStore.getComponentDescriptor(componentId);
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	private static ACCEPTABLE_VALUES = new Set<string>(['number', 'string', 'boolean']);
	public override setProperties(properties: { [key: string]: any; }): void {
		let castProperties = properties as azdata.DeclarativeTableProperties;
		const basicData: any[][] = castProperties.data ?? [];
		const complexData: azdata.DeclarativeTableCellValue[][] = castProperties.dataValues ?? [];
		let finalData: azdata.DeclarativeTableCellValue[][];

		finalData = basicData.map(row => {
			return row.map((value): azdata.DeclarativeTableCellValue => {
				if (DeclarativeTableComponent.ACCEPTABLE_VALUES.has(typeof (value))) {
					return {
						value: value
					};
				} else {
					return {
						value: JSON.stringify(value)
					};
				}
			});
		});

		if (finalData.length <= 0) {
			finalData = complexData;
		}

		this.columns = castProperties.columns ?? [];

		// check whether the data property is changed before actually setting the properties.
		const isDataPropertyChanged = !arrayEquals(this.data, finalData ?? [], (a, b) => {
			return arrayEquals(a, b, (cell1, cell2) => {
				return equals(cell1, cell2);
			});
		});

		// the angular is using reference compare to determine whether the data is changed or not
		// so we are only updating it when the actual data has changed by doing the deep comparison.
		// if the data property is changed, we need add child components to the container,
		// so that the events can be passed upwards through the control hierarchy.
		if (isDataPropertyChanged) {
			this.clearContainer();
			this._data = finalData;
		}

		const previousSelectedRow = this.selectedRow;

		super.setProperties(properties);

		if (this.selectedRow !== previousSelectedRow && this.enableRowSelection) {
			this.fireEvent({
				eventType: ComponentEventType.onSelectedRowChanged,
				args: {
					row: this.selectedRow
				}
			});
		}
	}

	public override clearContainer(): void {
		super.clearContainer();
		this.selectedRow = -1;
	}

	public get data(): azdata.DeclarativeTableCellValue[][] {
		return this._data;
	}

	public isRowSelected(row: number): boolean {
		if (!this.enableRowSelection) {
			return false;
		}
		return this.selectedRow === row;
	}

	public onRowSelected(row: number) {
		if (!this.enableRowSelection) {
			return;
		}
		if (this._rowSelectionFocusFlag || !this.isRowSelected(row)) {
			this.selectedRow = row;
			this._rowSelectionFocusFlag = false;
			this._changeRef.detectChanges();

			this.fireEvent({
				eventType: ComponentEventType.onSelectedRowChanged,
				args: {
					row
				}
			});
		}
	}

	public get contextMenuButtonTitle(): string {
		return localize('declarativeTable.showActions', "Show Actions");
	}

	public onContextMenuButtonKeyDown(event: KeyboardEvent, row: number, column: number): void {
		const keyboardEvent = new StandardKeyboardEvent(event);
		if (keyboardEvent.keyCode === KeyCode.Space ||
			keyboardEvent.keyCode === KeyCode.Enter) {
			this.showContextMenu(event, row, column);
		}
	}

	public onContextMenuButtonClick(event: MouseEvent, row: number, column: number): void {
		this.showContextMenu(event, row, column);
	}

	private showContextMenu(event: MouseEvent | KeyboardEvent, row: number, column: number): void {
		EventHelper.stop(event, true);
		const cellValue = this.data[row][column].value as azdata.DeclarativeTableMenuCellValue;
		const actions: IAction[] = [];
		let addSeparator = false;
		for (const [index, command] of cellValue.commands.entries()) {
			const isCommand = typeof command === 'string';
			if (addSeparator || (!isCommand && index !== 0)) {
				actions.push(new Separator());
			}
			if (typeof command === 'string') {
				addSeparator = false;
				actions.push(this.createMenuItem(command));
			} else {
				addSeparator = true;
				actions.push(...command.map(cmd => {
					return this.createMenuItem(cmd);
				}));
			}
		}
		this.contextMenuService.showContextMenu({
			getAnchor: () => event.currentTarget as HTMLElement,
			getActions: () => actions,
			getActionsContext: () => cellValue.context
		});
	}

	private createMenuItem(commandId: string): MenuItemAction {
		const command = MenuRegistry.getCommand(commandId);
		return this.instantiationService.createInstance(MenuItemAction, command, undefined, { shouldForwardArgs: true });
	}

	public onKey(e: KeyboardEvent, row: number) {
		// Ignore the bubble up events
		if (e.target !== e.currentTarget) {
			return;
		}
		const event = new StandardKeyboardEvent(e);
		if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
			this.onRowSelected(row);
			EventHelper.stop(e, true);
		}
	}

	public override doAction(action: string, ...args: any[]): void {
		if (action === ModelViewAction.Filter) {
			this._filteredRowIndexes = args[0];
		}
		this._changeRef.detectChanges();
	}

	/**
	 * Checks whether a given row is filtered (not visible)
	 * @param rowIndex The row to check
	 */
	public isFiltered(rowIndex: number): boolean {
		if (this._filteredRowIndexes === undefined) {
			return false;
		}
		return this._filteredRowIndexes.includes(rowIndex) ? false : true;
	}

	public override get CSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'width': this.getWidth(),
			'height': this.getHeight()
		});
	}

	public getRowStyle(rowIndex: number): azdata.CssStyles {
		if (this.isRowSelected(rowIndex)) {
			const bgColor = this._hasFocus ? colorRegistry.listActiveSelectionBackground : colorRegistry.listInactiveSelectionBackground;
			const color = this._hasFocus ? colorRegistry.listActiveSelectionForeground : colorRegistry.listInactiveSelectionForeground;
			return {
				'background-color': this._colorTheme.getColor(bgColor)?.toString(),
				'color': this._colorTheme.getColor(color)?.toString()
			};
		} else {
			return {};
		}
	}

	onFocusIn() {
		this._hasFocus = true;
		this._rowSelectionFocusFlag = true;
		this._changeRef.detectChanges();
	}

	onFocusOut() {
		this._hasFocus = false;
		this._changeRef.detectChanges();
	}

	public get enableRowSelection(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.enableRowSelection, false);
	}

	public get selectedRow(): number {
		return this.getPropertyOrDefault<number>((props) => props.selectedRow, -1);
	}

	public set selectedRow(row: number) {
		if (row !== this.selectedRow) {
			this.setPropertyFromUI<number>((properties, value) => { properties.selectedRow = value; }, row);
		}
	}

	public showColumn(column: azdata.DeclarativeTableColumn): boolean {
		return column.hidden === undefined || !column.hidden;
	}
}
