/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./../media/filterDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Modal } from 'sql/workbench/browser/modal/modal'
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILogService } from 'vs/platform/log/common/log';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { localize } from 'vs/nls';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { attachButtonStyler, attachInputBoxStyler, attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import * as DOM from 'vs/base/browser/dom';
import * as azdata from 'azdata';
import { AsyncServerTree } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { ITree } from 'sql/base/parts/tree/browser/tree';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { NodeInfoFilterPropertyType, NodeInfoStringOperators } from 'sql/workbench/api/common/sqlExtHostTypes';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { Table } from 'sql/base/browser/ui/table/table';
import { TableCellEditorFactory } from 'sql/base/browser/ui/table/tableCellEditorFactory';
import { Emitter } from 'vs/base/common/event';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { TableHeaderRowHeight, TableRowHeight } from 'sql/workbench/browser/designer/designerTableUtil';
import { textFormatter } from 'sql/base/browser/ui/table/formatters';
import { Dropdown } from 'sql/base/browser/ui/editableDropdown/browser/dropdown';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { TabbedPanel } from 'sql/base/browser/ui/panel/panel';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { ButtonColumn } from 'sql/base/browser/ui/table/plugins/buttonColumn.plugin';
import { Codicon } from 'vs/base/common/codicons';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';

function FilterDialogTitle(nodePath: string): string { return localize('objectExplorer.filterDialogTitle', "Filter Settings: {0}", nodePath) }
const OkButtonText = localize('objectExplorer.okButtonText', "OK");
const CancelButtonText = localize('objectExplorer.cancelButtonText', "Cancel");
const ClearAllButtonText = localize('objectExplorer.clearAllButtonText', "Clear All");
const TitleIconClass: string = 'icon filterLabel';

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
const AND_SELECT_BOX = localize('objectExplorer.andSelectBox', "And");

const PROPERTY_NAME_COLUMN_HEADER = localize('objectExplorer.propertyNameColumnHeader', "Property");
const OPERATOR_COLUMN_HEADER = localize('objectExplorer.operatorColumnHeader', "Operator");
const VALUE_COLUMN_HEADER = localize('objectExplorer.valueColumnHeader', "Value");

const TRUE_SELECT_BOX = localize('objectExplorer.trueSelectBox', "True");
const FALSE_SELECT_BOX = localize('objectExplorer.falseSelectBox', "False");

const PROPERTY_COLUMN_ID = 'property';
const OPERATOR_COLUMN_ID = 'operator';
const VALUE_COLUMN_ID = 'value';

export class ObjectExplorerServiceDialog extends Modal {

	private _okButton?: Button;
	private _cancelButton?: Button;
	private _clearAllButton?: Button;

	private filterTable: Table<Slick.SlickData>;
	private _tableCellEditorFactory: TableCellEditorFactory;
	private _onStyleChangeEventEmitter = new Emitter<void>();

	constructor(
		private _treeNode: TreeNode,
		private _tree: AsyncServerTree | ITree,
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
		@IDialogService private _dialogService: IDialogService
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
				hasTitleIcon: true
			}
		);

		this._treeNode.defaultFilters = [
			{
				name: 'Name',
				type: NodeInfoFilterPropertyType.string,
				operator: undefined,
				value: undefined
			},
			{
				name: 'Schema',
				type: NodeInfoFilterPropertyType.date,
				operator: undefined,
				value: undefined
			},
			{
				name: 'IsSystemObject',
				type: NodeInfoFilterPropertyType.boolean,
				operator: undefined,
				value: undefined
			}
		];

	}

	public open(): void {
		this.render();
		this.show();
		this._okButton.focus();
	}

	public override render() {
		super.render();
		this.title = FilterDialogTitle(this._treeNode.nodePath);
		this.titleIconClassName = TitleIconClass;
		this._register(attachModalDialogStyler(this, this._themeService));
		this._okButton = this.addFooterButton(OkButtonText, () => { this.onApply() });
		this._cancelButton = this.addFooterButton(CancelButtonText, () => { this.onClose() });
		this._clearAllButton = this.addFooterButton(ClearAllButtonText, () => { this.onClearAll() }, 'left', true);
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
		this._register(attachButtonStyler(this._clearAllButton, this._themeService));
	}

	protected renderBody(container: HTMLElement): void {
		const body = DOM.append(container, DOM.$('.filter-dialog-body'));
		const clauseTableContainer = DOM.append(body, DOM.$('.filter-table-container'));
		const filter = DOM.append(clauseTableContainer, DOM.$('.filter-table'));
		this._tableCellEditorFactory = new TableCellEditorFactory(
			{
				valueGetter: (item, column): string => {
					return item[column.field].value;
				},
				valueSetter: (context: any, row: number, item: any, column: Slick.Column<Slick.SlickData>, value: string): void => {
					item[column.field].value = value;
					if (column.field === 'operator') {
						const index = item.index;
						const nodeOperator = this._treeNode.defaultFilters[index].type;
						if (nodeOperator === NodeInfoFilterPropertyType.date || nodeOperator === NodeInfoFilterPropertyType.number) {
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
									index: -1
								};
								tableData.splice(row + 1, 0, newRow);
								dataProvider.clear();
								dataProvider.push(tableData);
								this.filterTable.rerenderGrid();
								this.filterTable.layout(new DOM.Dimension(600, (dataProvider.getItems().length + 2) * TableRowHeight));
							} else {
								const tableData = this.filterTable.getData().getItems();
								if (tableData.length > row + 1) {
									if (tableData[row + 1].operator.value === AND_SELECT_BOX) {
										tableData.splice(row + 1, 1);
										dataProvider.clear();
										dataProvider.push(tableData);
										this.filterTable.rerenderGrid();
										this.filterTable.layout(new DOM.Dimension(600, (dataProvider.getItems().length + 2) * TableRowHeight));
									}
								}
							}
						}
					}
				},
				optionsGetter: (item, column): string[] => {
					return item[column.field].values;
				},
				editorStyler: (component) => {
					this.styleComponent(component);
				},
				onStyleChange: this._onStyleChangeEventEmitter.event
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
			id: 'clear',
			iconCssClass: Codicon.close.classNames,
			name: localize('objectExplorer.clearColumn', "Clear"),
			title: localize('objectExplorer.clearColumn', "Clear"),
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

		this._treeNode.defaultFilters.forEach((f, i) => {
			const row: Slick.SlickData = {
				property: {
					value: f.name
				},
				operator: {
					value: this.getOperatorsForType(f.type)[0],
					values: this.getOperatorsForType(f.type)
				},
				value: {
					value: '',
					values: this.getValuesForType(f)
				},
				index: i
			};



			tableData.push(row);
		});

		const dataProvider = new TableDataView<Slick.SlickData>();
		dataProvider.push(tableData);

		(<any>dataProvider).getItemMetadata = (row: number) => {
			var metaData = { columns: { value: {} } };
			if (dataProvider.getItem(row).operator.value === 'And') {
				(<any>metaData.columns.value).editor = this._tableCellEditorFactory.getTextEditorClass(this, 'date');
				return metaData;
			}
			if (dataProvider.getItem(row).index) {
				row = dataProvider.getItem(row).index;
			}
			let editor;
			if (this._treeNode.defaultFilters[row].type === NodeInfoFilterPropertyType.string) {
				editor = this._tableCellEditorFactory.getTextEditorClass(this, 'text');
			} else if (this._treeNode.defaultFilters[row].type === NodeInfoFilterPropertyType.date) {
				editor = this._tableCellEditorFactory.getTextEditorClass(this, 'date');
			} else if (this._treeNode.defaultFilters[row].type === NodeInfoFilterPropertyType.boolean) {
				editor = this._tableCellEditorFactory.getDropdownEditorClass(this, ['true', 'false'], false);
			} else if (this._treeNode.defaultFilters[row].type === NodeInfoFilterPropertyType.number) {
				editor = this._tableCellEditorFactory.getTextEditorClass(this, 'number');
			} else if (this._treeNode.defaultFilters[row].type === NodeInfoFilterPropertyType.predefinedValues) {
				editor = this._tableCellEditorFactory.getDropdownEditorClass(this, this._treeNode.defaultFilters[row].options, false);
			}
			(<any>metaData.columns.value).editor = editor;
			return metaData;
		}

		this.filterTable = new Table(filter, this._accessibilityService, this._quickInputService, {
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

		this.filterTable.registerPlugin(clearValueColumn);


		this.filterTable.layout(new DOM.Dimension(600, (this._treeNode.defaultFilters.length + 2) * TableRowHeight));


	}

	protected layout(height?: number): void {
		// noop
	}

	protected override onClose() {
		this.hide('close');
	}

	protected onClearAll() {
		const tableAllData = this.filterTable.getData().getItems();
		tableAllData.forEach((row) => {
			row.value.value = '';

		});
		this.filterTable.rerenderGrid();
	}

	private getFiltersFromUI(): azdata.NodeInfoFilterProperty[] {
		return [
			{
				name: 'name',
				type: NodeInfoFilterPropertyType.string,
				operator: NodeInfoStringOperators.contains,
				value: 'test',
				options: []
			}
		];
	}

	// This method is called when the ok button is pressed
	private async onApply(): Promise<void> {
		this.hide('ok');
		this._treeNode.filters = this.getFiltersFromUI();
		if (this._tree instanceof AsyncServerTree) {
			await this._tree.rerender(this._treeNode);
			await this._tree.updateChildren(this._treeNode);
			await this._tree.expand(this._treeNode);
		} else {
			await this._tree.refresh(this._treeNode);
			await this._tree.expand(this._treeNode);
		}
	}

	// This method is called by modal when the enter button is pressed
	// We override it to do nothing so that the enter button doesn't close the dialog
	protected override async onAccept() {
		// noop
	}

	private getOperatorsForType(type: NodeInfoFilterPropertyType): string[] {
		switch (type) {
			case NodeInfoFilterPropertyType.string:
				return [
					CONTAINS_SELECT_BOX,
					NOT_CONTAINS_SELECT_BOX,
					EQUALS_SELECT_BOX,
					NOT_EQUALS_SELECT_BOX
				];
			case NodeInfoFilterPropertyType.number:
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
			case NodeInfoFilterPropertyType.boolean:
				return [
					EQUALS_SELECT_BOX,
					NOT_EQUALS_SELECT_BOX
				];
			case NodeInfoFilterPropertyType.predefinedValues:
				return [
					EQUALS_SELECT_BOX,
					NOT_EQUALS_SELECT_BOX
				];
			case NodeInfoFilterPropertyType.date:
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

	private getValuesForType(f: azdata.NodeInfoFilterProperty): string[] {
		switch (f.type) {
			case NodeInfoFilterPropertyType.boolean:
				return ['', TRUE_SELECT_BOX, FALSE_SELECT_BOX];
			case NodeInfoFilterPropertyType.predefinedValues:
				return ['', ...f.options];
			default:
				return [];
		}
	}

	private styleComponent(component: TabbedPanel | InputBox | Checkbox | Table<Slick.SlickData> | SelectBox | Button | Dropdown): void {
		if (component instanceof InputBox) {
			this._register(attachInputBoxStyler(component, this._themeService));
		} else if (component instanceof SelectBox) {
			this._register(attachSelectBoxStyler(component, this._themeService));
		} else if (component instanceof Table) {
			this._register(attachTableStyler(component, this._themeService));
		}
	}
}
