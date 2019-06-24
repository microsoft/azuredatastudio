/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ITableRenderer } from 'sql/base/browser/ui/table/highPerf/table';
import { Table } from 'sql/base/browser/ui/table/highPerf/tableWidget';
import { IView, Orientation } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';
import { GridTableState } from 'sql/workbench/parts/query/electron-browser/gridPanel';
import { VirtualizedWindow } from 'sql/base/browser/ui/table/highPerf/virtualizedWindow';
import { IColumn } from 'sql/base/browser/ui/table/highPerf/tableView';
import { SaveFormat } from 'sql/workbench/parts/grid/common/interfaces';
import { RestoreTableAction, MaximizeTableAction, SaveResultAction, ChartDataAction } from 'sql/workbench/parts/query/browser/actions';
import QueryRunner from 'sql/platform/query/common/queryRunner';

import { append, $, getContentWidth, getContentHeight } from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { Emitter, Event } from 'vs/base/common/event';
import { generateUuid } from 'vs/base/common/uuid';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IAction } from 'vs/base/common/actions';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { attachHighPerfTableStyler } from 'sql/platform/theme/common/styler';

type ICellTemplate = HTMLElement;

class TableFormatter<T> implements ITableRenderer<T, ICellTemplate> {
	renderTemplate(container: HTMLElement): ICellTemplate {
		return append(container, $('.cell'));
	}

	renderCell(element: T, index: number, columnId: string, templateData: ICellTemplate, width: number): void {
		templateData.innerText = element[columnId];
	}

	disposeCell?(element: T, index: number, columnId: string, templateData: ICellTemplate, width: number): void {
		templateData.innerText = '';
	}

	disposeTemplate(templateData: ICellTemplate): void {
	}

}

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

export class GridTable<T> extends Disposable implements IView {
	private table: Table<T>;
	private actionBar: ActionBar;
	private container = $('.grid-panel');

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
		private readonly runner: QueryRunner,
		private _resultSet: azdata.ResultSetSummary,
		state: GridTableState,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IThemeService private readonly themeService: IThemeService
	) {
		super();
		let config = this.configurationService.getValue<{ rowHeight: number }>('resultsGrid');
		this.rowHeight = config && config.rowHeight ? config.rowHeight : ROW_HEIGHT;
		this.state = state;
		this.container.style.width = '100%';
		this.container.style.height = '100%';

		this.columns = this.resultSet.columnInfo.map<IColumn<T, any>>((c, i) => ({
			id: i.toString(),
			name: c.columnName === 'Microsoft SQL Server 2005 XML Showplan'
				? 'XML Showplan'
				: escape(c.columnName),
			renderer: new TableFormatter(),
			width: this.state.columnSizes && this.state.columnSizes[i] ? this.state.columnSizes[i] : undefined
		}));
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

		this.table = new Table<T>(tableContainer, this.columns, {
			getRow: index => this.virtWindow.getIndex(index)
		}, { rowHeight: this.rowHeight });
		this.table.length = this.resultSet.rowCount;

		this._register(attachHighPerfTableStyler(this.table, this.themeService));

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

	public get state(): GridTableState {
		return this._state;
	}

	public set state(val: GridTableState) {
		this._state = val;
	}

	public updateResult(resultSet: azdata.ResultSetSummary) {
		this._resultSet = resultSet;
		if (this.table) {
			this.virtWindow.length = resultSet.rowCount;
			this.table.length = resultSet.rowCount;
		}
		this._onDidChange.fire(undefined);
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
