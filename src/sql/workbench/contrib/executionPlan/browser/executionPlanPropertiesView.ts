/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import type * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { removeLineBreaks } from 'sql/base/common/strings';
import { isString } from 'vs/base/common/types';
import { textFormatter } from 'sql/base/browser/ui/table/formatters';
import { ExecutionPlanPropertiesViewBase, PropertiesSortType } from 'sql/workbench/contrib/executionPlan/browser/executionPlanPropertiesViewBase';

export class ExecutionPlanPropertiesView extends ExecutionPlanPropertiesViewBase {
	// Div that holds the name of the element selected
	private _operationName!: HTMLElement;
	private _model: ExecutionPlanPropertiesViewModel;

	public constructor(
		parentContainer: HTMLElement,
		themeService: IThemeService
	) {
		super(parentContainer, themeService);
		this._model = <ExecutionPlanPropertiesView>{};
		this._operationName = DOM.$('h3');
		this._operationName.classList.add('operation-name');
		this._parentContainer.appendChild(this._operationName);
		this.setHeader(this._operationName);

		this._parentContainer.style.display = 'none';
	}

	public set graphElement(element: azdata.executionPlan.ExecutionPlanNode | azdata.executionPlan.ExecutionPlanEdge) {
		this._model.graphElement = element;
		this.refreshPropertiesTable();
	}

	public sortPropertiesAlphabetically(props: azdata.executionPlan.ExecutionPlanGraphElementProperty[]): azdata.executionPlan.ExecutionPlanGraphElementProperty[] {
		return props.sort((a, b) => {
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
	}

	public sortPropertiesReverseAlphabetically(props: azdata.executionPlan.ExecutionPlanGraphElementProperty[]): azdata.executionPlan.ExecutionPlanGraphElementProperty[] {
		return props.sort((a, b) => {
			if (!a?.name && !b?.name) {
				return 0;
			} else if (!a?.name) {
				return -1;
			} else if (!b?.name) {
				return 1;
			} else {
				return b.name.localeCompare(a.name);
			}
		});
	}


	public sortPropertiesByImportance(props: azdata.executionPlan.ExecutionPlanGraphElementProperty[]): azdata.executionPlan.ExecutionPlanGraphElementProperty[] {
		return props.sort((a, b) => {
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
	}

	public refreshPropertiesTable(): void {
		if (this._model.graphElement) {
			const nodeName = (<azdata.executionPlan.ExecutionPlanNode>this._model.graphElement).name;
			this._operationName.innerText = nodeName ? removeLineBreaks(nodeName) : localize('executionPlanPropertiesEdgeOperationName', "Edge"); //since edges do not have names like node, we set the operation name to 'Edge'
		}

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

		this.populateTable(columns, this.convertModelToTableRows(this._model.graphElement.properties, -1, 0));
	}

	private convertModelToTableRows(props: azdata.executionPlan.ExecutionPlanGraphElementProperty[], parentIndex: number, indent: number, rows: { [key: string]: string }[] = []): { [key: string]: string }[] {
		if (!props) {
			return rows;
		}

		switch (this.sortType) {
			case PropertiesSortType.DisplayOrder:
				props = this.sortPropertiesByImportance(props);
				break;
			case PropertiesSortType.Alphabetical:
				props = this.sortPropertiesAlphabetically(props);
				break;
			case PropertiesSortType.ReverseAlphabetical:
				props = this.sortPropertiesReverseAlphabetically(props);
				break;
		}

		const parentRowCellStyling = 'font-weight: bold';

		props.forEach((p, i) => {
			let row = {};
			rows.push(row);
			row['name'] = p.name;
			row['parent'] = parentIndex;
			if (!isString(p.value)) {
				// Styling values in the parent row differently to make them more apparent and standout compared to the rest of the cells.
				row['name'] = {
					text: row['name'],
					style: parentRowCellStyling
				};
				row['value'] = {
					text: removeLineBreaks(p.displayValue, ' '),
					style: parentRowCellStyling
				};
				row['tootltip'] = p.displayValue;
				this.convertModelToTableRows(p.value, rows.length - 1, indent + 2, rows);
			} else {
				row['value'] = removeLineBreaks(p.displayValue, ' ');
				row['tooltip'] = p.displayValue;
			}
		});
		return rows;
	}
}

export interface ExecutionPlanPropertiesViewModel {
	graphElement: azdata.executionPlan.ExecutionPlanNode | azdata.executionPlan.ExecutionPlanEdge;
}
