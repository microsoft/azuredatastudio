/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionProfile } from 'azdata';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';
import { ITreeItem } from 'sql/workbench/common/views';
import { CONNECTIONS_SORT_BY_CONFIG_KEY } from 'sql/platform/connection/common/connectionConfig';
import { ConnectionSource } from 'sql/workbench/services/connection/browser/connectionDialogWidget';
import { IConnectionTreeDescriptor, IConnectionTreeService } from 'sql/workbench/services/connection/common/connectionTreeService';
import { AsyncRecentConnectionTreeDataSource } from 'sql/workbench/services/objectExplorer/browser/asyncRecentConnectionTreeDataSource';
import { ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { ConnectionProfileRenderer, TreeNodeRenderer } from 'sql/workbench/services/objectExplorer/browser/asyncServerTreeRenderer';
import { ServerTreeRenderer } from 'sql/workbench/services/objectExplorer/browser/serverTreeRenderer';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import * as DOM from 'vs/base/browser/dom';
import { ActionBar, IActionViewItemProvider } from 'vs/base/browser/ui/actionbar/actionbar';
import { status } from 'vs/base/browser/ui/aria/aria';
import { IIdentityProvider, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { ProgressBar } from 'vs/base/browser/ui/progressbar/progressbar';
import { IAsyncDataSource, ITreeNode, ITreeRenderer } from 'vs/base/browser/ui/tree/tree';
import { IAction } from 'vs/base/common/actions';
import { debounce } from 'vs/base/common/decorators';
import { Emitter, Event } from 'vs/base/common/event';
import { Iterable } from 'vs/base/common/iterator';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { basename, dirname } from 'vs/base/common/resources';
import { isString } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import 'vs/css!./media/connectionBrowseTab';
import { localize } from 'vs/nls';
import { createAndFillInContextMenuActions, MenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IMenuService, MenuId, MenuItemAction } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { FileKind } from 'vs/platform/files/common/files';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILabelService } from 'vs/platform/label/common/label';
import { WorkbenchAsyncDataTree } from 'vs/platform/list/browser/listService';
import { attachProgressBarStyler } from 'vs/platform/theme/common/styler';
import { ColorScheme } from 'vs/platform/theme/common/theme';
import { FileThemeIcon, FolderThemeIcon, IThemeService, ThemeIcon } from 'vs/platform/theme/common/themeService';
import { IResourceLabel, ResourceLabels } from 'vs/workbench/browser/labels';
import { ITreeItemLabel, ITreeViewDataProvider, TreeItemCollapsibleState, TreeViewItemHandleArg } from 'vs/workbench/common/views';



export type TreeElement = ConnectionDialogTreeProviderElement | ITreeItemFromProvider | SavedConnectionNode | ServerTreeElement;

export class ConnectionBrowseTab implements IPanelTab {
	public readonly title = localize('connectionDialog.browser', "Browse");
	public readonly identifier = 'connectionBrowse';
	public readonly view = this.instantiationService.createInstance(ConnectionBrowserView);
	constructor(@IInstantiationService private readonly instantiationService: IInstantiationService) { }
}

export interface SelectedConnectionChangedEventArgs {
	connectionProfile: IConnectionProfile,
	connect: boolean,
	source: ConnectionSource
}

export class ConnectionBrowserView extends Disposable implements IPanelView {
	private tree: WorkbenchAsyncDataTree<TreeModel, TreeElement> | undefined;
	private filterInput: InputBox | undefined;
	private treeContainer: HTMLElement | undefined;
	private model: TreeModel | undefined;
	private treeLabels: ResourceLabels | undefined;
	private treeMenus: ConnectionBrowseTreeMenuProvider | undefined;
	private treeDataSource: DataSource | undefined;
	private filterProgressBar: ProgressBar | undefined;

	public onDidChangeVisibility = Event.None;

	private readonly _onSelectedConnectionChanged = this._register(new Emitter<SelectedConnectionChangedEventArgs>());
	public readonly onSelectedConnectionChanged = this._onSelectedConnectionChanged.event;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConnectionTreeService private readonly connectionTreeService: IConnectionTreeService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IThemeService private readonly themeService: IThemeService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private readonly capabilitiesService: ICapabilitiesService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();
		this.connectionTreeService.setView(this);
	}

	render(container: HTMLElement): void {
		this.renderFilterBox(container);
		this.renderTree(container);
	}

	renderFilterBox(container: HTMLElement): void {
		this.filterInput = new InputBox(container, this.contextViewService, {
			placeholder: localize('connectionDialog.FilterPlaceHolder', "Type here to filter the list"),
			ariaLabel: localize('connectionDialog.FilterInputTitle', "Filter connections")
		});
		this.filterProgressBar = new ProgressBar(this.filterInput.element);
		this._register(this.filterProgressBar);
		this._register(attachProgressBarStyler(this.filterProgressBar, this.themeService));
		this.filterInput.element.style.margin = '5px';
		this._register(this.filterInput);
		this._register(attachInputBoxStyler(this.filterInput, this.themeService));
		this._register(this.filterInput.onDidChange(async () => {
			await this.applyFilter();
		}));
	}

	@debounce(500)
	async applyFilter(): Promise<void> {
		const applyingFilterStatusMessage = this.filterInput.value ? localize('connectionDialog.ApplyingFilter', "Applying filter")
			: localize('connectionDialog.RemovingFilter', "Removing filter");
		const filterAppliedStatusMessage = this.filterInput.value ? localize('connectionDialog.FilterApplied', "Filter applied")
			: localize('connectionDialog.FilterRemoved', "Filter removed");
		status(applyingFilterStatusMessage);
		this.filterProgressBar.infinite().show(100);
		this.treeDataSource.setFilter(this.filterInput.value);
		await this.refresh();
		await this.expandAll();
		this.filterProgressBar.hide();
		status(filterAppliedStatusMessage);
	}

	async expandAll(): Promise<void> {
		const expandedTreeItems: TreeElement[] = [];
		let treeItemsToExpand: TreeElement[] = this.treeDataSource.expandableTreeNodes;
		// expand the nodes one by one here to avoid the possible azure api traffic throttling.
		while (treeItemsToExpand.length !== 0) {
			for (const treeItem of treeItemsToExpand) {
				await this.tree.expand(treeItem);
			}
			expandedTreeItems.push(...treeItemsToExpand);
			treeItemsToExpand = this.treeDataSource.expandableTreeNodes.filter(el => expandedTreeItems.indexOf(el) === -1);
		}
	}

	renderTree(container: HTMLElement): void {
		this.treeContainer = container.appendChild(DOM.$('div'));
		this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, this));
		this.treeMenus = this.instantiationService.createInstance(ConnectionBrowseTreeMenuProvider);
		const actionViewItemProvider = (action: IAction) => {
			if (action instanceof MenuItemAction) {
				return this.instantiationService.createInstance(MenuEntryActionViewItem, action);
			}
			return undefined;
		};
		const renderers: ITreeRenderer<TreeElement, any, any>[] = [
			new ProviderElementRenderer(this.treeMenus, actionViewItemProvider),
			this.instantiationService.createInstance(TreeItemRenderer, this.treeMenus, this.treeLabels, actionViewItemProvider),
			this.instantiationService.createInstance(ConnectionProfileRenderer, true),
			this.instantiationService.createInstance(ConnectionProfileGroupRenderer),
			this.instantiationService.createInstance(TreeNodeRenderer),
			new SavedConnectionsNodeRenderer()
		];

		this.model = this.instantiationService.createInstance(TreeModel);
		this.treeDataSource = new DataSource();
		this.tree = this._register(this.instantiationService.createInstance(
			WorkbenchAsyncDataTree,
			'Browser Connections',
			this.treeContainer,
			new ListDelegate(),
			renderers,
			this.treeDataSource,
			{
				identityProvider: new IdentityProvider(),
				horizontalScrolling: false,
				setRowLineHeight: false,
				transformOptimization: false,
				accessibilityProvider: new ListAccessibilityProvider()
			}) as WorkbenchAsyncDataTree<TreeModel, TreeElement>);
		this._register(this.tree.onContextMenu(e => {
			const actionContext = this.treeMenus.getActionContext(e.element);
			if (actionContext) {
				const actions = this.treeMenus.getActions(e.element);
				this.contextMenuService.showContextMenu({
					getAnchor: () => e.anchor,
					getActions: () => actions,
					getActionsContext: () => actionContext
				});
			}
		}));
		this._register(this.tree.onMouseDblClick(e => {
			this.handleTreeElementSelection(e?.element, true);
		}));

		this._register(this.tree.onDidOpen((e) => {
			this.handleTreeElementSelection(e?.element, false);
		}));

		this.tree.setInput(this.model);

		this._register(this.connectionTreeService.onDidAddProvider(() => this.tree.updateChildren(this.model)));

		// this event will be fired when connections/connection groups are created/edited
		this._register(this.connectionManagementService.onAddConnectionProfile(() => {
			this.updateSavedConnectionsNode();
		}));

		// this event will be fired when connections/connection groups are deleted
		this._register(this.connectionManagementService.onDeleteConnectionProfile(() => {
			this.updateSavedConnectionsNode();
		}));

		// this event will be fired when connection provider is registered
		// when a connection's provider is not registered (e.g. the extensions are not fully loaded or the provider extension has been uninstalled)
		// it will be displayed as 'loading...', this event will be fired when a connection's provider becomes available.
		this._register(this.capabilitiesService.onCapabilitiesRegistered(() => {
			this.updateSavedConnectionsNode();
		}));

		this._register(this.themeService.onDidColorThemeChange(async () => {
			await this.refresh();
		}));

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(CONNECTIONS_SORT_BY_CONFIG_KEY)) {
				this.updateSavedConnectionsNode();
			}
		}));

	}

	private handleTreeElementSelection(selectedNode: TreeElement, connect: boolean): void {
		if (!selectedNode) {
			return;
		}
		if ('element' in selectedNode) {
			if (selectedNode.element.command) {
				this.commandService.executeCommand(selectedNode.element.command.id, ...(selectedNode.element.command.arguments || []));
			} else {
				if (selectedNode.element.payload) {
					this._onSelectedConnectionChanged.fire(
						{
							connectionProfile: selectedNode.element.payload,
							connect: connect,
							source: 'azure'
						});
				}
			}
		} else if (selectedNode instanceof ConnectionProfile) {
			this._onSelectedConnectionChanged.fire({
				connectionProfile: selectedNode,
				connect: connect,
				source: 'savedconnections'
			});
		}
	}

	private updateSavedConnectionsNode(): void {
		if (this.model.savedConnectionNode) {
			this.tree.updateChildren(this.model.savedConnectionNode);
		}
	}

	async refresh(items?: ITreeItem[]): Promise<void> {
		if (this.tree) {
			return this.tree.updateChildren();
		}
	}

	layout(dimension: DOM.Dimension): void {
		const treeHeight = dimension.height - DOM.getTotalHeight(this.filterInput.element);
		this.treeContainer.style.width = `${dimension.width}px`;
		this.treeContainer.style.height = `${treeHeight}px`;
		this.tree.layout(treeHeight, dimension.width);
	}
}

export interface ITreeItemFromProvider {
	readonly element: ITreeItem;
	readonly treeId?: string;
	getChildren?(): Promise<ITreeItemFromProvider[]>;
}

export function instanceOfITreeItemFromProvider(obj: any): obj is ITreeItemFromProvider {
	return !!(<ITreeItemFromProvider>obj)?.element;
}

class ConnectionDialogTreeProviderElement {
	public readonly id = this.descriptor.id;
	public readonly name = this.descriptor.name;

	constructor(private readonly provider: ITreeViewDataProvider, private readonly descriptor: IConnectionTreeDescriptor) {
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItemFromProvider[]> {
		const children = await this.provider.getChildren(element);
		return children.map(v => ({
			element: v,
			treeId: this.descriptor.id,
			getChildren: () => this.getChildren(v)
		}));
	}
}

class ListDelegate implements IListVirtualDelegate<TreeElement> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(element: TreeElement): string {
		if (element instanceof ConnectionDialogTreeProviderElement) {
			return ProviderElementRenderer.TEMPLATE_ID;
		} else if (element instanceof ConnectionProfile) {
			return ServerTreeRenderer.CONNECTION_TEMPLATE_ID;
		} else if (element instanceof ConnectionProfileGroup) {
			return ConnectionProfileGroupRenderer.TEMPLATE_ID;
		} else if (element instanceof TreeNode) {
			return ServerTreeRenderer.OBJECTEXPLORER_TEMPLATE_ID;
		} else if (element instanceof SavedConnectionNode) {
			return SavedConnectionsNodeRenderer.TEMPLATE_ID;
		} else {
			return TreeItemRenderer.TREE_TEMPLATE_ID;
		}
	}
}

interface TreeElementTemplate {
	readonly icon: HTMLElement;
	readonly name: HTMLElement;
	readonly actionBar?: ActionBar;
}

abstract class BaseTreeItemRender<T> implements ITreeRenderer<T, void, TreeElementTemplate> {
	public readonly abstract templateId: string;
	protected abstract getText(element: T): string;
	protected abstract getIconClass(element: T): string;

	constructor(private menus?: ConnectionBrowseTreeMenuProvider,
		private actionViewItemProvider?: IActionViewItemProvider
	) {
	}

	renderTemplate(container: HTMLElement): TreeElementTemplate {
		const root = DOM.append(container, DOM.$('div.browse-tree-element'));
		const icon = DOM.append(root, DOM.$('.icon'));
		const name = DOM.append(root, DOM.$('.name'));
		let actionBar: ActionBar | undefined;
		if (this.menus) {
			const actionsContainer = DOM.append(root, DOM.$('.actions'));
			actionBar = new ActionBar(actionsContainer, {
				actionViewItemProvider: this.actionViewItemProvider
			});
		}
		return { name, icon, actionBar };
	}

	renderElement(element: ITreeNode<T, void>, index: number, templateData: TreeElementTemplate, height: number): void {
		templateData.name.innerText = this.getText(element.element);
		templateData.icon.classList.add('codicon', this.getIconClass(element.element));
		if (this.menus) {
			templateData.actionBar.clear();
			templateData.actionBar.context = this.menus.getActionContext(element.element);
			templateData.actionBar.push(this.menus.getActions(element.element), { icon: true, label: false });
		}
	}

	disposeTemplate(templateData: TreeElementTemplate): void {
		templateData.actionBar?.dispose();
	}
}

class ProviderElementRenderer extends BaseTreeItemRender<ConnectionDialogTreeProviderElement> {
	public static readonly TEMPLATE_ID = 'ProviderElementTemplate';
	public readonly templateId = ProviderElementRenderer.TEMPLATE_ID;

	constructor(menus: ConnectionBrowseTreeMenuProvider, actionViewItemProvider: IActionViewItemProvider) {
		super(menus, actionViewItemProvider);
	}

	getText(element: ConnectionDialogTreeProviderElement): string {
		return element.name;
	}

	getIconClass(element: ConnectionDialogTreeProviderElement): string {
		return 'codicon-folder';
	}
}

class SavedConnectionsNodeRenderer extends BaseTreeItemRender<SavedConnectionNode> {
	public static readonly TEMPLATE_ID = 'savedConnectionNode';
	public readonly templateId = SavedConnectionsNodeRenderer.TEMPLATE_ID;

	getText(element: SavedConnectionNode): string {
		return localize('savedConnections', "Saved Connections");
	}

	getIconClass(element: SavedConnectionNode): string {
		return 'codicon-folder';
	}
}

class ConnectionProfileGroupRenderer extends BaseTreeItemRender<ConnectionProfileGroup>{
	public static readonly TEMPLATE_ID = 'connectionProfileGroup';
	public readonly templateId = ConnectionProfileGroupRenderer.TEMPLATE_ID;

	getText(element: ConnectionProfileGroup): string {
		return element.name;
	}

	getIconClass(element: ConnectionProfileGroup): string {
		return 'codicon-folder';
	}
}

class IdentityProvider implements IIdentityProvider<TreeElement> {
	getId(element: TreeElement): string {
		if (element instanceof ConnectionDialogTreeProviderElement) {
			return element.id;
		} else if (element instanceof ConnectionProfile) {
			return element.id;
		} else if (element instanceof ConnectionProfileGroup) {
			return element.id!;
		} else if (element instanceof TreeNode) {
			return element.id;
		} else if (element instanceof SavedConnectionNode) {
			return element.id;
		} else {
			return element.element.handle;
		}
	}
}

class TreeModel {
	private _savedConnectionNode: SavedConnectionNode | undefined;

	constructor(
		@IConnectionTreeService private readonly connectionTreeService: IConnectionTreeService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) { }

	getChildren(): TreeElement[] {
		this._savedConnectionNode = this.instantiationService.createInstance(SavedConnectionNode);
		const descriptors = Array.from(this.connectionTreeService.descriptors);
		return [this._savedConnectionNode, ...Iterable.map(this.connectionTreeService.providers, ([id, provider]) => new ConnectionDialogTreeProviderElement(provider, descriptors.find(i => i.id === id)))];
	}

	public get savedConnectionNode(): SavedConnectionNode | undefined {
		return this._savedConnectionNode;
	}
}

class ListAccessibilityProvider implements IListAccessibilityProvider<TreeElement> {
	getAriaLabel(element: TreeElement): string {
		if (element instanceof ConnectionDialogTreeProviderElement) {
			return element.name;
		} else if (element instanceof ConnectionProfile) {
			return element.serverName;
		} else if (element instanceof ConnectionProfileGroup) {
			return element.name;
		} else if (element instanceof TreeNode) {
			return element.label;
		} else if (element instanceof SavedConnectionNode) {
			return localize('savedConnection', "Saved Connections");
		} else {
			return element.element.label.label;
		}
	}

	getWidgetAriaLabel(): string {
		return localize('connectionBrowserTree', "Connection Browser Tree");
	}
}

class DataSource implements IAsyncDataSource<TreeModel, TreeElement> {
	private _filter: string | undefined;
	private _filterRegex: RegExp | undefined;
	public setFilter(filter: string): void {
		this._filter = filter;
		this._filterRegex = new RegExp(filter, 'i');
	}

	hasChildren(element: TreeModel | TreeElement): boolean {
		if (element instanceof TreeModel) {
			return true;
		} else if (element instanceof ConnectionDialogTreeProviderElement) {
			return true;
		} else if (element instanceof ConnectionProfile) {
			return false;
		} else if (element instanceof ConnectionProfileGroup) {
			return true;
		} else if (element instanceof TreeNode) {
			return element.children.length > 0;
		} else if (element instanceof SavedConnectionNode) {
			return true;
		} else {
			return element.element.collapsibleState !== TreeItemCollapsibleState.None;
		}
	}

	public treeNodes: TreeElement[] = [];

	public get expandableTreeNodes(): TreeElement[] {
		return this.treeNodes.filter(node => {
			return (node instanceof TreeModel)
				|| (node instanceof ConnectionDialogTreeProviderElement)
				|| (node instanceof SavedConnectionNode)
				|| (node instanceof ConnectionProfileGroup)
				|| (instanceOfITreeItemFromProvider(node) && node.element.collapsibleState !== TreeItemCollapsibleState.None);
		});
	}

	async getChildren(element: TreeModel | TreeElement): Promise<Iterable<TreeElement>> {
		if (element instanceof TreeModel) {
			this.treeNodes = [];
		}
		if (!(element instanceof ConnectionProfile)) {
			let children = await element.getChildren();
			if (this._filter) {
				if ((element instanceof SavedConnectionNode) || (element instanceof ConnectionProfileGroup)) {
					children = (children as (ConnectionProfile | ConnectionProfileGroup)[]).filter(item => {
						return (item instanceof ConnectionProfileGroup) || this._filterRegex.test(item.title);
					});
				} else if (instanceOfITreeItemFromProvider(element)) {
					children = (children as ITreeItemFromProvider[]).filter(item => {
						return item.element.collapsibleState !== TreeItemCollapsibleState.None || this._filterRegex.test(item.element.label.label);
					});
				}
			}
			this.treeNodes.push(...children);
			return children;
		}
		return [];
	}
}

class SavedConnectionNode {
	public readonly id = 'SavedConnectionNode';
	private readonly dataSource: AsyncRecentConnectionTreeDataSource;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService
	) {
		this.dataSource = instantiationService.createInstance(AsyncRecentConnectionTreeDataSource);
	}

	getChildren() {
		return this.dataSource.getChildren(TreeUpdateUtils.getTreeInput(this.connectionManagementService));
	}
}

interface ITreeExplorerTemplateData {
	elementDisposable: IDisposable;
	container: HTMLElement;
	resourceLabel: IResourceLabel;
	icon: HTMLElement;
	actionBar: ActionBar;
}

class ConnectionBrowseTreeMenuProvider {
	constructor(
		@IMenuService private readonly menuService: IMenuService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService
	) {
	}

	public getActionContext(element: any): TreeViewItemHandleArg | ConnectionDialogTreeProviderElement | undefined {
		let actionContext: TreeViewItemHandleArg | ConnectionDialogTreeProviderElement | undefined;
		if (instanceOfITreeItemFromProvider(element)) {
			actionContext = <TreeViewItemHandleArg>{ $treeViewId: element.treeId, $treeItemHandle: element.element.handle, $treeItem: element.element };
		} else if (element instanceof ConnectionDialogTreeProviderElement) {
			actionContext = element;
		}
		return actionContext;
	}

	public getActions(element: any): IAction[] {
		if (!this.contextKeyService) {
			return [];
		}

		let context: ITreeItem | ConnectionDialogTreeProviderElement | undefined;
		if (instanceOfITreeItemFromProvider(element)) {
			context = element.element;
		} else if (element instanceof ConnectionDialogTreeProviderElement) {
			context = element;
		}

		if (!context) {
			return [];
		}

		const contextKeyService = context instanceof ConnectionDialogTreeProviderElement ?
			this.contextKeyService.createOverlay([['treeId', context.id]]) :
			this.contextKeyService.createOverlay([['contextValue', context.contextValue]]);
		const menu = this.menuService.createMenu(MenuId.ConnectionDialogBrowseTreeContext, contextKeyService);
		const primary: IAction[] = [];
		const secondary: IAction[] = [];
		const result = { primary, secondary };
		createAndFillInContextMenuActions(menu, { shouldForwardArgs: true }, result);

		menu.dispose();
		contextKeyService.dispose();

		return result.primary;
	}
}

class TreeItemRenderer extends Disposable implements ITreeRenderer<ITreeItemFromProvider, void, ITreeExplorerTemplateData> {
	static readonly ITEM_HEIGHT = 22;
	static readonly TREE_TEMPLATE_ID = 'treeExplorer';

	constructor(
		private menus: ConnectionBrowseTreeMenuProvider,
		private labels: ResourceLabels,
		private actionViewItemProvider: IActionViewItemProvider,
		@IThemeService private readonly themeService: IThemeService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILabelService private readonly labelService: ILabelService
	) {
		super();
	}

	get templateId(): string {
		return TreeItemRenderer.TREE_TEMPLATE_ID;
	}

	renderTemplate(container: HTMLElement): ITreeExplorerTemplateData {
		container.classList.add('custom-view-tree-node-item');

		const icon = DOM.append(container, DOM.$('.custom-view-tree-node-item-icon'));

		const resourceLabel = this.labels.create(container, { supportHighlights: true });
		const actionsContainer = DOM.append(resourceLabel.element, DOM.$('.actions'));
		const actionBar = new ActionBar(actionsContainer, {
			actionViewItemProvider: this.actionViewItemProvider
		});

		return { resourceLabel, icon, container, elementDisposable: Disposable.None, actionBar };
	}

	renderElement(element: ITreeNode<ITreeItemFromProvider, void>, index: number, templateData: ITreeExplorerTemplateData): void {
		templateData.elementDisposable.dispose();
		const node = element.element.element;
		const resource = node.resourceUri ? URI.revive(node.resourceUri) : null;
		const treeItemLabel: ITreeItemLabel | undefined = node.label ? node.label : resource ? { label: basename(resource) } : undefined;
		const description = isString(node.description) ? node.description : resource && node.description === true ? this.labelService.getUriLabel(dirname(resource), { relative: true }) : undefined;
		const label = treeItemLabel ? treeItemLabel.label : undefined;
		const icon = this.themeService.getColorTheme().type === ColorScheme.LIGHT ? node.icon : node.iconDark;
		const iconUrl = icon ? URI.revive(icon) : null;
		const title = node.tooltip ? isString(node.tooltip) ? node.tooltip : undefined : resource ? undefined : label;
		const sqlIcon = node.sqlIcon;

		// reset
		templateData.actionBar.clear();

		if (resource || this.isFileKindThemeIcon(node.themeIcon)) {
			const fileDecorations = this.configurationService.getValue<{ colors: boolean, badges: boolean }>('explorer.decorations');
			templateData.resourceLabel.setResource({ name: label, description, resource: resource ? resource : URI.parse('missing:_icon_resource') }, { fileKind: this.getFileKind(node), title, hideIcon: !!iconUrl, fileDecorations, extraClasses: ['custom-view-tree-node-item-resourceLabel'] });
		} else {
			templateData.resourceLabel.setResource({ name: label, description }, { title, hideIcon: true, extraClasses: ['custom-view-tree-node-item-resourceLabel'] });
		}

		templateData.icon.title = title ? title : '';

		if (iconUrl || sqlIcon) {
			templateData.icon.className = 'custom-view-tree-node-item-icon';
			if (sqlIcon) {
				DOM.toggleClass(templateData.icon, sqlIcon, !!sqlIcon);  // tracked change
			}
			DOM.toggleClass(templateData.icon, 'icon', !!sqlIcon);
			templateData.icon.style.backgroundImage = iconUrl ? DOM.asCSSUrl(iconUrl) : '';
		} else {
			let iconClass: string | undefined;
			if (node.themeIcon && !this.isFileKindThemeIcon(node.themeIcon)) {
				iconClass = ThemeIcon.asClassName(node.themeIcon);
			}
			templateData.icon.className = iconClass ? `custom-view-tree-node-item-icon ${iconClass}` : '';
			templateData.icon.style.backgroundImage = '';
		}

		templateData.actionBar.context = this.menus.getActionContext(element.element);
		templateData.actionBar.push(this.menus.getActions(element.element), { icon: true, label: false });
	}

	private isFileKindThemeIcon(icon: ThemeIcon | undefined): boolean {
		if (icon) {
			return icon.id === FileThemeIcon.id || icon.id === FolderThemeIcon.id;
		} else {
			return false;
		}
	}

	private getFileKind(node: ITreeItem): FileKind {
		if (node.themeIcon) {
			switch (node.themeIcon.id) {
				case FileThemeIcon.id:
					return FileKind.FILE;
				case FolderThemeIcon.id:
					return FileKind.FOLDER;
			}
		}
		return node.collapsibleState === TreeItemCollapsibleState.Collapsed || node.collapsibleState === TreeItemCollapsibleState.Expanded ? FileKind.FOLDER : FileKind.FILE;
	}

	disposeElement(resource: ITreeNode<ITreeItemFromProvider, void>, index: number, templateData: ITreeExplorerTemplateData): void {
		templateData.elementDisposable.dispose();
	}

	disposeTemplate(templateData: ITreeExplorerTemplateData): void {
		templateData.resourceLabel.dispose();
		templateData.actionBar.dispose();
		templateData.elementDisposable.dispose();
	}
}
