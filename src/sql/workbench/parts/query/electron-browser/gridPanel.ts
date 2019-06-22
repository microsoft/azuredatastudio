/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as pretty from 'pretty-data';
import 'vs/css!./gridPanel';

import { attachTableStyler } from 'sql/platform/theme/common/styler';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import { ScrollableSplitView, IView, Orientation } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';
import { SaveFormat } from 'sql/workbench/parts/grid/common/interfaces';
import { SaveResultAction, MaximizeTableAction, RestoreTableAction, ChartDataAction } from 'sql/workbench/parts/query/browser/actions';
import { escape } from 'sql/base/common/strings';
import { ITableStyles, ITableMouseEvent } from 'sql/base/browser/ui/table/interfaces';
import { TableView, IColumn } from 'sql/base/browser/ui/table/highPerf/tableView';
import { ITableRenderer } from 'sql/base/browser/ui/table/highPerf/table';

import * as azdata from 'azdata';

import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Emitter, Event } from 'vs/base/common/event';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { Disposable, IDisposable, dispose } from 'vs/base/common/lifecycle';
import { generateUuid } from 'vs/base/common/uuid';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { Dimension, $, append, getContentWidth, getContentHeight } from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IUntitledEditorService } from 'vs/workbench/services/untitled/common/untitledEditorService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IAction } from 'vs/base/common/actions';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { ILogService } from 'vs/platform/log/common/log';
import { VirtualizedWindow } from 'sql/base/browser/ui/table/highPerf/virtualizedWindow';

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

export class GridPanelState {
	public tableStates: GridTableState[] = [];
	public scrollPosition: number;

	dispose() {
		dispose(this.tableStates);
	}
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

export class GridPanel {
	private container = document.createElement('div');
	private splitView: ScrollableSplitView;
	private tables: GridTable<any>[] = [];
	private tableDisposable: IDisposable[] = [];
	private queryRunnerDisposables: IDisposable[] = [];
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
		this.splitView = new ScrollableSplitView(this.container, { enableResizing: false, verticalScrollbarVisibility: ScrollbarVisibility.Visible, scrollDebounce: 0 });
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
		dispose(this.tableDisposable);
		this.tableDisposable = [];
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
		dispose(this.queryRunnerDisposables);
		dispose(this.tableDisposable);
		dispose(this.tables);
		this.tableDisposable = undefined;
		this.tables = undefined;
	}
}

interface ICellTemplate {
	element: HTMLElement;
}

class TableFormatter<T> implements ITableRenderer<T, ICellTemplate> {
	constructor(private key: string) { }

	renderTemplate(container: HTMLElement): ICellTemplate {
		const element = append(container, $('.cell'));
		return { element };
	}

	renderCell(element: T, index: number, templateData: ICellTemplate, width: number): void {
		templateData.element.innerText = element[this.key];
	}

	disposeCell?(element: T, index: number, templateData: ICellTemplate, width: number): void {
		templateData.element.innerText = '';
	}

	disposeTemplate(templateData: ICellTemplate): void {
	}

}

class GridTable<T> extends Disposable implements IView {
	private table: TableView<T>;
	private actionBar: ActionBar;
	private container = document.createElement('div');

	private columns: IColumn<T, ICellTemplate>[];

	private _onDidChange = new Emitter<number>();
	public readonly onDidChange: Event<number> = this._onDidChange.event;

	private virtWindow: VirtualizedWindow<T>;

	public id = generateUuid();
	readonly element: HTMLElement = this.container;

	private _state: GridTableState;

	private rowHeight: number;

	public isOnlyTable: boolean = true;

	public get resultSet(): azdata.ResultSetSummary {
		return this._resultSet;
	}

	// this handles if the row count is small, like 4-5 rows
	private get maxSize(): number {
		return ((this.resultSet.rowCount) * this.rowHeight) + HEADER_HEIGHT + ESTIMATED_SCROLL_BAR_HEIGHT;
	}

	constructor(
		private runner: QueryRunner,
		private _resultSet: azdata.ResultSetSummary,
		state: GridTableState,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IEditorService private editorService: IEditorService,
		@IUntitledEditorService private untitledEditorService: IUntitledEditorService,
		@IConfigurationService private configurationService: IConfigurationService
	) {
		super();
		let config = this.configurationService.getValue<{ rowHeight: number }>('resultsGrid');
		this.rowHeight = config && config.rowHeight ? config.rowHeight : ROW_HEIGHT;
		this.state = state;
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this.container.className = 'grid-panel';

		this.columns = this.resultSet.columnInfo.map<IColumn<T, any>>((c, i) => ({
			id: i.toString(),
			name: c.columnName === 'Microsoft SQL Server 2005 XML Showplan'
				? 'XML Showplan'
				: escape(c.columnName),
			renderer: new TableFormatter(i.toString()),
			width: this.state.columnSizes && this.state.columnSizes[i] ? this.state.columnSizes[i] : undefined
		})
		);
	}

	private build(): void {
		const tableContainer = document.createElement('div');
		tableContainer.style.display = 'inline-block';
		tableContainer.style.width = `calc(100% - ${ACTIONBAR_WIDTH}px)`;
		tableContainer.style.height = '100%';

		this.container.appendChild(tableContainer);

		this.virtWindow = new VirtualizedWindow<T>(50, this.resultSet.rowCount, (offset, count) => {
			return Promise.resolve(this.runner.getQueryRows(offset, count, this._resultSet.batchId, this._resultSet.id).then(r => {
				return r.resultSubset.rows.map(c => c.reduce((p, c, i) => {
					p[this.columns[i].id] = c.displayValue;
					return p;
				}, Object.create(null)));
			}));
		});

		this.table = new TableView<T>(tableContainer, this.columns, {
			getRow: index => this.virtWindow.getIndex(index)
		});
		this.table.length = this.resultSet.rowCount;

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
		this.actionBar.push(actions, { icon: true, label: false });
	}

	private restoreScrollState() {
		if (this.state.scrollPositionX || this.state.scrollPositionY) {
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

	public updateResult(resultSet: azdata.ResultSetSummary) {
		this._resultSet = resultSet;
		if (this.table) {
			this.virtWindow.length = resultSet.rowCount;
			this.table.length = resultSet.rowCount;
		}
		this._onDidChange.fire(undefined);
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

	public layout(size?: number, orientation?: Orientation, width?: number): void {
		if (!this.table) {
			this.build();
		}
		const layoutWidth = width || (!isUndefinedOrNull(orientation) && orientation === Orientation.VERTICAL ? getContentWidth(this.element) : getContentHeight(this.element)) || undefined;
		this.table.layout(size, layoutWidth - ACTIONBAR_WIDTH);
	}

	public get minimumSize(): number {
		// clamp between ensuring we can show the actionbar, while also making sure we don't take too much space
		// if there is only one table then allow a minimum size of ROW_HEIGHT
		return this.isOnlyTable ? ROW_HEIGHT : Math.max(Math.min(this.maxSize, MIN_GRID_HEIGHT), ACTIONBAR_HEIGHT + BOTTOM_PADDING);
	}

	public get maximumSize(): number {
		return Math.max(this.maxSize, ACTIONBAR_HEIGHT + BOTTOM_PADDING);
	}

	public style(styles: ITableStyles) {
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
