/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/resourceViewerTable';
import * as azdata from 'azdata';
import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableFilterStyler, attachTableStyler } from 'sql/platform/theme/common/styler';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { HyperlinkCellValue, isHyperlinkCellValue, TextCellValue } from 'sql/base/browser/ui/table/formatters';
import { HeaderFilter, CommandEventArgs } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { Disposable } from 'vs/base/common/lifecycle';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { FilterableColumn, ITableMouseEvent } from 'sql/base/browser/ui/table/interfaces';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { isString } from 'vs/base/common/types';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { localize } from 'vs/nls';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ColumnDefinition } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';
import { Emitter } from 'vs/base/common/event';
import { ContextMenuAnchor } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerEditor';
import { LoadingSpinnerPlugin } from 'sql/base/browser/ui/table/plugins/loadingSpinner.plugin';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';

export class ResourceViewerTable extends Disposable {

	private _resourceViewerTable!: Table<azdata.DataGridItem>;
	private _dataView: TableDataView<azdata.DataGridItem>;
	private _loadingSpinnerPlugin = new LoadingSpinnerPlugin<azdata.DataGridItem>();
	private _onContextMenu = new Emitter<{ anchor: ContextMenuAnchor, item: azdata.DataGridItem }>();
	public onContextMenu = this._onContextMenu.event;

	constructor(parent: HTMLElement,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@IOpenerService private _openerService: IOpenerService,
		@ICommandService private _commandService: ICommandService,
		@INotificationService private _notificationService: INotificationService,
		@IContextViewService private _contextViewService: IContextViewService) {
		super();
		let filterFn = (data: Array<azdata.DataGridItem>): Array<azdata.DataGridItem> => {
			return data.filter(item => this.filter(item));
		};

		this._dataView = new TableDataView<azdata.DataGridItem>(undefined, undefined, undefined, filterFn);
		this._resourceViewerTable = this._register(new Table(parent, {
			sorter: (args) => {
				this._dataView.sort(args);
			}
		}, {
			dataItemColumnValueExtractor: dataGridColumnValueExtractor
		}));

		this._resourceViewerTable.setSelectionModel(new RowSelectionModel());
		let filterPlugin = new HeaderFilter<azdata.DataGridItem>(this._contextViewService);
		this._register(attachTableFilterStyler(filterPlugin, this._themeService));
		this._register(attachTableStyler(this._resourceViewerTable, this._themeService));
		this._register(this._resourceViewerTable.onClick(this.onTableClick, this));
		this._register(this._resourceViewerTable.onContextMenu((e: ITableMouseEvent) => {
			this._onContextMenu.fire({
				anchor: e.anchor,
				item: this._dataView.getItem(e.cell.row)
			});
		}));
		filterPlugin.onFilterApplied.subscribe(() => {
			this._dataView.filter();
			this._resourceViewerTable.grid.invalidate();
			this._resourceViewerTable.grid.render();
			this._resourceViewerTable.grid.resetActiveCell();
			this._resourceViewerTable.grid.resizeCanvas();
		});
		filterPlugin.onCommand.subscribe((e, args: CommandEventArgs<azdata.DataGridItem>) => {
			// Convert filter command to SlickGrid sort args
			this._dataView.sort({
				grid: args.grid,
				multiColumnSort: false,
				sortCol: args.column,
				sortAsc: args.command === 'sort-asc'
			});
			this._resourceViewerTable.grid.invalidate();
			this._resourceViewerTable.grid.render();
		});
		this._resourceViewerTable.registerPlugin(filterPlugin);
		this._resourceViewerTable.registerPlugin(this._loadingSpinnerPlugin);
	}

	public set data(data: azdata.DataGridItem[]) {
		this._dataView.clear();
		this._dataView.push(data);
		this._resourceViewerTable.grid.setData(this._dataView, true);
		this._resourceViewerTable.grid.render();
	}

	public set columns(columns: Slick.Column<Slick.SlickData>[]) {
		this._resourceViewerTable.columns = columns as any; // Cast to any to fix strict type assertion error
		this._resourceViewerTable.autosizeColumns();
	}

	public set loading(isLoading: boolean) {
		this._loadingSpinnerPlugin.loading = isLoading;
	}

	public set title(title: string) {
		this._resourceViewerTable.setTableTitle(title);
	}

	public registerPlugin(plugin: Slick.Plugin<azdata.DataGridItem>): void {
		this._resourceViewerTable.registerPlugin(plugin);
	}

	public unregisterPlugin(plugin: Slick.Plugin<azdata.DataGridItem>): void {
		this._resourceViewerTable.unregisterPlugin(plugin);
	}

	public layout(): void {
		this._resourceViewerTable.resizeCanvas();
		this._resourceViewerTable.autosizeColumns();
	}

	public focus(): void {
		this._resourceViewerTable.focus();
	}

	private filter(item: Slick.SlickData) {
		const columns = this._resourceViewerTable.grid.getColumns();
		let value = true;
		for (let i = 0; i < columns.length; i++) {
			const col: FilterableColumn<Slick.SlickData> = columns[i] as any; // Cast to any to fix strict type assertion error
			if (!col.field) {
				continue;
			}
			let filterValues = col.filterValues;
			if (filterValues && filterValues.length > 0) {
				if (item._parent) {
					value = value && !!filterValues.find(x => x === item._parent[col.field!]);
				} else {
					value = value && !!filterValues.find(x => x === item[col.field!]);
				}
			}
		}
		return value;
	}

	private async onTableClick(event: ITableMouseEvent): Promise<void> {
		const column = this._resourceViewerTable.columns[event.cell.cell] as ColumnDefinition;
		if (column) {
			const row = this._dataView.getItem(event.cell.row);
			const value = row[column.field];
			if (isHyperlinkCellValue(value)) {
				if (isString(value.linkOrCommand)) {
					try {
						await this._openerService.open(value.linkOrCommand);
					} catch (err) {
						this._notificationService.error(localize('resourceViewerTable.openError', "Error opening link : {0}", err.message ?? err));
					}
				} else {
					try {
						await this._commandService.executeCommand(value.linkOrCommand.id, ...(value.linkOrCommand.args ?? []));
					} catch (err) {
						this._notificationService.error(localize('resourceViewerTable.commandError', "Error executing command '{0}' : {1}", value.linkOrCommand.id, err.message ?? err));
					}
				}
			}
		}
	}
}

/**
 * Extracts the specified field into the expected object to be handled by SlickGrid and/or formatters as needed.
 */
function dataGridColumnValueExtractor(value: azdata.DataGridItem, columnDef: ColumnDefinition): TextCellValue | HyperlinkCellValue {
	const fieldValue = value[columnDef.field];
	if (columnDef.type === 'hyperlink') {
		return fieldValue as HyperlinkCellValue;
	} else {
		return <TextCellValue>{
			text: fieldValue,
			ariaLabel: fieldValue ? escape(fieldValue as string) : fieldValue
		};
	}
}
