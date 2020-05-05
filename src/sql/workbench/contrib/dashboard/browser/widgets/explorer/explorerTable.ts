/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { ButtonColumn } from 'sql/base/browser/ui/table/plugins/buttonColumn.plugin';
import * as nls from 'vs/nls';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { status } from 'vs/base/browser/ui/aria/aria';
import * as DOM from 'vs/base/browser/dom';
import { ObjectListViewProperty, FlavorProperties } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import { TextWidthIconColumn } from 'sql/base/browser/ui/table/plugins/textWithIconColumn';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { MetadataType } from 'sql/platform/connection/common/connectionManagement';
import { Disposable } from 'vs/base/common/lifecycle';

export const NameProperty: string = 'name';
const IconClassProperty: string = 'iconClass';
const NamePropertyDisplayText: string = nls.localize('dashboard.explorer.namePropertyDisplayValue', "Name");
const ShowActionsText: string = nls.localize('dashboard.explorer.actions', "Show Actions");

/**
 * Table for explorer widget
 */
export class ExplorerTable extends Disposable {
	private _table: Table<Slick.SlickData>;
	private _view: TableDataView<Slick.SlickData>;
	private _actionsColumn: ButtonColumn<Slick.SlickData>;
	private _filterStr: string;

	constructor(private parentElement: HTMLElement, themeService: IThemeService, private context: string, private flavorProperties: FlavorProperties) {
		super();
		this._table = new Table<Slick.SlickData>(parentElement, undefined, { forceFitColumns: true, rowHeight: 35 });
		this._table.setSelectionModel(new RowSelectionModel());
		this._actionsColumn = new ButtonColumn<Slick.SlickData>({
			id: 'actions',
			iconCssClass: 'toggle-more',
			title: ShowActionsText,
			width: 40
		});
		this._table.registerPlugin(this._actionsColumn);
		this._register(this._actionsColumn.onClick((item) => {
		}));
		this._register(attachTableStyler(this._table, themeService));
		this._view = new TableDataView<Slick.SlickData>(undefined, undefined, undefined, (data: Slick.SlickData[]): Slick.SlickData[] => {
			return this.filterItems(this._filterStr, data);
		});
		this._register(this._view);
		this._register(this._view.onRowCountChange(() => {
			this._table.updateRowCount();
		}));
		this._register(this._view.onFilterStateChange(() => {
			this._table.grid.invalidateAllRows();
			this._table.updateRowCount();
		}));
	}

	public filter(filterStr: string): void {
		this._filterStr = filterStr;
		this._view.clearFilter();
		this._view.filter();
		const count = this._view.getItems().length;
		let message: string;
		if (count === 0) {
			message = nls.localize('explorerSearchNoMatchResultMessage', "No matching item found");
		} else if (count === 1) {
			message = nls.localize('explorerSearchSingleMatchResultMessage', "Filtered search list to 1 item");
		} else {
			message = nls.localize('explorerSearchMatchResultMessage', "Filtered search list to {0} items", count);
		}
		status(message);
	}

	public layout(): void {
		this._table.layout(new DOM.Dimension(
			DOM.getContentWidth(this.parentElement),
			DOM.getContentHeight(this.parentElement)));
		this._table.columns = this.columnDefinitions;
	}

	public setData(items: Slick.SlickData[]): void {
		this._table.columns = this.columnDefinitions;
		this._view.clear();
		this._view.clearFilter();
		this.setIconClassForData(items);
		this._table.setData(this._view);
		this._view.push(items);
	}

	private setIconClassForData(items: Slick.SlickData[]): void {
		if (this.context === 'database') {
			items.forEach(item => {
				let iconClass: string;
				switch (item.metadataType) {
					case MetadataType.Function:
						iconClass = 'scalarvaluedfunction';
						break;
					case MetadataType.SProc:
						iconClass = 'storedprocedure';
						break;
					case MetadataType.Table:
						iconClass = 'table';
						break;
					case MetadataType.View:
						iconClass = 'view';
						break;
				}
				item[IconClassProperty] = iconClass;
			});
		} else {
			items.forEach(item => {
				item[IconClassProperty] = 'database-colored';
			});
		}
	}

	private get columnDefinitions(): Slick.Column<Slick.SlickData>[] {
		const totalWidth = DOM.getContentWidth(this.parentElement);
		let totalColumnWidthWeight: number = 0;
		this.propertyList.forEach(p => {
			if (p.widthWeight) {
				totalColumnWidthWeight += p.widthWeight;
			}
		});

		const columns: Slick.Column<Slick.SlickData>[] = this.propertyList.map(property => {
			const columnWidth = property.widthWeight ? totalWidth * (property.widthWeight / totalColumnWidthWeight) : undefined;
			if (property.value === NameProperty) {
				const nameColumn = new TextWidthIconColumn({
					id: property.value,
					iconCssClassField: IconClassProperty,
					width: columnWidth,
					field: property.value,
					name: property.displayName
				});
				return nameColumn.definition;
			} else {
				return <Slick.Column<Slick.SlickData>>{
					id: property.value,
					field: property.value,
					name: property.displayName,
					width: columnWidth
				};
			}
		});
		columns.push(this._actionsColumn.definition);
		return columns;
	}

	private get propertyList(): ObjectListViewProperty[] {
		let propertyList;
		if (this.context === 'database') {
			if (this.flavorProperties && this.flavorProperties.objectsListProperties) {
				propertyList = this.flavorProperties.objectsListProperties;
			} else {
				propertyList = [{
					displayName: NamePropertyDisplayText,
					value: NameProperty,
					widthWeight: 60
				}, {
					displayName: nls.localize('dashboard.explorer.schemaDisplayValue', "Schema"),
					value: 'schema',
					widthWeight: 20
				}, {
					displayName: nls.localize('dashboard.explorer.objectTypeDisplayValue', "Type"),
					value: 'metadataTypeName',
					widthWeight: 20
				}];
			}
		} else {
			if (this.flavorProperties && this.flavorProperties.databasesListProperties) {
				propertyList = this.flavorProperties.databasesListProperties;
			} else {
				propertyList = [{
					displayName: NamePropertyDisplayText,
					value: NameProperty,
					widthWeight: 80
				}];
			}
		}

		return propertyList;
	}

	private filterItems(filterString: string, data: Slick.SlickData[]): Slick.SlickData[] {
		if (filterString) {
			let metadataType: MetadataType;
			if (this.context === 'database' && filterString.indexOf(':') > -1) {
				const filterArray = filterString.split(':');

				if (filterArray.length > 2) {
					filterString = filterArray.slice(1, filterArray.length - 1).join(':');
				} else {
					filterString = filterArray[1];
				}

				switch (filterArray[0].toLowerCase()) {
					case 'v':
						metadataType = MetadataType.View;
						break;
					case 't':
						metadataType = MetadataType.Table;
						break;
					case 'sp':
						metadataType = MetadataType.SProc;
						break;
					case 'f':
						metadataType = MetadataType.Function;
						break;
					default:
						break;
				}
			}

			return data.filter((item: Slick.SlickData) => {
				if (metadataType !== undefined && item.metadataType !== metadataType) {
					return false;
				}
				const keys = this.propertyList.map(property => property.value);
				let match = false;
				for (let i = 0; i < keys.length; i++) {
					const property = keys[i];
					const val = item[property];
					if (item[property] && typeof val === 'string' &&
						val.toLowerCase().indexOf(filterString.toLowerCase()) !== -1) {
						match = true;
						break;
					}
				}
				return match;
			});
		} else {
			return data;
		}
	}
}

