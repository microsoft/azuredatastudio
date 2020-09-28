/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor';
import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IDataGridProviderService } from 'sql/workbench/services/dataGridProvider/common/dataGridProviderService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { getDataGridFormatter } from 'sql/workbench/services/dataGridProvider/browser/dataGridProviderUtils';

export interface ColumnDefinition extends Slick.Column<Slick.SlickData> {
	name: string;
	filterable?: boolean;
}

export class ResourceViewerInput extends EditorInput {

	public static ID: string = 'workbench.editorInput.resourceViewerInput';
	private _data: Slick.SlickData[] = [];
	private _columns: ColumnDefinition[] = [];

	private _onColumnsChanged = new Emitter<Slick.Column<Slick.SlickData>[]>();
	public onColumnsChanged: Event<Slick.Column<Slick.SlickData>[]> = this._onColumnsChanged.event;

	private _onDataChanged = new Emitter<void>();
	public onDataChanged: Event<void> = this._onDataChanged.event;

	constructor(private _providerId: string, @IDataGridProviderService private _dataGridProvider: IDataGridProviderService) {
		super();
		this.refresh().catch(err => onUnexpectedError(err));
	}

	public getTypeId(): string {
		return ResourceViewerInput.ID;
	}

	public getName(): string {
		return nls.localize('resourceViewerInput.resourceViewer', "Resource Viewer");
	}

	public get data(): Slick.SlickData[] {
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
		await Promise.all([
			this.fetchColumns(),
			this.fetchItems()
		]);
	}

	private fetchColumns(): void {
		this._dataGridProvider.getDataGridColumns(this._providerId).then(columns => {
			this.columns = columns.map(col => {
				return {
					name: col.name,
					field: col.field,
					id: col.id,
					formatter: getDataGridFormatter(col.type),
					sortable: col.sortable ?? true,
					filterable: col.filterable ?? true,
					resizable: col.resizable ?? true,
					tooltip: col.tooltip,
					width: col.width
				};
			});
		}).catch(err => onUnexpectedError(err));
	}

	private fetchItems(): void {
		this._dataGridProvider.getDataGridItems(this._providerId).then(items => {
			this._data = items;
			this._onDataChanged.fire();
		}).catch(err => onUnexpectedError(err));
	}
}
