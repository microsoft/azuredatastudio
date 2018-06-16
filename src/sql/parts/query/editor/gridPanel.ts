/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { DragCellSelectionModel } from 'sql/base/browser/ui/table/plugins/dragCellSelectionModel.plugin';
import { attachTableStyler } from 'sql/common/theme/styler';
import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { VirtualizedCollection, AsyncDataProvider } from 'sql/base/browser/ui/table/asyncDataView';
import { Table, ITableStyles, ITableContextMenuEvent } from 'sql/base/browser/ui/table/table';
import { ScrollableSplitView } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';
import { MouseWheelSupport } from 'sql/base/browser/ui/table/plugins/mousewheelTableScroll.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { SaveFormat } from 'sql/parts/grid/common/interfaces';
import { IGridActionContext, SaveResultAction, CopyResultAction, SelectAllGridAction, MaximizeTableAction, MinimizeTableAction } from 'sql/parts/query/editor/actions';

import * as sqlops from 'sqlops';

import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Emitter, Event } from 'vs/base/common/event';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { isArray, isUndefinedOrNull } from 'vs/base/common/types';
import { range } from 'vs/base/common/arrays';
import { Orientation, IView } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable, IDisposable, dispose } from 'vs/base/common/lifecycle';
import { $ } from 'vs/base/browser/builder';
import { generateUuid } from 'vs/base/common/uuid';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TPromise } from 'vs/base/common/winjs.base';
import { Separator } from 'vs/base/browser/ui/actionbar/actionbar';

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
	private tables: GridTable[] = [];
	private tableDisposable: IDisposable[] = [];

	public runner: QueryRunner;

	private maximizedGrid: GridTable;

	constructor(
		title: string, options: IViewletPanelOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IThemeService private themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super(title, options, keybindingService, contextMenuService, configurationService);
		this.splitView = new ScrollableSplitView(this.container);
	}

	protected renderBody(container: HTMLElement): void {
		this.container.style.width = '100%';
		this.container.style.height = '100%';

		container.appendChild(this.container);
	}

	protected layoutBody(size: number): void {
		this.splitView.layout(size);
	}

	public onResultSet(resultSet: sqlops.ResultSetSummary | sqlops.ResultSetSummary[]) {
		if (isArray(resultSet)) {
			resultSet.forEach(c => {
				this.addResultSet(c);
			});
		} else {
			this.addResultSet(resultSet);
		}

		this.tables.map(t => {
			t.state.canBeMaximized = this.tables.length > 1;
		});

		this.maximumBodySize = this.tables.reduce((p, c) => {
			return p + c.maximumSize;
		}, 0);
	}

	private addResultSet(resultSet: sqlops.ResultSetSummary) {
		let tableState = new GridTableState();
		let table = new GridTable(this.runner, tableState, resultSet, this.contextMenuService, this.instantiationService);
		tableState.onMaximizedChange(e => {
			if (e) {
				this.maximizeTable(table.id);
			} else {
				this.minimizeTables();
			}
		});
		this.tableDisposable.push(attachTableStyler(table, this.themeService));
		if (isUndefinedOrNull(this.maximizedGrid)) {
			this.splitView.addView(table, table.minimumSize, this.splitView.length);
		}
		this.tables.push(table);
	}

	public reset() {
		for (let i = this.splitView.length - 1; i >= 0; i--) {
			this.splitView.removeView(i);
		}
		dispose(this.tables);
		this.tables = [];
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
			this.tables.map(t => {
				this.splitView.addView(t, t.minimumSize, this.splitView.length);
			});
		}
	}
}

class GridTable extends Disposable implements IView {
	private static BOTTOMPADDING = 5;
	private table: Table<any>;
	private container = document.createElement('div');
	private selectionModel = new DragCellSelectionModel();

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
		let collection = new VirtualizedCollection(50, resultSet.rowCount,
			(offset, count) => this.loadData(offset, count),
			index => this.placeholdGenerator(index)
		);
		collection.setCollectionChangedCallback((change, startIndex, count) => {
			this.renderGridDataRowsRange(startIndex, count);
		});
		let columns = resultSet.columnInfo.map<Slick.Column<any>>((c, i) => {
			return {
				id: i.toString(),
				name: c.columnName,
				field: i.toString(),
				width: 100
			};
		});
		this.table = this._register(new Table(this.container, { dataProvider: new AsyncDataProvider(collection, columns), columns }, { rowHeight, showRowNumber: true }));
		this.table.setSelectionModel(this.selectionModel);
		this.table.registerPlugin(new MouseWheelSupport());
		this.table.registerPlugin(new AutoColumnSize());
		this._register(this.table.onContextMenu(this.contextMenu, this));
	}

	public render(container: HTMLElement, orientation: Orientation): void {
		container.appendChild(this.container);
	}

	public layout(size: number): void {
		this.table.layout(size - GridTable.BOTTOMPADDING, Orientation.VERTICAL);
	}

	public get minimumSize(): number {
		let smallestRows = ((this.resultSet.rowCount) * rowHeight) + columnHeight + estimatedScrollBarHeight + GridTable.BOTTOMPADDING;
		let smallestSize = (minGridHeightInRows * rowHeight) + columnHeight + estimatedScrollBarHeight + GridTable.BOTTOMPADDING;
		return Math.min(smallestRows, smallestSize);
	}

	public get maximumSize(): number {
		return ((this.resultSet.rowCount) * rowHeight) + columnHeight + estimatedScrollBarHeight + GridTable.BOTTOMPADDING;
	}

	private loadData(offset: number, count: number): Thenable<any[]> {
		return this.runner.getQueryRows(offset, count, this.resultSet.batchId, this.resultSet.id).then(response => {
			let rows = response.resultSubset;
			return rows.rows.map(r => {
				return {
					values: r.map(c => {
						return c.displayValue;
					})
				};
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
					new SaveResultAction(SaveResultAction.SAVECSV_ID, SaveResultAction.SAVECSV_LABEL, SaveFormat.CSV),
					new SaveResultAction(SaveResultAction.SAVEEXCEL_ID, SaveResultAction.SAVEEXCEL_LABEL, SaveFormat.EXCEL),
					new SaveResultAction(SaveResultAction.SAVEJSON_ID, SaveResultAction.SAVEJSON_LABEL, SaveFormat.JSON),
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
		this.table.style(styles);
	}

	public dispose() {
		$(this.container).destroy();
		super.dispose();
	}
}
