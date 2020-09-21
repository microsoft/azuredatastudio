/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Component, Input, Inject, ViewChild, ElementRef } from '@angular/core';
import * as azdata from 'azdata';

import { IGridDataProvider, getResultsString } from 'sql/workbench/services/query/common/gridDataProvider';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IDataResource, MaxTableRowsConfigName, NotebookConfigSectionName, IDataResourceSchema, IDataResourceFields, MAX_ROWS } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import QueryRunner, { getEolString, shouldIncludeHeaders, shouldRemoveNewLines } from 'sql/workbench/services/query/common/queryRunner';
import { ResultSetSummary, ResultSetSubset, ICellValue, BatchSummary } from 'sql/workbench/services/query/common/query';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { localize } from 'vs/nls';
import { IAction } from 'vs/base/common/actions';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IMimeComponent } from 'sql/workbench/contrib/notebook/browser/outputs/mimeRegistry';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { MimeModel } from 'sql/workbench/services/notebook/browser/outputs/mimemodel';
import { GridTableState } from 'sql/workbench/common/editor/query/gridTableState';
import { GridTableBase } from 'sql/workbench/contrib/query/browser/gridPanel';
import { getErrorMessage } from 'vs/base/common/errors';
import { ISerializationService, SerializeDataParams } from 'sql/platform/serialization/common/serializationService';
import { SaveResultAction, IGridActionContext } from 'sql/workbench/contrib/query/browser/actions';
import { SaveFormat, ResultSerializer, SaveResultsResponse } from 'sql/workbench/services/query/common/resultSerializer';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { ChartView } from 'sql/workbench/contrib/charts/browser/chartView';
import { ToggleableAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { IInsightOptions } from 'sql/workbench/common/editor/query/chartState';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { values } from 'vs/base/common/collections';
import { URI } from 'vs/base/common/uri';
import { assign } from 'vs/base/common/objects';
import { escape } from 'sql/base/common/strings';

@Component({
	selector: GridOutputComponent.SELECTOR,
	template: `<div #output class="notebook-cellTable"></div>`
})
export class GridOutputComponent extends AngularDisposable implements IMimeComponent, OnInit {
	public static readonly SELECTOR: string = 'grid-output';

	@ViewChild('output', { read: ElementRef }) private output: ElementRef;

	private _initialized: boolean = false;
	private _cellModel: ICellModel;
	private _cellOutput: azdata.nb.ICellOutput;
	private _bundleOptions: MimeModel.IOptions;
	private _table: DataResourceTable;
	private _batchId: number;
	private _id: number;
	private _queryRunnerUri: string;
	private _queryRunner: QueryRunner;
	private _configuredMaxRows: number = MAX_ROWS;

	constructor(
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IThemeService) private readonly themeService: IThemeService,
		@Inject(IConfigurationService) private configurationService: IConfigurationService,
		@Inject(IQueryManagementService) private queryManagementService: IQueryManagementService
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

	get cellOutput(): azdata.nb.ICellOutput {
		return this._cellOutput;
	}

	@Input() set cellOutput(value: azdata.nb.ICellOutput) {
		this._cellOutput = value;
	}

	@Input() set batchId(value: number) {
		this._batchId = value;
	}

	@Input() set id(value: number) {
		this._id = value;
	}

	@Input() set queryRunnerUri(value: string) {
		this._queryRunnerUri = value;
	}

	ngOnInit() {
		let config = this.configurationService.getValue(NotebookConfigSectionName);
		if (config) {
			let maxRows = config[MaxTableRowsConfigName] ? config[MaxTableRowsConfigName] : undefined;
			if (maxRows && maxRows > 0) {
				this._configuredMaxRows = maxRows;
			}
		}
		// When a saved notebook is opened, there is no query runner
		this._queryRunner = this.queryManagementService.getRunner(this._queryRunnerUri);
		this.renderGrid();
	}

	renderGrid(): void {
		if (!this._bundleOptions || !this._cellModel || !this.mimeType) {
			return;
		}
		if (!this._table) {
			let source = <IDataResource><any>this._bundleOptions.data[this.mimeType];
			let state = new GridTableState(0, 0);
			this._table = this.instantiationService.createInstance(DataResourceTable, this._batchId, this._id, this._queryRunner, source, this.cellModel, this.cellOutput, state);
			let outputElement = <HTMLElement>this.output.nativeElement;
			outputElement.appendChild(this._table.element);
			this._register(attachTableStyler(this._table, this.themeService));
			this._table.onDidInsert();
			this.layout();
			if (this._queryRunner) {
				this._register(this._queryRunner.onResultSetUpdate(resultSet => { this.updateResultSet(resultSet); }));
				this._register(this._queryRunner.onBatchEnd(batch => { this.convertData(batch); }));
			}
			this._initialized = true;
		}
	}

	updateResultSet(resultSet: ResultSetSummary | ResultSetSummary[]): void {
		let resultsToUpdate: ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToUpdate = [resultSet];
		} else {
			resultsToUpdate = resultSet?.splice(0);
		}
		for (let set of resultsToUpdate) {
			if (this._batchId === set.batchId && this._id === set.id) {
				set.rowCount = set.rowCount > this._configuredMaxRows ? this._configuredMaxRows : set.rowCount;
				this._table.updateResult(set);
				this.layout();
			}
		}
	}

	convertData(batch: BatchSummary): void {
		for (let set of batch.resultSetSummaries) {
			if (set.batchId === this._batchId && set.id === this._id) {
				set.rowCount = set.rowCount > this._configuredMaxRows ? this._configuredMaxRows : set.rowCount;
				this._cellModel.addGridDataConversionPromise(this._table.convertData(set));
			}
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

	private _gridDataProvider: DataResourceDataProvider;
	private _chart: ChartView;
	private _chartContainer: HTMLElement;
	private _batchId: number;
	private _id: number;
	private _queryRunner: QueryRunner;

	constructor(batchId: number,
		id: number,
		queryRunner: QueryRunner,
		source: IDataResource,
		private cellModel: ICellModel,
		private cellOutput: azdata.nb.ICellOutput,
		state: GridTableState,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService protected instantiationService: IInstantiationService,
		@IEditorService editorService: IEditorService,
		@IUntitledTextEditorService untitledEditorService: IUntitledTextEditorService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(state, createResultSet(source), { actionOrientation: ActionsOrientation.HORIZONTAL }, contextMenuService, instantiationService, editorService, untitledEditorService, configurationService);
		this._batchId = batchId;
		this._id = id;
		this._queryRunner = queryRunner;
		this._gridDataProvider = this.instantiationService.createInstance(DataResourceDataProvider, this._batchId, this._id, this._queryRunner, source, this.resultSet, this.cellModel);
		this._chart = this.instantiationService.createInstance(ChartView, false);

		if (!this.cellOutput.metadata) {
			this.cellOutput.metadata = {};
		} else if (this.cellOutput.metadata.azdata_chartOptions) {
			this._chart.options = this.cellOutput.metadata.azdata_chartOptions as IInsightOptions;
			this.updateChartData(this.resultSet.rowCount, this.resultSet.columnInfo.length, this.gridDataProvider);
		}
		this._chart.onOptionsChange(options => {
			this.setChartOptions(options);
		});
	}

	public get gridDataProvider(): IGridDataProvider {
		return this._gridDataProvider;
	}

	public get chartDisplayed(): boolean {
		return this.cellOutput.metadata.azdata_chartOptions !== undefined;
	}

	protected getCurrentActions(): IAction[] {
		return this.getContextActions();
	}

	protected getContextActions(): IAction[] {
		return [
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveResultAction.SAVEXML_ICON, SaveFormat.XML),
			this.instantiationService.createInstance(NotebookChartAction, this)
		];
	}

	public get maximumSize(): number {
		// Overriding action bar size calculation for now.
		// When we add this back in, we should update this calculation
		return Math.max(this.maxSize, /* ACTIONBAR_HEIGHT + BOTTOM_PADDING */ 0);
	}

	public layout(size?: number): void {
		super.layout(size);

		if (!this._chartContainer) {
			this._chartContainer = document.createElement('div');
			this._chartContainer.style.width = '100%';

			if (this.cellOutput.metadata.azdata_chartOptions) {
				this.tableContainer.style.display = 'none';
				this._chartContainer.style.display = 'inline-block';
			} else {
				this._chartContainer.style.display = 'none';
			}

			this.element.appendChild(this._chartContainer);
			this._chart.render(this._chartContainer);
		}
	}

	public toggleChartVisibility(): void {
		if (this.tableContainer.style.display !== 'none') {
			this.tableContainer.style.display = 'none';
			this._chartContainer.style.display = 'inline-block';
			this.setChartOptions(this._chart.options);
		} else {
			this._chartContainer.style.display = 'none';
			this.tableContainer.style.display = 'inline-block';
			this.setChartOptions(undefined);
		}
		this.layout();
	}

	public updateChartData(rowCount: number, columnCount: number, gridDataProvider: IGridDataProvider): void {
		gridDataProvider.getRowData(0, rowCount).then(result => {
			let range = new Slick.Range(0, 0, rowCount - 1, columnCount - 1);
			let columns = gridDataProvider.getColumnHeaders(range);
			this._chart.setData(result.rows, columns);
		});
	}

	private setChartOptions(options: IInsightOptions | undefined) {
		this.cellOutput.metadata.azdata_chartOptions = options;
		this.cellModel.sendChangeToNotebook(NotebookChangeType.CellMetadataUpdated);
	}

	public convertData(set: ResultSetSummary): Promise<void> {
		return this._gridDataProvider.convertAllData(set);
	}

	public updateResult(resultSet: ResultSetSummary): void {
		super.updateResult(resultSet);
		this._gridDataProvider.updateResultSet(resultSet);
	}
}

export class DataResourceDataProvider implements IGridDataProvider {
	private _rows: ICellValue[][];
	private _documentUri: string;
	private _queryRunner: QueryRunner;
	private _batchId: number;
	private _id: number;
	private _resultSet: ResultSetSummary;
	private _data: any;
	constructor(
		batchId: number,
		id: number,
		queryRunner: QueryRunner,
		source: IDataResource,
		resultSet: ResultSetSummary,
		private cellModel: ICellModel,
		@INotificationService private _notificationService: INotificationService,
		@IClipboardService private _clipboardService: IClipboardService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ITextResourcePropertiesService private _textResourcePropertiesService: ITextResourcePropertiesService,
		@ISerializationService private _serializationService: ISerializationService,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
		this._documentUri = this.cellModel.notebookModel.notebookUri.toString();
		this._queryRunner = queryRunner;
		this._batchId = batchId;
		this._id = id;
		this._resultSet = resultSet;
		this.initializeData();
		this.transformSource(source);
	}

	private initializeData(): void {
		// Set up data resource
		let columnsResources: IDataResourceSchema[] = [];
		this._resultSet.columnInfo.forEach(column => {
			columnsResources.push({ name: escape(column.columnName) });
		});
		let columnsFields: IDataResourceFields = { fields: columnsResources };
		let dataResource = {
			schema: columnsFields,
			data: []
		};
		// Set up html table string
		let htmlTable: string[] = new Array(3);
		htmlTable[0] = '<table>';
		let columnHeaders = '<tr>';
		for (let column of this._resultSet.columnInfo) {
			columnHeaders += `<th>${escape(column.columnName)}</th>`;
		}
		columnHeaders += '</tr>';
		htmlTable[1] = columnHeaders;
		htmlTable[2] = '</table>';

		this._data = {
			'application/vnd.dataresource+json': dataResource,
			'text/html': htmlTable
		};
	}

	private transformSource(source: IDataResource): void {
		this._rows = source.data.map(row => {
			let rowData: azdata.DbCellValue[] = [];
			Object.keys(row).forEach((val, index) => {
				let displayValue = String(values(row)[index]);
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

	public updateResultSet(resultSet: ResultSetSummary): void {
		this._resultSet = resultSet;
	}

	public async convertAllData(result: ResultSetSummary): Promise<void> {
		// Querying 100 rows at a time. Querying large amount of rows will be slow and
		// affect table rendering since each time the user scrolls, getRowData is called.
		let numRows = 100;
		for (let i = 0; i < result.rowCount; i += 100) {
			if (i + 100 > result.rowCount) {
				numRows += result.rowCount - i;
			}
			let rows = await this._queryRunner.getQueryRows(i, numRows, this._batchId, this._id);
			this.convertData(rows);
		}
		this.cellModel.sendChangeToNotebook(NotebookChangeType.CellOutputUpdated);
	}

	private convertData(rows: ResultSetSubset): void {
		let dataResourceRows = this.convertRowsToDataResource(rows);
		let htmlStringArr = this.convertRowsToHtml(rows);
		this._data['application/vnd.dataresource+json'].data = this._data['application/vnd.dataresource+json'].data.concat(dataResourceRows);
		this._data['text/html'].splice(this._data['text/html'].length - 1, 0, ...htmlStringArr);
		this.cellModel.updateOutputData(this._batchId, this._id, this._data);
	}

	getRowData(rowStart: number, numberOfRows: number): Thenable<ResultSetSubset> {
		if (this._queryRunner) {
			return this._queryRunner.getQueryRows(rowStart, numberOfRows, this._batchId, this._id);
		} else {
			let rowEnd = rowStart + numberOfRows;
			if (rowEnd > this._rows.length) {
				rowEnd = this._rows.length;
			}
			let resultSubset: ResultSetSubset = {
				rowCount: rowEnd - rowStart,
				rows: this._rows.slice(rowStart, rowEnd)
			};
			return Promise.resolve(resultSubset);
		}
	}

	async copyResults(selection: Slick.Range[], includeHeaders?: boolean): Promise<void> {
		return this.copyResultsAsync(selection, includeHeaders);
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
		return getEolString(this._textResourcePropertiesService, this._documentUri);
	}
	shouldIncludeHeaders(includeHeaders: boolean): boolean {
		return shouldIncludeHeaders(includeHeaders, this._configurationService);
	}
	shouldRemoveNewLines(): boolean {
		return shouldRemoveNewLines(this._configurationService);
	}

	getColumnHeaders(range: Slick.Range): string[] {
		let headers: string[] = this._resultSet.columnInfo.slice(range.fromCell, range.toCell + 1).map((info, i) => {
			return info.columnName;
		});
		return headers;
	}

	get canSerialize(): boolean {
		return this._serializationService.hasProvider();
	}

	serializeResults(format: SaveFormat, selection: Slick.Range[]): Thenable<void> {
		if (this._queryRunner) {
			selection = selection ? selection : [new Slick.Range(0, 0, this._resultSet.rowCount - 1, this._resultSet.columnInfo.length - 1)];
			return this._queryRunner.serializeResults(this._batchId, this._id, format, selection);
		} else {
			let serializer = this._instantiationService.createInstance(ResultSerializer);
			return serializer.handleSerialization(this._documentUri, format, (filePath) => this.doSerialize(serializer, filePath, format, selection));
		}
	}

	private doSerialize(serializer: ResultSerializer, filePath: URI, format: SaveFormat, selection: Slick.Range[]): Promise<SaveResultsResponse | undefined> {
		if (!this.canSerialize) {
			return Promise.resolve(undefined);
		}
		// TODO implement selection support
		let columns = this._resultSet.columnInfo;
		let rowLength = this._rows.length;
		let minRow = 0;
		let maxRow = this._rows.length;
		let singleSelection = selection && selection.length > 0 ? selection[0] : undefined;
		if (singleSelection && this.isSelected(singleSelection)) {
			rowLength = singleSelection.toRow - singleSelection.fromRow + 1;
			minRow = singleSelection.fromRow;
			maxRow = singleSelection.toRow + 1;
			columns = columns.slice(singleSelection.fromCell, singleSelection.toCell + 1);
		}
		let getRows: ((index: number, includeHeaders: boolean, rowCount: number) => ICellValue[][]) = (index, includeHeaders, rowCount) => {
			// Offset for selections by adding the selection startRow to the index
			index = index + minRow;
			if (rowLength === 0 || index < 0 || index >= maxRow) {
				return [];
			}
			let endIndex = index + rowCount;
			if (endIndex > maxRow) {
				endIndex = maxRow;
			}
			let result: ICellValue[][] = [];
			if (includeHeaders) {
				result.push(columns.map(col => {
					let headerData: azdata.DbCellValue;
					headerData = {
						displayValue: col.columnName,
						isNull: false,
						invariantCultureDisplayValue: col.columnName
					};
					return headerData;
				}));
			}
			result = result.concat(this._rows.slice(index, endIndex).map(row => {
				if (this.isSelected(singleSelection)) {
					return row.slice(singleSelection.fromCell, singleSelection.toCell + 1);
				} else {
					return row;
				}
			}));
			return result;
		};

		let serializeRequestParams: SerializeDataParams = <SerializeDataParams>assign(serializer.getBasicSaveParameters(format), <Partial<SerializeDataParams>>{
			saveFormat: format,
			columns: columns,
			filePath: filePath.fsPath,
			getRowRange: (rowStart, includeHeaders, numberOfRows) => getRows(rowStart, includeHeaders, numberOfRows),
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

	private convertRowsToDataResource(subset: ResultSetSubset): any[] {
		return subset.rows.map(row => {
			let rowObject: { [key: string]: any; } = {};
			row.forEach((val, index) => {
				rowObject[index] = val.displayValue;
			});
			return rowObject;
		});
	}

	private convertRowsToHtml(subset: ResultSetSubset): string[] {
		let htmlStringArr = [];
		for (const row of subset.rows) {
			let rowData = '<tr>';
			for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
				rowData += `<td>${escape(row[columnIndex].displayValue)}</td>`;
			}
			rowData += '</tr>';
			htmlStringArr.push(rowData);
		}
		return htmlStringArr;
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

export class NotebookChartAction extends ToggleableAction {
	public static ID = 'notebook.showChart';
	public static SHOWCHART_LABEL = localize('notebook.showChart', "Show chart");
	public static SHOWCHART_ICON = 'viewChart';

	public static SHOWTABLE_LABEL = localize('notebook.showTable', "Show table");
	public static SHOWTABLE_ICON = 'table';

	constructor(private resourceTable: DataResourceTable) {
		super(NotebookChartAction.ID, {
			toggleOnLabel: NotebookChartAction.SHOWTABLE_LABEL,
			toggleOnClass: NotebookChartAction.SHOWTABLE_ICON,
			toggleOffLabel: NotebookChartAction.SHOWCHART_LABEL,
			toggleOffClass: NotebookChartAction.SHOWCHART_ICON,
			isOn: resourceTable.chartDisplayed
		});
	}

	public async run(context: IGridActionContext): Promise<boolean> {
		this.resourceTable.toggleChartVisibility();
		this.toggle(!this.state.isOn);
		if (this.state.isOn) {
			let rowCount = context.table.getData().getLength();
			let columnCount = context.table.columns.length;
			this.resourceTable.updateChartData(rowCount, columnCount, context.gridDataProvider);
		}
		return true;
	}
}
