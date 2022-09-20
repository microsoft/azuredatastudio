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
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export enum ExecutionPlanCompareOrientation {
	Horizontal = 'horizontal',
	Vertical = 'vertical'
}

function getTopOperationLabel(target: string): string {
	return localize('nodePropertyViewTopOperation', 'Top operation: {0}', target);
}

function getBottomOperationLabel(target: string): string {
	return localize('nodePropertyViewBottomOperation', 'Bottom operation: {0}', target);
}

function getLeftOperationLabel(target: string): string {
	return localize('nodePropertyViewLeftOperation', 'Left operation: {0}', target);
}

function getRightOperationLabel(target: string): string {
	return localize('nodePropertyViewRightOperation', 'Right operation: {0}', target);
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
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextMenuService contextMenuService: IContextMenuService
	) {
		super(parentContainer, themeService, instantiationService, contextMenuService);
		this._model = <ExecutionPlanComparisonPropertiesViewModel>{};
		this._parentContainer.style.display = 'none';
		const header = DOM.$('.compare-operation-name');
		this._primaryContainer = DOM.$('.compare-operation-name-text');
		header.appendChild(this._primaryContainer);
		this._secondaryContainer = DOM.$('.compare-operation-name-text');
		header.appendChild(this._secondaryContainer);
		this.setHeader(header);
	}

	public setPrimaryElement(e: InternalExecutionPlanElement): void {
		this._model.primaryElement = e;
		if ((<azdata.executionPlan.ExecutionPlanNode>e).name) {
			this._primaryTarget = removeLineBreaks((<azdata.executionPlan.ExecutionPlanNode>e).name);
		} else {
			this._primaryTarget = localize('executionPlanPropertiesEdgeOperationName', "Edge");
		}

		const primaryTitleText = this._orientation === ExecutionPlanCompareOrientation.Horizontal
			? getTopOperationLabel(this._primaryTarget)
			: getLeftOperationLabel(this._primaryTarget);

		this._primaryContainer.innerText = primaryTitleText;
		this._primaryContainer.title = primaryTitleText;
		this.refreshPropertiesTable();
	}

	public setSecondaryElement(e: InternalExecutionPlanElement): void {
		this._model.secondaryElement = e;
		if ((<azdata.executionPlan.ExecutionPlanNode>e)?.name) {
			this._secondaryTarget = removeLineBreaks((<azdata.executionPlan.ExecutionPlanNode>e).name);
		} else {
			this._secondaryTarget = localize('executionPlanPropertiesEdgeOperationName', "Edge");
		}

		const secondaryTitleText = this._orientation === ExecutionPlanCompareOrientation.Horizontal
			? getBottomOperationLabel(this._secondaryTarget)
			: getRightOperationLabel(this._secondaryTarget);

		this._secondaryContainer.innerText = secondaryTitleText;
		this._secondaryContainer.title = secondaryTitleText;
		this.refreshPropertiesTable();
	}

	private updatePropertyContainerTitles(): void {
		const [primaryTitleText, secondaryTitleText] = this._orientation === ExecutionPlanCompareOrientation.Horizontal
			? [getTopOperationLabel(this._primaryTarget), getBottomOperationLabel(this._secondaryTarget)]
			: [getLeftOperationLabel(this._primaryTarget), getRightOperationLabel(this._secondaryTarget)];

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

		let primaryProps = [];
		let secondaryProps = [];
		if (this._model.primaryElement?.properties) {
			primaryProps = this._model.primaryElement.properties;
		}
		if (this._model.secondaryElement?.properties) {
			secondaryProps = this._model.secondaryElement.properties;
		}

		this.populateTable(columns, this.convertPropertiesToTableRows(primaryProps, secondaryProps, -1, 0));
	}

	private getPropertyTableColumns() {
		const columns: Slick.Column<Slick.SlickData>[] = [];

		if (this._model.primaryElement) {
			columns.push({
				id: 'name',
				name: localize('nodePropertyViewNameNameColumnHeader', "Name"),
				field: 'name',
				width: 200,
				headerCssClass: 'prop-table-header',
				formatter: textFormatter
			});
			columns.push({
				id: 'value1',
				name: getPropertyViewNameValueColumnTopHeaderForOrientation(this._orientation),
				field: 'primary',
				width: 150,
				headerCssClass: 'prop-table-header',
				formatter: textFormatter
			});
		}
		if (this._model.secondaryElement) {
			columns.push(new TextWithIconColumn({
				id: 'value2',
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

	private convertPropertiesToTableRows(primaryNode: azdata.executionPlan.ExecutionPlanGraphElementProperty[], secondaryNode: azdata.executionPlan.ExecutionPlanGraphElementProperty[], parentIndex: number, indent: number, rows: { [key: string]: string }[] = []): { [key: string]: string }[] {
		let propertiesMap: Map<string, TablePropertiesMapEntry> = new Map();

		if (primaryNode) {
			primaryNode.forEach(p => {
				propertiesMap.set(p.name, {
					primaryProp: p,
					secondaryProp: undefined,
					displayOrder: p.displayOrder,
					name: p.name
				});
			});
		}

		if (secondaryNode) {
			secondaryNode.forEach(p => {
				if (propertiesMap.has(p.name)) {
					propertiesMap.get(p.name).secondaryProp = p;
				} else {
					propertiesMap.set(p.name, {
						primaryProp: undefined,
						secondaryProp: p,
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

			const primaryProp = v.primaryProp;
			const secondaryProp = v.secondaryProp;
			let diffIconClass = '';
			if (primaryProp && secondaryProp) {
				row['displayOrder'] = v.primaryProp.displayOrder;
				if (v.primaryProp.displayValue !== v.secondaryProp.displayValue) {
					switch (v.primaryProp.dataType) {
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Boolean:
							diffIconClass = executionPlanComparisonPropertiesDifferent;
							break;
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Number:
							diffIconClass = (parseFloat(v.primaryProp.displayValue) > parseFloat(v.secondaryProp.displayValue)) ? executionPlanComparisonPropertiesDownArrow : executionPlanComparisonPropertiesUpArrow;
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
					text: removeLineBreaks(v.primaryProp.displayValue, ' ')
				};
				row['secondary'] = {
					iconCssClass: diffIconClass,
					title: removeLineBreaks(v.secondaryProp.displayValue, ' ')
				};
				if ((primaryProp && !isString(primaryProp.value)) || (secondaryProp && !isString(secondaryProp.value))) {
					row['name'].iconCssClass += ` parent-row-styling`;
					row['primary'].iconCssClass += ` parent-row-styling`;
					row['secondary'].iconCssClass += ` parent-row-styling`;
				}
				rows.push(row);
				if (!isString(primaryProp.value) && !isString(secondaryProp.value)) {
					this.convertPropertiesToTableRows(primaryProp.value, secondaryProp.value, rows.length - 1, indent + 2, rows);
				} else if (isString(primaryProp?.value) && !isString(secondaryProp.value)) {
					this.convertPropertiesToTableRows(undefined, secondaryProp.value, rows.length - 1, indent + 2, rows);
				} else if (!isString(primaryProp.value) && !isString(secondaryProp.value)) {
					this.convertPropertiesToTableRows(primaryProp.value, undefined, rows.length - 1, indent + 2, rows);
				}
			} else if (primaryProp && !secondaryProp) {
				row['displayOrder'] = v.primaryProp.displayOrder;
				row['primary'] = {
					text: v.primaryProp.displayValue
				};
				rows.push(row);
				if (!isString(primaryProp.value)) {
					row['name'].iconCssClass += ` parent-row-styling`;
					row['primary'].iconCssClass += ` parent-row-styling`;
					this.convertPropertiesToTableRows(primaryProp.value, undefined, rows.length - 1, indent + 2, rows);
				}
			} else if (!primaryProp && secondaryProp) {
				row['displayOrder'] = v.secondaryProp.displayOrder;
				row['secondary'] = {
					title: v.secondaryProp.displayValue,
					iconCssClass: diffIconClass
				};
				rows.push(row);
				if (!isString(secondaryProp.value)) {
					row['name'].iconCssClass += ` parent-row-styling`;
					row['secondary'].iconCssClass += ` parent-row-styling`;
					this.convertPropertiesToTableRows(undefined, secondaryProp.value, rows.length - 1, indent + 2, rows);
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
	primaryElement: InternalExecutionPlanElement,
	secondaryElement: InternalExecutionPlanElement
}

interface TablePropertiesMapEntry {
	primaryProp: azdata.executionPlan.ExecutionPlanGraphElementProperty,
	secondaryProp: azdata.executionPlan.ExecutionPlanGraphElementProperty,
	displayOrder: number,
	name: string
}
