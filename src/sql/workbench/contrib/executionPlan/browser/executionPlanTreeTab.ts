/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { ExecutionPlanState } from 'sql/workbench/common/editor/query/executionPlanState';
import { TreeGrid } from 'sql/base/browser/ui/table/treeGrid';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as sqlExtHostType from 'sql/workbench/api/common/sqlExtHostTypes';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';
import { ITableKeyboardEvent } from 'sql/base/browser/ui/table/interfaces';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { Action } from 'vs/base/common/actions';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { textFormatter } from 'sql/base/browser/ui/table/formatters';
import { ExecutionPlanViewHeader } from 'sql/workbench/contrib/executionPlan/browser/executionPlanViewHeader';
import { CopyKeybind } from 'sql/base/browser/ui/table/plugins/copyKeybind.plugin';
import { Disposable } from 'vs/base/common/lifecycle';
import { deepClone } from 'vs/base/common/objects';

export class ExecutionPlanTreeTab extends Disposable implements IPanelTab {
	public readonly title: string = localize('planTreeTab.title', 'Plan Tree (Preview)');
	public readonly identifier: string = 'planTreeTab';
	public readonly view: ExecutionPlanTreeTabView;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super();
		this.view = this._register(instantiationService.createInstance(ExecutionPlanTreeTabView));
	}

	public clear() {

	}
}

export class ExecutionPlanTreeTabView extends Disposable implements IPanelView {
	private _container: HTMLElement = DOM.$('.top-operations-tab');
	private _input: ExecutionPlanState;
	private _treeGrids: TreeGrid<Slick.SlickData>[] = [];
	private _planTreeContainers: HTMLElement[] = [];

	constructor(
		@IThemeService private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextMenuService private _contextMenuService: IContextMenuService
	) {
		super();
	}

	public set state(newInput: ExecutionPlanState) {
		const oldInput = this._input;

		if (oldInput === newInput) {
			return;
		}

		this._input = newInput;
		this.renderInput();
	}

	render(parent: HTMLElement): void {
		parent.appendChild(this._container);
	}

	public renderInput() {
		while (this._container.firstChild) {
			this._container.removeChild(this._container.firstChild);
		}
		this._input.graphs.forEach((g, i) => {
			this.convertExecutionPlanGraphToTreeGrid(g, i);
		});
	}

	public convertExecutionPlanGraphToTreeGrid(graph: azdata.executionPlan.ExecutionPlanGraph, index: number): TreeGrid<Slick.SlickData> {
		let dataMap: { [key: string]: any }[] = [];
		const columnValues: string[] = [];
		const stack: { node: azdata.executionPlan.ExecutionPlanNode, parentIndex: number }[] = [];
		stack.push({
			node: graph.root,
			parentIndex: -1,
		});
		while (stack.length !== 0) {
			const treeGridNode = stack.pop();
			const row: { [key: string]: any } = {};
			treeGridNode.node.topOperationsData.forEach((d, i) => {
				let displayText = d.displayValue.toString();

				row[d.columnName] = {
					text: displayText,
					ariaLabel: d.displayValue,
					dataType: d.dataType
				};

				if (columnValues.indexOf(d.columnName) === -1) {
					columnValues.splice(i, 0, d.columnName);
				}
			});
			row['nodeId'] = treeGridNode.node.id;
			row['parent'] = treeGridNode.parentIndex;
			row['parentNodeId'] = dataMap[treeGridNode.parentIndex] ? dataMap[treeGridNode.parentIndex]['nodeId'] : undefined;
			row['expanded'] = true;
			if (treeGridNode.node.children) {
				treeGridNode.node.children.forEach(c => stack.push({
					node: c,
					parentIndex: dataMap.length
				}));
			}

			dataMap.push(row);
		}

		const columns = columnValues.map((c, i) => {
			return <Slick.Column<Slick.SlickData>>{
				id: c.toString(),
				name: c,
				field: c.toString(),
				formatter: textFormatter,
				sortable: true,
			};
		});

		columns[0].width = 500;

		const topOperationContainer = DOM.$('.top-operations-container');
		this._container.appendChild(topOperationContainer);
		const header = this._instantiationService.createInstance(ExecutionPlanViewHeader, topOperationContainer, {
			planIndex: index,
		});
		header.query = graph.query;
		header.relativeCost = graph.root.relativeCost;
		const tableContainer = DOM.$('.table-container');
		topOperationContainer.appendChild(tableContainer);
		this._planTreeContainers.push(topOperationContainer);

		let copyHandler = new CopyKeybind<any>();
		this._register(copyHandler.onCopy(e => {

			const selectedDataRange = selectionModel.getSelectedRanges()[0];
			let csvString = '';
			if (selectedDataRange) {
				const data = [];

				for (let rowIndex = selectedDataRange.fromRow; rowIndex <= selectedDataRange.toRow; rowIndex++) {
					const dataRow = treeGrid.getData().getItem(rowIndex);
					const row = [];
					for (let colIndex = selectedDataRange.fromCell; colIndex <= selectedDataRange.toCell; colIndex++) {
						const dataItem = dataRow[treeGrid.grid.getColumns()[colIndex].field];
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
					columns.push(treeGrid.grid.getColumns()[colIndex].name);
				}

			}

			this._instantiationService.createInstance(CopyTableData).run({
				selectedText: csvString
			});
		}));

		const selectionModel = new CellSelectionModel<Slick.SlickData>();

		const treeGrid = new TreeGrid<Slick.SlickData>(tableContainer, {
			columns: columns,
			sorter: (args) => {
				const sortColumn = args.sortCol.field;
				let data = deepClone(dataMap);
				if (data.length === 0) {
					data = treeGrid.getData().getItems();
				}
				const sortedData = [];
				const rootRow = data[0];
				const stack: { row: Slick.SlickData, originalIndex: number }[] = [];
				stack.push({ row: rootRow, originalIndex: 0 });

				while (stack.length !== 0) {
					const currentTreeGridRow = stack.pop();
					let currentTreeGridRowChildren: { row: Slick.SlickData, originalIndex: number }[] = [];
					sortedData.push(currentTreeGridRow.row);
					for (let i = 0; i < data.length; i++) {
						if (data[i].parentNodeId === currentTreeGridRow.row.nodeId) {
							currentTreeGridRowChildren.push({ row: data[i], originalIndex: i });
						}
					}

					currentTreeGridRowChildren = currentTreeGridRowChildren.sort((a, b) => {
						const aRow = a.row;
						const bRow = b.row;
						let result = -1;
						if (!aRow[sortColumn]) {
							result = 1;
						} else {
							if (!bRow[sortColumn]) {
								result = -1;
							} else {
								const dataType = aRow[sortColumn].dataType;
								const aText = aRow[sortColumn].text;
								const bText = bRow[sortColumn].text;
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

					currentTreeGridRowChildren.forEach(c => {
						c.row['parent'] = sortedData.length - 1;
					});

					stack.push(...currentTreeGridRowChildren);
				}
				dataMap = sortedData;
				treeGrid.setData(sortedData);
			}
		}, {
			rowHeight: RESULTS_GRID_DEFAULTS.rowHeight,
			forceFitColumns: false,
			defaultColumnWidth: 120,
			showRowNumber: true
		});
		treeGrid.setSelectionModel(selectionModel);
		treeGrid.setData(dataMap);

		treeGrid.registerPlugin(copyHandler);

		treeGrid.setTableTitle(localize('topOperationsTableTitle', "Execution Plan Tree"));

		this._treeGrids.push(treeGrid);
		const contextMenuAction = [
			this._instantiationService.createInstance(CopyTableData),
			this._instantiationService.createInstance(CopyTableDataWithHeader),
			this._instantiationService.createInstance(SelectAll)
		];

		this._register(treeGrid.onKeyDown((evt: ITableKeyboardEvent) => {
			if (evt.event.ctrlKey && (evt.event.key === 'a' || evt.event.key === 'A')) {
				selectionModel.setSelectedRanges([new Slick.Range(0, 0, treeGrid.getData().getLength() - 1, treeGrid.grid.getColumns().length - 1)]);
				treeGrid.focus();
				evt.event.preventDefault();
				evt.event.stopPropagation();
			}
		}));

		this._register(treeGrid.onContextMenu(e => {
			const selectedDataRange = selectionModel.getSelectedRanges()[0];
			let csvString = '';
			let csvStringWithHeader = '';
			if (selectedDataRange) {
				const data = [];

				for (let rowIndex = selectedDataRange.fromRow; rowIndex <= selectedDataRange.toRow; rowIndex++) {
					const dataRow = treeGrid.getData().getItem(rowIndex);
					const row = [];
					for (let colIndex = selectedDataRange.fromCell; colIndex <= selectedDataRange.toCell; colIndex++) {
						const dataItem = dataRow[treeGrid.grid.getColumns()[colIndex].field];
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
					columns.push(treeGrid.grid.getColumns()[colIndex].name);
				}

				csvStringWithHeader = columns.join('\t') + '\n' + csvString;
			}

			this._contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => contextMenuAction,
				getActionsContext: () => ({
					selectedText: csvString,
					selectionModel: selectionModel,
					treeGrid: treeGrid,
					selectionTextWithHeader: csvStringWithHeader
				})
			});

		}));
		attachTableStyler(treeGrid, this._themeService);

		new ResizeObserver((e) => {
			treeGrid.layout(new DOM.Dimension(tableContainer.clientWidth, tableContainer.clientHeight));
		}).observe(tableContainer);
		return treeGrid;
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

export class CopyTableData extends Action {
	public static ID = 'ept.CopyTableData';
	public static LABEL = localize('ept.topOperationsCopyTableData', "Copy");

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
	public static ID = 'ept.CopyTableDataWithHeader';
	public static LABEL = localize('ept.topOperationsCopyWithHeader', "Copy with Header");

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
	public static ID = 'ept.SelectAllTableData';
	public static LABEL = localize('ept.topOperationsSelectAll', "Select All");

	constructor(
	) {
		super(SelectAll.ID, SelectAll.LABEL, '');
	}

	public override async run(context: ContextMenuModel): Promise<void> {
		context.selectionModel.setSelectedRanges([new Slick.Range(0, 0, context.treeGrid.getData().getLength() - 1, context.treeGrid.grid.getColumns().length - 1)]);
	}
}

interface ContextMenuModel {
	selectedText?: string;
	selectionModel?: CellSelectionModel<Slick.SlickData>;
	treeGrid?: TreeGrid<Slick.SlickData>;
	selectionTextWithHeader?: string;
}
