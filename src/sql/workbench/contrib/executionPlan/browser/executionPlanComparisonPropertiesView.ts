/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecutionPlanPropertiesViewBase, PropertiesSortType } from 'sql/workbench/contrib/executionPlan/browser/executionPlanPropertiesViewBase';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { textFormatter } from 'sql/base/browser/ui/table/formatters';
import { isString } from 'vs/base/common/types';
import { removeLineBreaks } from 'sql/base/common/strings';
import * as DOM from 'vs/base/browser/dom';
import { InternalExecutionPlanElement } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { executionPlanComparisonPropertiesDifferent, executionPlanComparisonPropertiesUpArrow, executionPlanComparisonPropertiesDownArrow } from 'sql/workbench/contrib/executionPlan/browser/constants';
import * as sqlExtHostType from 'sql/workbench/api/common/sqlExtHostTypes';
import { TextWithIconColumn } from 'sql/base/browser/ui/table/plugins/textWithIconColumn';

export enum ExecutionPlanCompareOrientation {
	Horizontal = 'horizontal',
	Vertical = 'vertical'
}

const topTitleColumnHeader = localize('nodePropertyViewNameValueColumnTopHeader', "Value (Top Plan)");
const leftTitleColumnHeader = localize('nodePropertyViewNameValueColumnLeftHeader', "Value (Left Plan)");
const rightTitleColumnHeader = localize('nodePropertyViewNameValueColumnRightHeader', "Value (Right Plan)");
const bottomTitleColumnHeader = localize('nodePropertyViewNameValueColumnBottomHeader', "Value (Bottom Plan)");

export class ExecutionPlanComparisonPropertiesView extends ExecutionPlanPropertiesViewBase {
	private _model: ExecutionPlanComparisonPropertiesViewModel;
	private _primaryContainer: HTMLElement;
	private _secondaryContainer: HTMLElement;
	private _orientation: ExecutionPlanCompareOrientation = ExecutionPlanCompareOrientation.Horizontal;
	private _primaryTarget: string;
	private _secondaryTarget: string;

	public constructor(
		parentContainer: HTMLElement,
		@IThemeService themeService: IThemeService,
	) {
		super(parentContainer, themeService);
		this._model = <ExecutionPlanComparisonPropertiesViewModel>{};
		this._parentContainer.style.display = 'none';
		const header = DOM.$('.compare-operation-name');
		this._primaryContainer = DOM.$('.compare-operation-name-text');
		header.appendChild(this._primaryContainer);
		this._secondaryContainer = DOM.$('.compare-operation-name-text');
		header.appendChild(this._secondaryContainer);
		this.setHeader(header);
	}

	public setTopElement(e: InternalExecutionPlanElement): void {
		this._model.topElement = e;
		if ((<azdata.executionPlan.ExecutionPlanNode>e).name) {
			this._primaryTarget = removeLineBreaks((<azdata.executionPlan.ExecutionPlanNode>e).name);
		} else {
			this._primaryTarget = localize('executionPlanPropertiesEdgeOperationName', "Edge");
		}

		let topTitleText = localize('executionPlanComparisonPropertiesTopOperation', "Top operation: {0}", this._primaryTarget);
		this._primaryContainer.innerText = topTitleText;
		this._primaryContainer.title = topTitleText;
		this.refreshPropertiesTable();
	}

	public setBottomElement(e: InternalExecutionPlanElement): void {
		this._model.bottomElement = e;
		if ((<azdata.executionPlan.ExecutionPlanNode>e)?.name) {
			this._secondaryTarget = removeLineBreaks((<azdata.executionPlan.ExecutionPlanNode>e).name);
		} else {
			this._secondaryTarget = localize('executionPlanPropertiesEdgeOperationName', "Edge");
		}

		let bottomTitleText = localize('executionPlanComparisonPropertiesBottomOperation', "Bottom operation: {0}", this._secondaryTarget);
		this._secondaryContainer.innerText = bottomTitleText;
		this._secondaryContainer.title = bottomTitleText;
		this.refreshPropertiesTable();
	}

	private updatePropertyContainerTitles(): void {
		let primaryTitleText = '';
		let secondaryTitleText = '';

		if (this._orientation === ExecutionPlanCompareOrientation.Horizontal) {
			primaryTitleText = localize('executionPlanComparisonPropertiesTopOperation', "Top operation: {0}", this._primaryTarget);
			secondaryTitleText = localize('executionPlanComparisonPropertiesBottomOperation', "Bottom operation: {0}", this._secondaryTarget);
		}
		else {
			primaryTitleText = localize('executionPlanComparisonPropertiesLeftOperation', "Left operation: {0}", this._primaryTarget);
			secondaryTitleText = localize('executionPlanComparisonPropertiesRightOperation', "Right operation: {0}", this._secondaryTarget);
		}

		this._primaryContainer.innerText = primaryTitleText;
		this._primaryContainer.title = primaryTitleText;
		this._secondaryContainer.innerText = secondaryTitleText;
		this._secondaryContainer.title = secondaryTitleText;

		this.updatePropertiesTableColumnHeaders();
	}

	public updatePropertiesTableColumnHeaders() {
		const columns: Slick.Column<Slick.SlickData>[] = this.getPropertyTableColumns();

		this.updateTableColumns(columns);
	}

	public refreshPropertiesTable() {
		const columns: Slick.Column<Slick.SlickData>[] = this.getPropertyTableColumns();

		let topProps = [];
		let bottomProps = [];
		if (this._model.topElement?.properties) {
			topProps = this._model.topElement.properties;
		}
		if (this._model.bottomElement?.properties) {
			bottomProps = this._model.bottomElement.properties;
		}

		this.populateTable(columns, this.convertPropertiesToTableRows(topProps, bottomProps, -1, 0));
	}

	private getPropertyTableColumns() {
		const columns: Slick.Column<Slick.SlickData>[] = [];

		if (this._model.topElement) {
			columns.push({
				id: 'name',
				name: localize('nodePropertyViewNameNameColumnHeader', "Name"),
				field: 'name',
				width: 200,
				editor: Slick.Editors.Text,
				headerCssClass: 'prop-table-header',
				formatter: textFormatter
			});
			columns.push({
				id: 'value',
				name: getPropertyViewNameValueColumnTopHeaderForOrientation(this._orientation),
				field: 'primary',
				width: 150,
				editor: Slick.Editors.Text,
				headerCssClass: 'prop-table-header',
				formatter: textFormatter
			});
		}
		if (this._model.bottomElement) {
			columns.push(new TextWithIconColumn({
				id: 'value',
				name: getPropertyViewNameValueColumnBottomHeaderForOrientation(this._orientation),
				field: 'secondary',
				width: 150,
				headerCssClass: 'prop-table-header',
			}).definition);
		}

		return columns;
	}

	public sortPropertiesAlphabetically(props: Map<string, TablePropertiesMapEntry>): Map<string, TablePropertiesMapEntry> {
		return new Map([...props.entries()].sort((a, b) => {
			if (!a[1]?.name && !b[1]?.name) {
				return 0;
			} else if (!a[1]?.name) {
				return -1;
			} else if (!b[1]?.name) {
				return 1;
			} else {
				return a[1].name.localeCompare(b[1].name);
			}
		}));
	}

	public sortPropertiesByImportance(props: Map<string, TablePropertiesMapEntry>): Map<string, TablePropertiesMapEntry> {
		return new Map([...props.entries()].sort((a, b) => {
			if (!a[1]?.displayOrder && !b[1]?.displayOrder) {
				return 0;
			} else if (!a[1]?.displayOrder) {
				return -1;
			} else if (!b[1]?.displayOrder) {
				return 1;
			} else {
				return a[1].displayOrder - b[1].displayOrder;
			}
		}));
	}

	public sortPropertiesReverseAlphabetically(props: Map<string, TablePropertiesMapEntry>): Map<string, TablePropertiesMapEntry> {
		return new Map([...props.entries()].sort((a, b) => {
			if (!a[1]?.displayOrder && !b[1]?.displayOrder) {
				return 0;
			} else if (!a[1]?.displayOrder) {
				return -1;
			} else if (!b[1]?.displayOrder) {
				return 1;
			} else {
				return b[1].displayOrder - a[1].displayOrder;
			}
		}));
	}

	private convertPropertiesToTableRows(topNode: azdata.executionPlan.ExecutionPlanGraphElementProperty[], bottomNode: azdata.executionPlan.ExecutionPlanGraphElementProperty[], parentIndex: number, indent: number, rows: { [key: string]: string }[] = []): { [key: string]: string }[] {
		let propertiesMap: Map<string, TablePropertiesMapEntry> = new Map();

		if (topNode) {
			topNode.forEach(p => {
				propertiesMap.set(p.name, {
					topProp: p,
					bottomProp: undefined,
					displayOrder: p.displayOrder,
					name: p.name
				});
			});
		}

		if (bottomNode) {
			bottomNode.forEach(p => {
				if (propertiesMap.has(p.name)) {
					propertiesMap.get(p.name).bottomProp = p;
				} else {
					propertiesMap.set(p.name, {
						topProp: undefined,
						bottomProp: p,
						displayOrder: p.displayOrder,
						name: p.name
					});
				}
			});
		}

		switch (this.sortType) {
			case PropertiesSortType.DisplayOrder:
				propertiesMap = this.sortPropertiesByImportance(propertiesMap);
				break;
			case PropertiesSortType.Alphabetical:
				propertiesMap = this.sortPropertiesAlphabetically(propertiesMap);
				break;
			case PropertiesSortType.ReverseAlphabetical:
				propertiesMap = this.sortPropertiesReverseAlphabetically(propertiesMap);
				break;
		}

		propertiesMap.forEach((v, k) => {
			let row = {};
			row['name'] = {
				text: k
			};
			row['parent'] = parentIndex;

			const topProp = v.topProp;
			const bottomProp = v.bottomProp;
			const parentRowCellStyling = 'font-weight: bold';
			let diffIconClass = '';
			if (topProp && bottomProp) {
				row['displayOrder'] = v.topProp.displayOrder;
				if (v.topProp.displayValue !== v.bottomProp.displayValue) {
					switch (v.topProp.dataType) {
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Boolean:
							diffIconClass = executionPlanComparisonPropertiesDifferent;
							break;
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Number:
							diffIconClass = (parseFloat(v.topProp.displayValue) > parseFloat(v.bottomProp.displayValue)) ? executionPlanComparisonPropertiesDownArrow : executionPlanComparisonPropertiesUpArrow;
							break;
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.String:
							diffIconClass = executionPlanComparisonPropertiesDifferent;
							break;
						default:
							diffIconClass = executionPlanComparisonPropertiesDifferent;
							break;
					}
				}
				row['primary'] = {
					text: removeLineBreaks(v.topProp.displayValue, ' ')
				};
				row['secondary'] = {
					iconCssClass: diffIconClass,
					title: removeLineBreaks(v.bottomProp.displayValue, ' ')
				};
				if ((topProp && !isString(topProp.value)) || (bottomProp && !isString(bottomProp.value))) {
					row['name'].style = parentRowCellStyling;
					row['primary'].style = parentRowCellStyling;
					row['secondary'].iconCssClass += ` parent-row-styling`;
				}
				rows.push(row);
				if (!isString(topProp.value) && !isString(bottomProp.value)) {
					this.convertPropertiesToTableRows(topProp.value, bottomProp.value, rows.length - 1, indent + 2, rows);
				} else if (isString(topProp?.value) && !isString(bottomProp.value)) {
					this.convertPropertiesToTableRows(undefined, bottomProp.value, rows.length - 1, indent + 2, rows);
				} else if (!isString(topProp.value) && !isString(bottomProp.value)) {
					this.convertPropertiesToTableRows(topProp.value, undefined, rows.length - 1, indent + 2, rows);
				}
			} else if (topProp && !bottomProp) {
				row['displayOrder'] = v.topProp.displayOrder;
				row['primary'] = {
					text: v.topProp.displayValue
				};
				rows.push(row);
				if (!isString(topProp.value)) {
					row['name'].style = parentRowCellStyling;
					row['primary'].style = parentRowCellStyling;
					this.convertPropertiesToTableRows(topProp.value, undefined, rows.length - 1, indent + 2, rows);
				}
			} else if (!topProp && bottomProp) {
				row['displayOrder'] = v.bottomProp.displayOrder;
				row['secondary'] = {
					title: v.bottomProp.displayValue,
					iconCssClass: diffIconClass
				};
				rows.push(row);
				if (!isString(bottomProp.value)) {
					row['name'].style = parentRowCellStyling;
					row['secondary'].iconCssClass += ` parent-row-styling`;
					this.convertPropertiesToTableRows(undefined, bottomProp.value, rows.length - 1, indent + 2, rows);
				}
			}

		});
		return rows;
	}

	set orientation(value: ExecutionPlanCompareOrientation) {
		if (this._orientation === value) {
			return;
		}
		this._orientation = value;
		this.updatePropertyContainerTitles();
	}
}

function getPropertyViewNameValueColumnTopHeaderForOrientation(orientation: ExecutionPlanCompareOrientation): string {
	if (orientation === ExecutionPlanCompareOrientation.Horizontal) {
		return topTitleColumnHeader;
	}
	else {
		return leftTitleColumnHeader;
	}
}

function getPropertyViewNameValueColumnBottomHeaderForOrientation(orientation: ExecutionPlanCompareOrientation): string {
	if (orientation === ExecutionPlanCompareOrientation.Horizontal) {
		return bottomTitleColumnHeader;
	}
	else {
		return rightTitleColumnHeader;
	}
}

export interface ExecutionPlanComparisonPropertiesViewModel {
	topElement: InternalExecutionPlanElement,
	bottomElement: InternalExecutionPlanElement
}

interface TablePropertiesMapEntry {
	topProp: azdata.executionPlan.ExecutionPlanGraphElementProperty,
	bottomProp: azdata.executionPlan.ExecutionPlanGraphElementProperty,
	displayOrder: number,
	name: string
}
