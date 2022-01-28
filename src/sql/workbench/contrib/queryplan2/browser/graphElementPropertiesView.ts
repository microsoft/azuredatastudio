/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { Table } from 'sql/base/browser/ui/table/table';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';
import { isString } from 'vs/base/common/types';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';


export class GraphElementPropertiesView {

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
	private _table: Table<any>;
	private _dataView: TableDataView<Slick.SlickData>;
	private _data: { [key: string]: string }[];
	private _tableContainer!: HTMLElement;
	private _actualTable!: HTMLElement;

	// Table dimensions.
	private _tableWidth = 485;
	private _tableHeight = 420;

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

		const columns: Slick.Column<any>[] = [
			{
				id: 'name',
				name: localize('nodePropertyViewNameNameColumnHeader', "Name"),
				field: 'name',
				width: 250,
				editor: Slick.Editors.Text,
				headerCssClass: 'prop-table-header'
			},
			{
				id: 'value',
				name: localize('nodePropertyViewNameValueColumnHeader', "Value"),
				field: 'value',
				width: 250,
				editor: Slick.Editors.Text,
				headerCssClass: 'prop-table-header'
			}
		];

		this._table = new Table(this._actualTable, {
			dataProvider: this._dataView, columns: columns
		}, {
			rowHeight: RESULTS_GRID_DEFAULTS.rowHeight,
			forceFitColumns: true,
			defaultColumnWidth: 120
		});

		attachTableStyler(this._table, this._themeService);
	}

	public set graphElement(element: azdata.ExecutionPlanNode | azdata.ExecutionPlanEdge) {
		this._model.graphElement = element;
		this.sortPropertiesByImportance();
		this.renderView();
	}

	public sortPropertiesAlphabetically() {
		this._model.graphElement.properties = this._model.graphElement.properties.sort((a, b) => {
			if (a.name < b.name) { return -1; }
			if (a.name > b.name) { return 1; }
			return 0;
		});
		this.renderView();
	}

	public sortPropertiesByImportance() {
		this._model.graphElement.properties = this._model.graphElement.properties.sort((a, b) => {
			return a.displayOrder - b.displayOrder;
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

	private renderView() {
		if (this._model.graphElement) {
			const nodeName = (<azdata.ExecutionPlanNode>this._model.graphElement).name;
			this._operationName.innerText = nodeName ?? localize('queryPlanPropertiesEdgeOperationName', "Edge"); //since edges do not have names like node, we set the operation name to 'Edge'
		}
		this._tableContainer.scrollTo(0, 0);
		this._data = [];
		this._dataView.clear();
		this.parseProperties(this._model.graphElement.properties, -1, 0);
		this._dataView.push(this._data);
		this._table.setData(this._dataView);
		this._table.autosizeColumns();
		this._table.updateRowCount();
		this._table.layout(new DOM.Dimension(this._tableWidth, this._tableHeight));
		this._table.resizeCanvas();
	}

	private parseProperties(props: azdata.ExecutionPlanGraphElementProperty[], parentRow: number, indent: number) {
		props.forEach((p, i) => {
			if (!isString(p.value)) {
				let row = {};
				row['name'] = '\t'.repeat(indent) + p.name;
				row['value'] = '';
				this._data.push(row);
				this.parseProperties(p.value, this._data.length - 1, indent + 2);
			} else {
				let row = {};
				row['name'] = '\t'.repeat(indent) + p.name;
				row['value'] = p.value;
				this._data.push(row);
			}
		});
	}

	public toggleVisibility() {
		this._parentContainer.style.display = this._parentContainer.style.display === 'none' ? 'block' : 'none';
		this.renderView();
	}
}

export interface GraphElementPropertyViewData {
	graphElement: azdata.ExecutionPlanNode | azdata.ExecutionPlanEdge;
}

export class ClosePropertyViewAction extends Action {
	public static ID = 'qp.propertiesView.close';
	public static LABEL = localize('queryPlanPropertyViewClose', "Close");

	constructor() {
		super(ClosePropertyViewAction.ID, ClosePropertyViewAction.LABEL, Codicon.close.classNames);
	}

	public override async run(context: GraphElementPropertiesView): Promise<void> {
		context.toggleVisibility();
	}
}

export class SortPropertiesAlphabeticallyAction extends Action {
	public static ID = 'qp.propertiesView.sortByAlphabet';
	public static LABEL = localize('queryPlanPropertyViewSortAlphabetically', "Alphabetical");

	constructor() {
		super(SortPropertiesAlphabeticallyAction.ID, SortPropertiesAlphabeticallyAction.LABEL, Codicon.sortPrecedence.classNames);
	}

	public override async run(context: GraphElementPropertiesView): Promise<void> {
		context.sortPropertiesAlphabetically();
	}
}

export class SortPropertiesByDisplayOrderAction extends Action {
	public static ID = 'qp.propertiesView.sortByDisplayOrder';
	public static LABEL = localize('queryPlanPropertyViewSortByDisplayOrde', "Categorized");

	constructor() {
		super(SortPropertiesByDisplayOrderAction.ID, SortPropertiesByDisplayOrderAction.LABEL, Codicon.listOrdered.classNames);
	}

	public override async run(context: GraphElementPropertiesView): Promise<void> {
		context.sortPropertiesByImportance();
	}
}
