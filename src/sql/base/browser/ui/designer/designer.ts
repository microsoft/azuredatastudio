/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerComponentInput, DesignerComponentType, DesignerEditType, DesignerTab, InputComponentDefinition, InputComponentData, TableComponentDefinition, TableComponentData, DesignerEdit, TableComponentRowData, CheckboxComponentData, DropdownComponentDefinition, DesignerEditIdentifier, DesignerData, CheckboxComponentDefinition, DropdownComponentData } from 'sql/base/browser/ui/designer/interfaces';
import { IPanelTab, ITabbedPanelStyles, TabbedPanel } from 'sql/base/browser/ui/panel/panel';
import * as DOM from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';
import { Orientation, Sizing, SplitView } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInputBoxStyles, InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import 'vs/css!./media/designer';
import { ITableStyles } from 'sql/base/browser/ui/table/interfaces';
import { IThemable } from 'vs/base/common/styler';
import { Checkbox, ICheckboxStyles } from 'sql/base/browser/ui/checkbox/checkbox';
import { Table } from 'sql/base/browser/ui/table/table';
import { ISelectBoxStyles, SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { localize } from 'vs/nls';
import { TableCellEditorFactory } from 'sql/base/browser/ui/table/tableCellEditorFactory';
import { CheckBoxColumn } from 'sql/base/browser/ui/table/plugins/checkboxColumn.plugin';
import { DesignerTabPanelView } from 'sql/base/browser/ui/designer/designerTabPanelView';
import { DesignerPropertiesPane, PropertiesPaneObjectContext } from 'sql/base/browser/ui/designer/designerPropertiesPane';

export interface IDesignerStyle {
	tabbedPanelStyles?: ITabbedPanelStyles;
	inputBoxStyles?: IInputBoxStyles;
	tableStyles?: ITableStyles;
	selectBoxStyles?: ISelectBoxStyles;
	checkboxStyles?: ICheckboxStyles;
}

export type DesignerUIComponent = InputBox | Checkbox | Table<Slick.SlickData> | SelectBox;

export type CreateComponentFunc = (container: HTMLElement, component: DesignerComponentType, editIdentifier: DesignerEditIdentifier, labelOnTop: boolean) => DesignerUIComponent;
export type SetComponentValueFunc = (definition: DesignerComponentType, component: DesignerUIComponent, data: DesignerData) => void;

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
	private _propertiesPaneContainer: HTMLElement;
	private _styles: IDesignerStyle = {};
	private _supressEditProcessing: boolean = false;
	private _componentMap = new Map<string, { defintion: DesignerComponentType, component: DesignerUIComponent }>();
	private _input: DesignerComponentInput;
	private _tableCellEditorFactory: TableCellEditorFactory;
	private _propertiesPane: DesignerPropertiesPane;

	constructor(private readonly _container: HTMLElement,
		private readonly _contextViewProvider: IContextViewProvider) {
		super();
		this._tableCellEditorFactory = new TableCellEditorFactory(
			{
				valueGetter: (item, column): string => {
					return item[column.field].value;
				},
				valueSetter: async (context: string, row: number, item: TableComponentRowData, column: Slick.Column<Slick.SlickData>, value: string): Promise<void> => {
					await this.handleEdit({
						type: DesignerEditType.Update,
						property: {
							parentProperty: context,
							index: row,
							property: column.field
						},
						value: value
					});
				},
				optionsGetter: (item, column): string[] => {
					return item[column.field].options;
				},
				editorStyler: (component) => {
					this.styleComponent(component);
				}
			}, this._contextViewProvider
		);
		this._verticalSplitViewContainer = DOM.$('.designer-component');
		this._horizontalSplitViewContainer = DOM.$('.container');
		this._contentContainer = DOM.$('.content-container');
		this._topContentContainer = DOM.$('.top-content-container.components-grid');
		this._tabbedPanelContainer = DOM.$('.tabbed-panel-container');
		this._editorContainer = DOM.$('.editor-container');
		this._propertiesPaneContainer = DOM.$('.properties-container');
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
			minimumSize: 200,
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
			minimumSize: 200,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._horizontalSplitView.addView({
			element: this._propertiesPaneContainer,
			layout: size => { },
			minimumSize: 200,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._propertiesPane = new DesignerPropertiesPane(this._propertiesPaneContainer, (container, component, identifier, labelOnTop) => {
			return this.createComponent(container, component, identifier, labelOnTop, false, false);
		}, (definition, component, data) => {
			this.setComponentValue(definition, component, data);
		}, (component) => {
			this.styleComponent(component);
		});
		const editor = DOM.$('div');
		editor.innerText = 'script pane placeholder';
		this._editorContainer.appendChild(editor);
	}

	private styleComponent(component: TabbedPanel | InputBox | Checkbox | Table<Slick.SlickData> | SelectBox): void {
		if (component instanceof InputBox) {
			component.style(this._styles.inputBoxStyles);
		} else if (component instanceof Checkbox) {
			component.style(this._styles.checkboxStyles);
		} else if (component instanceof TabbedPanel) {
			component.style(this._styles.tabbedPanelStyles);
		} else if (component instanceof Table) {
			component.style(this._styles.tableStyles);
		} else {
			component.style(this._styles.selectBoxStyles);
		}
	}
	public style(styles: IDesignerStyle): void {
		this._styles = styles;
		this._componentMap.forEach((value, key, map) => {
			if (value.component.style) {
				this.styleComponent(value.component);
			}
		});
		this._propertiesPane.style();
		this._verticalSplitView.style({
			separatorBorder: styles.selectBoxStyles.selectBorder
		});

		this._horizontalSplitView.style({
			separatorBorder: styles.selectBoxStyles.selectBorder
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
		this._propertiesPane.clear();
		DOM.clearNode(this._topContentContainer);
		const view = await this._input.getView();
		if (view.components) {
			view.components.forEach(component => {
				this.createComponent(this._topContentContainer, component, component.property, false, true, true);
			});
		}
		this._tabbedPanel.clearTabs();
		view.tabs.forEach(tab => {
			this._tabbedPanel.pushTab(this.createTabView(tab));
		});
		this.layoutTabbedPanel();
		this.updateComponentValues();
	}

	private layoutTabbedPanel() {
		this._tabbedPanel.layout(new DOM.Dimension(this._tabbedPanelContainer.clientWidth, this._tabbedPanelContainer.clientHeight));
	}

	private async updateComponentValues(): Promise<void> {
		const data = await this._input.getData();
		// data[ScriptPropertyName] -- todo- set the script editor
		this._componentMap.forEach((value) => {
			this.setComponentValue(value.defintion, value.component, data);
		});

		let type: string;
		let components: DesignerComponentType[];
		let inputData: DesignerData;
		let context: PropertiesPaneObjectContext;
		const currentContext = this._propertiesPane.context;
		if (currentContext === 'root' || currentContext === undefined) {
			context = 'root';
			components = [];
			this._componentMap.forEach(value => {
				components.push(value.defintion);
			});
			type = this._input.objectType;
			inputData = data;
		} else {
			context = currentContext;
			const tableData = data[currentContext.parentProperty] as TableComponentData;
			const tableDefinition = this._componentMap.get(currentContext.parentProperty).defintion as TableComponentDefinition;
			inputData = tableData.rows[currentContext.index] as DesignerData;
			components = tableDefinition.itemProperties;
			type = tableDefinition.objectType;
		}
		this._propertiesPane.show({
			context: context,
			type: type,
			components: components,
			data: inputData
		});
	}

	private async handleEdit(edit: DesignerEdit): Promise<void> {
		if (this._supressEditProcessing) {
			return;
		}
		await this.applyEdit(edit);
		const result = await this._input.processEdit(edit);
		if (result.isValid) {
			this._supressEditProcessing = true;
			await this.updateComponentValues();
			this._supressEditProcessing = false;
		} else {
			//TODO: add error notification
		}
	}

	private async applyEdit(edit: DesignerEdit): Promise<void> {
		const data = await this._input.getData();
		switch (edit.type) {
			case DesignerEditType.Update:
				if (typeof edit.property === 'string') {
					const propertyValue = data[edit.property] as InputComponentData | DropdownComponentData | CheckboxComponentData;
					propertyValue.value = edit.value;
				} else {
					const parentPropertyValue = data[edit.property.parentProperty] as TableComponentData;
					const propertyValue = parentPropertyValue.rows[edit.property.index][edit.property.property] as InputComponentData | DropdownComponentData | CheckboxComponentData;
					propertyValue.value = edit.value;
				}
				break;
			default:
				break;
		}
	}

	private createTabView(tab: DesignerTab): IPanelTab {
		const view = new DesignerTabPanelView(tab, (container, component, identifier, labelOnTop) => {
			return this.createComponent(container, component, identifier, labelOnTop, true, false);
		});
		return {
			identifier: tab.title,
			title: tab.title,
			view: view
		};
	}

	private setComponentValue(definition: DesignerComponentType, component: DesignerUIComponent, data: DesignerData): void {
		this._supressEditProcessing = true;
		switch (definition.type) {
			case 'input':
				const input = component as InputBox;
				const inputData = data[definition.property] as InputComponentData;
				input.setEnabled(inputData.enabled ?? true);
				input.value = inputData.value?.toString() ?? '';
				break;
			case 'table':
				const table = component as Table<Slick.SlickData>;
				const tableDataView = table.getData() as TableDataView<Slick.SlickData>;
				tableDataView.clear();
				tableDataView.push((data[definition.property] as TableComponentData).rows);
				table.rerenderGrid();
				break;
			case 'checkbox':
				const checkbox = component as Checkbox;
				const checkboxData = data[definition.property] as CheckboxComponentData;
				if (checkboxData.enabled === false) {
					checkbox.disable();
				} else {
					checkbox.enable();
				}
				checkbox.checked = checkboxData.value;
				break;
			case 'dropdown':
				const dropdown = component as SelectBox;
				const dropdownDefinition = definition as DropdownComponentDefinition;
				const dropdownData = data[definition.property] as DropdownComponentData;
				if (dropdownData.enabled === false) {
					dropdown.disable();
				} else {
					dropdown.enable();
				}
				const options = dropdownData.options || dropdownDefinition.options || [];
				dropdown.setOptions(options);
				const idx = options?.indexOf(dropdownData.value);
				if (idx > -1) {
					dropdown.select(idx);
				}
				break;
			default:
				break;
		}
		this._supressEditProcessing = false;
	}

	private createComponent(container: HTMLElement, componentDefinition: DesignerComponentType, editIdentifier: DesignerEditIdentifier, labelOnTop: boolean, addToComponentMap: boolean, setWidth: boolean): DesignerUIComponent {
		const componentContainerClass = labelOnTop || componentDefinition.type === 'table' ? '.full-row' : '';
		const labelContainer = container.appendChild(DOM.$(componentContainerClass));
		labelContainer.appendChild(DOM.$('span.component-label')).innerText = componentDefinition.type === 'checkbox' || componentDefinition.title === undefined ? '' : componentDefinition.title;
		const componentDiv = container.appendChild(DOM.$(componentContainerClass));
		let component: DesignerUIComponent;
		switch (componentDefinition.type) {
			case 'input':
				const inputDefinition = componentDefinition as InputComponentDefinition;
				const input = new InputBox(componentDiv, this._contextViewProvider, {
					ariaLabel: componentDefinition.ariaLabel ?? componentDefinition.title,
					type: inputDefinition.inputType,
				});
				input.onDidChange((newValue) => {
					this.handleEdit({ type: DesignerEditType.Update, property: editIdentifier, value: newValue });
				});
				if (setWidth && componentDefinition.width !== undefined) {
					input.width = componentDefinition.width;
				}
				component = input;
				break;
			case 'dropdown':
				const dropdownDefinition = componentDefinition as DropdownComponentDefinition;
				const dropdown = new SelectBox(dropdownDefinition.options, undefined, this._contextViewProvider, undefined);
				dropdown.render(componentDiv);
				dropdown.selectElem.style.height = '25px';
				dropdown.onDidSelect((e) => {
					this.handleEdit({ type: DesignerEditType.Update, property: editIdentifier, value: e.selected });
				});
				component = dropdown;
				break;
			case 'checkbox':
				const checkboxDefinition = componentDefinition as CheckboxComponentDefinition;
				const checkbox = new Checkbox(componentDiv, {
					label: checkboxDefinition.title
				});
				checkbox.onChange(newValue => {
					this.handleEdit({ type: DesignerEditType.Update, property: editIdentifier, value: newValue });
				});
				component = checkbox;
				break;
			case 'table':
				const tableDefinition = componentDefinition as TableComponentDefinition;
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
									type: DesignerEditType.Update,
									property: {
										parentProperty: tableDefinition.property,
										index: e.row,
										property: propertyDefinition.property
									},
									value: e.value
								});
							});
							return checkboxColumn.definition;
						case 'dropdown':
							const dropdownDefinition = propertyDefinition as DropdownComponentDefinition;
							return {
								name: propertyDefinition.title,
								field: propertyDefinition.property,
								editor: this._tableCellEditorFactory.getSelectBoxEditorClass(componentDefinition.property, dropdownDefinition.options),
								width: propertyDefinition.width
							};
						default:
							const inputDefinition = propertyDefinition as InputComponentDefinition;
							return {
								name: propertyDefinition.title,
								field: propertyDefinition.property,
								editor: this._tableCellEditorFactory.getTextEditorClass(componentDefinition.property, inputDefinition.inputType),
								width: propertyDefinition.width
							};
					}
				});
				table.layout(new DOM.Dimension(container.clientWidth, container.clientHeight));
				table.grid.onBeforeEditCell.subscribe((e, data): boolean => {
					return data.item[data.column.field].enabled !== false;
				});
				table.grid.onActiveCellChanged.subscribe((e, data) => {
					this._propertiesPane.show({
						context: {
							parentProperty: tableDefinition.property,
							index: data.row
						},
						type: tableDefinition.objectType,
						components: tableDefinition.itemProperties,
						data: table.getData().getItem(data.row)
					});
				});
				component = table;
				break;
			default:
				throw new Error(localize('tableDesigner.unknownComponentType', "The component type: {0} is not supported", componentDefinition.type));
		}
		if (addToComponentMap) {
			this._componentMap.set(componentDefinition.property, {
				defintion: componentDefinition,
				component: component
			});
		}
		this.styleComponent(component);
		return component;
	}
}
