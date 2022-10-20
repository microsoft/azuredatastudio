/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecutionPlanPropertiesViewBase, PropertiesSortType } from 'sql/workbench/contrib/executionPlan/browser/executionPlanPropertiesViewBase';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { iconCssFormatter, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { isString } from 'vs/base/common/types';
import { removeLineBreaks } from 'sql/base/common/strings';
import * as DOM from 'vs/base/browser/dom';
import { InternalExecutionPlanElement } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { executionPlanComparisonPropertiesDifferent } from 'sql/workbench/contrib/executionPlan/browser/constants';
import * as sqlExtHostType from 'sql/workbench/api/common/sqlExtHostTypes';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Codicon } from 'vs/base/common/codicons';
import { deepClone } from 'vs/base/common/objects';

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

const notEqualTitle = localize('nodePropertyViewNameNotEqualTitle', 'Not equal to');
const lessThanTitle = localize('nodePropertyViewNameLessThanTitle', 'Less than');
const greaterThanTitle = localize('nodePropertyViewNameGreaterThanTitle', 'Greater than');
const equivalentPropertiesRowHeader = localize('nodePropertyViewNameEquivalentPropertiesRowHeader', 'Equivalent Properties');
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
		@IContextMenuService contextMenuService: IContextMenuService,
		@IContextViewService contextViewService: IContextViewService
	) {
		super(parentContainer, themeService, instantiationService, contextMenuService, contextViewService);
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
		if (this._model.primaryElement?.properties) {
			primaryProps = this._model.primaryElement.properties;
		}

		let secondaryProps = [];
		if (this._model.secondaryElement?.properties) {
			secondaryProps = this._model.secondaryElement.properties;
		}

		let tableRows = this.convertPropertiesToTableRows(primaryProps, secondaryProps);
		tableRows = this.sortPropertiesByDisplayValueEquivalency(tableRows);
		this.populateTable(columns, tableRows);
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
			columns.push({
				id: 'comparison',
				name: '',
				field: 'icon',
				width: 40,
				headerCssClass: 'prop-table-header',
				formatter: iconCssFormatter
			});

			columns.push({
				id: 'value2',
				name: getPropertyViewNameValueColumnBottomHeaderForOrientation(this._orientation),
				field: 'secondary',
				width: 150,
				headerCssClass: 'prop-table-header',
				formatter: textFormatter
			});
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
			}
			else if (!a[1]?.displayOrder) {
				return -1;
			}
			else if (!b[1]?.displayOrder) {
				return 1;
			}
			else {
				return a[1].displayOrder - b[1].displayOrder;
			}
		}));
	}

	/**
	 * This method will sort properties by having those with different values appear at the top,
	 * and similar values appearing at the bottom of the table.
	 *
	 * An example of this sort of sorting looks like this:
	 *
	 * Name							Value (Top plan)		Value (Bottom Plan)
	 * -------------------------------------------------------------------------
	 * Compile Time					38						37						<unequal>
	 * CompileCpu					38						37						<unequal>
	 * CompileMemory				5816					6424					<unequal>
	 * Estimated Number of Rows		1000					1000					<equal>
	 * Optimization Level			FULL					FULL					<equal>
	 * RetrievedFromCache			false					false					<equal>
	 *
	 * @param rows An array of TableRows that contains all the properties that will be organized.
	 * @returns A new array of TableRows with unequal values appearing at the top and equal values appearing at the bottom.
	 */
	public sortPropertiesByDisplayValueEquivalency(rows: TableRow[]): TableRow[] {
		const [unequalPropertyRows, equalPropertyRows] = this.splitEqualFromUnequalProperties(rows);

		const organizedPropertyRows: TableRow[] = [...unequalPropertyRows];

		if (equalPropertyRows.length > 0) {
			const equivalentPropertiesRow: TableRow = new Object() as TableRow;
			equivalentPropertiesRow.name = equivalentPropertiesRowHeader;
			equivalentPropertiesRow.expanded = false;
			equivalentPropertiesRow.treeGridChildren = equalPropertyRows;

			organizedPropertyRows.push(equivalentPropertiesRow);
		}

		return organizedPropertyRows;
	}

	private splitEqualFromUnequalProperties(rows: TableRow[]): [TableRow[], TableRow[]] {
		const unequalRows: TableRow[] = [];
		const equalRows: TableRow[] = [];

		for (let row of rows) {
			const treeGridChildren = row.treeGridChildren;

			if (treeGridChildren?.length > 0) {
				const [unequalSubRows, equalSubRows] = this.splitEqualFromUnequalProperties(treeGridChildren);

				if (unequalSubRows.length > 0) {
					const currentRow = deepClone(row);
					currentRow.treeGridChildren = unequalSubRows;
					currentRow.expanded = true;

					currentRow.icon = {
						iconCssClass: executionPlanComparisonPropertiesDifferent,
						title: notEqualTitle
					};

					unequalRows.push(currentRow);
				}

				if (equalSubRows.length > 0) {
					const currentRow = deepClone(row);
					currentRow.treeGridChildren = equalSubRows;

					equalRows.push(currentRow);
				}
			}
			else {
				const primary = row.primary;
				const secondary = row.secondary;

				if (primary && secondary && primary.text === secondary.title) {
					equalRows.push(row);
				}
				else {
					unequalRows.push(row);
				}
			}
		}

		return [unequalRows, equalRows];
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

	private convertPropertiesToTableRows(primaryNode: azdata.executionPlan.ExecutionPlanGraphElementProperty[], secondaryNode: azdata.executionPlan.ExecutionPlanGraphElementProperty[]): TableRow[] {
		const rows: TableRow[] = [];
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
			let row: TableRow = new Object() as TableRow;
			row.name = {
				text: k
			};

			const primaryProp = v.primaryProp;
			const secondaryProp = v.secondaryProp;

			if (primaryProp && secondaryProp) {
				row.displayOrder = v.primaryProp.displayOrder;

				let diffIcon = new Object() as DiffIcon;
				if (v.primaryProp.displayValue !== v.secondaryProp.displayValue) {
					switch (v.primaryProp.dataType) {
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Boolean:
							diffIcon.iconClass = executionPlanComparisonPropertiesDifferent;
							diffIcon.title = notEqualTitle;
							break;
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Number:
							if (v.primaryProp.betterValue === sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyBetterValue.None) {
								diffIcon.title = notEqualTitle;
								diffIcon.iconClass = executionPlanComparisonPropertiesDifferent;
							} else {
								diffIcon = (parseFloat(v.primaryProp.displayValue) > parseFloat(v.secondaryProp.displayValue))
									? { iconClass: Codicon.chevronRight.classNames, title: greaterThanTitle }
									: { iconClass: Codicon.chevronLeft.classNames, title: lessThanTitle };
							}
							break;
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.String:
							diffIcon.iconClass = executionPlanComparisonPropertiesDifferent;
							diffIcon.title = notEqualTitle;
							break;
						default:
							diffIcon.iconClass = executionPlanComparisonPropertiesDifferent;
							diffIcon.title = notEqualTitle;
							break;
					}
				}

				row.primary = {
					text: removeLineBreaks(v.primaryProp.displayValue, ' ')
				};

				row.icon = {
					iconCssClass: diffIcon.iconClass ?? '',
					title: diffIcon.title ?? ''
				};

				row.secondary = {
					title: removeLineBreaks(v.secondaryProp.displayValue, ' '),
				};

				if ((primaryProp && !isString(primaryProp.value)) || (secondaryProp && !isString(secondaryProp.value))) {
					const parentRowStyling = ' parent-row-styling';

					row.name.iconCssClass = !row.name.iconCssClass ? parentRowStyling : row.name.iconCssClass + parentRowStyling;
					row.primary.iconCssClass = !row.primary.iconCssClass ? parentRowStyling : row.primary.iconCssClass + parentRowStyling;
					row.icon.iconCssClass = !row.icon.iconCssClass ? parentRowStyling : row.icon.iconCssClass + parentRowStyling;
					row.secondary.iconCssClass = !row.secondary.iconCssClass ? parentRowStyling : row.secondary.iconCssClass + parentRowStyling;
				}

				rows.push(row);

				const topPropValue = isString(primaryProp.value) ? undefined : primaryProp.value;
				const bottomPropValue = isString(secondaryProp.value) ? undefined : secondaryProp.value;
				row.treeGridChildren = this.convertPropertiesToTableRows(topPropValue, bottomPropValue);

			} else if (primaryProp && !secondaryProp) {
				row.displayOrder = v.primaryProp.displayOrder;

				row.primary = {
					text: v.primaryProp.displayValue
				};

				row.icon = {
					iconCssClass: executionPlanComparisonPropertiesDifferent,
					title: notEqualTitle
				};

				rows.push(row);

				if (!isString(primaryProp.value)) {
					row.name.iconCssClass += ` parent-row-styling`;
					row.primary.iconCssClass += ` parent-row-styling`;
					row.treeGridChildren = this.convertPropertiesToTableRows(primaryProp.value, undefined);
				}
			} else if (!primaryProp && secondaryProp) {
				row.displayOrder = v.secondaryProp.displayOrder;

				row.secondary = {
					title: v.secondaryProp.displayValue,
					iconCssClass: ''
				};

				row.icon = {
					iconCssClass: executionPlanComparisonPropertiesDifferent,
					title: notEqualTitle
				};

				rows.push(row);

				if (!isString(secondaryProp.value)) {
					row.name.iconCssClass += ` parent-row-styling`;
					row.secondary.iconCssClass += ` parent-row-styling`;
					row.treeGridChildren = this.convertPropertiesToTableRows(undefined, secondaryProp.value);
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

interface DiffIcon {
	iconClass: string;
	title: string;
}

interface TableRow extends Slick.SlickData {
	displayOrder: number;
	icon: RowContent;
	name: RowContent | string;
	primary: RowContent;
	secondary: RowContent;
	expanded: boolean;
	treeGridChildren: TableRow[];
}

interface RowContent {
	iconCssClass?: string;
	text?: string;
	title?: string;
}
