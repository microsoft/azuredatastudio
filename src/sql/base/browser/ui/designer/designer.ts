/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerComponentInput, DesignerEditType, DesignerTab, DesignerEdit, DesignerEditIdentifier, DesignerViewModel, DesignerDataPropertyInfo, DesignerTableComponentRowData, DesignerTableProperties, InputBoxProperties, DropDownProperties, CheckBoxProperties, DesignerComponentTypeName } from 'sql/base/browser/ui/designer/interfaces';
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
import { Button, IButtonStyles } from 'sql/base/browser/ui/button/button';
import { ButtonColumn } from 'sql/base/browser/ui/table/plugins/buttonColumn.plugin';
import { Codicon } from 'vs/base/common/codicons';
import { Color } from 'vs/base/common/color';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';

export interface IDesignerStyle {
	tabbedPanelStyles?: ITabbedPanelStyles;
	inputBoxStyles?: IInputBoxStyles;
	tableStyles?: ITableStyles;
	selectBoxStyles?: ISelectBoxStyles;
	checkboxStyles?: ICheckboxStyles;
	buttonStyles?: IButtonStyles;
	paneSeparator?: Color;
}

export type DesignerUIComponent = InputBox | Checkbox | Table<Slick.SlickData> | SelectBox;

export type CreateComponentFunc = (container: HTMLElement, component: DesignerDataPropertyInfo, editIdentifier: DesignerEditIdentifier) => DesignerUIComponent;
export type SetComponentValueFunc = (definition: DesignerDataPropertyInfo, component: DesignerUIComponent, data: DesignerViewModel) => void;

export class Designer extends Disposable implements IThemable {
	private _loadingSpinner: LoadingSpinner;
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
	private _componentMap = new Map<string, { defintion: DesignerDataPropertyInfo, component: DesignerUIComponent }>();
	private _input: DesignerComponentInput;
	private _tableCellEditorFactory: TableCellEditorFactory;
	private _propertiesPane: DesignerPropertiesPane;
	private _buttons: Button[] = [];

	constructor(private readonly _container: HTMLElement,
		private readonly _contextViewProvider: IContextViewProvider) {
		super();
		this._tableCellEditorFactory = new TableCellEditorFactory(
			{
				valueGetter: (item, column): string => {
					return item[column.field].value;
				},
				valueSetter: async (context: string, row: number, item: DesignerTableComponentRowData, column: Slick.Column<Slick.SlickData>, value: string): Promise<void> => {
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
		this._loadingSpinner = new LoadingSpinner(this._container, { showText: true, fullSize: true });
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

		this._propertiesPane = new DesignerPropertiesPane(this._propertiesPaneContainer, (container, component, identifier) => {
			return this.createComponent(container, component, identifier, false, false);
		}, (definition, component, viewModel) => {
			this.setComponentValue(definition, component, viewModel);
		}, (component) => {
			this.styleComponent(component);
		});
		const editor = DOM.$('div');
		editor.innerText = 'script pane placeholder';
		this._editorContainer.appendChild(editor);
	}

	private styleComponent(component: TabbedPanel | InputBox | Checkbox | Table<Slick.SlickData> | SelectBox | Button): void {
		if (component instanceof InputBox) {
			component.style(this._styles.inputBoxStyles);
		} else if (component instanceof Checkbox) {
			component.style(this._styles.checkboxStyles);
		} else if (component instanceof TabbedPanel) {
			component.style(this._styles.tabbedPanelStyles);
		} else if (component instanceof Table) {
			component.style(this._styles.tableStyles);
		} else if (component instanceof Button) {
			component.style(this._styles.buttonStyles);
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
			separatorBorder: styles.paneSeparator
		});

		this._horizontalSplitView.style({
			separatorBorder: styles.paneSeparator
		});

		this._buttons.forEach((button) => {
			this.styleComponent(button);
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
		// For initialization, we would want to show the loading indicator immediately.
		const handle = this.startLoading(localize('designer.loadingDesigner', "Loading designer..."), 0);
		const view = await this._input.getView();
		this.stopLoading(handle, localize('designer.loadingDesignerCompleted', "Loading designer completed"));
		if (view.components) {
			view.components.forEach(component => {
				this.createComponent(this._topContentContainer, component, component.propertyName, true, true);
			});
		}
		this._tabbedPanel.clearTabs();
		view.tabs.forEach(tab => {
			this._tabbedPanel.pushTab(this.createTabView(tab));
		});
		this.layoutTabbedPanel();
		await this.updateComponentValues();
	}

	private layoutTabbedPanel() {
		this._tabbedPanel.layout(new DOM.Dimension(this._tabbedPanelContainer.clientWidth, this._tabbedPanelContainer.clientHeight));
	}

	private async updatePropertiesPane(newContext: PropertiesPaneObjectContext): Promise<void> {
		const viewModel = await this._input.getViewModel();
		let type: string;
		let components: DesignerDataPropertyInfo[];
		let inputViewModel: DesignerViewModel;
		let context: PropertiesPaneObjectContext;
		if (newContext !== 'root') {
			context = newContext;
			const tableData = viewModel[newContext.parentProperty] as DesignerTableProperties;
			const tableProperties = this._componentMap.get(newContext.parentProperty).defintion.componentProperties as DesignerTableProperties;
			inputViewModel = tableData.data[newContext.index] as DesignerViewModel;
			components = tableProperties.itemProperties;
			type = tableProperties.objectTypeDisplayName;
		}

		if (!inputViewModel) {
			context = 'root';
			components = [];
			this._componentMap.forEach(value => {
				components.push(value.defintion);
			});
			type = this._input.objectTypeDisplayName;
			inputViewModel = viewModel;
		}

		if (inputViewModel) {
			this._propertiesPane.show({
				context: context,
				type: type,
				components: components,
				viewModel: inputViewModel
			});
		}
	}

	private async updateComponentValues(): Promise<void> {
		const viewModel = await this._input.getViewModel();
		// data[ScriptPropertyName] -- todo- set the script editor
		this._componentMap.forEach((value) => {
			this.setComponentValue(value.defintion, value.component, viewModel);
		});
		await this.updatePropertiesPane(this._propertiesPane.context ?? 'root');
	}

	private async handleEdit(edit: DesignerEdit): Promise<void> {
		if (this._supressEditProcessing) {
			return;
		}
		await this.applyEdit(edit);
		const handle = this.startLoading(localize('designer.processingChanges', "Processing changes..."));
		const result = await this._input.processEdit(edit);
		this.stopLoading(handle, localize('designer.processingChangesCompleted', "Processing changes completed"));
		if (result.isValid) {
			this._supressEditProcessing = true;
			await this.updateComponentValues();
			if (edit.type === DesignerEditType.Add) {
				// Move focus to the first cell of the newly added row.
				const data = await this._input.getViewModel();
				const propertyName = edit.property as string;
				const tableData = data[propertyName] as DesignerTableProperties;
				const table = this._componentMap.get(propertyName).component as Table<Slick.SlickData>;
				table.setActiveCell(tableData.data.length - 1, 0);
			}
			this._supressEditProcessing = false;
		} else {
			//TODO: add error notification
		}
	}

	private async applyEdit(edit: DesignerEdit): Promise<void> {
		const viewModel = await this._input.getViewModel();
		switch (edit.type) {
			case DesignerEditType.Update:
				if (typeof edit.property === 'string') {
					// if the type of the property is string then the property is a top level property
					if (!viewModel[edit.property]) {
						viewModel[edit.property] = {};
					}
					const componentData = viewModel[edit.property];
					const componentType = this._componentMap.get(edit.property).defintion.componentType;
					this.setComponentData(componentType, componentData, edit.value);
				} else {
					const columnPropertyName = edit.property.property;
					const tableInfo = this._componentMap.get(edit.property.parentProperty).defintion.componentProperties as DesignerTableProperties;
					const tableProperties = viewModel[edit.property.parentProperty] as DesignerTableProperties;
					if (!tableProperties.data[edit.property.index][columnPropertyName]) {
						tableProperties.data[edit.property.index][columnPropertyName] = {};
					}
					const componentData = tableProperties.data[edit.property.index][columnPropertyName];
					const itemProperty = tableInfo.itemProperties.find(property => property.propertyName === columnPropertyName);
					if (itemProperty) {
						this.setComponentData(itemProperty.componentType, componentData, edit.value);
					}
				}
				break;
			default:
				break;
		}
	}

	private setComponentData(componentType: DesignerComponentTypeName, componentData: any, value: any): void {
		switch (componentType) {
			case 'checkbox':
				(<CheckBoxProperties>componentData).checked = value;
				break;
			case 'dropdown':
				(<DropDownProperties>componentData).value = value;
				break;
			case 'input':
				(<InputBoxProperties>componentData).value = value;
				break;
		}
	}

	private createTabView(tab: DesignerTab): IPanelTab {
		const view = new DesignerTabPanelView(tab, (container, component, identifier) => {
			return this.createComponent(container, component, identifier, true, false);
		});
		return {
			identifier: tab.title,
			title: tab.title,
			view: view
		};
	}

	private setComponentValue(definition: DesignerDataPropertyInfo, component: DesignerUIComponent, viewModel: DesignerViewModel): void {
		// Skip the property if it is not in the data model
		if (!viewModel[definition.propertyName]) {
			return;
		}
		this._supressEditProcessing = true;
		switch (definition.componentType) {
			case 'input':
				const input = component as InputBox;
				const inputData = viewModel[definition.propertyName] as InputBoxProperties;
				input.setEnabled(inputData.enabled ?? true);
				input.value = inputData.value?.toString() ?? '';
				break;
			case 'table':
				const table = component as Table<Slick.SlickData>;
				const tableDataView = table.getData() as TableDataView<Slick.SlickData>;
				const newData = (viewModel[definition.propertyName] as DesignerTableProperties).data;
				let activeCell: Slick.Cell;
				if (table.container.contains(document.activeElement)) {
					// Note down the current active cell if the focus is currently in the table
					// After the table is refreshed, the focus will be restored.
					activeCell = Object.assign({}, table.activeCell);
				}
				tableDataView.clear();
				tableDataView.push(newData);
				table.rerenderGrid();
				if (activeCell && newData.length > activeCell.row) {
					table.setActiveCell(activeCell.row, activeCell.cell);
				}
				break;
			case 'checkbox':
				const checkbox = component as Checkbox;
				const checkboxData = viewModel[definition.propertyName] as CheckBoxProperties;
				if (checkboxData.enabled === false) {
					checkbox.disable();
				} else {
					checkbox.enable();
				}
				checkbox.checked = checkboxData.checked;
				break;
			case 'dropdown':
				const dropdown = component as SelectBox;
				const defaultDropdownData = definition.componentProperties as DropDownProperties;
				const dropdownData = viewModel[definition.propertyName] as DropDownProperties;
				if (dropdownData.enabled === false) {
					dropdown.disable();
				} else {
					dropdown.enable();
				}
				const options = (dropdownData.values || defaultDropdownData.values || []) as string[];
				dropdown.setOptions(options);
				const idx = options?.indexOf(dropdownData.value as string);
				if (idx > -1) {
					dropdown.select(idx);
				}
				break;
			default:
				break;
		}
		this._supressEditProcessing = false;
	}

	private createComponent(container: HTMLElement, componentDefinition: DesignerDataPropertyInfo, editIdentifier: DesignerEditIdentifier, addToComponentMap: boolean, setWidth: boolean): DesignerUIComponent {
		let component: DesignerUIComponent;
		switch (componentDefinition.componentType) {
			case 'input':
				container.appendChild(DOM.$('')).appendChild(DOM.$('span.component-label')).innerText = componentDefinition.componentProperties?.title ?? '';
				const inputContainer = container.appendChild(DOM.$(''));
				const inputProperties = componentDefinition.componentProperties as InputBoxProperties;
				const input = new InputBox(inputContainer, this._contextViewProvider, {
					ariaLabel: inputProperties.title,
					type: inputProperties.inputType,
				});
				input.onLoseFocus(async (args) => {
					if (args.hasChanged) {
						await this.handleEdit({ type: DesignerEditType.Update, property: editIdentifier, value: args.value });
					}
				});
				if (setWidth && inputProperties.width !== undefined) {
					input.width = inputProperties.width as number;
				}
				component = input;
				break;
			case 'dropdown':
				container.appendChild(DOM.$('')).appendChild(DOM.$('span.component-label')).innerText = componentDefinition.componentProperties?.title ?? '';
				const dropdownContainer = container.appendChild(DOM.$(''));
				const dropdownProperties = componentDefinition.componentProperties as DropDownProperties;
				const dropdown = new SelectBox(dropdownProperties.values as string[], undefined, this._contextViewProvider, undefined);
				dropdown.render(dropdownContainer);
				dropdown.selectElem.style.height = '25px';
				dropdown.onDidSelect(async (e) => {
					await this.handleEdit({ type: DesignerEditType.Update, property: editIdentifier, value: e.selected });
				});
				component = dropdown;
				break;
			case 'checkbox':
				container.appendChild(DOM.$('')); // label container place holder
				const checkboxContainer = container.appendChild(DOM.$(''));
				const checkboxProperties = componentDefinition.componentProperties as CheckBoxProperties;
				const checkbox = new Checkbox(checkboxContainer, {
					label: checkboxProperties.title
				});
				checkbox.onChange(async (newValue) => {
					await this.handleEdit({ type: DesignerEditType.Update, property: editIdentifier, value: newValue });
				});
				component = checkbox;
				break;
			case 'table':
				const tableProperties = componentDefinition.componentProperties as DesignerTableProperties;
				const buttonContainer = container.appendChild(DOM.$('.full-row')).appendChild(DOM.$('.add-row-button-container'));
				const addNewText = localize('designer.newRowText', "Add New");
				const addRowButton = new Button(buttonContainer, {
					title: addNewText,
					secondary: true
				});
				addRowButton.onDidClick(async () => {
					await this.handleEdit({
						type: DesignerEditType.Add,
						property: componentDefinition.propertyName,
					});
				});
				this.styleComponent(addRowButton);
				addRowButton.label = addNewText;
				addRowButton.icon = {
					id: `add-row-button new codicon`
				};
				this._buttons.push(addRowButton);
				const tableContainer = container.appendChild(DOM.$('.full-row'));
				const table = new Table(tableContainer, {
					dataProvider: new TableDataView()
				}, {
					editable: true,
					autoEdit: true,
					dataItemColumnValueExtractor: (data: any, column: Slick.Column<Slick.SlickData>): string => {
						if (column.field) {
							return data[column.field].value;
						} else {
							return undefined;
						}
					}
				});
				table.ariaLabel = tableProperties.ariaLabel;
				const columns = tableProperties.columns.map(propName => {
					const propertyDefinition = tableProperties.itemProperties.find(item => item.propertyName === propName);
					switch (propertyDefinition.componentType) {
						case 'checkbox':
							const checkboxColumn = new CheckBoxColumn({
								field: propertyDefinition.propertyName,
								name: propertyDefinition.componentProperties.title,
								width: propertyDefinition.componentProperties.width as number
							});
							table.registerPlugin(checkboxColumn);
							checkboxColumn.onChange(async (e) => {
								await this.handleEdit({
									type: DesignerEditType.Update,
									property: {
										parentProperty: componentDefinition.propertyName,
										index: e.row,
										property: propertyDefinition.propertyName
									},
									value: e.value
								});
							});
							return checkboxColumn.definition;
						case 'dropdown':
							const dropdownProperties = propertyDefinition.componentProperties as DropDownProperties;
							return {
								name: dropdownProperties.title,
								field: propertyDefinition.propertyName,
								editor: this._tableCellEditorFactory.getSelectBoxEditorClass(componentDefinition.propertyName, dropdownProperties.values as string[]),
								width: dropdownProperties.width as number
							};
						default:
							const inputProperties = propertyDefinition.componentProperties as InputBoxProperties;
							return {
								name: inputProperties.title,
								field: propertyDefinition.propertyName,
								editor: this._tableCellEditorFactory.getTextEditorClass(componentDefinition.propertyName, inputProperties.inputType),
								width: inputProperties.width as number
							};
					}
				});
				const deleteRowColumn = new ButtonColumn({
					id: 'deleteRow',
					iconCssClass: Codicon.trash.classNames,
					title: localize('designer.removeRowText', "Remove"),
					width: 20,
					resizable: false,
					isFontIcon: true
				});
				deleteRowColumn.onClick(async (e) => {
					const viewModel = await this._input.getViewModel();
					(viewModel[componentDefinition.propertyName] as DesignerTableProperties).data.splice(e.row, 1);
					await this.handleEdit({
						type: DesignerEditType.Remove,
						property: componentDefinition.propertyName,
						value: e.item
					});
				});
				table.registerPlugin(deleteRowColumn);
				columns.push(deleteRowColumn.definition);
				table.columns = columns;
				table.grid.onBeforeEditCell.subscribe((e, data): boolean => {
					return data.item[data.column.field].enabled !== false;
				});
				table.grid.onActiveCellChanged.subscribe(async (e, data) => {
					if (data.row !== undefined) {
						await this.updatePropertiesPane({
							parentProperty: componentDefinition.propertyName,
							index: data.row
						});
					}
				});
				component = table;
				break;
			default:
				throw new Error(localize('tableDesigner.unknownComponentType', "The component type: {0} is not supported", componentDefinition.componentType));
		}
		if (addToComponentMap) {
			this._componentMap.set(componentDefinition.propertyName, {
				defintion: componentDefinition,
				component: component
			});
		}
		this.styleComponent(component);
		return component;
	}

	private startLoading(message: string, timeout: number = 500): any {
		// To make the experience smoother, only show the loading indicator if the request is not returning in 500ms(default value).
		return setTimeout(() => {
			this._loadingSpinner.loadingMessage = message;
			this._loadingSpinner.loading = true;
			this._container.removeChild(this._verticalSplitViewContainer);
		}, timeout);
	}

	private stopLoading(handle: any, message: string): void {
		clearTimeout(handle);
		if (this._loadingSpinner.loading) {
			this._loadingSpinner.loadingCompletedMessage = message;
			this._loadingSpinner.loading = false;
			this._container.appendChild(this._verticalSplitViewContainer);
		}
	}
}
