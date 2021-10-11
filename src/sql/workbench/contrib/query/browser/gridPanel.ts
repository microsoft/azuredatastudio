/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/gridPanel';

import { ITableStyles, ITableMouseEvent, FilterableColumn } from 'sql/base/browser/ui/table/interfaces';
import { attachTableFilterStyler, attachTableStyler } from 'sql/platform/theme/common/styler';
import QueryRunner, { QueryGridDataProvider } from 'sql/workbench/services/query/common/queryRunner';
import { ResultSetSummary, IColumn, ICellValue } from 'sql/workbench/services/query/common/query';
import { VirtualizedCollection } from 'sql/base/browser/ui/table/asyncDataView';
import { Table } from 'sql/base/browser/ui/table/table';
import { MouseWheelSupport } from 'sql/base/browser/ui/table/plugins/mousewheelTableScroll.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { IGridActionContext, SaveResultAction, CopyResultAction, SelectAllGridAction, MaximizeTableAction, RestoreTableAction, ChartDataAction, VisualizerDataAction } from 'sql/workbench/contrib/query/browser/actions';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';
import { escape } from 'sql/base/common/strings';
import { hyperLinkFormatter, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { AdditionalKeyBindings } from 'sql/base/browser/ui/table/plugins/additionalKeyBindings.plugin';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';

import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { Emitter, Event } from 'vs/base/common/event';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { Disposable, dispose, DisposableStore } from 'vs/base/common/lifecycle';
import { range } from 'vs/base/common/arrays';
import { generateUuid } from 'vs/base/common/uuid';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { isInDOM, Dimension } from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IAction, Separator } from 'vs/base/common/actions';
import { ILogService } from 'vs/platform/log/common/log';
import { localize } from 'vs/nls';
import { IGridDataProvider } from 'sql/workbench/services/query/common/gridDataProvider';
import { formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/format';
import { CancellationToken } from 'vs/base/common/cancellation';
import { GridPanelState, GridTableState } from 'sql/workbench/common/editor/query/gridTableState';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { SaveFormat } from 'sql/workbench/services/query/common/resultSerializer';
import { Progress } from 'vs/platform/progress/common/progress';
import { ScrollableView, IView } from 'sql/base/browser/ui/scrollableView/scrollableView';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { FilterButtonWidth, HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { HybridDataProvider } from 'sql/base/browser/ui/table/hybridDataProvider';
import { INotificationService } from 'vs/platform/notification/common/notification';

const ROW_HEIGHT = 29;
const HEADER_HEIGHT = 26;
const MIN_GRID_HEIGHT_ROWS = 8;
const ESTIMATED_SCROLL_BAR_HEIGHT = 15;
const BOTTOM_PADDING = 15;
const ACTIONBAR_WIDTH = 36;

// minimum height needed to show the full actionbar
const ACTIONBAR_HEIGHT = 120;

// this handles min size if rows is greater than the min grid visible rows
const MIN_GRID_HEIGHT = (MIN_GRID_HEIGHT_ROWS * ROW_HEIGHT) + HEADER_HEIGHT + ESTIMATED_SCROLL_BAR_HEIGHT;

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
		@ILogService private readonly logService: ILogService,
		@IThemeService private readonly themeService: IThemeService,
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
			if (this.state) {
				this.state.tableStates = [];
			}
			this.reset();
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
			this.tableDisposable.add(attachTableStyler(table, this.themeService));

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

export abstract class GridTableBase<T> extends Disposable implements IView {
	private table: Table<T>;
	private actionBar: ActionBar;
	private container = document.createElement('div');
	private selectionModel = new CellSelectionModel<T>();
	private styles: ITableStyles;
	private currentHeight: number;
	private dataProvider: HybridDataProvider<T>;
	private filterPlugin: HeaderFilter<T>;

	private columns: Slick.Column<T>[];

	private rowNumberColumn: RowNumberColumn<T>;

	private _onDidChange = new Emitter<number>();
	public readonly onDidChange: Event<number> = this._onDidChange.event;

	public id = generateUuid();
	readonly element: HTMLElement = this.container;
	protected tableContainer: HTMLElement;

	private _state: GridTableState;

	private scrolled = false;
	private visible = false;

	private rowHeight: number;

	public isOnlyTable: boolean = true;

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
		@IThemeService private readonly themeService: IThemeService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();

		this.options = { ...defaultGridTableOptions, ...options };

		let config = this.configurationService.getValue<{ rowHeight: number }>('resultsGrid');
		this.rowHeight = config && config.rowHeight ? config.rowHeight : ROW_HEIGHT;
		this.state = state;
		this.container.style.width = '100%';
		this.container.style.height = '100%';

		this.columns = this.resultSet.columnInfo.map((c, i) => {
			let isLinked = c.isXml || c.isJson;

			return <Slick.Column<T>>{
				id: i.toString(),
				name: c.columnName === 'Microsoft SQL Server 2005 XML Showplan'
					? localize('xmlShowplan', "XML Showplan")
					: escape(c.columnName),
				field: i.toString(),
				formatter: isLinked ? hyperLinkFormatter : textFormatter,
				width: this.state.columnSizes && this.state.columnSizes[i] ? this.state.columnSizes[i] : undefined
			};
		});
	}

	abstract get gridDataProvider(): IGridDataProvider;

	public get resultSet(): ResultSetSummary {
		return this._resultSet;
	}

	public async onDidInsert() {
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
		// when we are removed slickgrid acts badly so we need to account for that
		this.scrolled = false;
	}

	// actionsOrientation controls the orientation (horizontal or vertical) of the actionBar
	private build(): void {
		let actionBarContainer = document.createElement('div');

		// Create a horizontal actionbar if orientation passed in is HORIZONTAL
		if (this.options.actionOrientation === ActionsOrientation.HORIZONTAL) {
			actionBarContainer.className = 'grid-panel action-bar horizontal';
			this.container.appendChild(actionBarContainer);
		}

		this.tableContainer = document.createElement('div');
		this.tableContainer.className = 'grid-panel';
		this.tableContainer.style.display = 'inline-block';
		this.tableContainer.style.width = `calc(100% - ${ACTIONBAR_WIDTH}px)`;

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
		this.rowNumberColumn = new RowNumberColumn({ numberOfRows: this.resultSet.rowCount });
		let copyHandler = new CopyKeybind<T>();
		copyHandler.onCopy(e => {
			new CopyResultAction(CopyResultAction.COPY_ID, CopyResultAction.COPY_LABEL, false).run(this.generateContext());
		});
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
			(data: ICellValue) => { return data?.displayValue; },
			{
				inMemoryDataProcessing: this.options.inMemoryDataProcessing,
				inMemoryDataCountThreshold: this.options.inMemoryDataCountThreshold
			});
		this.table = this._register(new Table(this.tableContainer, { dataProvider: this.dataProvider, columns: this.columns }, tableOptions));
		this.table.setTableTitle(localize('resultsGrid', "Results grid"));
		this.table.setSelectionModel(this.selectionModel);
		this.table.registerPlugin(new MouseWheelSupport());
		const autoSizeOnRender: boolean = !this.state.columnSizes && this.configurationService.getValue('resultsGrid.autoSizeColumns');
		this.table.registerPlugin(new AutoColumnSize({ autoSizeOnRender: autoSizeOnRender, maxWidth: this.configurationService.getValue<number>('resultsGrid.maxColumnWidth'), extraColumnHeaderWidth: this.enableFilteringFeature ? FilterButtonWidth : 0 }));
		this.table.registerPlugin(copyHandler);
		this.table.registerPlugin(this.rowNumberColumn);
		this.table.registerPlugin(new AdditionalKeyBindings());
		this._register(this.dataProvider.onFilterStateChange(() => { this.layout(); }));
		this._register(this.table.onContextMenu(this.contextMenu, this));
		this._register(this.table.onClick(this.onTableClick, this));
		//This listener is used for correcting auto-scroling when clicking on the header for reszing.
		this._register(this.table.onHeaderClick(this.onHeaderClick, this));
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
		if (this.enableFilteringFeature) {
			this.filterPlugin = new HeaderFilter(this.contextViewService, this.notificationService, {
				disabledFilterMessage: localize('resultsGrid.maxRowCountExceeded', "Max row count for filtering/sorting has been exceeded. To update it, navigate to User Settings and change the setting: 'queryEditor.results.inMemoryDataProcessingThreshold'"),
				refreshColumns: !autoSizeOnRender // The auto size columns plugin refreshes the columns so we don't need to refresh twice if both plugins are on.
			});
			this._register(attachTableFilterStyler(this.filterPlugin, this.themeService));
			this.table.registerPlugin(this.filterPlugin);
		}
		if (this.styles) {
			this.table.style(this.styles);
		}
		// If the actionsOrientation passed in is "VERTICAL" (or no actionsOrientation is passed in at all), create a vertical actionBar
		if (this.options.actionOrientation === ActionsOrientation.VERTICAL) {
			actionBarContainer.className = 'grid-panel action-bar vertical';
			actionBarContainer.style.width = ACTIONBAR_WIDTH + 'px';
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
			await this.notifyTableSelectionChanged();
		});

		this.table.grid.onScroll.subscribe((e, data) => {
			if (!this.visible) {
				// If the grid is not set up yet it can get scroll events resetting the top to 0px,
				// so ignore those events
				return;
			}
			if (!this.scrolled && (this.state.scrollPositionY || this.state.scrollPositionX) && isInDOM(this.container)) {
				this.scrolled = true;
				this.restoreScrollState();
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

	private onHeaderClick(event: ITableMouseEvent) {
		//header clicks must be accounted for as they force the table to scroll to the top;
		this.scrolled = false;
	}

	private async notifyTableSelectionChanged() {
		const selectedCells = [];
		for (const range of this.state.selection) {
			let subset;
			if (this.dataProvider.isDataInMemory) {
				// handle the scenario when the data is sorted/filtered,
				// we need to use the data that is being displayed
				const data = await this.dataProvider.getRangeAsync(range.fromRow, range.toRow - range.fromRow + 1);
				subset = data.map(item => Object.keys(item).map(key => item[key]));
			} else {
				subset = (await this.gridDataProvider.getRowData(range.fromRow, range.toRow - range.fromRow + 1)).rows;
			}
			subset.forEach(row => {
				// start with range.fromCell -1 because we have row number column which is not available in the actual data
				for (let i = range.fromCell - 1; i < range.toCell; i++) {
					selectedCells.push(row[i]);
				}
			});
		}
		this.queryModelService.notifyCellSelectionChanged(selectedCells);
	}

	private onTableClick(event: ITableMouseEvent) {
		// account for not having the number column
		let column = this.resultSet.columnInfo[event.cell.cell - 1];
		// handle if a showplan link was clicked
		if (column && (column.isXml || column.isJson)) {
			this.gridDataProvider.getRowData(event.cell.row, 1).then(async d => {
				let value = d.rows[0][event.cell.cell - 1];
				let content = value.displayValue;

				const input = this.untitledEditorService.create({ mode: column.isXml ? 'xml' : 'json', initialValue: content });
				await input.resolve();
				await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, input.textEditorModel, FormattingMode.Explicit, Progress.None, CancellationToken.None);
				input.setDirty(false);

				return this.editorService.openEditor(input);
			});
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

	private get enableFilteringFeature(): boolean {
		return this.configurationService.getValue<boolean>('workbench')['enablePreviewFeatures'];
	}

	private setFilterState(): void {
		if (this.enableFilteringFeature) {
			const rowCount = this.table.getData().getLength();
			this.filterPlugin.enabled = this.options.inMemoryDataProcessing
				&& (this.options.inMemoryDataCountThreshold === undefined || this.options.inMemoryDataCountThreshold >= rowCount);
		}
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
		let actions = this.getCurrentActions();
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

	protected abstract getCurrentActions(): IAction[];

	protected abstract getContextActions(): IAction[];

	// The actionsOrientation passed in controls the actionBar orientation
	public layout(size?: number): void {
		if (!size) {
			size = this.currentHeight;
		} else {
			this.currentHeight = size;
		}
		// Table is always called with Orientation as VERTICAL
		this.table.layout(size, Orientation.VERTICAL);
	}

	public get minimumSize(): number {
		// clamp between ensuring we can show the actionbar, while also making sure we don't take too much space
		// if there is only one table then allow a minimum size of ROW_HEIGHT
		return this.isOnlyTable ? ROW_HEIGHT : Math.max(Math.min(this.maxSize, MIN_GRID_HEIGHT), ACTIONBAR_HEIGHT + BOTTOM_PADDING);
	}

	public get maximumSize(): number {
		return Math.max(this.maxSize, ACTIONBAR_HEIGHT + BOTTOM_PADDING);
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
					dataWithSchema[this.columns[i].field] = {
						displayValue: r[i - 1].displayValue,
						ariaLabel: escape(r[i - 1].displayValue),
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
				let contributedActions: IAction[] = this.getContextActions();
				if (contributedActions && contributedActions.length > 0) {
					actions.push(...contributedActions);
					actions.push(new Separator());
				}
				actions.push(
					new CopyResultAction(CopyResultAction.COPY_ID, CopyResultAction.COPY_LABEL, false),
					new CopyResultAction(CopyResultAction.COPYWITHHEADERS_ID, CopyResultAction.COPYWITHHEADERS_LABEL, true)
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
		// let editor = this.table.getCellEditor();
		// let oldValue = editor ? editor.getValue() : undefined;
		// let wasValueChanged = editor ? editor.isValueChanged() : false;
		this.invalidateRange(startIndex, startIndex + count);
		// let activeCell = this._grid.getActiveCell();
		// if (editor && activeCell.row >= startIndex && activeCell.row < startIndex + count) {
		//     if (oldValue && wasValueChanged) {
		//         editor.setValue(oldValue);
		//     }
		// }
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
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IEditorService editorService: IEditorService,
		@IUntitledTextEditorService untitledEditorService: IUntitledTextEditorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IThemeService themeService: IThemeService,
		@IContextViewService contextViewService: IContextViewService,
		@INotificationService notificationService: INotificationService
	) {
		super(state, resultSet, {
			actionOrientation: ActionsOrientation.VERTICAL,
			inMemoryDataProcessing: true,
			showActionBar: true,
			inMemoryDataCountThreshold: configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.inMemoryDataProcessingThreshold,
		}, contextMenuService, instantiationService, editorService, untitledEditorService, configurationService, queryModelService, themeService, contextViewService, notificationService);
		this._gridDataProvider = this.instantiationService.createInstance(QueryGridDataProvider, this._runner, resultSet.batchId, resultSet.id);
	}

	get gridDataProvider(): IGridDataProvider {
		return this._gridDataProvider;
	}

	protected getCurrentActions(): IAction[] {

		let actions = [];

		if (this.state.canBeMaximized) {
			if (this.state.maximized) {
				actions.splice(1, 0, new RestoreTableAction());
			} else {
				actions.splice(1, 0, new MaximizeTableAction());
			}
		}

		actions.push(
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveResultAction.SAVEXML_ICON, SaveFormat.XML),
			this.instantiationService.createInstance(ChartDataAction)
		);

		if (this.contextKeyService.getContextKeyValue('showVisualizer')) {
			actions.push(this.instantiationService.createInstance(VisualizerDataAction, this._runner));
		}

		return actions;
	}

	protected getContextActions(): IAction[] {
		return [
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON),
			this.instantiationService.createInstance(SaveResultAction, SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveResultAction.SAVEXML_ICON, SaveFormat.XML),
		];
	}
}
