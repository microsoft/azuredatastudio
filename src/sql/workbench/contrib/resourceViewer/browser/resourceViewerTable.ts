/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/resourceViewerTable';
import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler, attachButtonStyler } from 'sql/platform/theme/common/styler';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { slickGridDataItemColumnValueExtractor } from 'sql/base/browser/ui/table/formatters';
import { HeaderFilter, CommandEventArgs, IExtendedColumn } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { Disposable } from 'vs/base/common/lifecycle';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';

export class ResourceViewerTable extends Disposable {

	private _resourceViewerTable!: Table<Slick.SlickData>;
	private _dataView: TableDataView<Slick.SlickData>;

	constructor(parent: HTMLElement, @IWorkbenchThemeService private _themeService: IWorkbenchThemeService) {
		super();
		let filterFn = (data: Array<Slick.SlickData>): Array<Slick.SlickData> => {
			return data.filter(item => this.filter(item));
		};

		this._dataView = new TableDataView<Slick.SlickData>(undefined, undefined, undefined, filterFn);
		this._resourceViewerTable = this._register(new Table(parent, {
			sorter: (args) => {
				this._dataView.sort(args);
			}
		}, {
			dataItemColumnValueExtractor: slickGridDataItemColumnValueExtractor,
			forceFitColumns: true
		}));
		this._resourceViewerTable.setSelectionModel(new RowSelectionModel());
		let filterPlugin = new HeaderFilter<Slick.SlickData>();
		this._register(attachButtonStyler(filterPlugin, this._themeService));
		this._register(attachTableStyler(this._resourceViewerTable, this._themeService));
		filterPlugin.onFilterApplied.subscribe(() => {
			this._dataView.filter();
			this._resourceViewerTable.grid.invalidate();
			this._resourceViewerTable.grid.render();
			this._resourceViewerTable.grid.resetActiveCell();
			this._resourceViewerTable.grid.resizeCanvas();
		});
		filterPlugin.onCommand.subscribe((e, args: CommandEventArgs<Slick.SlickData>) => {
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
	}

	public set data(data: Slick.SlickData[]) {
		this._dataView.clear();
		this._dataView.push(data);
		this._resourceViewerTable.grid.setData(this._dataView, true);
		this._resourceViewerTable.grid.render();
	}

	public set columns(columns: Slick.Column<Slick.SlickData>[]) {
		this._resourceViewerTable.columns = columns;
	}

	public focus(): void {
		this._resourceViewerTable.focus();
	}

	private filter(item: Slick.SlickData) {
		const columns = this._resourceViewerTable.grid.getColumns();
		let value = true;
		for (let i = 0; i < columns.length; i++) {
			const col: IExtendedColumn<Slick.SlickData> = columns[i];
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
}
