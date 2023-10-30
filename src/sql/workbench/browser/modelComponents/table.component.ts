/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/table';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';

import { Table } from 'sql/base/browser/ui/table/table';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { getContentHeight, getContentWidth, Dimension, isAncestor } from 'vs/base/browser/dom';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { ActionOnCheck, CheckboxSelectColumn, ICheckboxCellActionEventArgs } from 'sql/base/browser/ui/table/plugins/checkboxSelectColumn.plugin';
import { Emitter, Event as vsEvent } from 'vs/base/common/event';
import { slickGridDataItemColumnValueWithNoData, textFormatter, iconCssFormatter, CssIconCellValue } from 'sql/base/browser/ui/table/formatters';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType, ModelViewAction } from 'sql/platform/dashboard/browser/interfaces';
import { convertSizeToNumber } from 'sql/base/browser/dom';
import { ButtonCellValue, ButtonColumn } from 'sql/base/browser/ui/table/plugins/buttonColumn.plugin';
import { IconPath, createIconCssClass, getIconKey } from 'sql/workbench/browser/modelComponents/iconUtils';
import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';
import { TableCellClickEventArgs } from 'sql/base/browser/ui/table/plugins/tableColumn';
import { HyperlinkCellValue, HyperlinkColumn } from 'sql/base/browser/ui/table/plugins/hyperlinkColumn.plugin';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ContextMenuColumn, ContextMenuCellValue } from 'sql/base/browser/ui/table/plugins/contextMenuColumn.plugin';
import { IAction, Separator } from 'vs/base/common/actions';
import { MenuItemAction, MenuRegistry } from 'vs/platform/actions/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { IComponentContextService } from 'sql/workbench/services/componentContext/browser/componentContextService';
import { deepClone, equals } from 'vs/base/common/objects';
import { defaultTableFilterStyles, defaultTableStyles } from 'sql/platform/theme/browser/defaultStyles';

export enum ColumnSizingMode {
	ForceFit = 0,	// all columns will be sized to fit in viewable space, no horiz scroll bar
	AutoFit = 1,	// columns will be ForceFit up to a certain number; currently 3.  At 4 or more the behavior will switch to NO force fit
	DataFit = 2		// columns use sizing based on cell data, horiz scroll bar present if more cells than visible in view area
}

enum ColumnType {
	text = 0,
	checkBox = 1,
	button = 2,
	icon = 3,
	hyperlink = 4,
	contextMenu = 5
}

type TableCellInputDataType = string | azdata.IconColumnCellValue | azdata.ButtonColumnCellValue | azdata.HyperlinkColumnCellValue | azdata.ContextMenuColumnCellValue | undefined;
type TableCellDataType = string | CssIconCellValue | ButtonCellValue | HyperlinkCellValue | ContextMenuCellValue | undefined;

@Component({
	selector: 'modelview-table',
	template: `
		<div #table [ngStyle]="CSSStyles"></div>
	`
})
export default class TableComponent extends ComponentBase<azdata.TableComponentProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _table: Table<Slick.SlickData>;
	private _tableData: TableDataView<Slick.SlickData>;
	private _tableColumns;
	private _checkboxColumns: Map<string, CheckboxSelectColumn<Slick.SlickData>> = new Map();
	private _buttonColumns: ButtonColumn<{}>[] = [];
	private _hyperlinkColumns: HyperlinkColumn<{}>[] = [];
	private _contextMenuColumns: ContextMenuColumn<{}>[] = [];
	private _pluginsRegisterStatus: boolean[] = [];
	private _filterPlugin: HeaderFilter<Slick.SlickData>;
	private _onCheckBoxChanged = this._register(new Emitter<ICheckboxCellActionEventArgs>());
	private _onButtonClicked = this._register(new Emitter<TableCellClickEventArgs<{}>>());
	public readonly onCheckBoxChanged: vsEvent<ICheckboxCellActionEventArgs> = this._onCheckBoxChanged.event;
	public readonly onButtonClicked: vsEvent<TableCellClickEventArgs<{}>> = this._onButtonClicked.event;
	private _iconCssMap: { [iconKey: string]: string } = {};

	@ViewChild('table', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IAccessibilityService) private accessibilityService: IAccessibilityService,
		@Inject(IQuickInputService) private quickInputService: IQuickInputService,
		@Inject(IComponentContextService) private componentContextService: IComponentContextService
	) {
		super(changeRef, el, logService);
	}

	transformColumns(columns: string[] | azdata.TableColumn[]): Slick.Column<any>[] {
		let tableColumns: any[] = <any[]>columns;
		if (tableColumns) {
			const mycolumns: Slick.Column<any>[] = [];
			let index: number = 0;

			(<any[]>columns).map(col => {
				if (col.type === ColumnType.checkBox) {
					this.createCheckBoxPlugin(col, index);
				} else if (col.type === ColumnType.button) {
					this.createButtonPlugin(col);
				} else if (col.type === ColumnType.icon) {
					mycolumns.push(TableComponent.createIconColumn(col));
				} else if (col.type === ColumnType.hyperlink) {
					this.createHyperlinkPlugin(col);
				} else if (col.type === ColumnType.contextMenu) {
					this.createContextMenuButtonPlugin(col);
				}
				else if (col.value) {
					mycolumns.push(TableComponent.createTextColumn(col as azdata.TableColumn));
				} else {
					mycolumns.push(<Slick.Column<any>>{
						name: <string>col,
						id: <string>col,
						field: <string>col,
						formatter: textFormatter
					});
				}
				index++;
			});
			return mycolumns;
		} else {
			return (<string[]>columns).map(col => {
				return <Slick.Column<any>>{
					name: col,
					id: col,
					field: col
				};
			});
		}
	}

	private static createIconColumn<T extends Slick.SlickData>(col: azdata.TableColumn): Slick.Column<T> {
		return <Slick.Column<T>>{
			name: col.name ?? col.value,
			id: col.value,
			field: col.value,
			width: col.width,
			cssClass: col.cssClass,
			headerCssClass: col.headerCssClass,
			toolTip: col.toolTip,
			formatter: iconCssFormatter,
			filterable: false,
			resizable: col.resizable
		};
	}

	private static createTextColumn<T extends Slick.SlickData>(col: azdata.TableColumn): Slick.Column<T> {
		return {
			name: col.name ?? col.value,
			id: col.value,
			field: col.value,
			width: col.width,
			cssClass: col.cssClass,
			headerCssClass: col.headerCssClass,
			toolTip: col.toolTip,
			formatter: textFormatter,
			resizable: col.resizable
		};
	}

	public transformData(rows: (TableCellInputDataType)[][], columns: string[] | azdata.TableColumn[]): { [key: string]: TableCellDataType }[] {
		if (rows && columns) {
			return rows.map(row => {
				const object: { [key: string]: TableCellDataType } = {};
				if (!Array.isArray(row)) {
					return object;
				}
				row.forEach((val, index) => {
					const column = columns[index];
					if (typeof column === 'string') {
						object[column] = <string>val;
					} else {
						const columnType = <ColumnType>column.type;
						let cellValue = undefined;
						switch (columnType) {
							case ColumnType.icon:
								const iconValue = <azdata.IconColumnCellValue>val;
								cellValue = <CssIconCellValue>{
									iconCssClass: this.createIconCssClassInternal(iconValue.icon),
									title: iconValue.title
								};
								break;
							case ColumnType.button:
								if (val) {
									const buttonValue = <azdata.ButtonColumnCellValue>val;
									cellValue = <ButtonCellValue>{
										iconCssClass: buttonValue.icon ? this.createIconCssClassInternal(buttonValue.icon) : undefined,
										title: buttonValue.title
									};
								}
								break;
							case ColumnType.hyperlink:
								if (val) {
									const hyperlinkValue = <azdata.HyperlinkColumnCellValue>val;
									cellValue = <HyperlinkCellValue>{
										iconCssClass: hyperlinkValue.icon ? this.createIconCssClassInternal(hyperlinkValue.icon) : undefined,
										title: hyperlinkValue.title,
										url: hyperlinkValue.url,
										role: hyperlinkValue.role
									};
									break;
								}
								break;
							case ColumnType.contextMenu:
								if (val) {
									const contextMenuValue = <azdata.ContextMenuColumnCellValue>val;
									cellValue = <ContextMenuCellValue>{
										title: contextMenuValue.title,
										commands: contextMenuValue.commands,
										context: contextMenuValue.context
									};
								}
								break;
							default:
								cellValue = val;
						}
						object[column.value] = cellValue;
					}
				});
				return object;
			});
		} else {
			return [];
		}
	}

	private createIconCssClassInternal(icon: IconPath): string {
		const iconKey: string = getIconKey(icon);
		const iconCssClass = this._iconCssMap[iconKey] ?? createIconCssClass(icon);
		if (!this._iconCssMap[iconKey]) {
			this._iconCssMap[iconKey] = iconCssClass;
		}
		return iconCssClass;
	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			this._tableData = new TableDataView<Slick.SlickData>(
				null,
				null,
				null,
				(data: Slick.SlickData[]) => {
					let columns = this._table.grid.getColumns();

					for (let i = 0; i < columns.length; i++) {
						let col: any = columns[i];
						let filterValues: Array<any> = col.filterValues;
						if (filterValues && filterValues.length > 0) {
							return data.filter(item => {
								let colValue = item[col.field];
								if (colValue instanceof Array) {
									return filterValues.find(x => colValue.indexOf(x) >= 0);
								}
								return filterValues.find(x => x === colValue);
							});
						}
					}

					return data;
				}
			);

			let options = <Slick.GridOptions<any>>{
				syncColumnCellResize: true,
				enableColumnReorder: false,
				enableCellNavigation: true,
				forceFitColumns: true, // default to true during init, actual value will be updated when setProperties() is called
				dataItemColumnValueExtractor: slickGridDataItemColumnValueWithNoData, // must change formatter if you are changing explicit column value extractor,
				enableInGridTabNavigation: this.moveFocusOutWithTab
			};

			this._table = new Table<Slick.SlickData>(this._inputContainer.nativeElement, this.accessibilityService, this.quickInputService, defaultTableStyles, { dataProvider: this._tableData, columns: this._tableColumns }, options);
			this._table.setData(this._tableData);
			this._table.setSelectionModel(new RowSelectionModel({ selectActiveRow: true }));

			this._register(this._table);
			this._register(this._table.onSelectedRowsChanged((e, data) => {
				if (this.isCheckboxColumnsUsedForSelection()) {
					return;
				}
				this.selectedRows = data.rows;
				this.fireEvent({
					eventType: ComponentEventType.onSelectedRowChanged,
					args: e
				});
			}));
			this._register(this.componentContextService.registerTable(this._table));
		}
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public override layout(): void {
		this.layoutTable();
		super.layout();
	}

	private layoutTable(): void {
		let width: number = convertSizeToNumber(this.width);
		let height: number = convertSizeToNumber(this.height);
		let forceFit: boolean = true;

		// convert the tri-state viewmodel columnSizingMode to be either true or false for SlickGrid
		switch (this.forceFitColumns) {
			case ColumnSizingMode.DataFit: {
				forceFit = false;
				break;
			}
			case ColumnSizingMode.AutoFit: {
				// determine if force fit should be on or off based on the number of columns
				// this can be made more sophisticated if need be in the future.  a simple
				// check for 3 or less force fits causes the small number of columns to fill the
				// screen better.  4 or more, slickgrid seems to do a good job filling the view and having forceFit
				// false enables the scroll bar and avoids the over-packing should there be a very large
				// number of columns
				forceFit = (this._table.columns.length <= 3);
				break;
			}
			case ColumnSizingMode.ForceFit:
			default: {
				// default behavior for the table component (used primarily in wizards) is to forcefit the columns
				forceFit = true;
				break;
			}
		}
		let updateOptions = <Slick.GridOptions<any>>{
			forceFitColumns: forceFit
		};
		this._table.setOptions(updateOptions);

		this._table.layout(new Dimension(
			width && width > 0 ? width : getContentWidth(this._inputContainer.nativeElement),
			height && height > 0 ? height : getContentHeight(this._inputContainer.nativeElement)));
		this._table.resizeCanvas();
	}

	public setLayout(): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		const oldColumns = deepClone(this.columns);
		super.setProperties(properties);
		this._tableData.clear();
		this._tableData.push(this.transformData(this.data, this.columns));
		if (!equals(oldColumns, this.columns)) {
			this._tableColumns = this.transformColumns(this.columns);
			this._table.columns = this._tableColumns;
			this._checkboxColumns.forEach((column, columnName) => { this.registerPlugins(columnName, column); })
			Object.keys(this._buttonColumns).forEach(col => this.registerPlugins(col, this._buttonColumns[col]));
			Object.keys(this._hyperlinkColumns).forEach(col => this.registerPlugins(col, this._hyperlinkColumns[col]));
			Object.keys(this._contextMenuColumns).forEach(col => this.registerPlugins(col, this._contextMenuColumns[col]));

			this._table.columns = this._tableColumns;
			this._table.autosizeColumns();
		}
		this._table.setData(this._tableData);
		this._table.setTableTitle(this.title);
		if (this.selectedRows) {
			this._table.setSelectedRows(this.selectedRows);
		}

		if (this.headerFilter === true) {
			this.registerFilterPlugin();
			this._tableData.clearFilter();
		}
		if (this.ariaRowCount === -1) {
			this._table.removeAriaRowCount();
		}
		else {
			this._table.ariaRowCount = this.ariaRowCount;
		}

		if (this.ariaColumnCount === -1) {
			this._table.removeAriaColumnCount();
		}
		else {
			this._table.ariaColumnCount = this.ariaColumnCount;
		}

		if (this.ariaRole) {
			this._table.ariaRole = this.ariaRole;
		}

		if (this.ariaLabel) {
			this._table.ariaLabel = this.ariaLabel;
		}

		if (this.updateCells !== undefined) {
			this.updateTableCells(this.updateCells);
		}

		this.layoutTable();
		this.validate().catch(onUnexpectedError);
	}

	private updateTableCells(cellInfos): void {
		cellInfos.forEach((cellInfo) => {
			if (isUndefinedOrNull(cellInfo.column) || isUndefinedOrNull(cellInfo.row) || cellInfo.row < 0 || cellInfo.row > this.data.length) {
				return;
			}

			const checkInfo: azdata.CheckBoxCell = cellInfo as azdata.CheckBoxCell;
			if (checkInfo) {
				this._checkboxColumns.get(checkInfo.columnName).reactiveCheckboxCheck(checkInfo.row, checkInfo.checked);
			}
		});
	}

	private createCheckBoxPlugin(col: azdata.CheckboxColumn, index: number) {
		let name = col.value;
		if (!this._checkboxColumns.has(col.value)) {
			const checkboxAction = <ActionOnCheck>(col.options ? (<any>col.options).actionOnCheckbox : col.action);
			this._checkboxColumns.set(col.value, new CheckboxSelectColumn({
				title: col.value,
				toolTip: col.toolTip,
				width: col.width,
				cssClass: col.cssClass,
				headerCssClass: col.headerCssClass,
				actionOnCheck: checkboxAction,
				columnId: `checkbox-column-${index}`,
			}, index));

			this._register(this._checkboxColumns.get(col.value).onChange((state) => {
				this.data[state.row][state.column] = state.checked;
				this.setPropertyFromUI<any[][]>((props, value) => props.data = value, this.data);
				this.fireEvent({
					eventType: ComponentEventType.onCellAction,
					args: {
						row: state.row,
						column: state.column,
						checked: state.checked,
						name: name
					}
				});
				if (checkboxAction === ActionOnCheck.selectRow) {
					const selectedRows: number[] = [];
					this.data.forEach((row, index) => {
						if (row[state.column]) {
							selectedRows.push(index);
						}
					});
					this.selectedRows = selectedRows;
					this.fireEvent({
						eventType: ComponentEventType.onSelectedRowChanged,
						args: selectedRows
					});
				}
			}));

			this._register(this._checkboxColumns.get(col.value).onCheckAllChange((state) => {
				this.data.forEach((row, index) => {
					row[state.column] = state.checked;
				});
				this.setPropertyFromUI<any[][]>((props, value) => props.data = value, this.data);
				if (checkboxAction === ActionOnCheck.selectRow) {

					this.selectedRows = state.checked ? this.data.map((v, i) => i) : [];
					this.fireEvent({
						eventType: ComponentEventType.onSelectedRowChanged,
						args: this.selectedRows
					});
				}
			}));
		}
	}

	private createButtonPlugin(col: azdata.ButtonColumn) {
		let name = col.value;
		if (!this._buttonColumns[col.value]) {
			const icon = <IconPath>(col.options ? (<any>col.options).icon : col.icon);
			this._buttonColumns[col.value] = new ButtonColumn({
				title: col.value,
				iconCssClass: icon ? this.createIconCssClassInternal(icon) : undefined,
				field: col.value,
				showText: col.showText,
				name: col.name,
				resizable: col.resizable
			});

			this._register(this._buttonColumns[col.value].onClick((state) => {
				this.fireEvent({
					eventType: ComponentEventType.onCellAction,
					args: {
						row: state.row,
						column: state.column,
						name: name
					}
				});
			}));
		}
	}

	private createHyperlinkPlugin(col: azdata.HyperlinkColumn) {
		const name = col.value;
		if (!this._hyperlinkColumns[col.value]) {
			const hyperlinkColumn = new HyperlinkColumn({
				title: col.value,
				width: col.width,
				iconCssClass: col.icon ? this.createIconCssClassInternal(col.icon) : undefined,
				field: col.value,
				name: col.name,
				resizable: col.resizable
			});

			this._hyperlinkColumns[col.value] = hyperlinkColumn;

			this._register(hyperlinkColumn.onClick((state) => {
				this.fireEvent({
					eventType: ComponentEventType.onCellAction,
					args: {
						row: state.row,
						column: state.column,
						name: name
					}
				});
			}));
		}
	}


	private createContextMenuButtonPlugin(col: azdata.ContextMenuColumn) {
		if (!this._contextMenuColumns[col.value]) {
			this._contextMenuColumns[col.value] = new ContextMenuColumn({
				title: col.value,
				width: col.width,
				field: col.value,
				name: col.name,
				resizable: col.resizable
			});
		}

		this._register(
			this._contextMenuColumns[col.value].onClick((state) => {
				const cellValue = state.item[col.value];
				const actions: IAction[] = [];
				cellValue.commands.forEach((c, i) => {
					if (typeof c === 'string') {
						actions.push(this.createMenuItem(c));
					} else {
						if (actions.length !== 0) {
							actions.push(new Separator());
						}
						actions.push(...c.map(cmd => {
							return this.createMenuItem(cmd);
						}));
						if (i !== cellValue.commands.length - 1) {
							actions.push(new Separator());
						}
					}
				});

				this.contextMenuService.showContextMenu({
					getAnchor: () => {
						return {
							x: state.position.x,
							y: state.position.y
						};
					},
					getActions: () => actions,
					getActionsContext: () => cellValue.context,
					onHide: () => {
						this.focus();
					}
				});
			})
		);
	}

	private createMenuItem(commandId: string): MenuItemAction {
		const command = MenuRegistry.getCommand(commandId);
		return this.instantiationService.createInstance(MenuItemAction, command, undefined, { shouldForwardArgs: true }, undefined);
	}


	private registerPlugins(col: string, plugin: CheckboxSelectColumn<{}> | ButtonColumn<{}> | HyperlinkColumn<{}> | ContextMenuColumn<{}>): void {
		const index = 'index' in plugin ? plugin.index : this.columns?.findIndex(x => x === col || ('value' in x && x['value'] === col));
		if (index >= 0) {
			this._tableColumns.splice(index, 0, plugin.definition);
			if (!(col in this._pluginsRegisterStatus) || !this._pluginsRegisterStatus[col]) {
				this._table.registerPlugin(plugin);
				this._pluginsRegisterStatus[col] = true;
			}
		}
	}


	private registerFilterPlugin() {
		const filterPlugin = new HeaderFilter<Slick.SlickData>(defaultTableFilterStyles, this.contextViewService);
		this._filterPlugin = filterPlugin;
		this._filterPlugin.onFilterApplied.subscribe((e, args) => {
			let filterValues = (<any>args).column.filterValues;
			if (filterValues) {
				this._tableData.filter();
				this._table.grid.resetActiveCell();
				this.data = this._tableData.getItems().map(dataObject => Object.values(dataObject));
				this.layoutTable();
			} else {
				this._tableData.clearFilter();
			}
		});

		this._filterPlugin.onCommand.subscribe((e, args: any) => {
			this._tableData.sort({
				sortAsc: args.command === 'sort-asc',
				sortCol: args.column,
				multiColumnSort: false,
				grid: this._table.grid
			});
			this.layoutTable();
		});

		this._table.registerPlugin(filterPlugin);
	}

	public override focus(): void {
		if (this._table.grid.getDataLength() > 0) {
			if (!this._table.grid.getActiveCell()) {
				this._table.grid.setActiveCell(0, 0);
			}
			this._table.grid.getActiveCellNode().focus();
		}
	}

	/**
	 * Returns true if the checkbox column is used for row selection in the table
	 */
	private isCheckboxColumnsUsedForSelection(): boolean {
		return this.columns.some(c => {
			const checkboxAction = <ActionOnCheck>(c.options ? (<azdata.CheckboxColumnOption>c.options).actionOnCheckbox : c.action);
			return checkboxAction === ActionOnCheck.selectRow
		});
	}

	// CSS-bound properties

	public get data(): any[][] {
		return this.getPropertyOrDefault<any[]>((props) => props.data, []);
	}

	public set data(newValue: any[][]) {
		this.setPropertyFromUI<any[][]>((props, value) => props.data = value, newValue);
	}

	public get columns(): string[] | azdata.TableColumn[] {
		return this.getPropertyOrDefault<string[] | azdata.TableColumn[]>((props) => props.columns, []);
	}

	public get fontSize(): number | string {
		return this.getPropertyOrDefault<number | string>((props) => props.fontSize, '');
	}

	public set columns(newValue: string[] | azdata.TableColumn[]) {
		this.setPropertyFromUI<string[] | azdata.TableColumn[]>((props, value) => props.columns = value, newValue);
	}

	public get selectedRows(): number[] {
		return this.getPropertyOrDefault<number[]>((props) => props.selectedRows, []);
	}

	public set selectedRows(newValue: number[]) {
		this.setPropertyFromUI<number[]>((props, value) => props.selectedRows = value, newValue);
	}

	public get forceFitColumns() {
		return this.getPropertyOrDefault<ColumnSizingMode>((props) => props.forceFitColumns, ColumnSizingMode.ForceFit);
	}

	public get title() {
		return this.getPropertyOrDefault<string>((props) => props.title, '');
	}

	public get ariaRowCount(): number {
		return this.getPropertyOrDefault<number>((props) => props.ariaRowCount, -1);
	}

	public get ariaColumnCount(): number {
		return this.getPropertyOrDefault<number>((props) => props.ariaColumnCount, -1);
	}

	public set moveFocusOutWithTab(newValue: boolean) {
		this.setPropertyFromUI<boolean>((props, value) => props.moveFocusOutWithTab = value, newValue);
	}

	public get moveFocusOutWithTab(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.moveFocusOutWithTab, false);
	}

	public get updateCells(): azdata.TableCell[] {
		return this.getPropertyOrDefault<azdata.TableCell[]>((props) => props.updateCells, undefined);
	}

	public set updateCells(newValue: azdata.TableCell[]) {
		this.setPropertyFromUI<azdata.TableCell[]>((properties, value) => { properties.updateCells = value; }, newValue);
	}

	public get headerFilter(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.headerFilter, false);
	}

	public override doAction(action: string, ...args: any[]): void {
		switch (action) {
			case ModelViewAction.AppendData:
				this.appendData(args[0]);
				break;
			case ModelViewAction.SetActiveCell:
				this._table.grid.setActiveCell(args[0], args[1]);
				break;
		}
	}

	private appendData(data: any[][]) {
		const tableHasFocus = isAncestor(document.activeElement, <HTMLElement>this._inputContainer.nativeElement);
		const currentActiveCell = this._table.grid.getActiveCell();
		const wasFocused = tableHasFocus && this._table.grid.getDataLength() > 0 && currentActiveCell;

		this._tableData.push(this.transformData(data, this.columns));
		this.data = this._tableData.getItems().map(dataObject => Object.values(dataObject));
		this.layoutTable();

		if (wasFocused) {
			if (!this._table.grid.getActiveCell()) {
				this._table.grid.setActiveCell(currentActiveCell.row, currentActiveCell.cell);
			}
			this._table.grid.getActiveCellNode().focus();
		}
	}

	public override get CSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'width': this.getWidth(),
			'height': '100%',
			'font-size': this.fontSize
		});
	}
}
