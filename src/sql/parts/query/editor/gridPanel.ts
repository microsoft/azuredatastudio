/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { attachTableStyler } from 'sql/common/theme/styler';
import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { VirtualizedCollection, AsyncDataProvider } from 'sql/base/browser/ui/table/asyncDataView';
import { Table, ITableStyles, ITableContextMenuEvent } from 'sql/base/browser/ui/table/table';
import { ScrollableSplitView } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';
import { MouseWheelSupport } from 'sql/base/browser/ui/table/plugins/mousewheelTableScroll.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { SaveFormat } from 'sql/parts/grid/common/interfaces';
import { IGridActionContext, SaveResultAction, CopyResultAction, SelectAllGridAction, MaximizeTableAction, MinimizeTableAction, ChartDataAction } from 'sql/parts/query/editor/actions';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';

import * as sqlops from 'sqlops';

import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Emitter, Event } from 'vs/base/common/event';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { range } from 'vs/base/common/arrays';
import { Orientation, IView } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable, IDisposable, dispose } from 'vs/base/common/lifecycle';
import { $ } from 'vs/base/browser/builder';
import { generateUuid } from 'vs/base/common/uuid';
import { TPromise } from 'vs/base/common/winjs.base';
import { Separator, ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { Dimension, getContentWidth } from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

const rowHeight = 29;
const columnHeight = 26;
const minGridHeightInRows = 8;
const estimatedScrollBarHeight = 10;

export interface IGridTableState {
	canBeMaximized: boolean;
	maximized: boolean;
}

export class GridTableState {

	private _maximized: boolean;

	private _onMaximizedChange = new Emitter<boolean>();
	public onMaximizedChange: Event<boolean> = this._onMaximizedChange.event;

	public canBeMaximized: boolean;

	constructor(state?: IGridTableState) {
		if (state) {
			this._maximized = state.maximized;
			this.canBeMaximized = state.canBeMaximized;
		}
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

	public clone(): GridTableState {
		return new GridTableState({ canBeMaximized: this.canBeMaximized, maximized: this.maximized });
	}
}

export class GridPanel extends ViewletPanel {
	private container = document.createElement('div');
	private splitView: ScrollableSplitView;
	private tables: GridTable<any>[] = [];
	private tableDisposable: IDisposable[] = [];
	private queryRunnerDisposables: IDisposable[] = [];

	private runner: QueryRunner;

	private maximizedGrid: GridTable<any>;

	constructor(
		title: string, options: IViewletPanelOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IThemeService private themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super(title, options, keybindingService, contextMenuService, configurationService);
		this.splitView = new ScrollableSplitView(this.container, { enableResizing: false });
	}

	protected renderBody(container: HTMLElement): void {
		this.container.style.width = '100%';
		this.container.style.height = '100%';

		container.appendChild(this.container);
	}

	protected layoutBody(size: number): void {
		this.splitView.layout(size);
	}

	public set queryRunner(runner: QueryRunner) {
		dispose(this.queryRunnerDisposables);
		this.reset();
		this.queryRunnerDisposables = [];
		this.runner = runner;
		this.queryRunnerDisposables.push(this.runner.onResultSet(e => this.onResultSet(e)));
		this.queryRunnerDisposables.push(this.runner.onQueryStart(() => this.reset()));
	}

	private onResultSet(resultSet: sqlops.ResultSetSummary | sqlops.ResultSetSummary[]) {
		this.addResultSet(resultSet);

		this.tables.map(t => {
			t.state.canBeMaximized = this.tables.length > 1;
		});

		this.maximumBodySize = this.tables.reduce((p, c) => {
			return p + c.maximumSize;
		}, 0);
	}

	private addResultSet(resultSet: sqlops.ResultSetSummary | sqlops.ResultSetSummary[]) {
		let resultsToAdd: sqlops.ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToAdd = [resultSet];
		} else {
			resultsToAdd = resultSet;
		}

		let tables: GridTable<any>[] = [];

		for (let set of resultsToAdd) {
			let tableState = new GridTableState();
			let table = new GridTable(this.runner, tableState, set, this.contextMenuService, this.instantiationService);
			tableState.onMaximizedChange(e => {
				if (e) {
					this.maximizeTable(table.id);
				} else {
					this.minimizeTables();
				}
			});
			this.tableDisposable.push(attachTableStyler(table, this.themeService));

			tables.push(table);
		}

		// possible to need a sort?

		if (isUndefinedOrNull(this.maximizedGrid)) {
			this.splitView.addViews(tables, tables.map(i => i.minimumSize), this.splitView.length);
		}

		this.tables = this.tables.concat(tables);
	}

	private reset() {
		for (let i = this.splitView.length - 1; i >= 0; i--) {
			this.splitView.removeView(i);
		}

		dispose(this.tables);
		this.tables = [];

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
}

class GridTable<T> extends Disposable implements IView {
	private static BOTTOMPADDING = 5;
	private static ACTIONBAR_WIDTH = 26;
	// this is the min height for grids
	private static MIN_GRID_HEIGHT = (minGridHeightInRows * rowHeight) + columnHeight + estimatedScrollBarHeight + GridTable.BOTTOMPADDING;
	private table: Table<T>;
	private actionBar: ActionBar;
	private container = document.createElement('div');
	private selectionModel = new CellSelectionModel();
	private styles: ITableStyles;

	private columns: Slick.Column<T>[];

	private _onDidChange = new Emitter<number>();
	public readonly onDidChange: Event<number> = this._onDidChange.event;

	public id = generateUuid();

	constructor(
		private runner: QueryRunner,
		public state: GridTableState,
		private resultSet: sqlops.ResultSetSummary,
		private contextMenuService: IContextMenuService,
		private instantiationService: IInstantiationService
	) {
		super();
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this.container.style.marginBottom = GridTable.BOTTOMPADDING + 'px';
		this.container.className = 'grid-panel';

		this.columns = this.resultSet.columnInfo.map((c, i) => {
			return <Slick.Column<T>>{
				id: i.toString(),
				name: c.columnName,
				field: i.toString(),
				width: 100
			};
		});
	}

	public render(container: HTMLElement, orientation: Orientation): void {
		container.appendChild(this.container);
	}

	private build(): void {
		let tableContainer = document.createElement('div');
		tableContainer.style.display = 'inline-block';

		this.container.appendChild(tableContainer);

		let collection = new VirtualizedCollection(50, this.resultSet.rowCount,
			(offset, count) => this.loadData(offset, count),
			index => this.placeholdGenerator(index)
		);
		collection.setCollectionChangedCallback((change, startIndex, count) => {
			this.renderGridDataRowsRange(startIndex, count);
		});
		let numberColumn = new RowNumberColumn({ numberOfRows: this.resultSet.rowCount });
		this.columns.unshift(numberColumn.getColumnDefinition());
		this.table = this._register(new Table(tableContainer, { dataProvider: new AsyncDataProvider(collection), columns: this.columns }, { rowHeight, showRowNumber: true }));
		this.table.setSelectionModel(this.selectionModel);
		this.table.registerPlugin(new MouseWheelSupport());
		this.table.registerPlugin(new AutoColumnSize());
		this.table.registerPlugin(numberColumn);
		this._register(this.table.onContextMenu(this.contextMenu, this));

		if (this.styles) {
			this.table.style(this.styles);
		}

		let actions = [];

		if (this.state.canBeMaximized) {
			if (this.state.maximized) {
				actions.splice(1, 0, new MinimizeTableAction());
			} else {
				actions.splice(1, 0, new MaximizeTableAction());
			}
		}

		actions.push(
			new SaveResultAction(SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveResultAction.SAVECSV_ICON, SaveFormat.CSV),
			new SaveResultAction(SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveResultAction.SAVEEXCEL_ICON, SaveFormat.EXCEL),
			new SaveResultAction(SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveResultAction.SAVEJSON_ICON, SaveFormat.JSON),
			this.instantiationService.createInstance(ChartDataAction)
		);

		let actionBarContainer = document.createElement('div');
		actionBarContainer.style.width = GridTable.ACTIONBAR_WIDTH + 'px';
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
		this.actionBar.push(actions, { icon: true, label: false });
	}

	public layout(size: number): void {
		if (!this.table) {
			this.build();
		}
		this.table.layout(
			new Dimension(
				getContentWidth(this.container) - GridTable.ACTIONBAR_WIDTH,
				size - GridTable.BOTTOMPADDING
			)
		);
	}

	public get minimumSize(): number {
		// this handles if the row count is small, like 4-5 rows
		let smallestRows = ((this.resultSet.rowCount) * rowHeight) + columnHeight + estimatedScrollBarHeight + GridTable.BOTTOMPADDING;
		return Math.min(smallestRows, GridTable.MIN_GRID_HEIGHT);
	}

	public get maximumSize(): number {
		return ((this.resultSet.rowCount) * rowHeight) + columnHeight + estimatedScrollBarHeight + GridTable.BOTTOMPADDING;
	}

	private loadData(offset: number, count: number): Thenable<T[]> {
		return this.runner.getQueryRows(offset, count, this.resultSet.batchId, this.resultSet.id).then(response => {
			return response.resultSubset.rows.map(r => {
				let dataWithSchema = {};
				// skip the first column since its a number column
				for (let i = 1; i < this.columns.length; i++) {
					dataWithSchema[this.columns[i].field] = r[i - 1].displayValue;
				}
				return dataWithSchema as T;
			});
		});
	}

	private contextMenu(e: ITableContextMenuEvent): void {
		const selection = this.selectionModel.getSelectedRanges();
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
					new Separator(),
					new CopyResultAction(CopyResultAction.COPY_ID, CopyResultAction.COPY_LABEL, false),
					new CopyResultAction(CopyResultAction.COPYWITHHEADERS_ID, CopyResultAction.COPYWITHHEADERS_LABEL, true)
				];

				if (this.state.canBeMaximized) {
					if (this.state.maximized) {
						actions.splice(1, 0, new MinimizeTableAction());
					} else {
						actions.splice(1, 0, new MaximizeTableAction());
					}
				}

				return TPromise.as(actions);
			},
			getActionsContext: () => {
				return <IGridActionContext>{
					cell,
					selection,
					runner: this.runner,
					batchId: this.resultSet.batchId,
					resultId: this.resultSet.id,
					table: this.table,
					tableState: this.state
				};
			}
		});
	}

	private placeholdGenerator(index: number): any {
		return { values: [] };
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
		super.dispose();
	}
}
