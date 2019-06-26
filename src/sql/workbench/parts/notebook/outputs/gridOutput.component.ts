/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { OnInit, Component, Input, Inject } from '@angular/core';
import * as azdata from 'azdata';

import { AngularDisposable } from 'sql/base/node/lifecycle';
import { IMimeComponent } from 'sql/workbench/parts/notebook/outputs/mimeRegistry';
import { MimeModel } from 'sql/workbench/parts/notebook/outputs/common/mimemodel';
import { ICellModel } from 'sql/workbench/parts/notebook/models/modelInterfaces';
import { GridTableBase, GridTableState } from 'sql/workbench/parts/query/electron-browser/gridPanel';
import { IGridDataProvider } from 'sql/platform/query/common/gridDataProvider';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { SaveFormat } from 'sql/workbench/parts/grid/common/interfaces';
import { IDataResource } from 'sql/workbench/services/notebook/sql/sqlSessionManager';

@Component({
	selector: GridOutputComponent.SELECTOR,
	template: `
		<div #output class="notebook-cellTable">

		</div>
	`
})
export class GridOutputComponent extends AngularDisposable implements IMimeComponent, OnInit {
	public static readonly SELECTOR: string = 'grid-output';

	private _initialized: boolean = false;
	private _cellModel: ICellModel;
	private _bundleOptions: MimeModel.IOptions;
	private _table: DataResourceTable;
	constructor(
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,

	) {
		super();
	}

	@Input() set bundleOptions(value: MimeModel.IOptions) {
		this._bundleOptions = value;
		if (this._initialized) {
			this.renderGrid();
		}
	}

	@Input() mimeType: string;

	get cellModel(): ICellModel {
		return this._cellModel;
	}

	@Input() set cellModel(value: ICellModel) {
		this._cellModel = value;
		if (this._initialized) {
			this.renderGrid();
		}
	}

	ngOnInit() {
		this.renderGrid();
	}

	renderGrid(): void {
		if (!this._table) {
			this._table = this.instantiationService.createInstance(DataResourceTable, this._bundleOptions, undefined);
		}
	}

	layout(): void {
		throw new Error('Method not implemented.');
	}
}

class DataResourceTable extends GridTableBase<any> {
	private _gridDataProvider: IGridDataProvider;

	constructor(private _bundleOptions: MimeModel.IOptions,
		state: GridTableState,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IEditorService editorService: IEditorService,
		@IUntitledEditorService untitledEditorService: IUntitledEditorService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(state, contextMenuService, instantiationService, editorService, untitledEditorService, configurationService);
		this._gridDataProvider = this.instantiationService.createChild(DataResourceDataProvider);
	}
	get gridDataProvider(): IGridDataProvider {
		return this._gridDataProvider;
	}

}

class DataResourceDataProvider implements IGridDataProvider {

	constructor(private source: IDataResource) {

	}
	getRowData(rowStart: number, numberOfRows: number): Thenable<azdata.QueryExecuteSubsetResult> {
		throw new Error('Method not implemented.');
	}

	copyResults(selection: Slick.Range[], includeHeaders?: boolean): void {
		throw new Error('Method not implemented.');
	}
	getEolString(): string {
		throw new Error('Method not implemented.');
	}
	shouldIncludeHeaders(includeHeaders: boolean): boolean {
		throw new Error('Method not implemented.');
	}

	shouldRemoveNewLines(): boolean {
		throw new Error('Method not implemented.');
	}

	getColumnHeaders(range: Slick.Range): string[] {
		throw new Error('Method not implemented.');
	}

	get canSerialize(): boolean {
		return false;
	}

	serializeResults(format: SaveFormat, selection: Slick.Range[]): Thenable<void> {
		throw new Error('Method not implemented.');
	}


}