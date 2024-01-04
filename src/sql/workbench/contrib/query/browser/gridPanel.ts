/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/gridPanel';

import { ITableStyles, ITableMouseEvent, FilterableColumn } from 'sql/base/browser/ui/table/interfaces';
import QueryRunner, { QueryGridDataProvider } from 'sql/workbench/services/query/common/queryRunner';
import { ResultSetSummary, IColumn, ICellValue } from 'sql/workbench/services/query/common/query';
import { VirtualizedCollection } from 'sql/base/browser/ui/table/asyncDataView';
import { Table } from 'sql/base/browser/ui/table/table';
import { MouseWheelSupport } from 'sql/base/browser/ui/table/plugins/mousewheelTableScroll.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { IGridActionContext, SaveResultAction, CopyResultAction, SelectAllGridAction, MaximizeTableAction, RestoreTableAction, ChartDataAction, VisualizerDataAction, CopyHeadersAction } from 'sql/workbench/contrib/query/browser/actions';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';
import { escape } from 'sql/base/common/strings';
import { DBCellValue, getCellDisplayValue, hyperLinkFormatter, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { AdditionalKeyBindings } from 'sql/base/browser/ui/table/plugins/additionalKeyBindings.plugin';

import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { Emitter, Event } from 'vs/base/common/event';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { Disposable, dispose, DisposableStore } from 'vs/base/common/lifecycle';
import { range } from 'vs/base/common/arrays';
import { generateUuid } from 'vs/base/common/uuid';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { isInDOM, Dimension } from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IAction, Separator, toAction } from 'vs/base/common/actions';
import { ILogService } from 'vs/platform/log/common/log';
import { localize } from 'vs/nls';
import { IGridDataProvider } from 'sql/workbench/services/query/common/gridDataProvider';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { GridPanelState, GridTableState } from 'sql/workbench/common/editor/query/gridTableState';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { SaveFormat } from 'sql/workbench/services/query/common/resultSerializer';
import { Progress } from 'vs/platform/progress/common/progress';
import { ScrollableView, IView } from 'sql/base/browser/ui/scrollableView/scrollableView';
import { IQueryEditorConfiguration, IResultGridConfiguration } from 'sql/platform/query/common/query';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { FilterButtonWidth, HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { HybridDataProvider } from 'sql/base/browser/ui/table/hybridDataProvider';
import { INotificationHandle, INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { alert, status } from 'vs/base/browser/ui/aria/aria';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { ExecutionPlanInput } from 'sql/workbench/contrib/executionPlan/browser/executionPlanInput';
import { CopyAction } from 'vs/editor/contrib/clipboard/browser/clipboard';
import { formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/browser/format';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { queryEditorNullBackground } from 'sql/platform/theme/common/colorRegistry';
import { IComponentContextService } from 'sql/workbench/services/componentContext/browser/componentContextService';
import { GridRange } from 'sql/base/common/gridRange';
import { onUnexpectedError } from 'vs/base/common/errors';
import { defaultTableFilterStyles, defaultTableStyles } from 'sql/platform/theme/browser/defaultStyles';

const ROW_HEIGHT = 29;
const HEADER_HEIGHT = 26;
const MIN_GRID_HEIGHT_ROWS = 8;
const ESTIMATED_SCROLL_BAR_HEIGHT = 15;
const BOTTOM_PADDING = 15;
const NO_ACTIONBAR_ADDITIONAL_PADDING = 75;
const ACTIONBAR_WIDTH = 36;

// minimum height needed to show the full actionbar
const ACTIONBAR_HEIGHT = 140;

// this handles min size if rows is greater than the min grid visible rows
const MIN_GRID_HEIGHT = (MIN_GRID_HEIGHT_ROWS * ROW_HEIGHT) + HEADER_HEIGHT + ESTIMATED_SCROLL_BAR_HEIGHT;

// The regex to check whether a string is a valid JSON string. It is used to determine:
// 1. whether the cell should be rendered as a hyperlink.
// 2. when user clicks a cell, whether the cell content should be displayed in a new text editor as json.
// Based on the requirements, the solution doesn't need to be very accurate, a simple regex is enough since it is more
// performant than trying to parse the string to object.
// Regex explaination: after removing the trailing whitespaces and line breaks, the string must start with '[' (to support arrays)
// or '{', and there must be a '}' or ']' to close it.
const IsJsonRegex = /^\s*[\{|\[][\S\s]*[\}\]]\s*$/g;

// The css class for null cell
const NULL_CELL_CSS_CLASS = 'cell-null';

export class GridPanel extends Disposable {
	private container = document.createElement('div');
	private scrollableView: ScrollableView;
	private tables: Array<GridTable<any>> = [];
	private tableDisposable = this._register(new DisposableStore());
	private queryRunnerDisposables = this._register(new DisposableStore());

	private runner: QueryRunner;

	private maximizedGrid: GridTable<any>;
	private _state: GridPanelState | undefined;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		this.scrollableView = new ScrollableView(this.container);
		this.scrollableView.onDidScroll(e => {
			if (this.state && this.scrollableView.length !== 0) {
				this.state.scrollPosition = e.scrollTop;
			}
		});
	}

	public render(container: HTMLElement): void {
		this.container.style.width = '100%';
		this.container.style.height = '100%';

		container.appendChild(this.container);
	}

	public layout(size: Dimension): void {
		this.scrollableView.layout(size.height, size.width);
	}

	public focus(): void {
		// will need to add logic to save the focused grid and focus that
		this.tables[0].focus();
	}

	public set queryRunner(runner: QueryRunner) {
		this.queryRunnerDisposables.clear();
		this.reset();
		this.runner = runner;
		this.queryRunnerDisposables.add(this.runner.onResultSet(this.onResultSet, this));
		this.queryRunnerDisposables.add(this.runner.onResultSetUpdate(this.updateResultSet, this));
		this.queryRunnerDisposables.add(this.runner.onQueryStart(() => {
			status(localize('query.QueryExecutionStarted', "Query execution started."));
			if (this.state) {
				this.state.tableStates = [];
			}
			this.reset();
		}));
		this.queryRunnerDisposables.add(this.runner.onQueryEnd(() => {
			status(localize('query.QueryExecutionEnded', "Query execution completed."));
		}));
		this.queryRunnerDisposables.add(this.runner.onMessage((messages) => {
			if (messages?.find(m => m.isError)) {
				alert(localize('query.QueryErrorOccured', "Error occured while executing the query."));
			}
		}));
		this.addResultSet(this.runner.batchSets.reduce<ResultSetSummary[]>((p, e) => {
			if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.streaming) {
				p = p.concat(e.resultSetSummaries ?? []);
			} else {
				p = p.concat(e.resultSetSummaries?.filter(c => c.complete) ?? []);
			}
			return p;
		}, []));

		if (this.state && this.state.scrollPosition) {
			this.scrollableView.setScrollTop(this.state.scrollPosition);
		}
	}

	public resetScrollPosition(): void {
		this.scrollableView.setScrollTop(this.state.scrollPosition);
	}

	private onResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
		let resultsToAdd: ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToAdd = [resultSet];
		} else {
			resultsToAdd = resultSet.splice(0);
		}
		const sizeChanges = () => {
			this.tables.map(t => {
				t.state.canBeMaximized = this.tables.length > 1;
			});

			if (this.state && this.state.scrollPosition) {
				this.scrollableView.setScrollTop(this.state.scrollPosition);
			}
		};

		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.streaming) {
			this.addResultSet(resultsToAdd);
			sizeChanges();
		} else {
			resultsToAdd = resultsToAdd.filter(e => e.complete);
			if (resultsToAdd.length > 0) {
				this.addResultSet(resultsToAdd);
			}
			sizeChanges();
		}
	}

	private updateResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
		let resultsToUpdate: ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToUpdate = [resultSet];
		} else {
			resultsToUpdate = resultSet.splice(0);
		}

		const sizeChanges = () => {
			if (this.state && this.state.scrollPosition) {
				this.scrollableView.setScrollTop(this.state.scrollPosition);
			}
		};

		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.streaming) {
			for (let set of resultsToUpdate) {
				let table = this.tables.find(t => t.resultSet.batchId === set.batchId && t.resultSet.id === set.id);
				if (table) {
					table.updateResult(set);
				} else {
					this.logService.warn('Got result set update request for non-existant table');
				}
			}
			sizeChanges();
		} else {
			resultsToUpdate = resultsToUpdate.filter(e => e.complete);
			if (resultsToUpdate.length > 0) {
				this.addResultSet(resultsToUpdate);
			}
			sizeChanges();
		}
	}

	private addResultSet(resultSet: ResultSetSummary[]) {
		const tables: Array<GridTable<any>> = [];

		for (const set of resultSet) {
			// ensure we aren't adding a resultSet that is already visible
			if (this.tables.find(t => t.resultSet.batchId === set.batchId && t.resultSet.id === set.id)) {
				continue;
			}
			let tableState: GridTableState;
			if (this.state) {
				tableState = this.state.tableStates.find(e => e.batchId === set.batchId && e.resultId === set.id);
			}
			if (!tableState) {
				tableState = new GridTableState(set.id, set.batchId);
				if (this.state) {
					this.state.tableStates.push(tableState);
				}
			}
			const table = this.instantiationService.createInstance(GridTable, this.runner, set, tableState);
			this.tableDisposable.add(tableState.onMaximizedChange(e => {
				if (e) {
					this.maximizeTable(table.id);
				} else {
					this.minimizeTables();
				}
			}));

			tables.push(table);
		}

		this.tables = this.tables.concat(tables);

		// turn-off special-case process when only a single table is being displayed
		if (this.tables.length > 1) {
			for (let i = 0; i < this.tables.length; ++i) {
				this.tables[i].isOnlyTable = false;
			}
		}

		if (isUndefinedOrNull(this.maximizedGrid)) {
			this.scrollableView.addViews(tables);
		}
	}

	public clear() {
		this.reset();
		this.state = undefined;
	}

	private reset() {
		this.scrollableView.clear();
		dispose(this.tables);
		this.tableDisposable.clear();
		this.tables = [];
		this.maximizedGrid = undefined;
	}

	private maximizeTable(tableid: string): void {
		if (!this.tables.find(t => t.id === tableid)) {
			return;
		}

		for (let i = this.tables.length - 1; i >= 0; i--) {
			if (this.tables[i].id === tableid) {
				const selectedTable = this.tables[i];
				selectedTable.state.maximized = true;
				this.maximizedGrid = selectedTable;
				this.scrollableView.clear();
				this.scrollableView.addViews([selectedTable]);
				break;
			}
		}
	}

	private minimizeTables(): void {
		if (this.maximizedGrid) {
			this.maximizedGrid.state.maximized = false;
			this.maximizedGrid = undefined;
			this.scrollableView.clear();
			this.scrollableView.addViews(this.tables);
		}
	}

	public set state(val: GridPanelState) {
		this._state = val;
		if (this.state) {
			this.tables.map(t => {
				let state = this.state.tableStates.find(s => s.batchId === t.resultSet.batchId && s.resultId === t.resultSet.id);
				if (!state) {
					this.state.tableStates.push(t.state);
				}
				if (state) {
					t.state = state;
				}
			});
		}
	}

	public get state() {
		return this._state;
	}

	public override dispose() {
		dispose(this.tables);
		this.tables = undefined;
		super.dispose();
	}
}

export interface IDataSet {
	rowCount: number;
	columnInfo: IColumn[];
}

export interface IGridTableOptions {
	actionOrientation: ActionsOrientation;
	showActionBar?: boolean;
	inMemoryDataProcessing: boolean;
	inMemoryDataCountThreshold?: number;
}

const defaultGridTableOptions: IGridTableOptions = {
	showActionBar: true,
	inMemoryDataProcessing: false,
	actionOrientation: ActionsOrientation.VERTICAL
};

export interface IQueryResultGrid {
	readonly htmlElement: HTMLElement;
	runAction(actionId: string): void;
}

export abstract class GridTableBase<T> extends Disposable implements IView, IQueryResultGrid {
	private table: Table<T>;
	private actionBar: ActionBar;
	private container = document.createElement('div');
	private selectionModel = new CellSelectionModel<T>({ hasRowSelector: true });
	private styles: ITableStyles;
	private currentHeight: number;
	private dataProvider: HybridDataProvider<T>;
	private filterPlugin: HeaderFilter<T>;
	private isDisposed: boolean = false;
	private gridConfig: IResultGridConfiguration;
	private selectionChangeHandlerTokenSource: CancellationTokenSource | undefined;

	private columns: Slick.Column<T>[];

	private rowNumberColumn: RowNumberColumn<T>;

	private _onDidChange = new Emitter<number>();
	public readonly onDidChange: Event<number> = this._onDidChange.event;

	public id = generateUuid();
	readonly element: HTMLElement = this.container;
	protected tableContainer: HTMLElement;

	private _state: GridTableState;

	private visible = false;

	private rowHeight: number;

	public isOnlyTable: boolean = true;

	public providerId: string;

	// this handles if the row count is small, like 4-5 rows
	protected get maxSize(): number {
		return ((this.resultSet.rowCount) * this.rowHeight) + HEADER_HEIGHT + ESTIMATED_SCROLL_BAR_HEIGHT;
	}

	public focus(): void {
		if (!this.table.activeCell) {
			this.table.setActiveCell(0, 1);
			this.selectionModel.setSelectedRanges([new Slick.Range(0, 1)]);
		}
		this.table.focus();
	}

	constructor(
		state: GridTableState,
		protected _resultSet: ResultSetSummary,
		private readonly options: IGridTableOptions,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IInstantiationService protected readonly instantiationService: IInstantiationService,
		@IEditorService private readonly editorService: IEditorService,
		@IUntitledTextEditorService private readonly untitledEditorService: IUntitledTextEditorService,
		@IConfigurationService protected readonly configurationService: IConfigurationService,
		@IQueryModelService private readonly queryModelService: IQueryModelService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@INotificationService private readonly notificationService: INotificationService,
		@IExecutionPlanService private readonly executionPlanService: IExecutionPlanService,
		@IAccessibilityService private readonly accessibilityService: IAccessibilityService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IComponentContextService private readonly componentContextService: IComponentContextService,
		@IContextKeyService protected readonly contextKeyService: IContextKeyService,
		@ILogService private readonly logService: ILogService
	) {
		super();

		this.options = { ...defaultGridTableOptions, ...options };
		this.gridConfig = this.configurationService.getValue<IResultGridConfiguration>('resultsGrid');
		this.rowHeight = this.gridConfig.rowHeight ?? ROW_HEIGHT;
		this.state = state;
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this.columns = this.resultSet.columnInfo.map((c, i) => {
			return <Slick.Column<T>>{
				id: i.toString(),
				name: c.columnName === 'Microsoft SQL Server 2005 XML Showplan'
					? localize('xmlShowplan', "XML Showplan")
					: escape(c.columnName),
				field: i.toString(),
				formatter: c.isXml || c.isJson ? hyperLinkFormatter : (row: number | undefined, cell: any | undefined, value: ICellValue, columnDef: any | undefined, dataContext: any | undefined): string | { text: string, addClasses: string } => {
					if (this.isXmlCell(value)) {
						this.resultSet.columnInfo[i].isXml = true;
						return hyperLinkFormatter(row, cell, value, columnDef, dataContext);
					} else if (this.gridConfig.showJsonAsLink && this.isJsonCell(value)) {
						this.resultSet.columnInfo[i].isJson = true;
						return hyperLinkFormatter(row, cell, value, columnDef, dataContext);
					} else {
						return textFormatter(row, cell, value, columnDef, dataContext, (DBCellValue.isDBCellValue(value) && value.isNull) ? NULL_CELL_CSS_CLASS : undefined);
					}
				},
				width: this.state.columnSizes && this.state.columnSizes[i] ? this.state.columnSizes[i] : undefined
			};
		});
	}

	public get htmlElement(): HTMLElement {
		return this.tableContainer;
	}

	runAction(actionId: string): void {
		let action: IAction | undefined;
		switch (actionId) {
			case CopyResultAction.COPYWITHHEADERS_ID:
				action = this.instantiationService.createInstance(CopyResultAction, CopyResultAction.COPYWITHHEADERS_ID, CopyResultAction.COPYWITHHEADERS_LABEL, true);
				break;
			case CopyHeadersAction.ID:
				action = this.instantiationService.createInstance(CopyHeadersAction);
				break;
			case SelectAllGridAction.ID:
				action = this.instantiationService.createInstance(SelectAllGridAction);
				break;
			case SaveResultAction.SAVECSV_ID:
				action = this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV);
				break;
			case SaveResultAction.SAVEEXCEL_ID:
				action = this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL);
				break;
			case SaveResultAction.SAVEJSON_ID:
				action = this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON);
				break;
			case SaveResultAction.SAVEMARKDOWN_ID:
				action = this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEMARKDOWN_ID, SaveResultAction.SAVEMARKDOWN_LABEL, SaveResultAction.SAVEMARKDOWN_ICON, SaveFormat.MARKDOWN);
				break;
			case SaveResultAction.SAVEXML_ID:
				action = this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveResultAction.SAVEXML_ICON, SaveFormat.XML);
				break;
			default:
				this.logService.error(`No handler registered for action '${actionId}'`);
				break;
		}
		if (action) {
			action.run(this.generateContext());
		}
	}

	abstract get gridDataProvider(): IGridDataProvider;

	public get resultSet(): ResultSetSummary {
		return this._resultSet;
	}

	public async onDidInsert() {
		if (this.isDisposed) {
			return;
		}
		if (!this.table) {
			this.build();
		}
		this.visible = true;
		let collection = new VirtualizedCollection(
			50,
			index => this.placeholdGenerator(index),
			this.resultSet.rowCount,
			(offset, count) => this.loadData(offset, count)
		);
		collection.setCollectionChangedCallback((startIndex, count) => {
			this.renderGridDataRowsRange(startIndex, count);
		});
		this.dataProvider.dataRows = collection;
		this.setFilterState();
		this.table.updateRowCount();
		await this.setupState();
	}

	public onDidRemove() {
		this.visible = false;
		let collection = new VirtualizedCollection(
			50,
			index => this.placeholdGenerator(index),
			0,
			() => Promise.resolve([])
		);
		this.dataProvider.dataRows = collection;
		this.table.updateRowCount();
	}

	// actionsOrientation controls the orientation (horizontal or vertical) of the actionBar
	private build(): void {
		let actionBarContainer = document.createElement('div');

		// Create a horizontal actionbar if orientation passed in is HORIZONTAL.
		// The horizontal actionbar gets created up top here so that it will appear above the results table.
		// A vertical actionbar is supposed to come after the results table, so it gets created later down below.
		if (this.options.actionOrientation === ActionsOrientation.HORIZONTAL) {
			actionBarContainer.className = 'grid-panel action-bar horizontal';
			this.container.appendChild(actionBarContainer);
		}

		this.tableContainer = document.createElement('div');
		this.tableContainer.className = 'grid-panel';
		this.tableContainer.style.display = 'inline-block';

		let actionBarWidth = this.showActionBar ? ACTIONBAR_WIDTH : 0;
		this.tableContainer.style.width = `calc(100% - ${actionBarWidth}px)`;

		this.container.appendChild(this.tableContainer);

		let collection = new VirtualizedCollection(
			50,
			index => this.placeholdGenerator(index),
			0,
			() => Promise.resolve([])
		);
		collection.setCollectionChangedCallback((startIndex, count) => {
			this.renderGridDataRowsRange(startIndex, count);
		});
		this.rowNumberColumn = new RowNumberColumn({ autoCellSelection: false });
		this.columns.unshift(this.rowNumberColumn.getColumnDefinition());
		let tableOptions: Slick.GridOptions<T> = {
			rowHeight: this.rowHeight,
			showRowNumber: true,
			forceFitColumns: false,
			defaultColumnWidth: 120
		};
		this.dataProvider = new HybridDataProvider(collection,
			(offset, count) => { return this.loadData(offset, count); },
			undefined,
			undefined,
			(data: ICellValue) => {
				if (!data || data.isNull) {
					return undefined;
				}
				// If the string only contains whitespaces, it will be treated as empty string to make the filtering easier.
				// Note: this is the display string and does not impact the export/copy features.
				return data.displayValue.trim() === '' ? '' : data.displayValue;
			},
			{
				inMemoryDataProcessing: this.options.inMemoryDataProcessing,
				inMemoryDataCountThreshold: this.options.inMemoryDataCountThreshold
			});
		this.table = this._register(new Table(this.tableContainer, this.accessibilityService, this.quickInputService, defaultTableStyles, { dataProvider: this.dataProvider, columns: this.columns }, tableOptions));
		this.table.setTableTitle(localize('resultsGrid', "Results grid"));
		this.table.setSelectionModel(this.selectionModel);
		this.table.registerPlugin(new MouseWheelSupport());
		const autoSizeOnRender: boolean = !this.state.columnSizes && this.gridConfig.autoSizeColumns;
		this.table.registerPlugin(new AutoColumnSize({ autoSizeOnRender: autoSizeOnRender, maxWidth: this.gridConfig.maxColumnWidth, extraColumnHeaderWidth: FilterButtonWidth }));
		this.table.registerPlugin(this.rowNumberColumn);
		this.table.registerPlugin(new AdditionalKeyBindings());
		this._register(this.dataProvider.onFilterStateChange(() => { this.layout(); }));
		this._register(this.table.onContextMenu(this.contextMenu, this));
		this._register(this.table.onClick(this.onTableClick, this));
		this._register(this.table.onDoubleClick(this.onTableDoubleClick, this));
		this._register(this.dataProvider.onFilterStateChange(() => {
			const columns = this.table.columns as FilterableColumn<T>[];
			this.state.columnFilters = columns.filter((column) => column.filterValues?.length > 0).map(column => {
				return {
					filterValues: column.filterValues,
					field: column.field
				};
			});
			this.table.rerenderGrid();
		}));
		this._register(this.dataProvider.onSortComplete((args: Slick.OnSortEventArgs<T>) => {
			this.state.sortState = {
				field: args.sortCol.field,
				sortAsc: args.sortAsc
			};
			this.table.rerenderGrid();
		}));
		this.filterPlugin = new HeaderFilter({
			disabledFilterMessage: localize('resultsGrid.maxRowCountExceeded', "Max row count for filtering/sorting has been exceeded. To update it, navigate to User Settings and change the setting: 'queryEditor.results.inMemoryDataProcessingThreshold'"),
			refreshColumns: !autoSizeOnRender, // The auto size columns plugin refreshes the columns so we don't need to refresh twice if both plugins are on.
			...defaultTableFilterStyles
		}, this.contextViewService, this.notificationService,);
		this._register(registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
			const nullBackground = theme.getColor(queryEditorNullBackground);
			if (nullBackground) {
				collector.addRule(`.slick-row:not(:hover) .${NULL_CELL_CSS_CLASS} { background: ${nullBackground};}`);
			}
		}));

		this.table.registerPlugin(this.filterPlugin);
		const result = this.componentContextService.registerQueryResultGrid(this);
		this._register(result);
		this._register(this.componentContextService.registerTable(this.table, result.componentContextKeyService));
		if (this.styles) {
			this.table.style(this.styles);
		}
		// if the actionsOrientation passed in is "VERTICAL" (or no actionsOrientation is passed in at all), create a vertical actionBar
		if (this.options.actionOrientation === ActionsOrientation.VERTICAL) {
			actionBarContainer.className = 'grid-panel action-bar vertical';
			actionBarContainer.style.width = (this.showActionBar ? ACTIONBAR_WIDTH : 0) + 'px';
			this.container.appendChild(actionBarContainer);
		}

		let context: IGridActionContext = {
			gridDataProvider: this.gridDataProvider,
			table: this.table,
			tableState: this.state,
			batchId: this.resultSet.batchId,
			resultId: this.resultSet.id
		};
		this.actionBar = new ActionBar(actionBarContainer, {
			orientation: this.options.actionOrientation, context: context
		});

		// update context before we run an action
		this.selectionModel.onSelectedRangesChanged.subscribe(e => {
			this.actionBar.context = this.generateContext();
		});

		this.rebuildActionBar();

		this.selectionModel.onSelectedRangesChanged.subscribe(async e => {
			if (this.state) {
				this.state.selection = this.selectionModel.getSelectedRanges();
			}
			await this.handleTableSelectionChange();
		});

		this.table.grid.onScroll.subscribe((e, data) => {
			if (!this.visible) {
				// If the grid is not set up yet it can get scroll events resetting the top to 0px,
				// so ignore those events
				return;
			}
			if (this.state && isInDOM(this.container)) {
				this.state.scrollPositionY = data.scrollTop;
				this.state.scrollPositionX = data.scrollLeft;
			}
		});

		// we need to remove the first column since this is the row number
		this.table.onColumnResize(() => {
			let columnSizes = this.table.grid.getColumns().slice(1).map(v => v.width);
			this.state.columnSizes = columnSizes;
		});

		this.table.grid.onActiveCellChanged.subscribe(e => {
			if (this.state) {
				this.state.activeCell = this.table.grid.getActiveCell();
			}
		});
		// Add implementation for the copy action to respect the user's global copy command keybinding.
		// 1 is a priority number that is slightly larger than the basic handler's priority 0 to make sure our implementation
		// is executed.
		this._register(CopyAction.addImplementation(1, 'query-result-grid', accessor => {
			const selectedRanges = this.table.getSelectedRanges();
			// Only do copy if the grid is the current active grid.
			if (this.container.contains(document.activeElement) && selectedRanges && selectedRanges.length !== 0) {
				this.instantiationService.createInstance(CopyResultAction, CopyResultAction.COPY_ID, CopyResultAction.COPY_LABEL, false).run(this.generateContext());
				return true;
			}
			return false;
		}));
	}

	private restoreScrollState() {
		if (this.state.scrollPositionX || this.state.scrollPositionY) {
			this.table.grid.scrollTo(this.state.scrollPositionY);
			this.table.grid.getContainerNode().children[3].scrollLeft = this.state.scrollPositionX;
		}
	}

	private async setupState() {
		// change actionbar on maximize change
		this._register(this.state.onMaximizedChange(this.rebuildActionBar, this));

		this._register(this.state.onCanBeMaximizedChange(this.rebuildActionBar, this));

		this.restoreScrollState();

		this.rebuildActionBar();

		// Setting the active cell resets the selection so save it here
		let savedSelection = this.state.selection;

		if (this.state.activeCell) {
			this.table.setActiveCell(this.state.activeCell.row, this.state.activeCell.cell);
		}

		if (savedSelection) {
			this.selectionModel.setSelectedRanges(savedSelection);
		}

		if (this.state.sortState) {
			const sortAsc = this.state.sortState.sortAsc;
			const sortCol = this.columns.find((column) => column.field === this.state.sortState.field);
			this.table.grid.setSortColumn(sortCol.id, sortAsc);
			await this.dataProvider.sort({
				multiColumnSort: false,
				grid: this.table.grid,
				sortAsc: sortAsc,
				sortCol: sortCol
			});
		}

		if (this.state.columnFilters) {
			this.columns.forEach(column => {
				const idx = this.state.columnFilters.findIndex(filter => filter.field === column.field);
				if (idx !== -1) {
					(<FilterableColumn<T>>column).filterValues = this.state.columnFilters[idx].filterValues;
				}
			});
			await this.dataProvider.filter(this.columns);
		}
	}

	public get state(): GridTableState {
		return this._state;
	}

	public set state(val: GridTableState) {
		this._state = val;
	}

	private async getRowData(start: number, length: number, cancellationToken?: CancellationToken, onProgressCallback?: (availableRows: number) => void): Promise<ICellValue[][]> {
		let subset;
		if (this.dataProvider.isDataInMemory) {
			// handle the scenario when the data is sorted/filtered,
			// we need to use the data that is being displayed
			const data = await this.dataProvider.getRangeAsync(start, length);
			subset = data.map(item => Object.keys(item).map(key => item[key]));
		} else {
			subset = (await this.gridDataProvider.getRowData(start, length, cancellationToken, onProgressCallback)).rows;
		}
		return subset;
	}

	private async handleTableSelectionChange(): Promise<void> {
		if (this.selectionChangeHandlerTokenSource) {
			this.selectionChangeHandlerTokenSource.cancel();
		}
		this.selectionChangeHandlerTokenSource = new CancellationTokenSource();
		await this.notifyTableSelectionChanged(this.selectionChangeHandlerTokenSource);
	}

	private async notifyTableSelectionChanged(cancellationTokenSource: CancellationTokenSource): Promise<void> {
		const gridRanges = GridRange.fromSlickRanges(this.state.selection ?? []);
		const rowRanges = GridRange.getUniqueRows(gridRanges);
		const columnRanges = GridRange.getUniqueColumns(gridRanges);
		const rowCount = rowRanges.map(range => range.end - range.start + 1).reduce((p, c) => p + c);
		const runAction = async (proceed: boolean) => {
			const selectedCells = [];
			if (proceed && !cancellationTokenSource.token.isCancellationRequested) {
				let notificationHandle: INotificationHandle = undefined;
				const timeout = setTimeout(() => {
					notificationHandle = this.notificationService.notify({
						message: localize('resultsGrid.loadingData', "Loading selected rows for calculation..."),
						severity: Severity.Info,
						progress: {
							infinite: true
						},
						actions: {
							primary: [
								toAction({
									id: 'cancelLoadingCells',
									label: localize('resultsGrid.cancel', "Cancel"),
									run: () => {
										cancellationTokenSource.cancel();
										notificationHandle.close();
									}
								})]
						}
					});
				}, 1000);
				this.queryModelService.notifyCellSelectionChanged([]);
				let rowsInProcessedRanges = 0;
				for (const range of rowRanges) {
					if (cancellationTokenSource.token.isCancellationRequested) {
						break;
					}
					const rows = await this.getRowData(range.start, range.end - range.start + 1, cancellationTokenSource.token, (availableRows: number) => {
						notificationHandle?.updateMessage(localize('resultsGrid.loadingDataWithProgress', "Loading selected rows for calculation ({0}/{1})...", rowsInProcessedRanges + availableRows, rowCount));
					});
					rows.forEach((row, rowIndex) => {
						columnRanges.forEach(cr => {
							for (let i = cr.start; i <= cr.end; i++) {
								if (this.state.selection.some(selection => selection.contains(rowIndex + range.start, i))) {
									// need to reduce the column index by 1 because we have row number column which is not available in the actual data
									selectedCells.push(row[i - 1]);
								}
							}
						});
					});
					rowsInProcessedRanges += range.end - range.start + 1;
				}
				clearTimeout(timeout);
				notificationHandle?.close();
			}
			cancellationTokenSource.dispose();
			if (!cancellationTokenSource.token.isCancellationRequested) {
				this.queryModelService.notifyCellSelectionChanged(selectedCells);
			}
		};
		const showPromptConfigValue = this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.promptForLargeRowSelection;
		if (this.options.inMemoryDataCountThreshold && rowCount > this.options.inMemoryDataCountThreshold && showPromptConfigValue) {
			this.notificationService.prompt(Severity.Warning, localize('resultsGrid.largeRowSelectionPrompt.', 'You have selected {0} rows, it might take a while to load the data and calculate the summary, do you want to continue?', rowCount), [
				{
					label: localize('resultsGrid.confirmLargeRowSelection', "Yes"),
					run: async () => {
						await runAction(true);
					}
				}, {
					label: localize('resultsGrid.cancelLargeRowSelection', "Cancel"),
					run: async () => {
						await runAction(false);
					}
				}, {
					label: localize('resultsGrid.donotShowLargeRowSelectionPromptAgain', "Don't show again"),
					run: async () => {
						this.configurationService.updateValue('queryEditor.results.promptForLargeRowSelection', false).catch(e => onUnexpectedError(e));
						await runAction(true);
					},
					isSecondary: true
				}
			]);
		} else {
			await runAction(true);
		}
	}

	private async onTableClick(event: ITableMouseEvent) {
		// account for not having the number column
		const column = this.resultSet.columnInfo[event.cell.cell - 1];
		// handle if a showplan link was clicked
		if (column) {
			const subset = await this.getRowData(event.cell.row, 1);
			const value = subset[0][event.cell.cell - 1];
			if (column.isXml || (this.gridConfig.showJsonAsLink && this.isJsonCell(value))) {
				if (column.isXml && this.providerId) {
					const result = await this.executionPlanService.isExecutionPlan(this.providerId, value.displayValue);
					if (result.isExecutionPlan) {
						const executionPlanGraphInfo = {
							graphFileContent: value.displayValue,
							graphFileType: result.queryExecutionPlanFileExtension
						};

						const executionPlanInput = this.instantiationService.createInstance(ExecutionPlanInput, undefined, executionPlanGraphInfo);
						await this.editorService.openEditor(executionPlanInput);
						return;
					}
				}
				const content = value.displayValue;
				const input = this.untitledEditorService.create({ languageId: column.isXml ? 'xml' : column.isJson ? 'json' : 'txt', initialValue: content });
				await input.resolve();
				await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, input.textEditorModel, FormattingMode.Explicit, Progress.None, CancellationToken.None);
				input.setDirty(false);
				await this.editorService.openEditor(input);
			}
		}
	}

	private onTableDoubleClick(event: ITableMouseEvent) {
		// the first column is already handled by rowNumberColumn plugin.
		if (event.cell && event.cell.cell !== 0) {
			// upon double clicking, we want to select the entire row so that it is easier to know which
			// row is selected when the user needs to scroll horizontally.
			this.table.grid.setSelectedRows([event.cell.row]);
		}
	}

	public updateResult(resultSet: ResultSetSummary) {
		this._resultSet = resultSet;
		if (this.table && this.visible) {
			this.dataProvider.length = resultSet.rowCount;
			this.setFilterState();
			this.table.updateRowCount();
		}
		this._onDidChange.fire(undefined);
	}

	private setFilterState(): void {
		const rowCount = this.table.getData().getLength();
		this.filterPlugin.enabled = this.options.inMemoryDataProcessing
			&& (this.options.inMemoryDataCountThreshold === undefined || this.options.inMemoryDataCountThreshold >= rowCount);
	}

	private generateContext(cell?: Slick.Cell): IGridActionContext {
		const selection = this.selectionModel.getSelectedRanges();
		return <IGridActionContext>{
			cell,
			selection,
			gridDataProvider: this.gridDataProvider,
			table: this.table,
			tableState: this.state,
			selectionModel: this.selectionModel
		};
	}

	private rebuildActionBar() {
		let actions = this.getActionBarItems();
		this.actionBar.clear();
		if (this.options.showActionBar) {
			this.actionBar.push(actions, { icon: true, label: false });
		}
	}

	public get showActionBar(): boolean {
		return this.options.showActionBar;
	}

	public set showActionBar(v: boolean) {
		if (this.options.showActionBar !== v) {
			this.options.showActionBar = v;
			this.rebuildActionBar();
		}
	}

	protected getActionBarItems(): IAction[] {
		return [
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEMARKDOWN_ID, SaveResultAction.SAVEMARKDOWN_LABEL, SaveResultAction.SAVEMARKDOWN_ICON, SaveFormat.MARKDOWN),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveResultAction.SAVEXML_ICON, SaveFormat.XML)
		];
	}

	private isJsonCell(value: ICellValue): boolean {
		return !!(value && !value.isNull && value.displayValue?.match(IsJsonRegex));
	}

	private isXmlCell(value: ICellValue): boolean {
		let isXML = false;
		try {
			if (value && !value.isNull && value.displayValue.trim() !== '') {
				var parser = new DOMParser();
				// Script elements if any are not evaluated during parsing
				var doc = parser.parseFromString(value.displayValue, 'text/xml');
				// For non-xmls, parsererror element is present in body element.
				var parserErrors = doc.body?.getElementsByTagName('parsererror') ?? [];
				isXML = parserErrors?.length === 0;
			}
		} catch (e) {
			// Ignore errors when parsing cell content, log and continue
			this.logService.debug(`An error occurred when parsing data as XML: ${e}`);
		}
		return isXML;
	}

	protected abstract getContextActions(): IAction[];

	// The actionsOrientation passed in controls the actionBar orientation
	public layout(size?: number): void {
		if (!size) {
			size = this.currentHeight;
		} else {
			this.currentHeight = size;
		}
		// Table is always called with Orientation as VERTICAL
		this.table?.layout(size, Orientation.VERTICAL);
	}

	public get minimumSize(): number {
		// clamp between ensuring we can show the actionbar, while also making sure we don't take too much space
		// if there is only one table then allow a minimum size of ROW_HEIGHT
		let actionBarHeight = this.showActionBar ? ACTIONBAR_HEIGHT : 0;
		let bottomPadding = this.showActionBar ? BOTTOM_PADDING : BOTTOM_PADDING + NO_ACTIONBAR_ADDITIONAL_PADDING;

		return this.isOnlyTable ? ROW_HEIGHT : Math.max(Math.min(this.maxSize, MIN_GRID_HEIGHT), actionBarHeight + bottomPadding);
	}

	public get maximumSize(): number {
		let actionBarHeight = this.showActionBar ? ACTIONBAR_HEIGHT : 0;
		let bottomPadding = this.showActionBar ? BOTTOM_PADDING : BOTTOM_PADDING + NO_ACTIONBAR_ADDITIONAL_PADDING;

		return Math.max(this.maxSize, actionBarHeight + bottomPadding);
	}

	private loadData(offset: number, count: number): Thenable<T[]> {
		return this.gridDataProvider.getRowData(offset, count).then(response => {
			if (!response) {
				return [];
			}
			return response.rows.map(r => {
				let dataWithSchema = {};
				// skip the first column since its a number column
				for (let i = 1; i < this.columns.length; i++) {
					const displayValue = r[i - 1].displayValue ?? '';
					const ariaLabel = getCellDisplayValue(displayValue);
					dataWithSchema[this.columns[i].field] = {
						displayValue: displayValue,
						ariaLabel: ariaLabel,
						isNull: r[i - 1].isNull,
						invariantCultureDisplayValue: r[i - 1].invariantCultureDisplayValue
					};
				}
				return dataWithSchema as T;
			});
		});
	}

	private contextMenu(e: ITableMouseEvent): void {
		const { cell } = e;
		this.contextMenuService.showContextMenu({
			getAnchor: () => e.anchor,
			getActions: () => {
				let actions: IAction[] = [
					new SelectAllGridAction(),
					new Separator()
				];
				actions.push(
					this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV),
					this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL),
					this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON),
					this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEMARKDOWN_ID, SaveResultAction.SAVEMARKDOWN_LABEL, SaveResultAction.SAVEMARKDOWN_ICON, SaveFormat.MARKDOWN),
					this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveResultAction.SAVEXML_ICON, SaveFormat.XML)
				);
				let contributedActions: IAction[] = this.getContextActions();
				if (contributedActions && contributedActions.length > 0) {
					actions.push(...contributedActions);
				}
				actions.push(new Separator());
				actions.push(
					this.instantiationService.createInstance(CopyResultAction, CopyResultAction.COPY_ID, CopyResultAction.COPY_LABEL, false),
					this.instantiationService.createInstance(CopyResultAction, CopyResultAction.COPYWITHHEADERS_ID, CopyResultAction.COPYWITHHEADERS_LABEL, true),
					this.instantiationService.createInstance(CopyHeadersAction)
				);

				if (this.state.canBeMaximized) {
					if (this.state.maximized) {
						actions.splice(1, 0, new RestoreTableAction());
					} else {
						actions.splice(1, 0, new MaximizeTableAction());
					}
				}

				return actions;
			},
			getActionsContext: () => {
				return this.generateContext(cell);
			}
		});
	}

	private placeholdGenerator(index: number): any {
		return {};
	}

	private renderGridDataRowsRange(startIndex: number, count: number): void {
		this.invalidateRange(startIndex, startIndex + count);
	}

	private invalidateRange(start: number, end: number): void {
		let refreshedRows = range(start, end);
		if (this.table) {
			this.table.invalidateRows(refreshedRows, true);
		}
	}

	public style(styles: ITableStyles) {
		if (this.table) {
			this.table.style(styles);
		} else {
			this.styles = styles;
		}
	}

	public override dispose() {
		this.isDisposed = true;
		this.container.remove();
		if (this.table) {
			this.table.dispose();
		}
		if (this.actionBar) {
			this.actionBar.dispose();
		}
		super.dispose();
	}
}

class GridTable<T> extends GridTableBase<T> {
	private _gridDataProvider: IGridDataProvider;
	constructor(
		private _runner: QueryRunner,
		resultSet: ResultSetSummary,
		state: GridTableState,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
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
		@ILogService logService: ILogService
	) {
		super(state, resultSet, {
			actionOrientation: ActionsOrientation.VERTICAL,
			inMemoryDataProcessing: true,
			showActionBar: configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.showActionBar,
			inMemoryDataCountThreshold: configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.inMemoryDataProcessingThreshold,
		}, contextMenuService, instantiationService, editorService, untitledEditorService, configurationService, queryModelService, contextViewService, notificationService, executionPlanService, accessibilityService, quickInputService, componentContextService, contextKeyService, logService);
		this._gridDataProvider = this.instantiationService.createInstance(QueryGridDataProvider, this._runner, resultSet.batchId, resultSet.id);
		this.providerId = this._runner.getProviderId();
	}

	get gridDataProvider(): IGridDataProvider {
		return this._gridDataProvider;
	}

	protected override getActionBarItems(): IAction[] {

		let actions = [];

		if (this.state.canBeMaximized) {
			if (this.state.maximized) {
				actions.splice(1, 0, new RestoreTableAction());
			} else {
				actions.splice(1, 0, new MaximizeTableAction());
			}
		}

		actions.push(...super.getActionBarItems());
		actions.push(this.instantiationService.createInstance(ChartDataAction));

		if (this.contextKeyService.getContextKeyValue('showVisualizer')) {
			actions.push(this.instantiationService.createInstance(VisualizerDataAction, this._runner));
		}

		return actions;
	}

	protected getContextActions(): IAction[] {
		return [];
	}
}
