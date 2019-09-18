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
import { IDataResource } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
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
import { ICellModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { MimeModel } from 'sql/workbench/parts/notebook/browser/models/mimemodel';
import { GridTableState } from 'sql/workbench/parts/query/common/gridPanelState';
import { GridTableBase } from 'sql/workbench/parts/query/browser/gridPanel';
import { getErrorMessage } from 'vs/base/common/errors';
import { ISerializationService, SerializeDataParams } from 'sql/platform/serialization/common/serializationService';
import { SaveResultAction } from 'sql/workbench/parts/query/browser/actions';
import { ResultSerializer, SaveResultsResponse } from 'sql/workbench/parts/query/common/resultSerializer';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';

@Component({
	selector: GridOutputComponent.SELECTOR,
	template: `<div #output class="notebook-cellTable" (mouseover)="hover=true" (mouseleave)="hover=false"></div>`
})
export class GridOutputComponent extends AngularDisposable implements IMimeComponent, OnInit {
	public static readonly SELECTOR: string = 'grid-output';

	@ViewChild('output', { read: ElementRef }) private output: ElementRef;

	private _initialized: boolean = false;
	private _cellModel: ICellModel;
	private _bundleOptions: MimeModel.IOptions;
	private _table: DataResourceTable;
	private _hover: boolean;
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

	@Input() set hover(value: boolean) {
		// only reaction on hover changes
		if (this._hover !== value) {
			this.toggleActionbar(value);
			this._hover = value;
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
			// By default, do not show the actions
			this.toggleActionbar(false);
			this._table.onAdd();
			this._initialized = true;
		}
	}

	layout(): void {
		if (this._table) {
			let maxSize = Math.min(this._table.maximumSize, 500);
			this._table.layout(maxSize, undefined, ActionsOrientation.HORIZONTAL);
		}
	}

	private toggleActionbar(visible: boolean) {
		let outputElement = <HTMLElement>this.output.nativeElement;
		let actionsContainers: HTMLElement[] = Array.prototype.slice.call(outputElement.getElementsByClassName('actions-container'));
		if (actionsContainers && actionsContainers.length) {
			if (visible) {
				actionsContainers.forEach(container => container.style.visibility = 'visible');
			} else {
				actionsContainers.forEach(container => container.style.visibility = 'hidden');
			}
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
		@IConfigurationService configurationService: IConfigurationService,
		@ISerializationService private _serializationService: ISerializationService
	) {
		super(state, createResultSet(source), contextMenuService, instantiationService, editorService, untitledEditorService, configurationService);
		this._gridDataProvider = this.instantiationService.createInstance(DataResourceDataProvider, source, this.resultSet, documentUri);
	}

	get gridDataProvider(): IGridDataProvider {
		return this._gridDataProvider;
	}

	protected getCurrentActions(): IAction[] {
		return this.getContextActions();
	}

	protected getContextActions(): IAction[] {
		if (!this._serializationService.hasProvider()) {
			return [];
		}
		return [
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveResultAction.SAVEXML_ICON, SaveFormat.XML),
		];
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
		@ITextResourcePropertiesService private _textResourcePropertiesService: ITextResourcePropertiesService,
		@ISerializationService private _serializationService: ISerializationService,
		@IInstantiationService private _instantiationService: IInstantiationService
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
		return this._serializationService.hasProvider();
	}


	serializeResults(format: SaveFormat, selection: Slick.Range[]): Thenable<void> {
		let serializer = this._instantiationService.createInstance(ResultSerializer);
		return serializer.handleSerialization(this.documentUri, format, (filePath) => this.doSerialize(serializer, filePath, format, selection));
	}

	private doSerialize(serializer: ResultSerializer, filePath: string, format: SaveFormat, selection: Slick.Range[]): Promise<SaveResultsResponse | undefined> {
		// TODO implement selection support
		let columns = this.resultSet.columnInfo;
		let rowLength = this.rows.length;
		let minRow = 0;
		let maxRow = this.rows.length;
		let singleSelection = selection && selection.length > 0 ? selection[0] : undefined;
		if (singleSelection && this.isSelected(singleSelection)) {
			rowLength = singleSelection.toRow - singleSelection.fromRow + 1;
			minRow = singleSelection.fromRow;
			maxRow = singleSelection.toRow + 1;
			columns = columns.slice(singleSelection.fromCell, singleSelection.toCell + 1);
		}
		let getRows: ((index: number, rowCount: number) => azdata.DbCellValue[][]) = (index, rowCount) => {
			// Offset for selections by adding the selection startRow to the index
			index = index + minRow;
			if (rowLength === 0 || index < 0 || index >= maxRow) {
				return [];
			}
			let endIndex = index + rowCount;
			if (endIndex > maxRow) {
				endIndex = maxRow;
			}
			let result = this.rows.slice(index, endIndex).map(row => {
				if (this.isSelected(singleSelection)) {
					return row.slice(singleSelection.fromCell, singleSelection.toCell + 1);
				}
				return row;
			});
			return result;
		};

		let serializeRequestParams: SerializeDataParams = <SerializeDataParams>Object.assign(serializer.getBasicSaveParameters(format), <Partial<SerializeDataParams>>{
			saveFormat: format,
			columns: columns,
			filePath: filePath,
			getRowRange: (rowStart, numberOfRows) => getRows(rowStart, numberOfRows),
			rowCount: rowLength
		});
		return this._serializationService.serializeResults(serializeRequestParams);
	}

	/**
	 * Check if a range of cells were selected.
	 */
	private isSelected(selection: Slick.Range): boolean {
		return (selection && !((selection.fromCell === selection.toCell) && (selection.fromRow === selection.toRow)));
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
