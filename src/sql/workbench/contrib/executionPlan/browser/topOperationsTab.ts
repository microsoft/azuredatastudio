/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/executionPlan';

import * as azdata from 'azdata';
import { IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import { ExecutionPlanState } from 'sql/workbench/common/editor/query/executionPlanState';
import { Table } from 'sql/base/browser/ui/table/table';
import { hyperLinkFormatter, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';
import { attachInputBoxStyler, attachTableStyler } from 'sql/platform/theme/common/styler';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { ExecutionPlanViewHeader } from 'sql/workbench/contrib/executionPlan/browser/executionPlanViewHeader';
import { QueryResultsView } from 'sql/workbench/contrib/query/browser/queryResultsView';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import * as sqlExtHostType from 'sql/workbench/api/common/sqlExtHostTypes';
import { listHoverBackground } from 'vs/platform/theme/common/colorRegistry';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { Action } from 'vs/base/common/actions';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ITableKeyboardEvent } from 'sql/base/browser/ui/table/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { filterIconClassNames, searchPlaceholder, topOperationsSearchDescription } from 'sql/workbench/contrib/executionPlan/browser/constants';

const TABLE_SORT_COLUMN_KEY = 'tableCostColumnForSorting';

export class TopOperationsTab extends Disposable implements IPanelTab {
	public readonly title = localize('topOperationsTabTitle', "Top Operations  (Preview)");
	public readonly identifier: string = 'TopOperationsTab';
	public readonly view: TopOperationsTabView;

	constructor(
		private _queryResultsView: QueryResultsView,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();
		this.view = this._register(instantiationService.createInstance(TopOperationsTabView, this._queryResultsView));
	}

	public clear() {
	}
}

export class TopOperationsTabView extends Disposable implements IPanelView {
	private _container: HTMLElement = DOM.$('.top-operations-tab');
	private _input: ExecutionPlanState;
	private _topOperationsContainers: HTMLElement[] = [];
	private _tables: Table<Slick.SlickData>[] = [];

	constructor(
		private _queryResultsView: QueryResultsView,
		@IThemeService private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IContextViewService private _contextViewService: IContextViewService
	) {
		super();
	}

	public scrollToIndex(index: number) {
		index = index - 1;
		this._topOperationsContainers[index].scrollIntoView(true);
		this._tables.forEach(t => {
			t.getSelectionModel().setSelectedRanges([]);
		});
		this._tables[index].getSelectionModel().setSelectedRanges([new Slick.Range(0, 1, 0, 1)]);
		this._tables[index].focus();
	}

	public set state(newInput: ExecutionPlanState) {
		const oldInput = this._input;

		if (oldInput === newInput) {
			return;
		}

		this._input = newInput;
		this.renderInput();
	}

	public render(parent: HTMLElement): void {
		parent.appendChild(this._container);
	}

	public renderInput(): void {
		while (this._container.firstChild) {
			this._container.removeChild(this._container.firstChild);
		}
		this._input.graphs.forEach((g, i) => {
			this.convertExecutionPlanGraphToTable(g, i);
		});
	}


	public convertExecutionPlanGraphToTable(graph: azdata.executionPlan.ExecutionPlanGraph, index: number): Table<Slick.SlickData> {

		const dataMap: { [key: string]: any }[] = [];
		const columnValues: string[] = [];

		const stack: azdata.executionPlan.ExecutionPlanNode[] = [];
		stack.push(...graph.root.children);
		while (stack.length !== 0) {
			const node = stack.pop();
			const row: { [key: string]: any } = {};
			node.topOperationsData.forEach((d, i) => {
				let displayText = d.displayValue.toString();
				if (i === 0) {
					row[d.columnName] = {
						displayText: displayText,
						linkOrCommand: ' ',
						dataType: d.dataType
					};
				} else {
					row[d.columnName] = {
						text: displayText,
						ariaLabel: d.displayValue,
						dataType: d.dataType
					};
				}
				if (columnValues.indexOf(d.columnName) === -1) {
					columnValues.splice(i, 0, d.columnName);
				}
			});
			row['nodeId'] = node.id;
			if (node.children) {
				node.children.forEach(c => stack.push(c));
			}
			row[TABLE_SORT_COLUMN_KEY] = node.cost;
			dataMap.push(row);
		}

		dataMap.sort((a, b) => {
			return b[TABLE_SORT_COLUMN_KEY] - a[TABLE_SORT_COLUMN_KEY];
		});

		const columns = columnValues.map((c, i) => {
			return <Slick.Column<Slick.SlickData>>{
				id: c.toString(),
				name: c,
				field: c.toString(),
				formatter: i === 0 ? hyperLinkFormatter : textFormatter,
				sortable: true
			};
		});

		const topOperationContainer = DOM.$('.top-operations-container');
		this._container.appendChild(topOperationContainer);

		const headerContainer = DOM.$('.top-operations-header');
		topOperationContainer.appendChild(headerContainer);

		const headerInfoContainer = DOM.$('.top-operations-header-info');
		headerContainer.appendChild(headerInfoContainer);

		const headerSearchBarContainer = DOM.$('.top-operations-header-search-bar');
		headerContainer.appendChild(headerSearchBarContainer);
		headerContainer.classList.add('codicon', filterIconClassNames);

		const topOperationsSearchInput = new InputBox(headerSearchBarContainer, this._contextViewService, {
			ariaDescription: topOperationsSearchDescription,
			placeholder: searchPlaceholder
		});
		attachInputBoxStyler(topOperationsSearchInput, this._themeService);
		topOperationsSearchInput.element.classList.add('codicon', filterIconClassNames);

		const header = this._instantiationService.createInstance(ExecutionPlanViewHeader, headerInfoContainer, {
			planIndex: index,
		});
		header.query = graph.query;
		header.relativeCost = graph.root.relativeCost;
		const tableContainer = DOM.$('.table-container');
		topOperationContainer.appendChild(tableContainer);
		this._topOperationsContainers.push(topOperationContainer);

		const rowNumberColumn = new RowNumberColumn({ numberOfRows: dataMap.length });
		columns.unshift(rowNumberColumn.getColumnDefinition());

		let copyHandler = new CopyKeybind<any>();
		this._register(copyHandler.onCopy(e => {

			const selectedDataRange = selectionModel.getSelectedRanges()[0];
			let csvString = '';
			if (selectedDataRange) {
				const data = [];

				for (let rowIndex = selectedDataRange.fromRow; rowIndex <= selectedDataRange.toRow; rowIndex++) {
					const dataRow = table.getData().getItem(rowIndex);
					const row = [];
					for (let colIndex = selectedDataRange.fromCell; colIndex <= selectedDataRange.toCell; colIndex++) {
						const dataItem = dataRow[table.columns[colIndex].field];
						if (dataItem) {
							row.push(dataItem.displayText ?? dataItem.text);
						} else {
							row.push(' ');
						}
					}
					data.push(row);
				}
				csvString = data.map(row =>
					row.map(x => `${x}`).join('\t')
				).join('\n');

				const columns = [];

				for (let colIndex = selectedDataRange.fromCell; colIndex <= selectedDataRange.toCell; colIndex++) {
					columns.push(table.columns[colIndex].name);
				}

			}

			this._instantiationService.createInstance(CopyTableData).run({
				selectedText: csvString
			});
		}));

		const selectionModel = new CellSelectionModel<Slick.SlickData>();

		const table = new Table<Slick.SlickData>(tableContainer, {
			columns: columns,
			sorter: (args) => {
				const column = args.sortCol.field;
				const sortedData = table.getData().getItems().sort((a, b) => {
					let result = -1;

					if (!a[column]) {
						result = 1;
					} else {
						if (!b[column]) {
							result = -1;
						} else {
							const dataType = a[column].dataType;

							const aText = a[column].displayText ?? a[column].text;
							const bText = b[column].displayText ?? b[column].text;
							if (aText === bText) {
								result = 0;
							} else {
								switch (dataType) {
									case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.String:
									case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Boolean:
										result = aText.localeCompare(bText);
										break;
									case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Number:
										result = parseFloat(aText) - parseFloat(bText);
										break;
								}
							}
						}
					}
					return args.sortAsc ? result : -result;
				});
				table.setData(sortedData);
			}
		}, {
			rowHeight: RESULTS_GRID_DEFAULTS.rowHeight,
			forceFitColumns: false,
			defaultColumnWidth: 120,
			showRowNumber: true
		});
		table.setSelectionModel(selectionModel);
		table.setData(dataMap);

		table.registerPlugin(copyHandler);

		table.setTableTitle(localize('topOperationsTableTitle', "Top Operations"));
		this._register(table.onClick(e => {
			if (e.cell.cell === 1) {
				const row = table.getData().getItem(e.cell.row);
				const nodeId = row['nodeId'];
				const planId = index;
				this._queryResultsView.switchToExecutionPlanTab();
				this._queryResultsView.focusOnNode(planId, nodeId);
			}
		}));

		this._tables.push(table);
		const contextMenuAction = [
			this._instantiationService.createInstance(CopyTableData),
			this._instantiationService.createInstance(CopyTableDataWithHeader),
			this._instantiationService.createInstance(SelectAll)
		];

		this._register(topOperationsSearchInput.onDidChange(e => {
			const filter = e.toLowerCase();
			if (filter) {
				const filteredData = dataMap.filter(row => {
					let includeRow = false;
					for (let i = 0; i < columns.length; i++) {
						const columnField = columns[i].field;
						if (row[columnField]) {
							const text = row[columnField].displayText ?? row[columnField].text;
							if (text.toLowerCase().includes(filter)) {
								includeRow = true;
							}
						}
					}
					return includeRow;
				});
				table.setData(filteredData);
			} else {
				table.setData(dataMap);
			}
			table.rerenderGrid();
		}));

		this._register(table.onKeyDown((evt: ITableKeyboardEvent) => {
			if (evt.event.ctrlKey && (evt.event.key === 'a' || evt.event.key === 'A')) {
				selectionModel.setSelectedRanges([new Slick.Range(0, 1, table.getData().getLength() - 1, table.columns.length - 1)]);
				table.focus();
				evt.event.preventDefault();
				evt.event.stopPropagation();
			}
		}));

		this._register(table.onContextMenu(e => {
			const selectedDataRange = selectionModel.getSelectedRanges()[0];
			let csvString = '';
			let csvStringWithHeader = '';
			if (selectedDataRange) {
				const data = [];

				for (let rowIndex = selectedDataRange.fromRow; rowIndex <= selectedDataRange.toRow; rowIndex++) {
					const dataRow = table.getData().getItem(rowIndex);
					const row = [];
					for (let colIndex = selectedDataRange.fromCell; colIndex <= selectedDataRange.toCell; colIndex++) {
						const dataItem = dataRow[table.columns[colIndex].field];
						if (dataItem) {
							row.push(dataItem.displayText ?? dataItem.text);
						} else {
							row.push('');
						}
					}
					data.push(row);
				}
				csvString = data.map(row =>
					row.map(x => `${x}`).join('\t')
				).join('\n');

				const columns = [];

				for (let colIndex = selectedDataRange.fromCell; colIndex <= selectedDataRange.toCell; colIndex++) {
					columns.push(table.columns[colIndex].name);
				}

				csvStringWithHeader = columns.join('\t') + '\n' + csvString;
			}

			this._contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => contextMenuAction,
				getActionsContext: () => ({
					selectedText: csvString,
					selectionModel: selectionModel,
					table: table,
					selectionTextWithHeader: csvStringWithHeader
				})
			});

		}));
		attachTableStyler(table, this._themeService);

		new ResizeObserver((e) => {
			table.layout(new DOM.Dimension(tableContainer.clientWidth, tableContainer.clientHeight));
		}).observe(tableContainer);
		return table;
	}

	layout(dimension: DOM.Dimension): void {
		this._container.style.width = dimension.width + 'px';
		this._container.style.height = dimension.height + 'px';
	}

	remove?(): void {
	}

	onShow?(): void {
	}

	onHide?(): void {
	}

}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const menuBackgroundColor = theme.getColor(listHoverBackground);
	if (menuBackgroundColor) {
		collector.addRule(`
		.top-operations-tab .top-operations-container .query-row {
			background-color: ${menuBackgroundColor};
		}
		`);
	}
});


export class CopyTableData extends Action {
	public static ID = 'ep.CopyTableData';
	public static LABEL = localize('ep.topOperationsCopyTableData', "Copy");

	constructor(
		@IClipboardService private _clipboardService: IClipboardService
	) {
		super(CopyTableData.ID, CopyTableData.LABEL, '');
	}

	public override async run(context: ContextMenuModel): Promise<void> {

		this._clipboardService.writeText(context.selectedText);
	}
}

export class CopyTableDataWithHeader extends Action {
	public static ID = 'ep.CopyTableData';
	public static LABEL = localize('ep.topOperationsCopyWithHeader', "Copy with Header");

	constructor(
		@IClipboardService private _clipboardService: IClipboardService
	) {
		super(CopyTableDataWithHeader.ID, CopyTableDataWithHeader.LABEL, '');
	}

	public override async run(context: ContextMenuModel): Promise<void> {

		this._clipboardService.writeText(context.selectionTextWithHeader);
	}
}

export class SelectAll extends Action {
	public static ID = 'ep.SelectAllTableData';
	public static LABEL = localize('ep.topOperationsSelectAll', "Select All");

	constructor(
	) {
		super(SelectAll.ID, SelectAll.LABEL, '');
	}

	public override async run(context: ContextMenuModel): Promise<void> {
		context.selectionModel.setSelectedRanges([new Slick.Range(0, 1, context.table.getData().getLength() - 1, context.table.columns.length - 1)]);
	}
}

interface ContextMenuModel {
	selectedText?: string;
	selectionModel?: CellSelectionModel<Slick.SlickData>;
	table?: Table<Slick.SlickData>;
	selectionTextWithHeader?: string;
}
