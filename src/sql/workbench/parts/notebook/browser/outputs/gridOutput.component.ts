/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Component, Input, Inject, ViewChild, ElementRef } from '@angular/core';
import * as azdata from 'azdata';

import { IGridDataProvider, getResultsString } from 'sql/platform/query/common/gridDataProvider';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { SaveFormat } from 'sql/workbench/parts/grid/common/interfaces';
import { IDataResource } from 'sql/workbench/services/notebook/common/sql/sqlSessionManager';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/resourceConfiguration';
import { getEolString, shouldIncludeHeaders, shouldRemoveNewLines } from 'sql/platform/query/common/queryRunner';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { localize } from 'vs/nls';
import { IAction } from 'vs/base/common/actions';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IMimeComponent } from 'sql/workbench/parts/notebook/browser/outputs/mimeRegistry';
import { ICellModel } from 'sql/workbench/parts/notebook/common/models/modelInterfaces';
import { MimeModel } from 'sql/workbench/parts/notebook/common/models/mimemodel';
import { GridTableState } from 'sql/workbench/parts/query/common/gridPanelState';
import { GridTableBase } from 'sql/workbench/parts/query/browser/gridPanel';
import { getErrorMessage } from 'vs/base/common/errors';

@Component({
	selector: GridOutputComponent.SELECTOR,
	template: `<div #output class="notebook-cellTable"></div>`
})
export class GridOutputComponent extends AngularDisposable implements IMimeComponent, OnInit {
	public static readonly SELECTOR: string = 'grid-output';

	@ViewChild('output', { read: ElementRef }) private output: ElementRef;

	private _initialized: boolean = false;
	private _cellModel: ICellModel;
	private _bundleOptions: MimeModel.IOptions;
	private _table: DataResourceTable;
	constructor(
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IThemeService) private readonly themeService: IThemeService
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
		if (!this._bundleOptions || !this._cellModel || !this.mimeType) {
			return;
		}
		if (!this._table) {
			let source = <IDataResource><any>this._bundleOptions.data[this.mimeType];
			let state = new GridTableState(0, 0);
			this._table = this.instantiationService.createInstance(DataResourceTable, source, this.cellModel.notebookModel.notebookUri.toString(), state);
			let outputElement = <HTMLElement>this.output.nativeElement;
			outputElement.appendChild(this._table.element);
			this._register(attachTableStyler(this._table, this.themeService));
			this.layout();
			this._table.onAdd();
			this._initialized = true;
		}
	}

	layout(): void {
		if (this._table) {
			let maxSize = Math.min(this._table.maximumSize, 500);
			this._table.layout(maxSize);
		}
	}
}

class DataResourceTable extends GridTableBase<any> {

	private _gridDataProvider: IGridDataProvider;

	constructor(source: IDataResource,
		documentUri: string,
		state: GridTableState,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IEditorService editorService: IEditorService,
		@IUntitledEditorService untitledEditorService: IUntitledEditorService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(state, createResultSet(source), contextMenuService, instantiationService, editorService, untitledEditorService, configurationService);
		this._gridDataProvider = this.instantiationService.createInstance(DataResourceDataProvider, source, this.resultSet, documentUri);
	}

	get gridDataProvider(): IGridDataProvider {
		return this._gridDataProvider;
	}

	protected getCurrentActions(): IAction[] {
		return [];
	}

	protected getContextActions(): IAction[] {
		return [];
	}

	public get maximumSize(): number {
		// Overriding action bar size calculation for now.
		// When we add this back in, we should update this calculation
		return Math.max(this.maxSize, /* ACTIONBAR_HEIGHT + BOTTOM_PADDING */ 0);
	}
}

class DataResourceDataProvider implements IGridDataProvider {
	private rows: azdata.DbCellValue[][];
	constructor(source: IDataResource,
		private resultSet: azdata.ResultSetSummary,
		private documentUri: string,
		@INotificationService private _notificationService: INotificationService,
		@IClipboardService private _clipboardService: IClipboardService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ITextResourcePropertiesService private _textResourcePropertiesService: ITextResourcePropertiesService
	) {
		this.transformSource(source);
	}

	private transformSource(source: IDataResource): void {
		this.rows = source.data.map(row => {
			let rowData: azdata.DbCellValue[] = [];
			Object.keys(row).forEach((val, index) => {
				let displayValue = String(Object.values(row)[index]);
				// Since the columns[0] represents the row number, start at 1
				rowData.push({
					displayValue: displayValue,
					isNull: false,
					invariantCultureDisplayValue: displayValue
				});
			});
			return rowData;
		});
	}

	getRowData(rowStart: number, numberOfRows: number): Thenable<azdata.QueryExecuteSubsetResult> {
		let rowEnd = rowStart + numberOfRows;
		if (rowEnd > this.rows.length) {
			rowEnd = this.rows.length;
		}
		let resultSubset: azdata.QueryExecuteSubsetResult = {
			message: undefined,
			resultSubset: {
				rowCount: rowEnd - rowStart,
				rows: this.rows.slice(rowStart, rowEnd)
			}
		};
		return Promise.resolve(resultSubset);
	}

	copyResults(selection: Slick.Range[], includeHeaders?: boolean): void {
		this.copyResultsAsync(selection, includeHeaders);
	}

	private async copyResultsAsync(selection: Slick.Range[], includeHeaders?: boolean): Promise<void> {
		try {
			let results = await getResultsString(this, selection, includeHeaders);
			this._clipboardService.writeText(results);
		} catch (error) {
			this._notificationService.error(localize('copyFailed', "Copy failed with error {0}", getErrorMessage(error)));
		}
	}

	getEolString(): string {
		return getEolString(this._textResourcePropertiesService, this.documentUri);
	}
	shouldIncludeHeaders(includeHeaders: boolean): boolean {
		return shouldIncludeHeaders(includeHeaders, this._configurationService);
	}
	shouldRemoveNewLines(): boolean {
		return shouldRemoveNewLines(this._configurationService);
	}

	getColumnHeaders(range: Slick.Range): string[] {
		let headers: string[] = this.resultSet.columnInfo.slice(range.fromCell, range.toCell + 1).map((info, i) => {
			return info.columnName;
		});
		return headers;
	}

	get canSerialize(): boolean {
		return false;
	}

	serializeResults(format: SaveFormat, selection: Slick.Range[]): Thenable<void> {
		throw new Error('Method not implemented.');
	}
}

function createResultSet(source: IDataResource): azdata.ResultSetSummary {
	let columnInfo: azdata.IDbColumn[] = source.schema.fields.map(field => {
		let column = new SimpleDbColumn(field.name);
		if (field.type) {
			switch (field.type) {
				case 'xml':
					column.isXml = true;
					break;
				case 'json':
					column.isJson = true;
					break;
				default:
					// Only handling a few cases for now
					break;
			}
		}
		return column;
	});
	let summary: azdata.ResultSetSummary = {
		batchId: 0,
		id: 0,
		complete: true,
		rowCount: source.data.length,
		columnInfo: columnInfo
	};
	return summary;
}

class SimpleDbColumn implements azdata.IDbColumn {

	constructor(columnName: string) {
		this.columnName = columnName;
	}
	allowDBNull?: boolean;
	baseCatalogName: string;
	baseColumnName: string;
	baseSchemaName: string;
	baseServerName: string;
	baseTableName: string;
	columnName: string;
	columnOrdinal?: number;
	columnSize?: number;
	isAliased?: boolean;
	isAutoIncrement?: boolean;
	isExpression?: boolean;
	isHidden?: boolean;
	isIdentity?: boolean;
	isKey?: boolean;
	isBytes?: boolean;
	isChars?: boolean;
	isSqlVariant?: boolean;
	isUdt?: boolean;
	dataType: string;
	isXml?: boolean;
	isJson?: boolean;
	isLong?: boolean;
	isReadOnly?: boolean;
	isUnique?: boolean;
	numericPrecision?: number;
	numericScale?: number;
	udtAssemblyQualifiedName: string;
	dataTypeName: string;
}
