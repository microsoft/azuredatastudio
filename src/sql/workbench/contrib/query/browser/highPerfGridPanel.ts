/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/optimizedGridPanel';

import { ITableRenderer, ITableColumn } from 'sql/base/browser/ui/table/highPerf/table';
import { VirtualizedWindow } from 'sql/base/browser/ui/table/highPerf/virtualizedWindow';
import { attachHighPerfTableStyler } from 'sql/platform/theme/common/styler';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { GridTableState } from 'sql/workbench/common/editor/query/gridTableState';
import { ResultSetSummary } from 'sql/workbench/services/query/common/query';

import { append, $ } from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import { generateUuid } from 'vs/base/common/uuid';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { WorkbenchTable } from 'sql/platform/table/browser/tableService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IView } from 'sql/base/browser/ui/scrollableView/scrollableView';

type ICellTemplate = HTMLElement;

class TableFormatter<T> implements ITableRenderer<T, ICellTemplate> {
	renderTemplate(container: HTMLElement): ICellTemplate {
		return append(container, $('.cell'));
	}

	renderCell(element: T, index: number, cellIndex: number, columnId: string, templateData: ICellTemplate, width: number): void {
		templateData.innerText = element[columnId];
	}

	disposeCell?(element: T, index: number, cellIndex: number, columnId: string, templateData: ICellTemplate, width: number): void {
		templateData.innerText = '';
	}

	disposeTemplate(templateData: ICellTemplate): void {
	}

}

const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 22;
const MIN_GRID_HEIGHT_ROWS = 8;
const ESTIMATED_SCROLL_BAR_SIZE = 10;
const BOTTOM_PADDING = 15;

// this handles min size if rows is greater than the min grid visible rows
const MIN_GRID_HEIGHT = (MIN_GRID_HEIGHT_ROWS * ROW_HEIGHT) + HEADER_HEIGHT + ESTIMATED_SCROLL_BAR_SIZE;

export class GridTable<T> extends Disposable implements IView {

	private _onDidChange = new Emitter<number>();
	public readonly onDidChange: Event<number> = this._onDidChange.event;

	private virtWindow: VirtualizedWindow<T>;
	private table: WorkbenchTable<T>;
	private tableContainer: HTMLElement;
	private columns: ITableColumn<T, ICellTemplate>[];

	public id = generateUuid();
	readonly element = $('.grid-panel.optimized');

	private _state: GridTableState;

	private rowHeight: number;

	public get resultSet(): ResultSetSummary {
		return this._resultSet;
	}

	// this handles if the row count is small, like 4-5 rows
	private get maxSize(): number {
		return ((this.resultSet.rowCount) * this.rowHeight) + HEADER_HEIGHT + ESTIMATED_SCROLL_BAR_SIZE;
	}

	// worthless for this table
	public isOnlyTable: boolean;

	constructor(
		private readonly runner: QueryRunner,
		private _resultSet: ResultSetSummary,
		state: GridTableState,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IThemeService private readonly themeService: IThemeService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();
		this.tableContainer = append(this.element, $('.table-panel'));
		let config = this.configurationService.getValue<{ rowHeight: number }>('resultsGrid');
		this.rowHeight = config && config.rowHeight ? config.rowHeight : ROW_HEIGHT;
		this.state = state;

		this.columns = this.resultSet.columnInfo.map<ITableColumn<T, any>>((c, i) => ({
			id: i.toString(),
			name: c.columnName === 'Microsoft SQL Server 2005 XML Showplan'
				? 'XML Showplan'
				: escape(c.columnName),
			renderer: new TableFormatter(),
			width: this.state.columnSizes && this.state.columnSizes[i] ? this.state.columnSizes[i] : undefined
		}));

		this.virtWindow = new VirtualizedWindow<T>(50, this.resultSet.rowCount, (offset, count) => {
			return Promise.resolve(this.runner.getQueryRows(offset, count, this._resultSet.batchId, this._resultSet.id).then(r => {
				return r.rows.map(c => c.reduce((p, c, i) => {
					p[this.columns[i].id] = c.displayValue;
					return p;
				}, Object.create(null)));
			}));
		});

		this.table = this._register(this.instantiationService.createInstance(WorkbenchTable, 'gridPanel', this.tableContainer, this.columns, {
			getRow: index => this.virtWindow.getIndex(index)
		}, { rowHeight: this.rowHeight, headerHeight: HEADER_HEIGHT, rowCountColumn: false }) as WorkbenchTable<T>);

		this.table.length = this.resultSet.rowCount;

		this._register(attachHighPerfTableStyler(this.table, this.themeService));
	}

	public get state(): GridTableState {
		return this._state;
	}

	public set state(val: GridTableState) {
		this._state = val;
	}

	public updateResult(resultSet: ResultSetSummary) {
		this._resultSet = resultSet;
		if (this.table) {
			this.virtWindow.length = resultSet.rowCount;
			this.table.length = resultSet.rowCount;
		}
		this._onDidChange.fire(undefined);
	}

	public layout(height: number, width: number): void {
		this.tableContainer.style.width = `${width - ESTIMATED_SCROLL_BAR_SIZE}px`;
		this.table.layout(height, width - ESTIMATED_SCROLL_BAR_SIZE);
	}

	public get minimumSize(): number {
		// clamp between ensuring we can show the actionbar, while also making sure we don't take too much space
		// if there is only one table then allow a minimum size of ROW_HEIGHT
		return Math.max(Math.min(this.maxSize, MIN_GRID_HEIGHT), BOTTOM_PADDING);
	}

	public get maximumSize(): number {
		return Math.max(this.maxSize, BOTTOM_PADDING);
	}

	public dispose() {
		this.element.remove();
		super.dispose();
	}

	public style(): void {
	}

	public focus() { }
}
