/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor';
import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { DataGridProvider, IDataGridProviderService } from 'sql/workbench/services/dataGridProvider/common/dataGridProviderService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ButtonColumn } from 'sql/base/browser/ui/table/plugins/buttonColumn.plugin';
import { getDataGridFormatter } from 'sql/workbench/services/dataGridProvider/browser/dataGridProviderUtils';
import { FilterableColumn } from 'sql/base/browser/ui/table/interfaces';

export interface ColumnDefinition extends FilterableColumn<azdata.DataGridItem> {
	name: string;
	// actions is a special internal type for the More Actions column
	type: azdata.DataGridColumnType | 'actions';
}

export class ResourceViewerInput extends EditorInput {

	public static ID: string = 'workbench.editorInput.resourceViewerInput';

	private _dataGridProvider: DataGridProvider;
	private _data: azdata.DataGridItem[] = [];
	private _columns: ColumnDefinition[] = [];
	private _loading: boolean = true;

	private _onLoadingChanged = new Emitter<boolean>();
	public onLoadingChanged: Event<boolean> = this._onLoadingChanged.event;
	private _onColumnsChanged = new Emitter<Slick.Column<azdata.DataGridItem>[]>();
	public actionsColumn: ButtonColumn<azdata.DataGridItem>;
	public onColumnsChanged: Event<Slick.Column<azdata.DataGridItem>[]> = this._onColumnsChanged.event;
	private _onDataChanged = new Emitter<void>();
	public onDataChanged: Event<void> = this._onDataChanged.event;

	constructor(private _providerId: string,
		@IDataGridProviderService dataGridProviderService: IDataGridProviderService) {
		super();
		this._dataGridProvider = dataGridProviderService.getDataGridProvider(this._providerId);
		this.actionsColumn = new ButtonColumn<azdata.DataGridItem>({
			id: 'actions',
			iconCssClass: 'toggle-more',
			title: nls.localize('resourceViewer.showActions', "Show Actions")
		});
		this.refresh().catch(err => onUnexpectedError(err));
	}

	public getTypeId(): string {
		return ResourceViewerInput.ID;
	}

	public getName(): string {
		return this._dataGridProvider.title || nls.localize('resourceViewerInput.resourceViewer', "Resource Viewer");
	}

	public get data(): azdata.DataGridItem[] {
		return this._data;
	}

	public set columns(columns: ColumnDefinition[]) {
		this._columns = columns;
		this._onColumnsChanged.fire(this._columns);
	}

	public get columns(): ColumnDefinition[] {
		return this._columns;
	}

	isDirty(): boolean {
		return false;
	}

	public get resource(): URI | undefined {
		return undefined;
	}

	public async refresh(): Promise<void> {
		this._loading = true;
		this._onLoadingChanged.fire(this._loading);
		await Promise.all([
			this.fetchColumns(),
			this.fetchItems()
		]);
		this._loading = false;
		this._onLoadingChanged.fire(this._loading);
	}

	public get plugins(): Slick.Plugin<azdata.DataGridItem>[] {
		return [this.actionsColumn];
	}

	public get loading(): boolean {
		return this._loading;
	}

	public get title(): string {
		return this._dataGridProvider.title;
	}

	private async fetchColumns(): Promise<void> {
		const columns = await this._dataGridProvider.getDataGridColumns();
		const columnDefinitions: ColumnDefinition[] = columns.map(col => {
			return {
				name: col.name,
				field: col.field,
				id: col.id,
				formatter: getDataGridFormatter(col.type),
				sortable: col.sortable ?? true,
				filterable: col.filterable ?? true,
				resizable: col.resizable ?? true,
				tooltip: col.tooltip,
				width: col.width,
				minWidth: col.width,
				type: col.type
			};
		});

		// Now add in the actions column definition at the end
		const actionsColumnDef: ColumnDefinition = Object.assign({}, this.actionsColumn.definition, { type: 'actions', filterable: false }) as ColumnDefinition;
		columnDefinitions.push(actionsColumnDef);
		this.columns = columnDefinitions;
	}

	private async fetchItems(): Promise<void> {
		const items = await this._dataGridProvider.getDataGridItems();
		this._data = items;
		this._onDataChanged.fire();
	}
}
