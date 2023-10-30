/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/filterDialog';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Modal } from 'sql/workbench/browser/modal/modal'
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILogService } from 'vs/platform/log/common/log';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { localize } from 'vs/nls';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import * as DOM from 'vs/base/browser/dom';
import * as azdata from 'azdata';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { NodeFilterPropertyDataType, NodeFilterOperator } from 'sql/workbench/api/common/sqlExtHostTypes';
import { Table } from 'sql/base/browser/ui/table/table';
import { TableCellEditorFactory } from 'sql/base/browser/ui/table/tableCellEditorFactory';
import { Emitter } from 'vs/base/common/event';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { TableHeaderRowHeight, TableRowHeight } from 'sql/workbench/browser/designer/designerTableUtil';
import { textFormatter } from 'sql/base/browser/ui/table/formatters';
import { ButtonColumn } from 'sql/base/browser/ui/table/plugins/buttonColumn.plugin';
import Severity from 'vs/base/common/severity';
import { status } from 'vs/base/browser/ui/aria/aria';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { defaultInputBoxStyles } from 'vs/platform/theme/browser/defaultStyles';
import { defaultEditableDropdownStyles, defaultSelectBoxStyles, defaultTableStyles } from 'sql/platform/theme/browser/defaultStyles';

// strings for filter dialog
const OkButtonText = localize('objectExplorer.okButtonText', "OK");
const CancelButtonText = localize('objectExplorer.cancelButtonText', "Cancel");
const ClearAllButtonText = localize('objectExplorer.clearAllButtonText', "Clear All");
const TitleIconClass: string = 'icon filterLabel';

// strings for filter operator select box
const EQUALS_SELECT_BOX = localize('objectExplorer.equalsSelectBox', "Equals");
const NOT_EQUALS_SELECT_BOX = localize('objectExplorer.notEqualsSelectBox', "Not Equals");
const LESS_THAN_SELECT_BOX = localize('objectExplorer.lessThanSelectBox', "Less Than");
const LESS_THAN_OR_EQUALS_SELECT_BOX = localize('objectExplorer.lessThanOrEqualsSelectBox', "Less Than Or Equals");
const GREATER_THAN_SELECT_BOX = localize('objectExplorer.greaterThanSelectBox', "Greater Than");
const GREATER_THAN_OR_EQUALS_SELECT_BOX = localize('objectExplorer.greaterThanOrEqualsSelectBox', "Greater Than Or Equals");
const BETWEEN_SELECT_BOX = localize('objectExplorer.betweenSelectBox', "Between");
const NOT_BETWEEN_SELECT_BOX = localize('objectExplorer.notBetweenSelectBox', "Not Between");
const CONTAINS_SELECT_BOX = localize('objectExplorer.containsSelectBox', "Contains");
const NOT_CONTAINS_SELECT_BOX = localize('objectExplorer.notContainsSelectBox', "Not Contains");
const STARTS_WITH_SELECT_BOX = localize('objectExplorer.startsWithSelectBox', "Starts With");
const NOT_STARTS_WITH_SELECT_BOX = localize('objectExplorer.notStartsWithSelectBox', "Not Starts With");
const ENDS_WITH_SELECT_BOX = localize('objectExplorer.endsWithSelectBox', "Ends With");
const NOT_ENDS_WITH_SELECT_BOX = localize('objectExplorer.notEndsWithSelectBox', "Not Ends With");
const AND_SELECT_BOX = localize('objectExplorer.andSelectBox', "And");

// strings for filter table column headers
const PROPERTY_NAME_COLUMN_HEADER = localize('objectExplorer.propertyNameColumnHeader', "Property");
const OPERATOR_COLUMN_HEADER = localize('objectExplorer.operatorColumnHeader', "Operator");
const VALUE_COLUMN_HEADER = localize('objectExplorer.valueColumnHeader', "Value");
const CLEAR_COLUMN_HEADER = localize('objectExplorer.clearColumnHeader', "Clear");


// strings for value select box for boolean type filters
const TRUE_SELECT_BOX = localize('objectExplorer.trueSelectBox', "True");
const FALSE_SELECT_BOX = localize('objectExplorer.falseSelectBox', "False");

const SUBTITLE_LABEL = localize('objectExplorer.nodePath', "Path:");

const PROPERTY_COLUMN_ID = 'property';
const OPERATOR_COLUMN_ID = 'operator';
const VALUE_COLUMN_ID = 'value';
const CLEAR_COLUMN_ID = 'clear';

export class FilterDialog extends Modal {

	private filterTable: Table<Slick.SlickData>;
	private _tableCellEditorFactory: TableCellEditorFactory;
	private _description: HTMLElement;
	private _onFilterApplied = new Emitter<azdata.NodeFilter[]>();
	public readonly onFilterApplied = this._onFilterApplied.event;
	private _onCloseEvent = new Emitter<void>();
	public readonly onDialogClose = this._onCloseEvent.event;

	constructor(
		private _properties: azdata.NodeFilterProperty[],
		private _filterDialogTitle: string,
		private _filterDialogSubtitle: string,
		private _appliedFilters: azdata.NodeFilter[],
		private applyFilterAction: (filters: azdata.NodeFilter[]) => Promise<void> | undefined,
		@IThemeService themeService: IThemeService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@ILayoutService layoutService: ILayoutService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextViewService private readonly _contextViewProvider: IContextViewService,
		@IAccessibilityService private readonly _accessibilityService: IAccessibilityService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
	) {
		super(
			'ObjectExplorerServiceDialog',
			'Object Explorer Service Dialog',
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{
				dialogStyle: 'normal',
				hasTitleIcon: true,
				hasSpinner: true
			}
		);
	}

	public open(): void {
		this.render();
		this.show();
		this.filterTable.focus();
	}

	public override render() {
		super.render();
		this.title = this._filterDialogTitle;
		this.titleIconClassName = TitleIconClass;
		this._register(attachModalDialogStyler(this, this._themeService));
		this.addFooterButton(OkButtonText, async () => { await this.onApply() });
		this.addFooterButton(CancelButtonText, () => { this.onClose() });
		this.addFooterButton(ClearAllButtonText, () => { this.onClearAll() }, 'left', true);
	}

	protected renderBody(container: HTMLElement): void {
		const body = DOM.append(container, DOM.$('.filter-dialog-body'));
		const subtitle = DOM.append(body, DOM.$('.filter-dialog-node-path'));
		const subtileLabel = DOM.append(subtitle, DOM.$('.filter-dialog-node-path-label'));
		subtileLabel.innerText = SUBTITLE_LABEL;
		const subtilteText = DOM.append(subtitle, DOM.$('.filter-dialog-node-path-text'));
		const nodePathText = this._filterDialogSubtitle;
		subtilteText.title = nodePathText;
		subtilteText.innerText = nodePathText;
		const clauseTableContainer = DOM.append(body, DOM.$('.filter-table-container'));
		const filter = DOM.append(clauseTableContainer, DOM.$('.filter-table'));
		this._tableCellEditorFactory = new TableCellEditorFactory(
			{
				valueGetter: (item, column): string => {

					// if the operator is And and the operator is date, we need to get the date from the previous
					// row to make it more user friendly for the user to enter the next value.
					if (column.field === VALUE_COLUMN_ID && item[OPERATOR_COLUMN_ID].value === AND_SELECT_BOX) {
						const index = item.filterPropertyIndex;
						const tableData = this.filterTable.getData().getItems();
						if (this._properties[index].type === NodeFilterPropertyDataType.Date) {
							let value1 = '';
							for (let i = 0; i < tableData.length; i++) {
								if (tableData[i].filterPropertyIndex === index) {
									value1 = tableData[i].value.value;
									break;
								}
							}
							const value2 = item[column.field].value;
							return value2 === '' ? value1 : value2;
						}
					}
					return item[column.field].value;
				},
				valueSetter: (context: any, row: number, item: any, column: Slick.Column<Slick.SlickData>, value: string): void => {
					item[column.field].value = value;
					if (column.field === 'operator') {
						const index = item.filterPropertyIndex;
						const nodeOperator = this._properties[index].type;
						if (nodeOperator === NodeFilterPropertyDataType.Date || nodeOperator === NodeFilterPropertyDataType.Number) {
							if (value === BETWEEN_SELECT_BOX || value === NOT_BETWEEN_SELECT_BOX) {

								const tableData = this.filterTable.getData().getItems();
								if (tableData.length > row + 1) {
									if (tableData[row + 1].operator.value === AND_SELECT_BOX) {
										return;
									}
								}
								const newRow: Slick.SlickData = {
									property: {
										value: ''
									},
									operator: {
										value: AND_SELECT_BOX,
										values: [AND_SELECT_BOX]
									},
									value: {
										value: '',
										values: []
									},
									filterPropertyIndex: tableData[row].filterPropertyIndex
								};
								const activeElement = this.filterTable.activeCell;
								tableData.splice(row + 1, 0, newRow);
								dataProvider.clear();
								dataProvider.push(tableData);
								this.filterTable.rerenderGrid();
								this.filterTable.layout(new DOM.Dimension(600, (dataProvider.getItems().length + 2) * TableRowHeight));
								this.filterTable.setActiveCell(activeElement.row, activeElement.cell);
							} else {
								const tableData = this.filterTable.getData().getItems();
								if (tableData.length > row + 1) {
									if (tableData[row + 1].operator.value === AND_SELECT_BOX) {
										const activeElement = this.filterTable.activeCell;
										tableData.splice(row + 1, 1);
										dataProvider.clear();
										dataProvider.push(tableData);
										this.filterTable.rerenderGrid();
										this.filterTable.layout(new DOM.Dimension(600, (dataProvider.getItems().length + 2) * TableRowHeight));
										this.filterTable.setActiveCell(activeElement.row, activeElement.cell);
									}
								}
							}
						}
					}
				},
				optionsGetter: (item, column): string[] => {
					return item[column.field].values;
				},
				inputBoxStyles: defaultInputBoxStyles,
				editableDropdownStyles: defaultEditableDropdownStyles,
				selectBoxStyles: defaultSelectBoxStyles
			}, this._contextViewProvider
		);
		const columns: Slick.Column<Slick.SlickData>[] = [
			{
				id: PROPERTY_COLUMN_ID,
				name: PROPERTY_NAME_COLUMN_HEADER,
				field: PROPERTY_COLUMN_ID,
				formatter: textFormatter,
				width: 180,
			},
			{
				id: OPERATOR_COLUMN_ID,
				name: OPERATOR_COLUMN_HEADER,
				editor: this._tableCellEditorFactory.getDropdownEditorClass(this, [], false),
				field: OPERATOR_COLUMN_ID,
				formatter: textFormatter,
				width: 180
			},
			{
				id: VALUE_COLUMN_ID,
				name: VALUE_COLUMN_HEADER,
				width: 180,
				formatter: textFormatter,
				field: VALUE_COLUMN_ID
			}
		];

		const clearValueColumn = new ButtonColumn({
			id: CLEAR_COLUMN_ID,
			iconCssClass: 'icon erase',
			name: CLEAR_COLUMN_HEADER,
			title: CLEAR_COLUMN_HEADER,
			width: 60,
			resizable: true,
			isFontIcon: true
		});
		this._register(clearValueColumn.onClick(e => {
			const row = e.row;
			const data = this.filterTable.getData().getItems();
			data[row][VALUE_COLUMN_ID].value = '';
			dataProvider.clear();
			dataProvider.push(data);
			this.filterTable.rerenderGrid();
		}));
		columns.push(clearValueColumn.definition);


		const tableData: Slick.SlickData[] = [];
		if (!this._appliedFilters) {
			this._appliedFilters = [];
		}
		this._properties.forEach((f, i) => {
			const appliedFilter = this._appliedFilters.find(filter => filter.name === f.name);
			const filterOperators = this.getOperatorsForType(f.type);
			const row: Slick.SlickData = {
				property: {
					value: f.displayName,
					id: f.name
				},
				operator: {
					value: appliedFilter ? this.getFilterOperatorString(appliedFilter.operator) : filterOperators[0],
					values: filterOperators
				},
				value: {
					value: appliedFilter ? this.getStringValueForFilter(f, appliedFilter.value) : '',
					values: this.getChoiceValuesForFilterProperties(f)
				},
				filterPropertyIndex: i
			};
			tableData.push(row);

			if (appliedFilter?.operator === NodeFilterOperator.Between || appliedFilter?.operator === NodeFilterOperator.NotBetween) {
				row.value.value = this.getStringValueForFilter(f, appliedFilter.value[0]);
				const andRow: Slick.SlickData = {
					property: {
						value: '',
						id: ''
					},
					operator: {
						value: AND_SELECT_BOX,
						values: [AND_SELECT_BOX]
					},
					value: {
						value: this.getStringValueForFilter(f, appliedFilter.value[1]),
						values: []
					},
					datatype: f.type,
					filterPropertyIndex: i
				};
				tableData.push(andRow);
			}
		});

		const dataProvider = new TableDataView<Slick.SlickData>();
		dataProvider.push(tableData);


		// Sets up the editor for the value column
		(<any>dataProvider).getItemMetadata = (row: number) => {
			const rowData = dataProvider.getItem(row);

			const filterProperty = this._properties[rowData.filterPropertyIndex];
			let editor;
			if (rowData.operator.value === AND_SELECT_BOX) {
				if (filterProperty.type === NodeFilterPropertyDataType.Number) {
					editor = this._tableCellEditorFactory.getTextEditorClass(this, 'number');
				} else if (filterProperty.type === NodeFilterPropertyDataType.Date) {
					editor = this._tableCellEditorFactory.getTextEditorClass(this, 'date');
				}
			} else {

				if (filterProperty.type === NodeFilterPropertyDataType.String) {
					editor = this._tableCellEditorFactory.getTextEditorClass(this, 'text');
				} else if (filterProperty.type === NodeFilterPropertyDataType.Date) {
					editor = this._tableCellEditorFactory.getTextEditorClass(this, 'date');
				} else if (filterProperty.type === NodeFilterPropertyDataType.Boolean) {
					editor = this._tableCellEditorFactory.getDropdownEditorClass(this, [TRUE_SELECT_BOX, FALSE_SELECT_BOX], false);
				} else if (filterProperty.type === NodeFilterPropertyDataType.Number) {
					editor = this._tableCellEditorFactory.getTextEditorClass(this, 'number');
				} else if (filterProperty.type === NodeFilterPropertyDataType.Choice) {
					editor = this._tableCellEditorFactory.getDropdownEditorClass(this, this.getDropdownOptionsForChoiceProperty(<azdata.NodeFilterChoiceProperty>filterProperty), false);
				}

			}
			return {
				columns: {
					value: {
						editor: editor
					}
				}
			};
		}

		this.filterTable = new Table(filter, this._accessibilityService, this._quickInputService, defaultTableStyles, {
			dataProvider: dataProvider!,
			columns: columns,
		}, {
			editable: true,
			autoEdit: true,
			dataItemColumnValueExtractor: (data: any, column: Slick.Column<Slick.SlickData>): string => {
				if (column.field) {
					return data[column.field]?.value;
				} else {
					return undefined;
				}
			},
			rowHeight: TableRowHeight,
			headerRowHeight: TableHeaderRowHeight,
			editorLock: new Slick.EditorLock(),
			autoHeight: true,
		});

		this.filterTable.grid.onActiveCellChanged.subscribe((e, any) => {
			if (this.filterTable.grid.getActiveCell()) {
				const row = this.filterTable.grid.getActiveCell().row;
				const data = this.filterTable.getData().getItems()[row];
				let index = data.filterPropertyIndex;
				const filterPropertyDescription = this._properties[index].description;
				this._description.innerText = filterPropertyDescription;
				// Announcing the filter property description for screen reader users
				status(filterPropertyDescription);
			}
		});

		this.filterTable.registerPlugin(clearValueColumn);
		this.filterTable.layout(new DOM.Dimension(600, (tableData.length + 2) * TableRowHeight));

		this._description = DOM.append(body, DOM.$('.filter-dialog-description'));
		this._description.innerText = this._properties[0].description;
	}

	protected layout(height?: number): void {
		// noop
	}

	protected override onClose() {
		this.hide('close');
		this._onCloseEvent.fire();
	}

	protected onClearAll() {
		const tableAllData = this.filterTable.getData().getItems();
		tableAllData.forEach((row) => {
			row.value.value = '';

		});
		this.filterTable.rerenderGrid();
	}

	// This method is called when the ok button is pressed
	private async onApply(): Promise<void> {
		const tableData = this.filterTable.getData().getItems();

		this._appliedFilters = [];

		for (let i = 0; i < tableData.length; i++) {
			const row = tableData[i];
			let filterProperty = this._properties[row.filterPropertyIndex]
			let filter: azdata.NodeFilter = {
				name: row.property.id,
				operator: this.getFilterOperatorEnum(row.operator.value),
				value: this.getFilterValue(filterProperty.type, row.value.value, filterProperty),
			};

			const isMultipleValueFilter = filter.operator === NodeFilterOperator.Between || filter.operator === NodeFilterOperator.NotBetween;
			if (isMultipleValueFilter) {
				i++;
				const row2 = tableData[i];
				var value1 = this.getFilterValue(filterProperty.type, row.value.value, filterProperty);
				var value2 = this.getFilterValue(filterProperty.type, row2.value.value, filterProperty);
				filter.value = <string[] | number[]>[value1, value2];
				if (filterProperty.type === NodeFilterPropertyDataType.Date) {
					if (filter.value[0] === '' && filter.value[1] !== '') {
						// start date not specified.
						this._errorMessageService.showDialog(Severity.Error, '', localize('filterDialog.errorStartDate', "Start date is not specified."));
						return;
					} else if (filter.value[0] !== '' && filter.value[1] === '') {
						// end date not specified.
						this._errorMessageService.showDialog(Severity.Error, '', localize('filterDialog.errorEndDate', "End date is not specified."));
						return;
					} else if (new Date(filter.value[0]) > new Date(filter.value[1])) {
						// start date is greater than end date.
						this._errorMessageService.showDialog(Severity.Error, '', localize('filterDialog.errorDateRange', "Start date cannot be greater than end date."));
						return;
					}
				} else if (filterProperty.type === NodeFilterPropertyDataType.Number) {
					if (filter.value[0] === '' && filter.value[1] !== '') {
						// start number not specified.
						this._errorMessageService.showDialog(Severity.Error, '', localize('filterDialog.errorStartNumber', "Start number is not specified."));
						return;
					} else if (filter.value[0] !== '' && filter.value[1] === '') {
						// end number not specified.
						this._errorMessageService.showDialog(Severity.Error, '', localize('filterDialog.errorEndNumber', "End number is not specified."));
						return;
					} else if (Number(filter.value[0]) > Number(filter.value[1])) {
						// start number is greater than end number.
						this._errorMessageService.showDialog(Severity.Error, '', localize('filterDialog.errorNumberRange', "Start number cannot be greater than end number."));
						return;
					}

				}
				if (value1 !== '' && value2 !== '') {
					this._appliedFilters.push(filter);
				}
			} else {
				if (filter.value !== '') {
					this._appliedFilters.push(filter);
				}
			}
		}
		this.spinner = true;

		try {
			if (this.applyFilterAction) {
				await this.applyFilterAction(this._appliedFilters);
			}
			this._onFilterApplied.fire(this._appliedFilters);
			this.hide('ok');
		}
		catch (e) {
			this.spinner = false;
			throw e;
		}
	}

	// This method is called by modal when the enter button is pressed
	// We override it to do nothing so that the enter button doesn't close the dialog
	protected override async onAccept() {
		// noop
	}

	private getFilterValue(
		filterType: NodeFilterPropertyDataType,
		value: string,
		filterProperty: azdata.NodeFilterProperty
	): string | number | boolean {
		if (value === '') {
			return '';
		}
		switch (filterType) {
			case NodeFilterPropertyDataType.Boolean:
				if (value === TRUE_SELECT_BOX) {
					return true;
				} else if (value === FALSE_SELECT_BOX) {
					return false;
				}
			case NodeFilterPropertyDataType.Number:
				return Number(value);
			case NodeFilterPropertyDataType.Choice:
				const choice = ((<azdata.NodeFilterChoiceProperty>filterProperty).choices.find(c => c.displayName === value));
				if (choice) {
					return choice.value;
				} else {
					return value;
				}
			case NodeFilterPropertyDataType.Date:
			case NodeFilterPropertyDataType.String:
				return value;
		}
	}

	private getStringValueForFilter(filter: azdata.NodeFilterProperty, value: string | number | boolean | number[] | string[]): string {
		switch (filter.type) {
			case NodeFilterPropertyDataType.Boolean:
				if (value === true) {
					return TRUE_SELECT_BOX;
				} else if (value === false) {
					return FALSE_SELECT_BOX;
				}
				break;
			case NodeFilterPropertyDataType.Number:
				return value.toString();
			case NodeFilterPropertyDataType.Choice:
				return (<azdata.NodeFilterChoiceProperty>filter).choices.find(c => c.value === value).displayName;
			case NodeFilterPropertyDataType.Date:
			case NodeFilterPropertyDataType.String:
				return value as string;
		}
		return '';
	}

	private getOperatorsForType(type: NodeFilterPropertyDataType): string[] {
		switch (type) {
			case NodeFilterPropertyDataType.String:
				return [
					CONTAINS_SELECT_BOX,
					NOT_CONTAINS_SELECT_BOX,
					EQUALS_SELECT_BOX,
					NOT_EQUALS_SELECT_BOX,
					STARTS_WITH_SELECT_BOX,
					NOT_STARTS_WITH_SELECT_BOX,
					ENDS_WITH_SELECT_BOX,
					NOT_ENDS_WITH_SELECT_BOX,
				];
			case NodeFilterPropertyDataType.Number:
				return [
					EQUALS_SELECT_BOX,
					NOT_EQUALS_SELECT_BOX,
					GREATER_THAN_SELECT_BOX,
					GREATER_THAN_OR_EQUALS_SELECT_BOX,
					LESS_THAN_SELECT_BOX,
					LESS_THAN_OR_EQUALS_SELECT_BOX,
					BETWEEN_SELECT_BOX,
					NOT_BETWEEN_SELECT_BOX
				];
			case NodeFilterPropertyDataType.Boolean:
				return [
					EQUALS_SELECT_BOX,
					NOT_EQUALS_SELECT_BOX
				];
			case NodeFilterPropertyDataType.Choice:
				return [
					EQUALS_SELECT_BOX,
					NOT_EQUALS_SELECT_BOX
				];
			case NodeFilterPropertyDataType.Date:
				return [
					EQUALS_SELECT_BOX,
					NOT_EQUALS_SELECT_BOX,
					GREATER_THAN_SELECT_BOX,
					GREATER_THAN_OR_EQUALS_SELECT_BOX,
					LESS_THAN_SELECT_BOX,
					LESS_THAN_OR_EQUALS_SELECT_BOX,
					BETWEEN_SELECT_BOX,
					NOT_BETWEEN_SELECT_BOX
				];
		}
	}

	private getFilterOperatorString(operator: NodeFilterOperator): string {
		switch (operator) {
			case NodeFilterOperator.Contains:
				return CONTAINS_SELECT_BOX;
			case NodeFilterOperator.NotContains:
				return NOT_CONTAINS_SELECT_BOX;
			case NodeFilterOperator.StartsWith:
				return STARTS_WITH_SELECT_BOX;
			case NodeFilterOperator.NotStartsWith:
				return NOT_STARTS_WITH_SELECT_BOX;
			case NodeFilterOperator.EndsWith:
				return ENDS_WITH_SELECT_BOX;
			case NodeFilterOperator.NotEndsWith:
				return NOT_ENDS_WITH_SELECT_BOX;
			case NodeFilterOperator.Equals:
				return EQUALS_SELECT_BOX;
			case NodeFilterOperator.NotEquals:
				return NOT_EQUALS_SELECT_BOX;
			case NodeFilterOperator.GreaterThan:
				return GREATER_THAN_SELECT_BOX;
			case NodeFilterOperator.GreaterThanOrEquals:
				return GREATER_THAN_OR_EQUALS_SELECT_BOX;
			case NodeFilterOperator.LessThan:
				return LESS_THAN_SELECT_BOX;
			case NodeFilterOperator.LessThanOrEquals:
				return LESS_THAN_OR_EQUALS_SELECT_BOX;
			case NodeFilterOperator.Between:
				return BETWEEN_SELECT_BOX;
			case NodeFilterOperator.NotBetween:
				return NOT_BETWEEN_SELECT_BOX;
			default:
				return '';
		}
	}

	private getFilterOperatorEnum(operator: string): NodeFilterOperator {
		switch (operator) {
			case CONTAINS_SELECT_BOX:
				return NodeFilterOperator.Contains;
			case NOT_CONTAINS_SELECT_BOX:
				return NodeFilterOperator.NotContains;
			case STARTS_WITH_SELECT_BOX:
				return NodeFilterOperator.StartsWith;
			case NOT_STARTS_WITH_SELECT_BOX:
				return NodeFilterOperator.NotStartsWith;
			case ENDS_WITH_SELECT_BOX:
				return NodeFilterOperator.EndsWith;
			case NOT_ENDS_WITH_SELECT_BOX:
				return NodeFilterOperator.NotEndsWith;
			case EQUALS_SELECT_BOX:
				return NodeFilterOperator.Equals;
			case NOT_EQUALS_SELECT_BOX:
				return NodeFilterOperator.NotEquals;
			case GREATER_THAN_SELECT_BOX:
				return NodeFilterOperator.GreaterThan;
			case GREATER_THAN_OR_EQUALS_SELECT_BOX:
				return NodeFilterOperator.GreaterThanOrEquals;
			case LESS_THAN_SELECT_BOX:
				return NodeFilterOperator.LessThan;
			case LESS_THAN_OR_EQUALS_SELECT_BOX:
				return NodeFilterOperator.LessThanOrEquals;
			case BETWEEN_SELECT_BOX:
				return NodeFilterOperator.Between;
			case NOT_BETWEEN_SELECT_BOX:
				return NodeFilterOperator.NotBetween;
			case TRUE_SELECT_BOX:
				return NodeFilterOperator.Equals;
			case FALSE_SELECT_BOX:
				return NodeFilterOperator.NotEquals;
			default:
				return undefined;
		}
	}

	private getChoiceValuesForFilterProperties(f: azdata.NodeFilterProperty): string[] {
		switch (f.type) {
			case NodeFilterPropertyDataType.Boolean:
				return ['', TRUE_SELECT_BOX, FALSE_SELECT_BOX];
			case NodeFilterPropertyDataType.Choice:
				return ['', ...this.getDropdownOptionsForChoiceProperty(<azdata.NodeFilterChoiceProperty>f)];
			default:
				return [];
		}
	}

	private getDropdownOptionsForChoiceProperty(f: azdata.NodeFilterChoiceProperty): string[] {
		return f.choices.map(choice => {
			return choice.displayName ?? choice.value;
		});
	}

	/**
	 * This method is used to let user apply filters on the given filters properties.
	 * @param properties Properties on which user can apply filters.
	 * @param filterDialogTitle Title of the filter dialog.
	 * @param filterDialogSubtile Subtitle of the filter dialog.
	 * @param appliedFilters Filters that are already applied so that we can prepopulate the filter dialog values.
	 * @param applyFilterAction Action to be performed when user clicks on apply button. We should pass this so that we can handle the spinner and error message within the dialog.
	 * @param instantiationService Instantiation service to create the filter dialog.
	 * @returns
	 */
	public static async getFiltersForProperties(
		properties: azdata.NodeFilterProperty[],
		filterDialogTitle: string,
		filterDialogSubtile: string,
		appliedFilters: azdata.NodeFilter[] | undefined,
		applyFilterAction: (filters: azdata.NodeFilter[]) => Promise<void> | undefined,
		instantiationService: IInstantiationService,
	): Promise<azdata.NodeFilter[]> {

		const dialog = instantiationService.createInstance(FilterDialog, properties, filterDialogTitle, filterDialogSubtile, appliedFilters, applyFilterAction);
		dialog.open();
		return new Promise<azdata.NodeFilter[]>((resolve, reject) => {
			dialog.onFilterApplied(filters => {
				resolve(filters);
			});
			dialog.onDialogClose(() => {
				reject();
			});
		});
	}
}

