/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	DesignerComponentInput, DesignerEditType, DesignerTab, DesignerEdit, DesignerPropertyPath, DesignerViewModel, DesignerDataPropertyInfo,
	DesignerTableComponentRowData, DesignerTableProperties, InputBoxProperties, DropDownProperties, CheckBoxProperties,
	DesignerEditProcessedEventArgs, DesignerStateChangedEventArgs, DesignerAction, ScriptProperty, DesignerRootObjectPath, CanBeDeletedProperty, DesignerUIArea
}
	from 'sql/workbench/browser/designer/interfaces';
import { IPanelTab, ITabbedPanelStyles, TabbedPanel } from 'sql/base/browser/ui/panel/panel';
import * as DOM from 'vs/base/browser/dom';
import { Emitter, Event } from 'vs/base/common/event';
import { Orientation, Sizing, SplitView } from 'vs/base/browser/ui/splitview/splitview';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IInputBoxStyles, InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
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
import { DesignerTabPanelView } from 'sql/workbench/browser/designer/designerTabPanelView';
import { DesignerPropertiesPane } from 'sql/workbench/browser/designer/designerPropertiesPane';
import { Button, IButtonStyles } from 'sql/base/browser/ui/button/button';
import { ButtonColumn } from 'sql/base/browser/ui/table/plugins/buttonColumn.plugin';
import { Codicon } from 'vs/base/common/codicons';
import { Color } from 'vs/base/common/color';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { DesignerIssuesTabPanelView } from 'sql/workbench/browser/designer/designerIssuesTabPanelView';
import { DesignerScriptEditorTabPanelView } from 'sql/workbench/browser/designer/designerScriptEditorTabPanelView';
import { DesignerPropertyPathValidator } from 'sql/workbench/browser/designer/designerPropertyPathValidator';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { listActiveSelectionBackground, listActiveSelectionForeground, listHoverBackground } from 'vs/platform/theme/common/colorRegistry';
import { alert } from 'vs/base/browser/ui/aria/aria';
import { layoutDesignerTable, TableHeaderRowHeight, TableRowHeight } from 'sql/workbench/browser/designer/designerTableUtil';
import { Dropdown, IDropdownStyles } from 'sql/base/browser/ui/editableDropdown/browser/dropdown';
import { IListStyles } from 'vs/base/browser/ui/list/listWidget';
import { IAction } from 'vs/base/common/actions';
import { InsertAfterSelectedRowAction, InsertBeforeSelectedRowAction, AddRowAction, DesignerTableActionContext, MoveRowDownAction, MoveRowUpAction, DesignerTableAction } from 'sql/workbench/browser/designer/tableActions';
import { RowMoveManager, RowMoveOnDragEventData } from 'sql/base/browser/ui/table/plugins/rowMoveManager.plugin';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { listFocusAndSelectionBackground } from 'sql/platform/theme/common/colors';

export interface IDesignerStyle {
	tabbedPanelStyles?: ITabbedPanelStyles;
	inputBoxStyles?: IInputBoxStyles;
	tableStyles?: ITableStyles;
	selectBoxStyles?: ISelectBoxStyles;
	checkboxStyles?: ICheckboxStyles;
	buttonStyles?: IButtonStyles;
	dropdownStyles?: IListStyles & IInputBoxStyles & IDropdownStyles;
	paneSeparator?: Color;
	groupHeaderBackground?: Color;
}

export type DesignerUIComponent = InputBox | Checkbox | Table<Slick.SlickData> | SelectBox | Dropdown;

export type CreateComponentsFunc = (container: HTMLElement, components: DesignerDataPropertyInfo[], parentPath: DesignerPropertyPath) => DesignerUIComponent[];
export type SetComponentValueFunc = (definition: DesignerDataPropertyInfo, component: DesignerUIComponent, data: DesignerViewModel) => void;

interface DesignerTableCellContext {
	view: DesignerUIArea;
	path: DesignerPropertyPath;
}

const ScriptTabId = 'scripts';
const IssuesTabId = 'issues';

export class Designer extends Disposable implements IThemable {
	private _loadingSpinner: LoadingSpinner;
	private _horizontalSplitViewContainer: HTMLElement;
	private _verticalSplitViewContainer: HTMLElement;
	private _tabbedPanelContainer: HTMLElement;
	private _editorContainer: HTMLElement;
	private _horizontalSplitView: SplitView;
	private _verticalSplitView: SplitView;
	private _contentTabbedPanel: TabbedPanel;
	private _scriptTabbedPannel: TabbedPanel;
	private _contentContainer: HTMLElement;
	private _topContentContainer: HTMLElement;
	private _propertiesPaneContainer: HTMLElement;
	private _styles: IDesignerStyle = {};
	private _supressEditProcessing: boolean = false;
	private _componentMap = new Map<string, { defintion: DesignerDataPropertyInfo, component: DesignerUIComponent }>();
	private _input: DesignerComponentInput;
	private _tableCellEditorFactory: TableCellEditorFactory;
	private _propertiesPane: DesignerPropertiesPane;
	private _inputDisposable: DisposableStore;
	private _loadingTimeoutHandle: any;
	private _groupHeaders: HTMLElement[] = [];
	private _issuesView: DesignerIssuesTabPanelView;
	private _scriptEditorView: DesignerScriptEditorTabPanelView;
	private _taskbars: Taskbar[] = [];
	private _actionsMap: Map<Taskbar, DesignerTableAction[]> = new Map<Taskbar, DesignerTableAction[]>();
	private _onStyleChangeEventEmitter = new Emitter<void>();

	constructor(private readonly _container: HTMLElement,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IContextViewService private readonly _contextViewProvider: IContextViewService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IDialogService private readonly _dialogService: IDialogService,
		@IThemeService private readonly _themeService: IThemeService,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService,) {
		super();
		this._tableCellEditorFactory = new TableCellEditorFactory(
			{
				valueGetter: (item, column): string => {
					return item[column.field].value;
				},
				valueSetter: (context: DesignerTableCellContext, row: number, item: DesignerTableComponentRowData, column: Slick.Column<Slick.SlickData>, value: string): void => {
					this.handleEdit({
						type: DesignerEditType.Update,
						path: [...context.path, row, column.field],
						value: value,
						source: context.view
					});
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
		this._contentTabbedPanel = new TabbedPanel(this._tabbedPanelContainer);
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
		this._scriptTabbedPannel = new TabbedPanel(this._editorContainer);
		this._issuesView = this._instantiationService.createInstance(DesignerIssuesTabPanelView);
		this._register(this._issuesView.onIssueSelected((path) => {
			if (path && path.length > 0) {
				this.selectProperty(path);
			}
		}));
		this._scriptEditorView = new DesignerScriptEditorTabPanelView(this._instantiationService);
		this._scriptTabbedPannel.pushTab({
			title: localize('designer.scriptTabTitle', "Scripts"),
			identifier: ScriptTabId,
			view: this._scriptEditorView
		});
		this._verticalSplitView.addView({
			element: this._editorContainer,
			layout: size => {
				this._scriptTabbedPannel.layout(new DOM.Dimension(this._editorContainer.clientWidth, size - this._scriptTabbedPannel.headersize));
			},
			minimumSize: 100,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._horizontalSplitView.addView({
			element: this._contentContainer,
			layout: size => {
				this.layoutTabbedPanel();
			},
			minimumSize: 400,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);

		this._horizontalSplitView.addView({
			element: this._propertiesPaneContainer,
			layout: size => {
				this.layoutPropertiesPane();
			},
			minimumSize: 200,
			maximumSize: Number.POSITIVE_INFINITY,
			onDidChange: Event.None
		}, Sizing.Distribute);


		this._propertiesPane = new DesignerPropertiesPane(this._propertiesPaneContainer, (container, components, parentPath) => {
			return this.createComponents(container, components, this._propertiesPane.componentMap, this._propertiesPane.groupHeaders, parentPath, 'PropertiesView');
		}, (definition, component, viewModel) => {
			this.setComponentValue(definition, component, viewModel);
		}, this._instantiationService);
	}

	private styleComponent(component: TabbedPanel | InputBox | Checkbox | Table<Slick.SlickData> | SelectBox | Button | Dropdown): void {
		if (component instanceof InputBox) {
			component.style(this._styles.inputBoxStyles);
		} else if (component instanceof Checkbox) {
			component.style(this._styles.checkboxStyles);
		} else if (component instanceof TabbedPanel) {
			component.style(this._styles.tabbedPanelStyles);
		} else if (component instanceof Table) {
			this.removeTableSelectionStyles();
			component.style(this._styles.tableStyles);
		} else if (component instanceof Button) {
			component.style(this._styles.buttonStyles);
		} else if (component instanceof Dropdown) {
			component.style(this._styles.dropdownStyles);
		} else {
			component.style(this._styles.selectBoxStyles);
		}
	}

	private removeTableSelectionStyles(): void {
		this._styles.tableStyles.listActiveSelectionBackground = undefined;
		this._styles.tableStyles.listActiveSelectionForeground = undefined;
		this._styles.tableStyles.listFocusAndSelectionBackground = undefined;
		this._styles.tableStyles.listFocusAndSelectionForeground = undefined;
		this._styles.tableStyles.listInactiveFocusBackground = undefined;
		this._styles.tableStyles.listInactiveFocusForeground = undefined;
		this._styles.tableStyles.listInactiveSelectionBackground = undefined;
		this._styles.tableStyles.listInactiveSelectionForeground = undefined;
	}

	private styleGroupHeader(header: HTMLElement): void {
		if (this._styles.groupHeaderBackground) {
			header.style.backgroundColor = this._styles.groupHeaderBackground.toString();
		}
	}

	public style(styles: IDesignerStyle): void {
		this._styles = styles;
		this._componentMap.forEach((value, key, map) => {
			if (value.component.style) {
				this.styleComponent(value.component);
			}
		});
		this._propertiesPane.componentMap.forEach((value) => {
			this.styleComponent(value.component);
		});
		this._verticalSplitView.style({
			separatorBorder: styles.paneSeparator
		});

		this._horizontalSplitView.style({
			separatorBorder: styles.paneSeparator
		});

		this._groupHeaders.forEach((header) => {
			this.styleGroupHeader(header);
		});

		this._propertiesPane.groupHeaders.forEach((header) => {
			this.styleGroupHeader(header);
		});

		this._propertiesPane.descriptionElement.style.borderColor = styles.paneSeparator.toString();
		this._onStyleChangeEventEmitter.fire();
	}

	public layout(dimension: DOM.Dimension) {
		this._verticalSplitView.layout(dimension.height);
		this._horizontalSplitView.layout(dimension.width);
	}


	public setInput(input: DesignerComponentInput): void {
		this.saveUIState();
		if (this._loadingTimeoutHandle) {
			this.stopLoading();
		}
		this.clearUI();
		this._inputDisposable?.dispose();
		// Initialize with new input
		this._input = input;
		this._inputDisposable = new DisposableStore();
		this._inputDisposable.add(this._input.onInitialized(() => {
			this.initializeDesigner();
		}));
		this._inputDisposable.add(this._input.onEditProcessed((args) => {
			this.handleEditProcessedEvent(args);
		}));
		this._inputDisposable.add(this._input.onStateChange((args) => {
			this.handleInputStateChangedEvent(args);
		}));
		this._inputDisposable.add(this._input.onRefreshRequested(() => {
			this.refresh();
		}));

		if (this._input.view === undefined) {
			this._input.initialize();
		} else {
			this.initializeDesigner();
		}
		if (this._input.pendingAction) {
			this.updateLoadingStatus(this._input.pendingAction, true, false);
		}
	}

	public override dispose(): void {
		super.dispose();
		this._inputDisposable?.dispose();
	}

	private clearUI(): void {
		this._componentMap.forEach(item => item.component.dispose());
		this._componentMap.clear();
		DOM.clearNode(this._topContentContainer);
		this._contentTabbedPanel.clearTabs();
		this._propertiesPane.clear();
		this._groupHeaders = [];
		this._taskbars.map(t => t.dispose());
	}

	private initializeDesigner(): void {
		const view = this._input.view;
		if (view.components) {
			this.createComponents(this._topContentContainer, view.components, this._componentMap, this._groupHeaders, DesignerRootObjectPath, 'TopContentView');
		}
		view.tabs.forEach(tab => {
			this._contentTabbedPanel.pushTab(this.createTabView(tab));
		});
		this.updateComponentValues();
		this.layoutTabbedPanel();
		this.updatePropertiesPane(DesignerRootObjectPath);
		this.restoreUIState();
	}

	private handleCellFocusAfterAddOrMove(edit: DesignerEdit): void {
		if (edit.path.length === 2) {
			const propertyName = edit.path[0] as string;
			const index = edit.type === DesignerEditType.Add ? edit.path[1] as number : edit.value as number;
			const table = this._componentMap.get(propertyName).component as Table<Slick.SlickData>;
			const tableProperties = this._componentMap.get(propertyName).defintion.componentProperties as DesignerTableProperties;
			let selectedCellIndex = tableProperties.itemProperties.findIndex(p => p.componentType === 'input');
			selectedCellIndex = tableProperties.canMoveRows ? selectedCellIndex + 1 : selectedCellIndex;
			try {
				table.grid.resetActiveCell();
				table.setActiveCell(index, selectedCellIndex);
				table.setSelectedRows([index]);
			}
			catch {
				// Ignore the slick grid error when setting active cell.
			}
		} else {
			this.updatePropertiesPane(this._propertiesPane.objectPath);
		}
	}

	private handleEditProcessedEvent(args: DesignerEditProcessedEventArgs): void {
		const edit = args.edit;
		this._supressEditProcessing = true;
		if (args.result.issues?.length > 0) {
			alert(localize('designer.issueCountAlert', "{0} validation issues found.", args.result.issues.length));
		}
		try {
			if (args.result.refreshView) {
				this.refresh();
				if (!args.result.isValid) {
					this._scriptTabbedPannel.showTab(IssuesTabId);
				}
			} else {
				this.updateComponentValues();
				this.layoutTabbedPanel();
			}
			if (edit.type === DesignerEditType.Add || edit.type === DesignerEditType.Move) {
				this.handleCellFocusAfterAddOrMove(edit);
			} else if (edit.type === DesignerEditType.Update) {
				// for edit, update the properties pane with new values of current object.
				this.updatePropertiesPane(this._propertiesPane.objectPath);
			} else if (edit.type === DesignerEditType.Remove) {
				// removing the secondary level entities, the properties pane needs to be updated to reflect the changes.
				if (edit.path.length === 4) {
					this.updatePropertiesPane(this._propertiesPane.objectPath);
				}
			}
			// try to move the focus back to where it was
			if (args.result.refreshView) {
				this.selectProperty(args.edit.path, args.edit.source, false);
			}
		} catch (err) {
			this._notificationService.error(err);
		}
		this._supressEditProcessing = false;
	}

	private handleInputStateChangedEvent(args: DesignerStateChangedEventArgs): void {
		if (args.previousState.pendingAction !== args.currentState.pendingAction) {
			const showLoading = args.currentState.pendingAction !== undefined;
			const action = args.currentState.pendingAction || args.previousState.pendingAction;
			this.updateLoadingStatus(action, showLoading, true);
		}
	}

	private updateLoadingStatus(action: DesignerAction, showLoading: boolean, useDelay: boolean): void {
		let message;
		let timeout;
		switch (action) {
			case 'publish':
				message = showLoading ? localize('designer.publishingChanges', "Publishing changes...") : localize('designer.publishChangesCompleted', "Changes have been published");
				timeout = 0;
				break;
			case 'initialize':
				message = showLoading ? localize('designer.loadingDesigner', "Loading designer...") : localize('designer.loadingDesignerCompleted', "Designer is loaded");
				timeout = 0;
				break;
			case 'processEdit':
				message = showLoading ? localize('designer.processingChanges', "Processing changes...") : localize('designer.processingChangesCompleted', "Changes have been processed");
				// To make the edit experience smoother, only show the loading indicator if the request is not returning in 500ms.
				timeout = 500;
				break;
			default:
				message = showLoading ? localize('designer.processing', "Processing...") : localize('designer.processingCompleted', "Processing completed");
				timeout = 0;
				break;
		}
		if (showLoading) {
			this.startLoading(message, useDelay ? timeout : 0);
		} else {
			this.stopLoading(message);
		}
	}

	private refresh() {
		this.saveUIState();
		this.clearUI();
		this.initializeDesigner();
	}

	private layoutTabbedPanel() {
		this._contentTabbedPanel.layout(new DOM.Dimension(this._tabbedPanelContainer.clientWidth, this._tabbedPanelContainer.clientHeight));
	}

	private layoutPropertiesPane() {
		this._propertiesPane?.componentMap.forEach((v) => {
			if (v.component instanceof Table) {
				layoutDesignerTable(v.component, this._propertiesPaneContainer.clientWidth);
			}
		});
	}

	private updatePropertiesPane(objectPath: DesignerPropertyPath): void {
		let type: string;
		let components: DesignerDataPropertyInfo[];
		let objectViewModel: DesignerViewModel;
		if (objectPath.length === 0) { // root object
			type = this._input.objectTypeDisplayName;
			components = [];
			components.push(...this._input.view.components);
			this._input.view.tabs.forEach(tab => {
				components.push(...tab.components);
			});
			objectViewModel = this._input.viewModel;
		} else if (objectPath.length === 2) { // second level object
			const parentPropertyName = objectPath[0] as string;
			const objectIndex = objectPath[1] as number;
			const tableData = this._input.viewModel[parentPropertyName] as DesignerTableProperties;
			const tableProperties = this._componentMap.get(parentPropertyName).defintion.componentProperties as DesignerTableProperties;
			objectViewModel = tableData.data[objectIndex] as DesignerViewModel;
			components = tableProperties.itemProperties;
			type = tableProperties.objectTypeDisplayName;
		}

		this._propertiesPane.show({
			path: objectPath,
			type: type,
			components: components,
			viewModel: objectViewModel
		});
		this.layoutPropertiesPane();
	}

	private updateComponentValues(): void {
		this.updateIssuesTab();
		const viewModel = this._input.viewModel;
		const scriptProperty = viewModel[ScriptProperty] as InputBoxProperties;
		if (scriptProperty) {
			this._scriptEditorView.content = scriptProperty.value || '';
		}
		this._componentMap.forEach((value) => {
			this.setComponentValue(value.defintion, value.component, viewModel);
		});
	}

	private updateIssuesTab(): void {
		if (!this._input) {
			return;
		}
		if (this._scriptTabbedPannel.contains(IssuesTabId)) {
			this._scriptTabbedPannel.removeTab(IssuesTabId);
		}

		if (this._input.issues === undefined || this._input.issues.length === 0) {
			return;
		}
		this._scriptTabbedPannel.pushTab({
			title: localize('designer.issuesTabTitle', "Issues ({0})", this._input.issues.length),
			identifier: IssuesTabId,
			view: this._issuesView
		});
		this._scriptTabbedPannel.showTab(IssuesTabId);
		this._issuesView.updateIssues(this._input.issues);
	}

	private selectProperty(path: DesignerPropertyPath, view?: DesignerUIArea, highlight: boolean = true): void {
		if (!DesignerPropertyPathValidator.validate(path, this._input.viewModel)) {
			return;
		}

		// Find top level property
		let found = false;
		if (this._input.view.components) {
			for (const component of this._input.view.components) {
				if (path[0] === component.propertyName) {
					found = true;
					break;
				}
			}
		}
		if (this._input.view.tabs) {
			for (const tab of this._input.view.tabs) {
				if (tab) {
					for (const component of tab.components) {
						if (path[0] === component.propertyName) {
							// if we are editing the top level property and the view is properties view, then we don't have to switch to the tab.
							if (path.length !== 1 || view !== 'PropertiesView') {
								this._contentTabbedPanel.showTab(tab.title);
							}
							found = true;
							break;
						}
					}
				}
				if (found) {
					break;
				}
			}
		}

		if (found) {
			const propertyInfo = this._componentMap.get(<string>path[0]);
			if (propertyInfo.defintion.componentType !== 'table') {
				if (view === 'PropertiesView') {
					this.updatePropertiesPane(DesignerRootObjectPath);
					this._propertiesPane.selectProperty(path);
				} else {
					propertyInfo.component.focus();
				}
				return;
			} else {
				const tableComponent = <Table<Slick.SlickData>>propertyInfo.component;
				const targetRow = <number>path[1];
				const targetCell = 0;
				tableComponent.setActiveCell(targetRow, targetCell);
				tableComponent.grid.scrollCellIntoView(targetRow, targetCell, false);
				if (path.length > 2) {
					const relativePath = path.slice(2);
					this._propertiesPane.selectProperty(relativePath);
				}
			}
			if (highlight) {
				this.highlightActiveElement();
			}
		}
	}

	private highlightActiveElement(): void {
		const bgColor = this._themeService.getColorTheme().getColor(listActiveSelectionBackground);
		const color = this._themeService.getColorTheme().getColor(listActiveSelectionForeground);
		const currentElement = document.activeElement as HTMLElement;
		if (currentElement) {
			const originalBGColor = currentElement.style.backgroundColor;
			const originalColor = currentElement.style.color;
			currentElement.style.backgroundColor = bgColor.toString();
			currentElement.style.color = color.toString();
			setTimeout(() => {
				currentElement.style.color = originalColor;
				currentElement.style.backgroundColor = originalBGColor;
			}, 500);
		}
	}

	public handleEdit(edit: DesignerEdit): void {
		if (this._supressEditProcessing) {
			return;
		}
		this._input.processEdit(edit);
	}

	private createTabView(tab: DesignerTab): IPanelTab {
		const view = new DesignerTabPanelView(tab, (container, components, identifierGetter) => {
			return this.createComponents(container, components, this._componentMap, this._groupHeaders, identifierGetter, 'TabsView');
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
				const dropdownProperties = definition.componentProperties as DropDownProperties;
				const dropdownData = viewModel[definition.propertyName] as DropDownProperties;
				const options = (dropdownData.values || dropdownProperties.values || []) as string[];
				const idx = options?.indexOf(dropdownData.value as string);
				let dropdown: Dropdown | SelectBox;
				if (dropdownProperties.isEditable) {
					dropdown = component as Dropdown;
					if (dropdownData.enabled === false) {
						dropdown.enabled = false;
					} else {
						dropdown.enabled = true;
					}
					dropdown.values = options;
					if (idx > -1) {
						dropdown.value = options[idx];
					}
				} else {
					dropdown = component as SelectBox;
					if (dropdownData.enabled === false) {
						dropdown.disable();
					} else {
						dropdown.enable();
					}
					dropdown.setOptions(options);
					if (idx > -1) {
						dropdown.select(idx);
					}
				}
				break;
			default:
				break;
		}
		this._supressEditProcessing = false;
	}

	private createComponents(container: HTMLElement,
		components: DesignerDataPropertyInfo[],
		componentMap: Map<string, { defintion: DesignerDataPropertyInfo, component: DesignerUIComponent }>,
		groupHeaders: HTMLElement[],
		parentPath: DesignerPropertyPath,
		area: DesignerUIArea): DesignerUIComponent[] {
		const uiComponents = [];
		const groupNames = [];
		const componentsToCreate = area === 'PropertiesView' ? components.filter(component => component.showInPropertiesView !== false) : components;
		componentsToCreate.forEach(component => {
			// Set the default group name if not set (undefined or null).
			component.group = component.group || localize('designer.generalGroupName', "General");
			if (groupNames.indexOf(component.group) === -1) {
				groupNames.push(component.group);
			}
		});

		// only show groups when there are multiple of them.
		if (groupNames.length < 2) {
			componentsToCreate.forEach(component => {
				uiComponents.push(this.createComponent(container, component, parentPath, componentMap, area));
			});
		} else {
			groupNames.forEach(group => {
				const groupHeader = container.appendChild(DOM.$('div.full-row.group-header'));
				groupHeaders.push(groupHeader);
				this.styleGroupHeader(groupHeader);
				groupHeader.innerText = group;
				componentsToCreate.forEach(component => {
					if (component.group === group) {
						uiComponents.push(this.createComponent(container, component, parentPath, componentMap, area));
					}
				});
			});
		}
		return uiComponents;
	}

	private createComponent(container: HTMLElement,
		componentDefinition: DesignerDataPropertyInfo,
		parentPath: DesignerPropertyPath,
		componentMap: Map<string, { defintion: DesignerDataPropertyInfo, component: DesignerUIComponent }>,
		view: DesignerUIArea): DesignerUIComponent {
		const propertyPath = [...parentPath, componentDefinition.propertyName];
		let component: DesignerUIComponent;
		switch (componentDefinition.componentType) {
			case 'input':
				container.appendChild(DOM.$('')).appendChild(DOM.$('span.component-label')).innerText = componentDefinition.componentProperties?.title ?? '';
				const inputContainer = container.appendChild(DOM.$(''));
				const inputProperties = componentDefinition.componentProperties as InputBoxProperties;
				const input = new InputBox(inputContainer, this._contextViewProvider, {
					ariaLabel: inputProperties.title,
					type: inputProperties.inputType,
					ariaDescription: componentDefinition.description
				});
				input.onLoseFocus((args) => {
					if (args.hasChanged) {
						this.handleEdit({ type: DesignerEditType.Update, path: propertyPath, value: args.value, source: view });
					}
				});
				input.onInputFocus(() => {
					if (view === 'PropertiesView') {
						this._propertiesPane.updateDescription(componentDefinition);
					} else if (view === 'TabsView' || view === 'TopContentView') {
						this.updatePropertiesPane(DesignerRootObjectPath);
					}
				});
				if (view === 'TopContentView' && inputProperties.width) {
					input.width = inputProperties.width as number;
				}
				component = input;
				break;
			case 'dropdown':
				container.appendChild(DOM.$('')).appendChild(DOM.$('span.component-label')).innerText = componentDefinition.componentProperties?.title ?? '';
				const dropdownContainer = container.appendChild(DOM.$(''));
				const dropdownProperties = componentDefinition.componentProperties as DropDownProperties;
				let dropdown;
				if (dropdownProperties.isEditable) {
					dropdown = new Dropdown(dropdownContainer, this._contextViewProvider, {
						values: dropdownProperties.values as string[] || [],
						ariaLabel: componentDefinition.componentProperties?.title,
						ariaDescription: componentDefinition.description
					});
					dropdown.onValueChange((value) => {
						this.handleEdit({ type: DesignerEditType.Update, path: propertyPath, value: value, source: view });
					});
					dropdown.onFocus(() => {
						if (view === 'PropertiesView') {
							this._propertiesPane.updateDescription(componentDefinition);
						} else if (view === 'TabsView' || view === 'TopContentView') {
							this.updatePropertiesPane(DesignerRootObjectPath);
						}
					});
				} else {
					dropdown = new SelectBox(dropdownProperties.values as string[] || [], undefined, this._contextViewProvider, undefined, {
						ariaLabel: componentDefinition.componentProperties?.title,
						ariaDescription: componentDefinition.description
					});
					dropdown.render(dropdownContainer);
					dropdown.selectElem.style.height = '25px';
					dropdown.onDidSelect((e) => {
						this.handleEdit({ type: DesignerEditType.Update, path: propertyPath, value: e.selected, source: view });
					});
					dropdown.onDidFocus(() => {
						if (view === 'PropertiesView') {
							this._propertiesPane.updateDescription(componentDefinition);
						} else if (view === 'TabsView' || view === 'TopContentView') {
							this.updatePropertiesPane(DesignerRootObjectPath);
						}
					});
				}
				component = dropdown;
				break;
			case 'checkbox':
				container.appendChild(DOM.$('')).appendChild(DOM.$('span.component-label')).innerText = componentDefinition.componentProperties?.title ?? '';
				const checkboxContainer = container.appendChild(DOM.$(''));
				const checkboxProperties = componentDefinition.componentProperties as CheckBoxProperties;
				const checkbox = new Checkbox(checkboxContainer, { label: '', ariaLabel: checkboxProperties.title, ariaDescription: componentDefinition.description });
				checkbox.onChange((newValue) => {
					this.handleEdit({ type: DesignerEditType.Update, path: propertyPath, value: newValue, source: view });
				});
				checkbox.onFocus(() => {
					if (view === 'PropertiesView') {
						this._propertiesPane.updateDescription(componentDefinition);
					} else if (view === 'TabsView' || view === 'TopContentView') {
						this.updatePropertiesPane(DesignerRootObjectPath);
					}
				});
				component = checkbox;
				break;
			case 'table':
				if (view === 'PropertiesView') {
					container.appendChild(DOM.$('.full-row')).appendChild(DOM.$('span.component-label')).innerText = componentDefinition.componentProperties?.title ?? '';
				}
				const tableProperties = componentDefinition.componentProperties as DesignerTableProperties;
				const taskbar = this.addTableTaskbar(container, tableProperties);
				const tableContainer = container.appendChild(DOM.$('.full-row'));
				const table = new Table(tableContainer, {
					dataProvider: new TableDataView()
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
					editorLock: new Slick.EditorLock()
				});
				table.grid.setSelectionModel(new RowSelectionModel());
				if (taskbar) {
					taskbar.context = { table: table, path: propertyPath, source: view };
					this._actionsMap.get(taskbar).map(a => a.table = table);
				}
				const columns: Slick.Column<Slick.SlickData>[] = [];
				if (tableProperties.canMoveRows) {
					// Add row move drag and drop
					const moveRowsPlugin = new RowMoveManager({
						cancelEditOnDrag: true,
						id: 'moveRow',
						iconCssClass: Codicon.grabber.classNames,
						name: localize('designer.moveRowText', 'Move'),
						width: 50,
						resizable: true,
						isFontIcon: true,
						behavior: 'selectAndMove'
					});
					table.registerPlugin(moveRowsPlugin);
					moveRowsPlugin.onMoveRows.subscribe((e: Slick.EventData, data: RowMoveOnDragEventData) => {
						const row = data.rows[0];
						// no point in moving before or after itself
						if (row === data.insertBefore || row === data.insertBefore - 1) {
							e.stopPropagation();
							return;
						}
						this.handleEdit({
							type: DesignerEditType.Move,
							path: [...propertyPath, row],
							source: view,
							value: data.insertBefore < row ? data.insertBefore : data.insertBefore - 1
						});
					});
					table.grid.registerPlugin(moveRowsPlugin);
					columns.push(moveRowsPlugin.definition);
				}
				table.ariaLabel = tableProperties.ariaLabel;
				columns.push(...tableProperties.columns.map((propName, index) => {
					const propertyDefinition = tableProperties.itemProperties.find(item => item.propertyName === propName);
					switch (propertyDefinition.componentType) {
						case 'checkbox':
							const checkboxColumn = new CheckBoxColumn({
								id: index.toString(),
								field: propertyDefinition.propertyName,
								name: propertyDefinition.componentProperties.title,
								width: propertyDefinition.componentProperties.width as number
							});
							table.registerPlugin(checkboxColumn);
							checkboxColumn.onChange((e) => {
								this.handleEdit({
									type: DesignerEditType.Update,
									path: [...propertyPath, e.row, propertyDefinition.propertyName],
									value: e.value,
									source: view
								});
							});
							return checkboxColumn.definition;
						case 'dropdown':
							const dropdownProperties = propertyDefinition.componentProperties as DropDownProperties;
							return {
								id: index.toString(),
								name: dropdownProperties.title,
								field: propertyDefinition.propertyName,
								editor: this._tableCellEditorFactory.getDropdownEditorClass({ view: view, path: propertyPath }, dropdownProperties.values as string[], dropdownProperties.isEditable),
								width: dropdownProperties.width as number
							};
						default:
							const inputProperties = propertyDefinition.componentProperties as InputBoxProperties;
							return {
								id: index.toString(),
								name: inputProperties.title,
								field: propertyDefinition.propertyName,
								editor: this._tableCellEditorFactory.getTextEditorClass({ view: view, path: propertyPath }, inputProperties.inputType),
								width: inputProperties.width as number
							};
					}
				}));
				if (tableProperties.canRemoveRows) {
					const removeText = localize('designer.removeRowText', "Remove");
					const deleteRowColumn = new ButtonColumn({
						id: 'deleteRow',
						iconCssClass: Codicon.trash.classNames,
						name: removeText,
						title: removeText,
						width: 60,
						resizable: true,
						isFontIcon: true,
						enabledField: CanBeDeletedProperty
					});
					deleteRowColumn.onClick(async (e) => {
						if (tableProperties.showRemoveRowConfirmation) {
							const confirmMessage = tableProperties.removeRowConfirmationMessage || localize('designer.defaultRemoveRowConfirmationMessage', "Are you sure you want to remove the row?");
							const result = await this._dialogService.confirm({
								type: 'question',
								message: confirmMessage
							});
							if (!result.confirmed) {
								return;
							}
						}
						this.handleEdit({
							type: DesignerEditType.Remove,
							path: [...propertyPath, e.row],
							source: view
						});
					});
					table.registerPlugin(deleteRowColumn);
					columns.push(deleteRowColumn.definition);
				}
				if (tableProperties.canInsertRows || tableProperties.canMoveRows) {
					const moreActionsText = localize('designer.actions', "More Actions");
					const actionsColumn = new ButtonColumn({
						id: 'actions',
						iconCssClass: Codicon.ellipsis.classNames,
						name: moreActionsText,
						title: moreActionsText,
						width: 100,
						resizable: true,
						isFontIcon: true
					});
					this._register(actionsColumn.onClick((e) => {
						this.openContextMenu(table, e.row, e.position, propertyPath, view, tableProperties);
					}));
					table.registerPlugin(actionsColumn);
					columns.push(actionsColumn.definition);
					// Add move context menu actions
					this._register(table.onContextMenu((e) => {
						this.openContextMenu(table, e.cell.row, e.anchor, propertyPath, view, tableProperties);
					}));
				}
				table.columns = columns;
				table.grid.onBeforeEditCell.subscribe((e, data): boolean => {
					return data.item[data.column.field].enabled !== false;
				});
				let currentTableActions = [];
				if (taskbar) {
					currentTableActions = this._actionsMap.get(taskbar);
				}
				table.grid.onActiveCellChanged.subscribe((e, data) => {
					if (view === 'TabsView' || view === 'TopContentView') {
						if (data.row !== undefined) {
							if (tableProperties.showItemDetailInPropertiesView === false) {
								this.updatePropertiesPane(DesignerRootObjectPath);
							} else {
								this.updatePropertiesPane([...propertyPath, data.row]);
							}
						} else {
							this.updatePropertiesPane(DesignerRootObjectPath);
						}
					} else if (view === 'PropertiesView') {
						if (data.row !== undefined) {
							this._propertiesPane.updateDescription(componentDefinition);
						}
					}
					if (data.row !== undefined) {
						currentTableActions.forEach(a => a.updateState(data.row));
						table.grid.setSelectedRows([data.row]);
					}
				});
				table.onBlur((e) => {
					currentTableActions.forEach(a => a.updateState());
					table.grid.setSelectedRows([]);
				});
				component = table;
				break;
			default:
				throw new Error(localize('designer.unknownComponentType', "The component type: {0} is not supported", componentDefinition.componentType));
		}
		componentMap.set(componentDefinition.propertyName, {
			defintion: componentDefinition,
			component: component
		});

		this.styleComponent(component);
		return component;
	}

	private addTableTaskbar(container: HTMLElement, tableProperties: DesignerTableProperties): Taskbar | undefined {
		if (tableProperties.canAddRows || tableProperties.canMoveRows) {
			const taskbarContainer = container.appendChild(DOM.$('.full-row')).appendChild(DOM.$('.add-row-button-container'));
			const taskbar = new Taskbar(taskbarContainer);
			const actions = [];
			if (tableProperties.canAddRows) {
				const addRowAction = this._instantiationService.createInstance(AddRowAction, this, tableProperties);
				actions.push(addRowAction);
			}
			if (tableProperties.canMoveRows) {
				const moveUpAction = this._instantiationService.createInstance(MoveRowUpAction, this);
				const moveDownAction = this._instantiationService.createInstance(MoveRowDownAction, this);
				actions.push(moveUpAction);
				actions.push(moveDownAction);
			}
			const taskbarContent: ITaskbarContent[] = actions.map((a) => { return { action: a }; });
			taskbar.setContent(taskbarContent);
			this._actionsMap.set(taskbar, actions);
			return taskbar;
		}
		return undefined;
	}

	private openContextMenu(
		table: Table<Slick.SlickData>,
		rowIndex: number,
		anchor: HTMLElement | { x: number, y: number },
		propertyPath: DesignerPropertyPath,
		view: DesignerUIArea,
		tableProperties: DesignerTableProperties
	): void {
		const tableActionContext: DesignerTableActionContext = {
			table: table,
			path: propertyPath,
			source: view,
			selectedRow: rowIndex
		};
		const data = table.grid.getData() as Slick.DataProvider<Slick.SlickData>;
		if (!data || rowIndex >= data.getLength()) {
			return undefined;
		}
		const actions = this.getTableActions(tableProperties);
		actions.forEach(a => {
			if (a instanceof DesignerTableAction) {
				a.table = table;
				a.updateState(rowIndex);
			}
		});
		this._contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => actions,
			getActionsContext: () => (tableActionContext)
		});
	}

	private getTableActions(tableProperties: DesignerTableProperties): IAction[] {
		const actions: IAction[] = [];
		if (tableProperties.canInsertRows) {
			const insertRowBefore = this._instantiationService.createInstance(InsertBeforeSelectedRowAction, this);
			const insertRowAfter = this._instantiationService.createInstance(InsertAfterSelectedRowAction, this);
			actions.push(insertRowBefore);
			actions.push(insertRowAfter);
		}
		if (tableProperties.canMoveRows) {
			const moveRowUp = this._instantiationService.createInstance(MoveRowUpAction, this);
			const moveRowDown = this._instantiationService.createInstance(MoveRowDownAction, this);
			actions.push(moveRowUp);
			actions.push(moveRowDown);
		}
		return actions;
	}

	private startLoading(message: string, timeout: number): void {
		this._loadingTimeoutHandle = setTimeout(() => {
			this._loadingSpinner.loadingMessage = message;
			this._loadingSpinner.loading = true;
			if (this._container.contains(this._verticalSplitViewContainer)) {
				this._container.removeChild(this._verticalSplitViewContainer);
			}
		}, timeout);
	}

	private stopLoading(message: string = ''): void {
		clearTimeout(this._loadingTimeoutHandle);
		this._loadingTimeoutHandle = undefined;
		if (this._loadingSpinner.loading) {
			this._loadingSpinner.loadingCompletedMessage = message;
			this._loadingSpinner.loading = false;
			if (!this._container.contains(this._verticalSplitViewContainer)) {
				this._container.appendChild(this._verticalSplitViewContainer);
			}
		}
	}

	private saveUIState(): void {
		if (this._input) {
			this._input.designerUIState = {
				activeContentTabId: this._contentTabbedPanel.selectedTabId,
				activeScriptTabId: this._scriptTabbedPannel.selectedTabId
			};
		}
	}

	private restoreUIState(): void {
		if (this._input.designerUIState) {
			this._contentTabbedPanel.showTab(this._input.designerUIState.activeContentTabId);
			this._scriptTabbedPannel.showTab(this._input.designerUIState.activeScriptTabId);
		}
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const listHoverBackgroundColor = theme.getColor(listHoverBackground);
	const listActiveSelectionBackgroundColor = theme.getColor(listActiveSelectionBackground);
	const listFocusSelectionBackgroundColor = theme.getColor(listFocusAndSelectionBackground);
	if (listHoverBackgroundColor) {
		collector.addRule(`
		.designer-component .slick-cell.isDragging {
			background-color: ${listHoverBackgroundColor};
		}
		.designer-component .slick-reorder-proxy {
			background: ${listActiveSelectionBackgroundColor};
			opacity: 0.5;
		}
		.vs-dark .designer-component .slick-reorder-proxy {
			opacity: 0.3;
		}
		.designer-component .slick-reorder-guide {
			background: ${listFocusSelectionBackgroundColor};
			opacity: 1;
		}
		`);
	}
});
