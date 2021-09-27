/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerComponentInput, DesignerComponentType, DesignerEditTypes, DesignerTab, InputComponentInfo, InputComponentData, TableComponentInfo, TableComponentData, DesignerEdit, TableComponentRowData, CheckboxComponentData } from 'sql/base/browser/ui/designer/interfaces';
import { IPanelTab, ITabbedPanelStyles, TabbedPanel } from 'sql/base/browser/ui/panel/panel';
import * as DOM from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';
import { Orientation, Sizing, SplitView } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInputBoxStyles, InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import 'vs/css!./media/designer';
import { ITableStyles } from 'sql/base/browser/ui/table/interfaces';
import { IDropdownStyles } from 'sql/base/browser/ui/dropdownList/dropdownList';
import { IThemable } from 'vs/base/common/styler';
import { Checkbox, ICheckboxStyles } from 'sql/base/browser/ui/checkbox/checkbox';
import { Table } from 'sql/base/browser/ui/table/table';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { localize } from 'vs/nls';
import { TableCellEditor } from 'sql/base/browser/ui/table/tableCellEditor';
import { CheckBoxColumn } from 'sql/base/browser/ui/table/plugins/checkboxColumn.plugin';
import { DesignerTabPanelView } from 'sql/base/browser/ui/designer/designerTabPanelView';

export interface IDesignerStyle extends ITabbedPanelStyles, IInputBoxStyles, ITableStyles, IDropdownStyles, ICheckboxStyles {
}

export type DesignerUIComponents = InputBox | Checkbox | Table<Slick.SlickData> | SelectBox;

export class Designer extends Disposable implements IThemable {

	private _horizontalSplitViewContainer: HTMLElement;
	private _verticalSplitViewContainer: HTMLElement;
	private _tabbedPanelContainer: HTMLElement;
	private _editorContainer: HTMLElement;
	private _horizontalSplitView: SplitView;
	private _verticalSplitView: SplitView;
	private _tabbedPanel: TabbedPanel;
	private _contentContainer: HTMLElement;
	private _topContentContainer: HTMLElement;
	private _propertiesPane: HTMLElement;
	private _styles: IDesignerStyle = {};
	private _supressEditProcessing: boolean = false;
	private _componentMap = new Map<string, { defintion: DesignerComponentType, component: DesignerUIComponents }>();
	private _input: DesignerComponentInput;
	private _tableCellEditor: TableCellEditor;

	constructor(private readonly _container: HTMLElement,
		private readonly _contextViewProvider: IContextViewProvider) {
		super();
		this._tableCellEditor = new TableCellEditor(
			{
				valueGetter: (item, column): string => {
					return item[column.field].value;
				},
				valueSetter: async (context: string, row: number, item: TableComponentRowData, column: Slick.Column<Slick.SlickData>, value: string): Promise<void> => {

					await this.handleEdit({
						type: DesignerEditTypes.Update,
						property: {
							parent: context,
							row: row,
							property: column.field
						},
						value: value
					});
				},
				editorStyler: (component) => {
					component.style(this._styles);
				}
			}, this._contextViewProvider
		);
		this._verticalSplitViewContainer = DOM.$('.designer-component');
		this._horizontalSplitViewContainer = DOM.$('.container');
		this._contentContainer = DOM.$('.content-container');
		this._topContentContainer = DOM.$('.top-content-container.components-grid');
		this._tabbedPanelContainer = DOM.$('.tabbed-panel-container');
		this._editorContainer = DOM.$('.editor-container');
		this._propertiesPane = DOM.$('.properties-container.components-grid');
		this._verticalSplitView = new SplitView(this._verticalSplitViewContainer, { orientation: Orientation.VERTICAL });
		this._horizontalSplitView = new SplitView(this._horizontalSplitViewContainer, { orientation: Orientation.HORIZONTAL });
		this._tabbedPanel = new TabbedPanel(this._tabbedPanelContainer);
		this._container.appendChild(this._verticalSplitViewContainer);
		this._contentContainer.appendChild(this._topContentContainer);
		this._contentContainer.appendChild(this._tabbedPanelContainer);
		this._verticalSplitView.addView({
			element: this._horizontalSplitViewContainer,
			layout: size => {
				this.layoutTabbedPanel();
			},
			minimumSize: 100,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._verticalSplitView.addView({
			element: this._editorContainer,
			layout: size => { },
			minimumSize: 100,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._horizontalSplitView.addView({
			element: this._contentContainer,
			layout: size => {
				this.layoutTabbedPanel();
			},
			minimumSize: 100,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._horizontalSplitView.addView({
			element: this._propertiesPane,
			layout: size => { },
			minimumSize: 100,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		const editor = DOM.$('div');
		editor.innerText = 'script pane placeholder';
		const properties = DOM.$('div');
		properties.innerText = 'properties pane placeholder';
		this._editorContainer.appendChild(editor);
		this._propertiesPane.appendChild(properties);
	}

	public style(styles: IDesignerStyle): void {
		this._styles = styles;
		this._componentMap.forEach((value, key, map) => {
			if (value.component.style) {
				value.component.style(styles);
			}
		});
		this._verticalSplitView.style({
			separatorBorder: styles.borderColor
		});

		this._horizontalSplitView.style({
			separatorBorder: styles.borderColor
		});
	}

	public layout(dimension: DOM.Dimension) {
		this._verticalSplitView.layout(dimension.height);
		this._horizontalSplitView.layout(dimension.width);
	}


	public async setInput(input: DesignerComponentInput): Promise<void> {
		this._input = input;
		await this.initializeDesignerView();
	}

	private async initializeDesignerView(): Promise<void> {
		DOM.clearNode(this._topContentContainer);
		const view = await this._input.getView();
		if (view.components) {
			view.components.forEach(component => {
				this.createComponent(this._topContentContainer, component);
			});
		}
		this._tabbedPanel.clearTabs();
		view.tabs.forEach(tab => {
			this._tabbedPanel.pushTab(this.createTabView(tab));
		});
		this.layoutTabbedPanel();
		this.setComponentValues();
	}

	private layoutTabbedPanel() {
		this._tabbedPanel.layout(new DOM.Dimension(this._tabbedPanelContainer.clientWidth, this._tabbedPanelContainer.clientHeight));
	}

	private async setComponentValues(): Promise<void> {
		this._supressEditProcessing = true;
		const data = await this._input.getData();
		// data[ScriptPropertyName] -- todo- set the script editor
		this._componentMap.forEach((value, key) => {
			switch (value.defintion.type) {
				case 'input':
					const input = value.component as InputBox;
					const inputData = data[key] as InputComponentData;
					input.setEnabled(inputData.enabled ?? true);
					input.value = inputData.value?.toString() ?? '';
					break;
				case 'table':
					const table = value.component as Table<Slick.SlickData>;
					const tableDataView = table.getData() as TableDataView<Slick.SlickData>;
					tableDataView.clear();
					tableDataView.push((data[key] as TableComponentData).rows);
					table.rerenderGrid();
					break;
			}
		});
		this._supressEditProcessing = false;
	}

	private async handleEdit(edit: DesignerEdit): Promise<void> {
		if (this._supressEditProcessing) {
			return;
		}

		const result = await this._input.processEdit(edit);

		if (result.isValid) {
			this._supressEditProcessing = true;
			await this.setComponentValues();
			this._supressEditProcessing = false;
		} else {
			//TODO: add error notification
		}
	}

	private createTabView(tab: DesignerTab): IPanelTab {
		const view = new DesignerTabPanelView(tab, (container, component) => {
			return this.createComponent(container, component);
		});
		return {
			identifier: tab.title,
			title: tab.title,
			view: view
		};
	}

	private createComponent(container: HTMLElement, component: DesignerComponentType, labelOnTop?: boolean): DesignerUIComponents {
		const componentContainerClass = labelOnTop || component.type === 'table' ? '.full-row' : '';
		const labelContainer = container.appendChild(DOM.$(componentContainerClass));
		labelContainer.appendChild(DOM.$('span.component-label')).innerText = component.title ?? '';
		const componentDiv = container.appendChild(DOM.$(componentContainerClass));
		switch (component.type) {
			case 'input':
				const inputDefinition = component as InputComponentInfo;
				const input = new InputBox(componentDiv, this._contextViewProvider, {
					ariaLabel: component.ariaLabel ?? component.title,
					type: inputDefinition.inputType,
				});
				this._componentMap.set(component.property, {
					defintion: inputDefinition,
					component: input
				});
				input.onDidChange((newValue) => {
					this.handleEdit({ type: DesignerEditTypes.Update, property: component.property, value: newValue });
				});
				input.style(this._styles);
				if (component.width !== undefined) {
					input.width = component.width;
				}
				return input;
			case 'table':
				const tableDefinition = component as TableComponentInfo;
				const table = new Table(componentDiv, {
					dataProvider: new TableDataView()
				}, {
					editable: true,
					autoEdit: true,
					dataItemColumnValueExtractor: (data: any, column: Slick.Column<Slick.SlickData>): string => {
						return data[column.field].value;
					}
				}
				);
				table.columns = tableDefinition.columns.map(propName => {
					const propertyDefinition = tableDefinition.itemProperties.find(item => item.property === propName);
					switch (propertyDefinition.type) {
						case 'checkbox':
							const checkboxColumn = new CheckBoxColumn({
								field: propertyDefinition.property,
								name: propertyDefinition.title,
								cellValueExtractor: (value: CheckboxComponentData) => { return value.value; },
								width: propertyDefinition.width
							});
							table.registerPlugin(checkboxColumn);
							checkboxColumn.onChange(async (e) => {
								await this.handleEdit({
									type: DesignerEditTypes.Update,
									property: {
										parent: tableDefinition.property,
										row: e.row,
										property: propertyDefinition.property
									},
									value: e.value
								});
							});
							return checkboxColumn.definition;
						default:
							const inputDefinition = propertyDefinition as InputComponentInfo;
							return {
								name: propertyDefinition.title,
								field: propertyDefinition.property,
								editor: this._tableCellEditor.getTextEditorClass(component.property, inputDefinition.inputType),
								width: propertyDefinition.width
							};
					}
				});
				table.style(this._styles);
				table.layout(new DOM.Dimension(container.clientWidth, container.clientHeight));
				table.grid.onBeforeEditCell.subscribe((e, data): boolean => {
					let enabled = data.item[data.column.field].enabled;
					return enabled !== false;
				});
				this._componentMap.set(component.property, { defintion: tableDefinition, component: table });
				return table;
			default:
				throw new Error(localize('tableDesigner.unknownComponentType', "The component type: {0} is not supported", component.type));
		}
	}
}
