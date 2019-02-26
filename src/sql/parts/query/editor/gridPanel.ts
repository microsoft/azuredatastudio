/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as pretty from 'pretty-data';

import { attachTableStyler } from 'sql/platform/theme/common/styler';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import { VirtualizedCollection, AsyncDataProvider } from 'sql/base/browser/ui/table/asyncDataView';
import { Table } from 'sql/base/browser/ui/table/table';
import { ScrollableSplitView, IView } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';
import { MouseWheelSupport } from 'sql/base/browser/ui/table/plugins/mousewheelTableScroll.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { SaveFormat } from 'sql/parts/grid/common/interfaces';
import { IGridActionContext, SaveResultAction, CopyResultAction, SelectAllGridAction, MaximizeTableAction, RestoreTableAction, ChartDataAction } from 'sql/parts/query/editor/actions';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';
import { escape } from 'sql/base/common/strings';
import { hyperLinkFormatter, textFormatter } from 'sql/parts/grid/services/sharedServices';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';
import { AdditionalKeyBindings } from 'sql/base/browser/ui/table/plugins/additionalKeyBindings.plugin';
import { ITableStyles, ITableMouseEvent } from 'sql/base/browser/ui/table/interfaces';
import { warn } from 'sql/base/common/log';
import { $ } from 'sql/base/browser/builder';

import * as sqlops from 'sqlops';

import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Emitter, Event } from 'vs/base/common/event';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { range } from 'vs/base/common/arrays';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable, IDisposable, dispose } from 'vs/base/common/lifecycle';
import { generateUuid } from 'vs/base/common/uuid';
import { TPromise } from 'vs/base/common/winjs.base';
import { Separator, ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { isInDOM } from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IAction } from 'vs/base/common/actions';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';

const ROW_HEIGHT = 29;
const HEADER_HEIGHT = 26;
const MIN_GRID_HEIGHT_ROWS = 8;
const ESTIMATED_SCROLL_BAR_HEIGHT = 10;
const BOTTOM_PADDING = 15;
const ACTIONBAR_WIDTH = 36;

// minimum height needed to show the full actionbar
const ACTIONBAR_HEIGHT = 120;

// this handles min size if rows is greater than the min grid visible rows
const MIN_GRID_HEIGHT = (MIN_GRID_HEIGHT_ROWS * ROW_HEIGHT) + HEADER_HEIGHT + ESTIMATED_SCROLL_BAR_HEIGHT;

export class GridPanelState {
	public tableStates: GridTableState[] = [];
	public scrollPosition: number;
	public collapsed = false;

	dispose() {
		dispose(this.tableStates);
	}
}

export interface IGridTableState {
	canBeMaximized: boolean;
	maximized: boolean;
}

export class GridTableState extends Disposable {

	private _maximized: boolean;

	private _onMaximizedChange = this._register(new Emitter<boolean>());
	public onMaximizedChange: Event<boolean> = this._onMaximizedChange.event;

	private _onCanBeMaximizedChange = this._register(new Emitter<boolean>());
	public onCanBeMaximizedChange: Event<boolean> = this._onCanBeMaximizedChange.event;

	private _canBeMaximized: boolean;

	/* The top row of the current scroll */
	public scrollPositionY = 0;
	public scrollPositionX = 0;
	public columnSizes: number[] = undefined;
	public selection: Slick.Range[];
	public activeCell: Slick.Cell;

	constructor(public readonly resultId: number, public readonly batchId: number) {
		super();
	}

	public get canBeMaximized(): boolean {
		return this._canBeMaximized;
	}

	public set canBeMaximized(val: boolean) {
		if (val === this._canBeMaximized) {
			return;
		}
		this._canBeMaximized = val;
		this._onCanBeMaximizedChange.fire(val);
	}

	public get maximized(): boolean {
		return this._maximized;
	}

	public set maximized(val: boolean) {
		if (val === this._maximized) {
			return;
		}
		this._maximized = val;
		this._onMaximizedChange.fire(val);
	}
}

export class GridPanel extends ViewletPanel {
	private container = document.createElement('div');
	private splitView: ScrollableSplitView;
	private tables: GridTable<any>[] = [];
	private tableDisposable: IDisposable[] = [];
	private queryRunnerDisposables: IDisposable[] = [];
	private currentHeight: number;

	private runner: QueryRunner;

	private maximizedGrid: GridTable<any>;
	private _state: GridPanelState;

	constructor(
		options: IViewletPanelOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IThemeService private themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super(options, keybindingService, contextMenuService, configurationService);
		this.splitView = new ScrollableSplitView(this.container, { enableResizing: false, verticalScrollbarVisibility: ScrollbarVisibility.Visible });
		this.splitView.onScroll(e => {
			if (this.state && this.splitView.length !== 0) {
				this.state.scrollPosition = e;
			}
		});
		this.onDidChange(e => {
			if (this.state) {
				this.state.collapsed = !this.isExpanded();
			}
		});
	}

	protected renderBody(container: HTMLElement): void {
		this.container.style.width = '100%';
		this.container.style.height = '100%';

		container.appendChild(this.container);
	}

	protected layoutBody(size: number): void {
		this.splitView.layout(size);
		// if the size hasn't change it won't layout our table so we have to do it manually
		if (size === this.currentHeight) {
			this.tables.map(e => e.layout());
		}
		this.currentHeight = size;
	}

	public set queryRunner(runner: QueryRunner) {
		dispose(this.queryRunnerDisposables);
		this.reset();
		this.queryRunnerDisposables = [];
		this.runner = runner;
		this.queryRunnerDisposables.push(this.runner.onResultSet(this.onResultSet, this));
		this.queryRunnerDisposables.push(this.runner.onResultSetUpdate(this.updateResultSet, this));
		this.queryRunnerDisposables.push(this.runner.onQueryStart(() => {
			if (this.state) {
				this.state.tableStates = [];
			}
			this.reset();
		}));
		this.addResultSet(this.runner.batchSets.reduce<sqlops.ResultSetSummary[]>((p, e) => {
			if (this.configurationService.getValue<boolean>('sql.results.streaming')) {
				p = p.concat(e.resultSetSummaries);
			} else {
				p = p.concat(e.resultSetSummaries.filter(c => c.complete));
			}
			return p;
		}, []));
		this.maximumBodySize = this.tables.reduce((p, c) => {
			return p + c.maximumSize;
		}, 0);

		if (this.state && this.state.scrollPosition) {
			this.splitView.setScrollPosition(this.state.scrollPosition);
		}
	}

	private onResultSet(resultSet: sqlops.ResultSetSummary | sqlops.ResultSetSummary[]) {
		let resultsToAdd: sqlops.ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToAdd = [resultSet];
		} else {
			resultsToAdd = resultSet.splice(0);
		}
		const sizeChanges = () => {
			this.tables.map(t => {
				t.state.canBeMaximized = this.tables.length > 1;
			});

			this.maximumBodySize = this.tables.reduce((p, c) => {
				return p + c.maximumSize;
			}, 0);

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

	private updateResultSet(resultSet: sqlops.ResultSetSummary | sqlops.ResultSetSummary[]) {
		let resultsToUpdate: sqlops.ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToUpdate = [resultSet];
		} else {
			resultsToUpdate = resultSet.splice(0);
		}

		const sizeChanges = () => {
			this.maximumBodySize = this.tables.reduce((p, c) => {
				return p + c.maximumSize;
			}, 0);

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
					warn('Got result set update request for non-existant table');
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

	private addResultSet(resultSet: sqlops.ResultSetSummary[]) {
		let tables: GridTable<any>[] = [];

		for (let set of resultSet) {
			let tableState: GridTableState;
			if (this._state) {
				tableState = this.state.tableStates.find(e => e.batchId === set.batchId && e.resultId === set.id);
			}
			if (!tableState) {
				tableState = new GridTableState(set.id, set.batchId);
				if (this._state) {
					this._state.tableStates.push(tableState);
				}
			}
			let table = this.instantiationService.createInstance(GridTable, this.runner, set, tableState);
			this.tableDisposable.push(tableState.onMaximizedChange(e => {
				if (e) {
					this.maximizeTable(table.id);
				} else {
					this.minimizeTables();
				}
			}));
			this.tableDisposable.push(attachTableStyler(table, this.themeService));

			tables.push(table);
		}

		// possible to need a sort?

		if (isUndefinedOrNull(this.maximizedGrid)) {
			this.splitView.addViews(tables, tables.map(i => i.minimumSize), this.splitView.length);
		}

		this.tables = this.tables.concat(tables);
	}

	public clear() {
		this.reset();
	}

	private reset() {
		for (let i = this.splitView.length - 1; i >= 0; i--) {
			this.splitView.removeView(i);
		}
		dispose(this.tables);
		dispose(this.tableDisposable);
		this.tableDisposable = [];
		this.tables = [];
		this.maximizedGrid = undefined;

		this.maximumBodySize = this.tables.reduce((p, c) => {
			return p + c.maximumSize;
		}, 0);
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
		this.tables.map(t => {
			let state = this.state.tableStates.find(s => s.batchId === t.resultSet.batchId && s.resultId === t.resultSet.id);
			if (!state) {
				this.state.tableStates.push(t.state);
			}
			if (state) {
				t.state = state;
			}
		});
		this.setExpanded(!this.state.collapsed);
	}

	public get state(): GridPanelState {
		return this._state;
	}

	public dispose() {
		dispose(this.queryRunnerDisposables);
		dispose(this.tableDisposable);
		dispose(this.tables);
		this.tableDisposable = undefined;
		this.tables = undefined;
		super.dispose();
	}
}

class GridTable<T> extends Disposable implements IView {
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

	public get resultSet(): sqlops.ResultSetSummary {
		return this._resultSet;
	}

	// this handles if the row count is small, like 4-5 rows
	private get maxSize(): number {
		return ((this.resultSet.rowCount) * ROW_HEIGHT) + HEADER_HEIGHT + ESTIMATED_SCROLL_BAR_HEIGHT;
	}

	constructor(
		private runner: QueryRunner,
		private _resultSet: sqlops.ResultSetSummary,
		state: GridTableState,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IEditorService private editorService: IEditorService,
		@IUntitledEditorService private untitledEditorService: IUntitledEditorService,
		@IConfigurationService private configurationService: IConfigurationService
	) {
		super();
		this.state = state;
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this.container.className = 'grid-panel';

		this.columns = this.resultSet.columnInfo.map((c, i) => {
			let isLinked = c.isXml || c.isJson;

			return <Slick.Column<T>>{
				id: i.toString(),
				name: c.columnName === 'Microsoft SQL Server 2005 XML Showplan'
					? 'XML Showplan'
					: escape(c.columnName),
				field: i.toString(),
				formatter: isLinked ? hyperLinkFormatter : textFormatter,
				width: this.state.columnSizes && this.state.columnSizes[i] ? this.state.columnSizes[i] : undefined
			};
		});
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
			() => TPromise.as([])
		);
		this.dataProvider.dataRows = collection;
		this.table.updateRowCount();
		// when we are removed slickgrid acts badly so we need to account for that
		this.scrolled = false;
	}

	private build(): void {
		let tableContainer = document.createElement('div');
		tableContainer.style.display = 'inline-block';
		tableContainer.style.width = `calc(100% - ${ACTIONBAR_WIDTH}px)`;

		this.container.appendChild(tableContainer);

		let collection = new VirtualizedCollection(
			50,
			index => this.placeholdGenerator(index),
			0,
			() => TPromise.as([])
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
			rowHeight: ROW_HEIGHT,
			showRowNumber: true,
			forceFitColumns: false,
			defaultColumnWidth: 120
		};
		this.dataProvider = new AsyncDataProvider(collection);
		this.table = this._register(new Table(tableContainer, { dataProvider: this.dataProvider, columns: this.columns }, tableOptions));
		this.table.setSelectionModel(this.selectionModel);
		this.table.registerPlugin(new MouseWheelSupport());
		this.table.registerPlugin(new AutoColumnSize({ autoSizeOnRender: !this.state.columnSizes && this.configurationService.getValue('resultsGrid.autoSizeColumns') }));
		this.table.registerPlugin(copyHandler);
		this.table.registerPlugin(this.rowNumberColumn);
		this.table.registerPlugin(new AdditionalKeyBindings());
		this._register(this.table.onContextMenu(this.contextMenu, this));
		this._register(this.table.onClick(this.onTableClick, this));

		if (this.styles) {
			this.table.style(this.styles);
		}

		let actions = this.getCurrentActions();

		let actionBarContainer = document.createElement('div');
		actionBarContainer.style.width = ACTIONBAR_WIDTH + 'px';
		actionBarContainer.style.display = 'inline-block';
		actionBarContainer.style.height = '100%';
		actionBarContainer.style.verticalAlign = 'top';
		this.container.appendChild(actionBarContainer);
		this.actionBar = new ActionBar(actionBarContainer, {
			orientation: ActionsOrientation.VERTICAL, context: {
				runner: this.runner,
				batchId: this.resultSet.batchId,
				resultId: this.resultSet.id,
				table: this.table,
				tableState: this.state
			}
		});
		// update context before we run an action
		this.selectionModel.onSelectedRangesChanged.subscribe(e => {
			this.actionBar.context = this.generateContext();
		});
		this.actionBar.push(actions, { icon: true, label: false });

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
			this.runner.getQueryRows(event.cell.row, 1, this.resultSet.batchId, this.resultSet.id).then(d => {
				let value = d.resultSubset.rows[0][event.cell.cell - 1];
				let content = value.displayValue;
				if (column.isXml) {
					try {
						content = pretty.pd.xml(content);
					} catch (e) {
						// If Xml fails to parse, fall back on original Xml content
					}
				} else {
					let jsonContent: string = undefined;
					try {
						jsonContent = JSON.parse(content);
					} catch (e) {
						// If Json fails to parse, fall back on original Json content
					}
					if (jsonContent) {
						// If Json content was valid and parsed, pretty print content to a string
						content = JSON.stringify(jsonContent, undefined, 4);
					}
				}

				let input = this.untitledEditorService.createOrGet(undefined, column.isXml ? 'xml' : 'json', content);
				this.editorService.openEditor(input);
			});
		}
	}

	public updateResult(resultSet: sqlops.ResultSetSummary) {
		this._resultSet = resultSet;
		if (this.table && this.visible) {
			this.dataProvider.length = resultSet.rowCount;
			this.table.updateRowCount();
		}
		this._onDidChange.fire();
	}

	private generateContext(cell?: Slick.Cell): IGridActionContext {
		const selection = this.selectionModel.getSelectedRanges();
		return <IGridActionContext>{
			cell,
			selection,
			runner: this.runner,
			batchId: this.resultSet.batchId,
			resultId: this.resultSet.id,
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

	private getCurrentActions(): IAction[] {

		let actions = [];

		if (this.state.canBeMaximized) {
			if (this.state.maximized) {
				actions.splice(1, 0, new RestoreTableAction());
			} else {
				actions.splice(1, 0, new MaximizeTableAction());
			}
		}

		actions.push(
			new SaveResultAction(SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV),
			new SaveResultAction(SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL),
			new SaveResultAction(SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON),
			new SaveResultAction(SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveResultAction.SAVEXML_ICON, SaveFormat.XML),
			this.instantiationService.createInstance(ChartDataAction)
		);

		return actions;
	}

	public layout(size?: number): void {
		if (!this.table) {
			this.build();
		}
		if (!size) {
			size = this.currentHeight;
		} else {
			this.currentHeight = size;
		}
		this.table.layout(size, Orientation.VERTICAL);
	}

	public get minimumSize(): number {
		// clamp between ensuring we can show the actionbar, while also making sure we don't take too much space
		return Math.max(Math.min(this.maxSize, MIN_GRID_HEIGHT), ACTIONBAR_HEIGHT + BOTTOM_PADDING);
	}

	public get maximumSize(): number {
		return Math.max(this.maxSize, ACTIONBAR_HEIGHT + BOTTOM_PADDING);
	}

	private loadData(offset: number, count: number): Thenable<T[]> {
		return this.runner.getQueryRows(offset, count, this.resultSet.batchId, this.resultSet.id).then(response => {
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
				let actions = [
					new SelectAllGridAction(),
					new Separator(),
					new SaveResultAction(SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV),
					new SaveResultAction(SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL),
					new SaveResultAction(SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON),
					new SaveResultAction(SaveResultAction.SAVEXML_ID, SaveResultAction.SAVEXML_LABEL, SaveResultAction.SAVEXML_ICON, SaveFormat.XML),
					new Separator(),
					new CopyResultAction(CopyResultAction.COPY_ID, CopyResultAction.COPY_LABEL, false),
					new CopyResultAction(CopyResultAction.COPYWITHHEADERS_ID, CopyResultAction.COPYWITHHEADERS_LABEL, true)
				];

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
		$(this.container).destroy();
		this.table.dispose();
		this.actionBar.dispose();
		super.dispose();
	}
}
