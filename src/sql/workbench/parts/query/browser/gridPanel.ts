/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/gridPanel';

import { attachTableStyler } from 'sql/platform/theme/common/styler';
import QueryRunner, { QueryGridDataProvider } from 'sql/platform/query/common/queryRunner';
import { VirtualizedCollection, AsyncDataProvider } from 'sql/base/browser/ui/table/asyncDataView';
import { Table } from 'sql/base/browser/ui/table/table';
import { ScrollableSplitView, IView } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';
import { MouseWheelSupport } from 'sql/base/browser/ui/table/plugins/mousewheelTableScroll.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { SaveFormat } from 'sql/workbench/parts/grid/common/interfaces';
import { IGridActionContext, SaveResultAction, CopyResultAction, SelectAllGridAction, MaximizeTableAction, RestoreTableAction, ChartDataAction, VisualizerDataAction } from 'sql/workbench/parts/query/browser/actions';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';
import { escape } from 'sql/base/common/strings';
import { hyperLinkFormatter, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';
import { AdditionalKeyBindings } from 'sql/base/browser/ui/table/plugins/additionalKeyBindings.plugin';
import { ITableStyles, ITableMouseEvent } from 'sql/base/browser/ui/table/interfaces';

import * as azdata from 'azdata';

import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { Emitter, Event } from 'vs/base/common/event';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { range } from 'vs/base/common/arrays';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable, dispose, DisposableStore } from 'vs/base/common/lifecycle';
import { generateUuid } from 'vs/base/common/uuid';
import { Separator, ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { isInDOM, Dimension } from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IAction } from 'vs/base/common/actions';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { ILogService } from 'vs/platform/log/common/log';
import { localize } from 'vs/nls';
import { IGridDataProvider } from 'sql/platform/query/common/gridDataProvider';
import { formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/format';
import { CancellationToken } from 'vs/base/common/cancellation';
import { GridPanelState, GridTableState } from 'sql/workbench/parts/query/common/gridPanelState';

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
	private splitView: ScrollableSplitView;
	private tables: GridTable<any>[] = [];
	private tableDisposable = this._register(new DisposableStore());
	private queryRunnerDisposables = this._register(new DisposableStore());
	private currentHeight: number;

	private runner: QueryRunner;

	private maximizedGrid: GridTable<any>;
	private _state: GridPanelState | undefined;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IThemeService private readonly themeService: IThemeService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		this.splitView = new ScrollableSplitView(this.container, { enableResizing: false, verticalScrollbarVisibility: ScrollbarVisibility.Visible });
		this.splitView.onScroll(e => {
			if (this.state && this.splitView.length !== 0) {
				this.state.scrollPosition = e;
			}
		});
	}

	public render(container: HTMLElement): void {
		this.container.style.width = '100%';
		this.container.style.height = '100%';

		container.appendChild(this.container);
	}

	public layout(size: Dimension): void {
		this.splitView.layout(size.height);
		// if the size hasn't change it won't layout our table so we have to do it manually
		if (size.height === this.currentHeight) {
			this.tables.map(e => e.layout());
		}
		this.currentHeight = size.height;
	}

	public focus(): void {
		// will need to add logic to save the focused grid and focus that
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
		this.addResultSet(this.runner.batchSets.reduce<azdata.ResultSetSummary[]>((p, e) => {
			if (this.configurationService.getValue<boolean>('sql.results.streaming')) {
				p = p.concat(e.resultSetSummaries);
			} else {
				p = p.concat(e.resultSetSummaries.filter(c => c.complete));
			}
			return p;
		}, []));

		if (this.state && this.state.scrollPosition) {
			this.splitView.setScrollPosition(this.state.scrollPosition);
		}
	}

	public resetScrollPosition(): void {
		this.splitView.setScrollPosition(this.state.scrollPosition);
	}

	private onResultSet(resultSet: azdata.ResultSetSummary | azdata.ResultSetSummary[]) {
		let resultsToAdd: azdata.ResultSetSummary[];
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
				this.splitView.setScrollPosition(this.state.scrollPosition);
			}
		};

		if (this.configurationService.getValue<boolean>('sql.results.streaming')) {
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

	private updateResultSet(resultSet: azdata.ResultSetSummary | azdata.ResultSetSummary[]) {
		let resultsToUpdate: azdata.ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToUpdate = [resultSet];
		} else {
			resultsToUpdate = resultSet.splice(0);
		}

		const sizeChanges = () => {
			if (this.state && this.state.scrollPosition) {
				this.splitView.setScrollPosition(this.state.scrollPosition);
			}
		};

		if (this.configurationService.getValue<boolean>('sql.results.streaming')) {
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

	private addResultSet(resultSet: azdata.ResultSetSummary[]) {
		let tables: GridTable<any>[] = [];

		for (let set of resultSet) {
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
			let table = this.instantiationService.createInstance(GridTable, this.runner, set, tableState);
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
			this.splitView.addViews(tables, tables.map(i => i.minimumSize), this.splitView.length);
		}
	}

	public clear() {
		this.reset();
		this.state = undefined;
	}

	private reset() {
		for (let i = this.splitView.length - 1; i >= 0; i--) {
			this.splitView.removeView(i);
		}
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
				this.tables[i].state.maximized = true;
				this.maximizedGrid = this.tables[i];
				continue;
			}

			this.splitView.removeView(i);
		}
	}

	private minimizeTables(): void {
		if (this.maximizedGrid) {
			this.maximizedGrid.state.maximized = false;
			this.maximizedGrid = undefined;
			this.splitView.removeView(0);
			this.splitView.addViews(this.tables, this.tables.map(i => i.minimumSize));
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

	public dispose() {
		dispose(this.tables);
		this.tables = undefined;
		super.dispose();
	}
}

export interface IDataSet {
	rowCount: number;
	columnInfo: azdata.IDbColumn[];
}

export abstract class GridTableBase<T> extends Disposable implements IView {
	private table: Table<T>;
	private actionBar: ActionBar;
	private container = document.createElement('div');
	private selectionModel = new CellSelectionModel();
	private styles: ITableStyles;
	private currentHeight: number;
	private dataProvider: AsyncDataProvider<T>;

	private columns: Slick.Column<T>[];

	private rowNumberColumn: RowNumberColumn<T>;

	private _onDidChange = new Emitter<number>();
	public readonly onDidChange: Event<number> = this._onDidChange.event;

	public id = generateUuid();
	readonly element: HTMLElement = this.container;

	private _state: GridTableState;

	private scrolled = false;
	private visible = false;

	private rowHeight: number;

	public isOnlyTable: boolean = true;

	// this handles if the row count is small, like 4-5 rows
	protected get maxSize(): number {
		return ((this.resultSet.rowCount) * this.rowHeight) + HEADER_HEIGHT + ESTIMATED_SCROLL_BAR_HEIGHT;
	}

	constructor(
		state: GridTableState,
		protected _resultSet: azdata.ResultSetSummary,
		protected contextMenuService: IContextMenuService,
		protected instantiationService: IInstantiationService,
		protected editorService: IEditorService,
		protected untitledEditorService: IUntitledEditorService,
		protected configurationService: IConfigurationService
	) {
		super();
		let config = this.configurationService.getValue<{ rowHeight: number }>('resultsGrid');
		this.rowHeight = config && config.rowHeight ? config.rowHeight : ROW_HEIGHT;
		this.state = state;
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this.container.className = 'grid-panel';

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

	public get resultSet(): azdata.ResultSetSummary {
		return this._resultSet;
	}

	public onAdd() {
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
		this.table.updateRowCount();
		this.setupState();
	}

	public onRemove() {
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
	private build(actionsOrientation?: ActionsOrientation): void {

		// Default is VERTICAL
		if (isUndefinedOrNull(actionsOrientation)) {
			actionsOrientation = ActionsOrientation.VERTICAL;
		}

		let actionBarContainer = document.createElement('div');

		// Create a horizontal actionbar if orientation passed in is HORIZONTAL
		if (actionsOrientation === ActionsOrientation.HORIZONTAL) {
			actionBarContainer.className = 'grid-panel action-bar horizontal';
			this.container.appendChild(actionBarContainer);
		}

		let tableContainer = document.createElement('div');
		tableContainer.style.display = 'inline-block';
		tableContainer.style.width = `calc(100% - ${ACTIONBAR_WIDTH}px)`;

		this.container.appendChild(tableContainer);

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
		let copyHandler = new CopyKeybind();
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
		this.dataProvider = new AsyncDataProvider(collection);
		this.table = this._register(new Table(tableContainer, { dataProvider: this.dataProvider, columns: this.columns }, tableOptions));
		this.table.setTableTitle(localize('resultsGrid', "Results grid"));
		this.table.setSelectionModel(this.selectionModel);
		this.table.registerPlugin(new MouseWheelSupport());
		this.table.registerPlugin(new AutoColumnSize({ autoSizeOnRender: !this.state.columnSizes && this.configurationService.getValue('resultsGrid.autoSizeColumns'), maxWidth: this.configurationService.getValue<number>('resultsGrid.maxColumnWidth') }));
		this.table.registerPlugin(copyHandler);
		this.table.registerPlugin(this.rowNumberColumn);
		this.table.registerPlugin(new AdditionalKeyBindings());
		this._register(this.table.onContextMenu(this.contextMenu, this));
		this._register(this.table.onClick(this.onTableClick, this));

		if (this.styles) {
			this.table.style(this.styles);
		}
		// If the actionsOrientation passed in is "VERTICAL" (or no actionsOrientation is passed in at all), create a vertical actionBar
		if (actionsOrientation === ActionsOrientation.VERTICAL) {
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
			orientation: actionsOrientation, context: context
		});
		// update context before we run an action
		this.selectionModel.onSelectedRangesChanged.subscribe(e => {
			this.actionBar.context = this.generateContext();
		});
		this.rebuildActionBar();

		this.selectionModel.onSelectedRangesChanged.subscribe(e => {
			if (this.state) {
				this.state.selection = this.selectionModel.getSelectedRanges();
			}
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

	private setupState() {
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
	}

	public get state(): GridTableState {
		return this._state;
	}

	public set state(val: GridTableState) {
		this._state = val;
	}

	private onTableClick(event: ITableMouseEvent) {
		// account for not having the number column
		let column = this.resultSet.columnInfo[event.cell.cell - 1];
		// handle if a showplan link was clicked
		if (column && (column.isXml || column.isJson)) {
			this.gridDataProvider.getRowData(event.cell.row, 1).then(async d => {
				let value = d.resultSubset.rows[0][event.cell.cell - 1];
				let content = value.displayValue;

				const input = this.untitledEditorService.createOrGet(undefined, column.isXml ? 'xml' : 'json', content);
				const model = await input.resolve();
				await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, model.textEditorModel, FormattingMode.Explicit, CancellationToken.None);
				return this.editorService.openEditor(input);
			});
		}
	}

	public updateResult(resultSet: azdata.ResultSetSummary) {
		this._resultSet = resultSet;
		if (this.table && this.visible) {
			this.dataProvider.length = resultSet.rowCount;
			this.table.updateRowCount();
		}
		this._onDidChange.fire(undefined);
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
		this.actionBar.push(actions, { icon: true, label: false });
	}

	protected abstract getCurrentActions(): IAction[];

	protected abstract getContextActions(): IAction[];

	// The actionsOrientation passed in controls the actionBar orientation
	public layout(size?: number, orientation?: Orientation, actionsOrientation?: ActionsOrientation): void {
		if (!this.table) {
			this.build(actionsOrientation);
		}
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
			if (!response.resultSubset) {
				return [];
			}
			return response.resultSubset.rows.map(r => {
				let dataWithSchema = {};
				// skip the first column since its a number column
				for (let i = 1; i < this.columns.length; i++) {
					dataWithSchema[this.columns[i].field] = {
						displayValue: r[i - 1].displayValue,
						ariaLabel: escape(r[i - 1].displayValue),
						isNull: r[i - 1].isNull
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

	public dispose() {
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
		resultSet: azdata.ResultSetSummary,
		state: GridTableState,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IEditorService editorService: IEditorService,
		@IUntitledEditorService untitledEditorService: IUntitledEditorService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(state, resultSet, contextMenuService, instantiationService, editorService, untitledEditorService, configurationService);
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
