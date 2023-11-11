/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnInit, Component, Input, Inject, ViewChild, ElementRef, ChangeDetectorRef, forwardRef } from '@angular/core';
import * as azdata from 'azdata';

import { IGridDataProvider, copySelectionToClipboard, getTableHeaderString } from 'sql/workbench/services/query/common/gridDataProvider';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IDataResource, rowHasColumnNameKeys } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
import { getEolString, shouldSkipNewLineAfterTrailingLineBreak, shouldIncludeHeaders, shouldRemoveNewLines } from 'sql/workbench/services/query/common/queryRunner';
import { ResultSetSummary, ResultSetSubset, ICellValue } from 'sql/workbench/services/query/common/query';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { IAction } from 'vs/base/common/actions';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { IMimeComponent } from 'sql/workbench/contrib/notebook/browser/outputs/mimeRegistry';
import { CellExecutionState, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { MimeModel } from 'sql/workbench/services/notebook/browser/outputs/mimemodel';
import { GridTableState } from 'sql/workbench/common/editor/query/gridTableState';
import { GridTableBase } from 'sql/workbench/contrib/query/browser/gridPanel';
import { getErrorMessage, onUnexpectedError } from 'vs/base/common/errors';
import { ISerializationService, SerializeDataParams } from 'sql/platform/serialization/common/serializationService';
import { IGridActionContext } from 'sql/workbench/contrib/query/browser/actions';
import { SaveFormat, ResultSerializer, SaveResultsResponse } from 'sql/workbench/services/query/common/resultSerializer';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { ChartView } from 'sql/workbench/contrib/charts/browser/chartView';
import { ToggleableAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { IInsightOptions } from 'sql/workbench/common/editor/query/chartState';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { URI } from 'vs/base/common/uri';
import { QueryResultId } from 'sql/workbench/services/notebook/browser/models/cell';
import { equals } from 'vs/base/common/arrays';
import { IDisposableDataProvider } from 'sql/base/common/dataProvider';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { getChartMaxRowCount, notifyMaxRowCountExceeded } from 'sql/workbench/contrib/charts/browser/utils';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { IComponentContextService } from 'sql/workbench/services/componentContext/browser/componentContextService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILogService } from 'vs/platform/log/common/log';

@Component({
	selector: GridOutputComponent.SELECTOR,
	template: `
	<loading-spinner [loading]="loading"></loading-spinner>
	<div #output class="notebook-cellTable"></div>`
})
export class GridOutputComponent extends AngularDisposable implements IMimeComponent, OnInit {
	public static readonly SELECTOR: string = 'grid-output';

	@ViewChild('output', { read: ElementRef }) private output: ElementRef;

	private _initialized: boolean = false;
	private _cellModel: ICellModel;
	private _cellOutput: azdata.nb.ICellOutput;
	private _bundleOptions: MimeModel.IOptions;
	private _table: DataResourceTable;
	private _batchId: number | undefined;
	private _id: number | undefined;
	private _layoutCalledOnce: boolean = false;
	private _incrementalGridRenderingEnabled: boolean;
	private _isLoading: boolean = false;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IConfigurationService) private configurationService: IConfigurationService
	) {
		super();
		this._incrementalGridRenderingEnabled = this.configurationService.getValue('notebook.enableIncrementalGridRendering');
	}

	@Input() set bundleOptions(value: MimeModel.IOptions) {
		this._bundleOptions = value;
		if (this._initialized) {
			this.renderGrid().catch(onUnexpectedError);
		}
	}

	@Input() mimeType: string;

	get cellModel(): ICellModel {
		return this._cellModel;
	}

	@Input() set cellModel(value: ICellModel) {
		this._cellModel = value;
		if (this._initialized) {
			this.renderGrid().catch(onUnexpectedError);
		}
	}

	get cellOutput(): azdata.nb.ICellOutput {
		return this._cellOutput;
	}

	@Input() set cellOutput(value: azdata.nb.ICellOutput) {
		this._cellOutput = value;
	}

	get loading(): boolean {
		return this._isLoading;
	}

	@Input() set loading(isLoading: boolean) {
		this._isLoading = isLoading;
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	async ngOnInit() {
		if (this.cellModel) {
			let outputId: QueryResultId = this.cellModel.getOutputId(this._cellOutput);
			if (outputId) {
				this._batchId = outputId.batchId;
				this._id = outputId.id;
			}
			this._register(this.cellModel.onTableUpdated(e => {
				if (e.resultSet.batchId === this._batchId && e.resultSet.id === this._id) {
					this.updateResult(e.resultSet, e.rows);
				}
			}));
			if (this._cellModel.executionState === CellExecutionState.Running || !this._incrementalGridRenderingEnabled) {
				await this.renderGrid();
			} else {
				this.loading = true;
				// setTimeout adds the renderGrid call to a queue that gets called after all current tasks get executed -
				// this allows the rest of the notebook to render first before rendering grids incrementally.
				setTimeout(async () => {
					await this.renderGrid();
					this.loading = false;
				});
			}
		}
	}


	async renderGrid(): Promise<void> {
		if (!this._bundleOptions || !this._cellModel || !this.mimeType) {
			return;
		}
		if (!this._table) {
			let source = <IDataResource><any>this._bundleOptions.data[this.mimeType];
			reorderGridData(source);
			let state = new GridTableState(0, 0);
			this._table = this.instantiationService.createInstance(DataResourceTable, source, this.cellModel, this.cellOutput, state);
			let outputElement = <HTMLElement>this.output.nativeElement;
			outputElement.appendChild(this._table.element);
			await this._table.onDidInsert();
			this.layout();
			this._initialized = true;
		}
	}

	layout(): void {
		if (this._table) {
			let maxSize = Math.min(this._table.maximumSize, 500);
			this._table.layout(maxSize);
		}
	}

	updateResult(resultSet: ResultSetSummary, rows: ICellValue[][]): void {
		this._table.updateResultSet(resultSet, rows);
		if (!this._layoutCalledOnce) {
			this.layout();
			this._layoutCalledOnce = true;
		}
	}
}

function reorderGridData(source: IDataResource): void {
	// Get Column Names list from the data resource schema
	const columnNames: string[] = source.schema.fields.map(field => field.name);
	// Check to see if data source is ordered properly based on schema
	// Papermill executed notebooks with KQL for instance will organize the
	// row data in alphabetical order as a result the outputted grid will be
	// unordered and not based on the data resource schema
	if (source.data.length > 0) {
		let rowKeys = Object.keys(source.data[0]);
		if (!equals(columnNames, rowKeys)) {
			// Older SQL notebooks use indices as keys instead of the column name.
			// Indicies indicate the row is ordered properly
			// We must check the data to know if it is in index form
			let notIndexOrderKeys = false;
			for (let index = 0; index < rowKeys.length - 1; index++) {
				// Index form (all numbers, start at 0 and increase by 1)
				let value = Number(rowKeys[index]);
				if (isNaN(value) || value !== index) {
					// break if key is not a number or in index form
					notIndexOrderKeys = true;
					break;
				}
			}
			// Only reorder data that is not in index form
			if (notIndexOrderKeys) {
				source.data.forEach((row, index) => {
					// Order each row based on the schema
					let reorderedData = {};
					for (let key of columnNames) {
						reorderedData[key] = row[key];
					}
					source.data[index] = reorderedData;
				});
			}
		}
	}
}

class DataResourceTable extends GridTableBase<any> {

	private _gridDataProvider: DataResourceDataProvider;
	private _chart: ChartView;
	private _chartContainer: HTMLElement;

	constructor(
		source: IDataResource,
		private cellModel: ICellModel,
		private cellOutput: azdata.nb.ICellOutput,
		state: GridTableState,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IEditorService editorService: IEditorService,
		@IUntitledTextEditorService untitledEditorService: IUntitledTextEditorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IContextViewService contextViewService: IContextViewService,
		@INotificationService notificationService: INotificationService,
		@IExecutionPlanService executionPlanService: IExecutionPlanService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
		@IQuickInputService quickInputService: IQuickInputService,
		@IComponentContextService componentContextService: IComponentContextService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService
	) {
		super(state, createResultSet(source), {
			actionOrientation: ActionsOrientation.HORIZONTAL,
			inMemoryDataProcessing: true
		}, contextMenuService, instantiationService, editorService, untitledEditorService, configurationService, queryModelService, contextViewService, notificationService, executionPlanService, accessibilityService, quickInputService, componentContextService, contextKeyService, logService);
		this._gridDataProvider = this.instantiationService.createInstance(DataResourceDataProvider, source, this.resultSet, this.cellModel);
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
		this.providerId = cellModel.notebookModel.context?.providerName;
	}

	public get gridDataProvider(): IGridDataProvider {
		return this._gridDataProvider;
	}

	public get chartDisplayed(): boolean {
		return this.cellOutput.metadata.azdata_chartOptions !== undefined;
	}

	protected override getActionBarItems(): IAction[] {
		const items = super.getActionBarItems();
		items.push(this.instantiationService.createInstance(NotebookChartAction, this));
		return items;
	}

	protected getContextActions(): IAction[] {
		return [
			this.instantiationService.createInstance(NotebookChartAction, this)
		];
	}

	public override get maximumSize(): number {
		// Overriding action bar size calculation for now.
		// When we add this back in, we should update this calculation
		return Math.max(this.maxSize, /* ACTIONBAR_HEIGHT + BOTTOM_PADDING */ 0);
	}

	public override layout(size?: number): void {
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
		if (this.chartDisplayed) {
			const actualRowCount = Math.min(getChartMaxRowCount(this.configurationService), rowCount);
			gridDataProvider.getRowData(0, actualRowCount).then(result => {
				let range = new Slick.Range(0, 0, actualRowCount - 1, columnCount - 1);
				let columns = gridDataProvider.getColumnHeaders(range);
				this._chart.setData(result.rows, columns);
			});
		}
	}

	private setChartOptions(options: IInsightOptions | undefined) {
		this.cellOutput.metadata.azdata_chartOptions = options;
		this.cellModel.sendChangeToNotebook(NotebookChangeType.CellMetadataUpdated);
	}

	public updateResultSet(resultSet: ResultSetSummary, rows: ICellValue[][]): void {
		this._gridDataProvider.updateResultSet(resultSet, rows);
		super.updateResult(resultSet);
		this.updateChartData(resultSet?.rowCount, resultSet?.columnInfo?.length, this._gridDataProvider);
	}
}

export class DataResourceDataProvider implements IGridDataProvider {
	private _rows: ICellValue[][];
	private _documentUri: string;
	private _resultSet: ResultSetSummary;
	constructor(
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
		this._resultSet = resultSet;
		this.transformSource(source);
	}

	private transformSource(source: IDataResource): void {
		if (source.data.length > 0) {
			let columns = source.schema.fields;
			// Rows are either indexed by column name or ordinal number, so check for one column name to see if it uses that format
			let useColumnNameKey = rowHasColumnNameKeys(source.data[0], source.schema.fields.map(field => field.name));
			this._rows = source.data.map(row => {
				let rowData: azdata.DbCellValue[] = [];
				for (let index = 0; index < Object.keys(row).length; index++) {
					let key = useColumnNameKey ? columns[index].name : index;
					let displayValue = String(row[key]);
					// Since the columns[0] represents the row number, start at 1
					rowData.push({
						displayValue: displayValue,
						isNull: false,
						invariantCultureDisplayValue: displayValue
					});
				}
				return rowData;
			});
		} else {
			this._rows = [];
		}
	}

	public updateResultSet(resultSet: ResultSetSummary, rows: ICellValue[][]): void {
		this._resultSet = resultSet;
		this._rows = this._rows.concat(rows);
	}

	getRowData(rowStart: number, numberOfRows: number): Thenable<ResultSetSubset> {
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

	async copyResults(selection: Slick.Range[], includeHeaders?: boolean, tableView?: IDisposableDataProvider<Slick.SlickData>): Promise<void> {
		return this.copyResultsAsync(selection, includeHeaders, tableView);
	}

	private async copyResultsAsync(selection: Slick.Range[], includeHeaders?: boolean, tableView?: IDisposableDataProvider<Slick.SlickData>): Promise<void> {
		try {
			await copySelectionToClipboard(this._clipboardService, this._notificationService, this._configurationService, this, selection, includeHeaders, tableView);
		} catch (error) {
			this._notificationService.error(localize('copyFailed', "Copy failed with error: {0}", getErrorMessage(error)));
		}
	}

	async copyHeaders(selection: Slick.Range[]): Promise<void> {
		try {
			const results = getTableHeaderString(this, selection);
			await this._clipboardService.writeText(results);
		} catch (error) {
			this._notificationService.error(localize('copyFailed', "Copy failed with error: {0}", getErrorMessage(error)));
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
	shouldSkipNewLineAfterTrailingLineBreak(): boolean {
		return shouldSkipNewLineAfterTrailingLineBreak(this._configurationService);
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
		let serializer = this._instantiationService.createInstance(ResultSerializer);
		return serializer.handleSerialization(this._documentUri, format, (filePath) => this.doSerialize(serializer, filePath, format, selection));
	}

	private doSerialize(serializer: ResultSerializer, filePath: URI, format: SaveFormat, selection: Slick.Range[]): Promise<SaveResultsResponse | undefined> {
		if (!this.canSerialize) {
			return Promise.resolve(undefined);
		}

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

			return [].concat(this._rows.slice(index, endIndex).map(row => {
				if (this.isSelected(singleSelection)) {
					return row.slice(singleSelection.fromCell, singleSelection.toCell + 1);
				} else {
					return row;
				}
			}));
		};

		// This code path uses the serialization service which uses a different request parameter
		// interface than the query execution service's saveResults handlers. Here, we take the
		// format-specific request params (eg, includeHeaders for CSV) and merge the format-agnostic
		// request params for the serialization request (eg, saveFormat, filePath).
		let provider = this.cellModel.notebookModel.context?.providerName;
		if (!provider) {
			// If no connection currently exists, then pick the first connection provider for the current kernel.
			// If there's still no provider, then fallback to the default MSSQL one.
			let connProviders = this.cellModel.notebookModel.getApplicableConnectionProviderIds(this.cellModel.notebookModel.selectedKernelDisplayName);
			if (connProviders?.length > 0) {
				provider = connProviders[0];
			}
		}
		if (!provider || !this._serializationService.isProviderRegistered(provider)) {
			// Serializing notebook query results to file is agnostic of database engine since the data is already available in the notebook.
			// If the provider doesn't have its own serializer we can let the mssql provider handle it.
			provider = mssqlProviderName;
		}
		let formatSpecificParams = serializer.getBasicSaveParameters(format);
		let formatAgnosticParams = <Partial<SerializeDataParams>>{
			serializationProviderId: provider,
			saveFormat: format,
			filePath: filePath.fsPath,
			columns: columns,
			rowCount: rowLength,
			getRowRange: (rowStart: number, includeHeaders: boolean, numberOfRows?: number) =>
				getRows(rowStart, includeHeaders, numberOfRows),
		};
		let serializeRequestParams = <SerializeDataParams>Object.assign(formatSpecificParams, formatAgnosticParams);

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

export class NotebookChartAction extends ToggleableAction {
	public static ID = 'notebook.showChart';
	public static SHOWCHART_LABEL = localize('notebook.showChart', "Show chart");
	public static SHOWCHART_ICON = 'viewChart';

	public static SHOWTABLE_LABEL = localize('notebook.showTable', "Show table");
	public static SHOWTABLE_ICON = 'table';

	constructor(private resourceTable: DataResourceTable,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService,
		@IAdsTelemetryService private readonly adsTelemetryService: IAdsTelemetryService) {
		super(NotebookChartAction.ID, {
			toggleOnLabel: NotebookChartAction.SHOWTABLE_LABEL,
			toggleOnClass: NotebookChartAction.SHOWTABLE_ICON,
			toggleOffLabel: NotebookChartAction.SHOWCHART_LABEL,
			toggleOffClass: NotebookChartAction.SHOWCHART_ICON,
			isOn: resourceTable.chartDisplayed
		});
	}

	public override async run(context: IGridActionContext): Promise<void> {
		this.resourceTable.toggleChartVisibility();
		this.toggle(!this.state.isOn);
		if (this.state.isOn) {
			const rowCount = context.table.getData().getLength();
			const columnCount = context.table.columns.length;
			const maxRowCount = getChartMaxRowCount(this.configurationService);
			const maxRowCountExceeded = rowCount > maxRowCount;
			if (maxRowCountExceeded) {
				notifyMaxRowCountExceeded(this.storageService, this.notificationService, this.configurationService);
			}
			this.adsTelemetryService.createActionEvent(TelemetryKeys.TelemetryView.Notebook, TelemetryKeys.TelemetryAction.ShowChart).withAdditionalProperties(
				{ [TelemetryKeys.TelemetryPropertyName.ChartMaxRowCountExceeded]: maxRowCountExceeded }
			).send();
			this.resourceTable.updateChartData(Math.min(rowCount, maxRowCount), columnCount, context.gridDataProvider);
		}
	}
}
