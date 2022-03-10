/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import type * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { Table } from 'sql/base/browser/ui/table/table';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { removeLineBreaks } from 'sql/base/common/strings';
import { isString } from 'vs/base/common/types';
import { sortAlphabeticallyIconClassNames, sortByDisplayOrderIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { textFormatter } from 'sql/base/browser/ui/table/formatters';


export class ExecutionPlanPropertiesView {

	// Title bar with close button action
	private _propertiesTitle!: HTMLElement;
	private _titleText!: HTMLElement;
	private _titleActionBarContainer!: HTMLElement;
	private _titleActionBar: ActionBar;

	// Div that holds the name of the element selected
	private _operationName!: HTMLElement;

	// Action bar that contains sorting option for the table
	private _tableActionBarContainer!: HTMLElement;
	private _tableActionBar!: ActionBar;

	// Properties table
	private _table: Table<Slick.SlickData>;
	private _dataView: TableDataView<Slick.SlickData>;
	private _data: { [key: string]: string }[];
	private _tableContainer!: HTMLElement;
	private _actualTable!: HTMLElement;

	// Table dimensions.
	private _tableWidth = 485;
	private _tableHeight;

	public constructor(
		private _parentContainer: HTMLElement,
		private _themeService: IThemeService,
		private _model: GraphElementPropertyViewData = <GraphElementPropertyViewData>{}
	) {
		this._parentContainer.style.display = 'none';

		this._propertiesTitle = DOM.$('.title');
		this._parentContainer.appendChild(this._propertiesTitle);

		this._titleText = DOM.$('h3');
		this._titleText.classList.add('text');
		this._titleText.innerText = localize('nodePropertyViewTitle', "Properties");
		this._propertiesTitle.appendChild(this._titleText);

		this._titleActionBarContainer = DOM.$('.action-bar');
		this._propertiesTitle.appendChild(this._titleActionBarContainer);
		this._titleActionBar = new ActionBar(this._titleActionBarContainer, {
			orientation: ActionsOrientation.HORIZONTAL, context: this
		});
		this._titleActionBar.pushAction([new ClosePropertyViewAction()], { icon: true, label: false });

		this._operationName = DOM.$('h3');
		this._operationName.classList.add('operation-name');
		this._parentContainer.appendChild(this._operationName);

		this._tableActionBarContainer = DOM.$('.table-action-bar');
		this._parentContainer.appendChild(this._tableActionBarContainer);
		this._tableActionBar = new ActionBar(this._tableActionBarContainer, {
			orientation: ActionsOrientation.HORIZONTAL, context: this
		});
		this._tableActionBar.pushAction([new SortPropertiesByDisplayOrderAction(), new SortPropertiesAlphabeticallyAction()], { icon: true, label: false });


		this._tableContainer = DOM.$('.table-container');
		this._parentContainer.appendChild(this._tableContainer);

		this._actualTable = DOM.$('.table');
		this._tableContainer.appendChild(this._actualTable);

		this._dataView = new TableDataView();
		this._data = [];

		const columns: Slick.Column<Slick.SlickData>[] = [
			{
				id: 'name',
				name: localize('nodePropertyViewNameNameColumnHeader', "Name"),
				field: 'name',
				width: 250,
				editor: Slick.Editors.Text,
				headerCssClass: 'prop-table-header',
				formatter: textFormatter
			},
			{
				id: 'value',
				name: localize('nodePropertyViewNameValueColumnHeader', "Value"),
				field: 'value',
				width: 250,
				editor: Slick.Editors.Text,
				headerCssClass: 'prop-table-header',
				formatter: textFormatter
			}
		];

		this._table = new Table(this._actualTable, {
			dataProvider: this._dataView, columns: columns
		}, {
			rowHeight: RESULTS_GRID_DEFAULTS.rowHeight,
			forceFitColumns: true,
			defaultColumnWidth: 120
		});

		new ResizeObserver((e) => {
			this.tableHeight = (this._parentContainer.getBoundingClientRect().height - 80);
		}).observe(this._parentContainer);

		attachTableStyler(this._table, this._themeService);
	}

	public set graphElement(element: azdata.ExecutionPlanNode | azdata.ExecutionPlanEdge) {
		this._model.graphElement = element;
		this.sortPropertiesByImportance();
		this.renderView();
	}

	public sortPropertiesAlphabetically(): void {
		this._model.graphElement.properties = this._model.graphElement.properties.sort((a, b) => {
			if (!a?.name && !b?.name) {
				return 0;
			} else if (!a?.name) {
				return -1;
			} else if (!b?.name) {
				return 1;
			} else {
				return a.name.localeCompare(b.name);
			}
		});
		this.renderView();
	}

	public sortPropertiesByImportance(): void {
		this._model.graphElement.properties = this._model.graphElement.properties.sort((a, b) => {
			if (!a?.displayOrder && !b?.displayOrder) {
				return 0;
			} else if (!a?.displayOrder) {
				return -1;
			} else if (!b?.displayOrder) {
				return 1;
			} else {
				return a.displayOrder - b.displayOrder;
			}
		});
		this.renderView();
	}

	public set tableHeight(value: number) {
		if (this.tableHeight !== value) {
			this._tableHeight = value;
			this.renderView();
		}
	}

	public get tableHeight(): number {
		return this._tableHeight;
	}

	public set tableWidth(value: number) {
		if (this._tableWidth !== value) {
			this._tableWidth = value;
			this.renderView();
		}
	}

	public get tableWidth(): number {
		return this._tableWidth;
	}

	private renderView(): void {
		if (this._model.graphElement) {
			const nodeName = (<azdata.ExecutionPlanNode>this._model.graphElement).name;
			this._operationName.innerText = nodeName ? removeLineBreaks(nodeName) : localize('executionPlanPropertiesEdgeOperationName', "Edge"); //since edges do not have names like node, we set the operation name to 'Edge'
		}
		this._tableContainer.scrollTo(0, 0);
		this._dataView.clear();
		this._data = this.convertPropertiesToTableRows(this._model.graphElement.properties, -1, 0);
		this._dataView.push(this._data);
		this._table.setData(this._dataView);
		this._table.autosizeColumns();
		this._table.updateRowCount();
		this.tableHeight = (this._parentContainer.getBoundingClientRect().height - 80); //80px is the space taken by the title and toolbar
		this._table.layout(new DOM.Dimension(this._tableWidth, this._tableHeight));
		this._table.resizeCanvas();
	}

	private convertPropertiesToTableRows(props: azdata.ExecutionPlanGraphElementProperty[], parentIndex: number, indent: number, rows: { [key: string]: string }[] = []): { [key: string]: string }[] {
		if (!props) {
			return rows;
		}
		props.forEach((p, i) => {
			let row = {};
			rows.push(row);
			row['name'] = '  '.repeat(indent) + p.name;
			row['parent'] = parentIndex;
			if (!isString(p.value)) {
				row['value'] = removeLineBreaks(p.displayValue, ' ');
				this.convertPropertiesToTableRows(p.value, rows.length - 1, indent + 2, rows);
			} else {
				row['value'] = removeLineBreaks(p.value, ' ');
				row['tooltip'] = p.value;
			}
		});
		return rows;
	}

	public toggleVisibility(): void {
		this._parentContainer.style.display = this._parentContainer.style.display === 'none' ? 'block' : 'none';
		this.renderView();
	}
}

export interface GraphElementPropertyViewData {
	graphElement: azdata.ExecutionPlanNode | azdata.ExecutionPlanEdge;
}

export class ClosePropertyViewAction extends Action {
	public static ID = 'ep.propertiesView.close';
	public static LABEL = localize('executionPlanPropertyViewClose', "Close");

	constructor() {
		super(ClosePropertyViewAction.ID, ClosePropertyViewAction.LABEL, Codicon.close.classNames);
	}

	public override async run(context: ExecutionPlanPropertiesView): Promise<void> {
		context.toggleVisibility();
	}
}

export class SortPropertiesAlphabeticallyAction extends Action {
	public static ID = 'ep.propertiesView.sortByAlphabet';
	public static LABEL = localize('executionPlanPropertyViewSortAlphabetically', "Alphabetical");

	constructor() {
		super(SortPropertiesAlphabeticallyAction.ID, SortPropertiesAlphabeticallyAction.LABEL, sortAlphabeticallyIconClassNames);
	}

	public override async run(context: ExecutionPlanPropertiesView): Promise<void> {
		context.sortPropertiesAlphabetically();
	}
}

export class SortPropertiesByDisplayOrderAction extends Action {
	public static ID = 'ep.propertiesView.sortByDisplayOrder';
	public static LABEL = localize('executionPlanPropertyViewSortByDisplayOrder', "Categorized");

	constructor() {
		super(SortPropertiesByDisplayOrderAction.ID, SortPropertiesByDisplayOrderAction.LABEL, sortByDisplayOrderIconClassNames);
	}

	public override async run(context: ExecutionPlanPropertiesView): Promise<void> {
		context.sortPropertiesByImportance();
	}
}
