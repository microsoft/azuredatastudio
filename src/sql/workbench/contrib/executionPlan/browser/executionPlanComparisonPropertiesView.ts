/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecutionPlanPropertiesViewBase, PropertiesSortType } from 'sql/workbench/contrib/executionPlan/browser/executionPlanPropertiesViewBase';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { isNumber } from 'sql/base/common/numbers';
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
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { Codicon } from 'vs/base/common/codicons';

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

function getTopPlanIsGreaterThanBottomPlanSummaryTextTemplate(rowName: string): string {
	return localize('nodePropertyViewTopPlanGreaterThanBottomPlan', '{0} is greater for the top plan than it is for the bottom plan.', rowName);
}

function getBottomPlanIsGreaterThanTopPlanSummaryTextTemplate(rowName: string): string {
	return localize('nodePropertyViewBottomPlanGreaterThanTopPlan', '{0} is greater for the bottom plan than it is for the top plan.', rowName);
}

function getLeftPlanIsGreaterThanRightPlanSummaryTextTemplate(rowName: string): string {
	return localize('nodePropertyViewLeftPlanGreaterThanRightPlan', '{0} is greater for the left plan than it is for the right plan.', rowName);
}

function getRightPlanIsGreaterThanLeftPlanSummaryTextTemplate(rowName: string): string {
	return localize('nodePropertyViewRightPlanGreaterThanLeftPlan', '{0} is greater for the right plan than it is for the left plan.', rowName);
}

const notEqualTitle = localize('nodePropertyViewNameNotEqualTitle', 'Not equal to');
const lessThanTitle = localize('nodePropertyViewNameLessThanTitle', 'Less than');
const greaterThanTitle = localize('nodePropertyViewNameGreaterThanTitle', 'Greater than');
const equalPropertiesRowHeader = localize('nodePropertyViewNameEqualPropertiesRowHeader', 'Equal Properties');
const topTitleColumnHeader = localize('nodePropertyViewNameValueColumnTopHeader', "Value (Top Plan)");
const leftTitleColumnHeader = localize('nodePropertyViewNameValueColumnLeftHeader', "Value (Left Plan)");
const rightTitleColumnHeader = localize('nodePropertyViewNameValueColumnRightHeader', "Value (Right Plan)");
const bottomTitleColumnHeader = localize('nodePropertyViewNameValueColumnBottomHeader', "Value (Bottom Plan)");

export class ExecutionPlanComparisonPropertiesView extends ExecutionPlanPropertiesViewBase {
	private _model: ExecutionPlanComparisonPropertiesViewModel;
	private _summaryTextContainer: HTMLElement;
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
		@IContextViewService contextViewService: IContextViewService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(parentContainer, themeService, instantiationService, contextMenuService, contextViewService);
		this._model = <ExecutionPlanComparisonPropertiesViewModel>{};
		this._parentContainer.style.display = 'none';
		const header = DOM.$('.compare-operation-name');

		this._summaryTextContainer = DOM.$('.compare-operation-summary-text');
		this.setSummary(this._summaryTextContainer);

		this._primaryContainer = DOM.$('.compare-operation-name-text');
		header.appendChild(this._primaryContainer);

		this._secondaryContainer = DOM.$('.compare-operation-name-text');
		header.appendChild(this._secondaryContainer);

		this.setHeader(header);
	}

	private setSummaryElement(summary: string[]): void {
		const EOL = this.textResourcePropertiesService.getEOL(undefined);
		let summaryText = summary.join(EOL);
		let summaryContainerText = localize('executionPlanSummaryForExpensiveOperators', "Summary: {0}{1}", EOL, summaryText);
		this._summaryTextContainer.innerText = summaryContainerText;
		this._summaryTextContainer.title = summaryContainerText;
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

		const tableRows = this.convertPropertiesToTableRows(primaryProps, secondaryProps);
		this.setSummaryElement(this.getExpensivePropertySummary(tableRows));
		this.populateTable(columns, tableRows);
	}

	/**
	 * This method returns an array of strings that that will make up the properties summary. The properties summary
	 * will appear above the properties table when execution plans are being compared.
	 * Each segment of that summary is in the following generic format:
	 *
	 * <row-name> is greater for the top plan than it is for the bottom plan.
	 * <row-name> is greater for the bottom plan than it is for the top plan.
	 *
	 * @param tableRows The table rows that will appear in the properties table.
	 * @returns The string array containing the segments of the summary.
	 */
	private getExpensivePropertySummary(tableRows: { [key: string]: string }[]): string[] {
		let summary: string[] = [];

		tableRows.forEach(row => {
			const rowName = row.name['text'];
			if (row.primary && row.secondary) {
				const primaryText = row.primary['text'].split(' ');
				const secondaryTitle = row.secondary['title'].split(' ');

				if (primaryText.length === secondaryTitle.length && primaryText.length <= 2 && secondaryTitle.length <= 2) {
					const MAX_PROPERTY_SUMMARY_LENGTH = 3;

					for (let i = 0; i < primaryText.length && summary.length < MAX_PROPERTY_SUMMARY_LENGTH; ++i) {
						if (isNumber(primaryText[i]) && isNumber(secondaryTitle[i])) {
							const primaryValue = Number(primaryText);
							const secondaryValue = Number(secondaryTitle);

							let summaryText: string;
							if (primaryValue > secondaryValue) {
								summaryText = this._orientation === ExecutionPlanCompareOrientation.Horizontal
									? getTopPlanIsGreaterThanBottomPlanSummaryTextTemplate(rowName)
									: getLeftPlanIsGreaterThanRightPlanSummaryTextTemplate(rowName);
							}
							else {
								summaryText = this._orientation === ExecutionPlanCompareOrientation.Horizontal
									? getBottomPlanIsGreaterThanTopPlanSummaryTextTemplate(rowName)
									: getRightPlanIsGreaterThanLeftPlanSummaryTextTemplate(rowName);
							}

							summary.push(summaryText);
						}
					}
				}
			}
		});

		return summary;
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

	/**
	 * This method will sort properties by having those with different values appear at the top,
	 * and similar values appearing at the bottom of the table.
	 *
	 * An example of this sort of sorting looks like this:
	 *
	 * Name							Value (Top plan)		Value (Bottom Plan)
	 * -------------------------------------------------------------------------
	 * Compile Time					38						37						<diff>
	 * CompileCpu					38						37						<diff>
	 * CompileMemory				5816					6424					<diff>
	 * Estimated Number of Rows		1000					1000					<same>
	 * Optimization Level			FULL					FULL					<same>
	 * RetrievedFromCache			false					false					<same>
	 *
	 * @param props Map of properties that will be organized.
	 * @returns A new map with different values appearing at the top and similar values appearing at the bottom.
	 */
	public sortPropertiesByDisplayValueEquivalency(props: Map<string, TablePropertiesMapEntry>): Map<string, TablePropertiesMapEntry> {
		let unequalProperties: Map<string, TablePropertiesMapEntry> = new Map();
		let equalProperties: Map<string, TablePropertiesMapEntry> = new Map();

		[...props.entries()].forEach(prop => {
			if (prop.length === 2) {
				const [rowKey, rowEntry] = prop;
				const primaryProp = rowEntry.primaryProp;
				const secondaryProp = rowEntry.secondaryProp;

				if (primaryProp?.displayValue.localeCompare(secondaryProp?.displayValue) === 0) {
					equalProperties.set(rowKey, rowEntry);
				}
				else {
					unequalProperties.set(rowKey, rowEntry);
				}
			}
		});

		let map: Map<string, TablePropertiesMapEntry> = new Map();
		unequalProperties.forEach((v, k) => {
			map.set(k, v);
		});

		equalProperties.forEach((v, k) => {
			map.set(k, v);
		});

		return map;
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

	private convertPropertiesToTableRows(primaryNode: azdata.executionPlan.ExecutionPlanGraphElementProperty[], secondaryNode: azdata.executionPlan.ExecutionPlanGraphElementProperty[]): { [key: string]: string }[] {
		const rows: { [key: string]: string }[] = [];
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
				propertiesMap = this.sortPropertiesByDisplayValueEquivalency(propertiesMap);
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

			const primaryProp = v.primaryProp;
			const secondaryProp = v.secondaryProp;
			let diffIconClass = '';

			if (primaryProp && secondaryProp) {
				row['displayOrder'] = v.primaryProp.displayOrder;

				let diffIcon = new Object() as DiffIcon;
				if (v.primaryProp.displayValue !== v.secondaryProp.displayValue) {
					switch (v.primaryProp.dataType) {
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Boolean:
							diffIcon.iconClass = executionPlanComparisonPropertiesDifferent;
							diffIcon.title = notEqualTitle;
							break;
						case sqlExtHostType.executionPlan.ExecutionPlanGraphElementPropertyDataType.Number:
							diffIcon = (parseFloat(v.primaryProp.displayValue) > parseFloat(v.secondaryProp.displayValue))
								? { iconClass: Codicon.chevronRight.classNames, title: greaterThanTitle }
								: { iconClass: Codicon.chevronLeft.classNames, title: lessThanTitle };

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

				row['primary'] = {
					text: removeLineBreaks(v.primaryProp.displayValue, ' ')
				};

				row['icon'] = {
					iconCssClass: diffIcon.iconClass,
					title: diffIcon.title
				};

				row['secondary'] = {
					title: removeLineBreaks(v.secondaryProp.displayValue, ' ')
				};

				if ((primaryProp && !isString(primaryProp.value)) || (secondaryProp && !isString(secondaryProp.value))) {
					row['name'].iconCssClass += ` parent-row-styling`;
					row['primary'].iconCssClass += ` parent-row-styling`;
					row['icon'].iconCssClass += 'parent-row-styling';
					row['secondary'].iconCssClass += ` parent-row-styling`;
				}

				rows.push(row);

				const topPropValue = isString(primaryProp.value) ? undefined : primaryProp.value;
				const bottomPropValue = isString(secondaryProp.value) ? undefined : secondaryProp.value;
				row['treeGridChildren'] = this.convertPropertiesToTableRows(topPropValue, bottomPropValue);

			} else if (primaryProp && !secondaryProp) {
				row['displayOrder'] = v.primaryProp.displayOrder;
				row['primary'] = {
					text: v.primaryProp.displayValue
				};
				rows.push(row);
				if (!isString(primaryProp.value)) {
					row['name'].iconCssClass += ` parent-row-styling`;
					row['primary'].iconCssClass += ` parent-row-styling`;
					row['treeGridChildren'] = this.convertPropertiesToTableRows(primaryProp.value, undefined);
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
					row['treeGridChildren'] = this.convertPropertiesToTableRows(undefined, secondaryProp.value);
				}
			}

		});

		let formattedRows: { [key: string]: string }[] = [];
		let equalRows: { [key: string]: string }[] = [];
		for (const [_, row] of Object.entries(rows)) {
			if (row.primary && row.secondary && row.primary['text'] === row.secondary['title']) {
				equalRows.push(row);
			}
			else {
				formattedRows.push(row);
			}
		}

		if (equalRows.length > 0) {
			let equalRow = {};
			equalRow['name'] = equalPropertiesRowHeader;
			equalRow['expanded'] = false;
			equalRow['treeGridChildren'] = equalRows;

			formattedRows.push(equalRow);
		}

		return formattedRows;
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
