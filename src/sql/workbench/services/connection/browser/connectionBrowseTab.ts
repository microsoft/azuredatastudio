/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/connectionBrowseTab';
import { IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { ITreeItem } from 'sql/workbench/common/views';
import { IConnectionTreeDescriptor, IConnectionTreeService } from 'sql/workbench/services/connection/common/connectionTreeService';
import * as DOM from 'vs/base/browser/dom';
import { IIdentityProvider, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { IAsyncDataSource, ITreeMouseEvent, ITreeNode, ITreeRenderer } from 'vs/base/browser/ui/tree/tree';
import { Iterable } from 'vs/base/common/iterator';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { basename, dirname } from 'vs/base/common/resources';
import { isString } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { FileKind } from 'vs/platform/files/common/files';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILabelService } from 'vs/platform/label/common/label';
import { WorkbenchAsyncDataTree } from 'vs/platform/list/browser/listService';
import { FileThemeIcon, FolderThemeIcon, IThemeService, LIGHT, ThemeIcon } from 'vs/platform/theme/common/themeService';
import { IResourceLabel, ResourceLabels } from 'vs/workbench/browser/labels';
import { ITreeItemLabel, ITreeViewDataProvider, TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { Emitter, Event } from 'vs/base/common/event';
import { AsyncRecentConnectionTreeDataSource } from 'sql/workbench/services/objectExplorer/browser/asyncRecentConnectionTreeDataSource';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ServerTreeRenderer } from 'sql/workbench/services/objectExplorer/browser/serverTreeRenderer';
import { ConnectionProfileGroupRenderer, ConnectionProfileRenderer, TreeNodeRenderer } from 'sql/workbench/services/objectExplorer/browser/asyncServerTreeRenderer';

export type TreeElement = ConnectionProviderElement | ITreeItemFromProvider | SavedConnectionNode | ServerTreeElement;

export class ConnectionBrowseTab implements IPanelTab {
	public readonly title = localize('connectionDialog.browser', "Browse");
	public readonly identifier = 'connectionBrowse';
	public readonly view = this.instantiationService.createInstance(ConnectionBrowserView);
	constructor(@IInstantiationService private readonly instantiationService: IInstantiationService) { }
}

export class ConnectionBrowserView extends Disposable implements IPanelView {
	private tree: WorkbenchAsyncDataTree<TreeModel, TreeElement> | undefined;
	private model: TreeModel | undefined;
	private treeLabels: ResourceLabels | undefined;
	public onDidChangeVisibility = Event.None;

	private readonly _onSelect = this._register(new Emitter<ITreeMouseEvent<TreeElement>>());
	public readonly onSelect = this._onSelect.event;

	private readonly _onDblClick = this._register(new Emitter<ITreeMouseEvent<TreeElement>>());
	public readonly onDblClick = this._onDblClick.event;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConnectionTreeService private readonly connectionTreeService: IConnectionTreeService
	) {
		super();
		this.connectionTreeService.setView(this);
	}

	render(container: HTMLElement): void {

		this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, this));
		const renderers: ITreeRenderer<TreeElement, any, any>[] = [
			new ProviderElementRenderer(),
			this.instantiationService.createInstance(TreeItemRenderer, this.treeLabels),
			this.instantiationService.createInstance(ConnectionProfileRenderer, true),
			this.instantiationService.createInstance(ConnectionProfileGroupRenderer),
			this.instantiationService.createInstance(TreeNodeRenderer),
			new SavedConnectionsNodeRenderer()
		];

		this.model = this.instantiationService.createInstance(TreeModel);

		this.tree = this._register(this.instantiationService.createInstance(
			WorkbenchAsyncDataTree,
			'Browser Connections',
			container,
			new ListDelegate(),
			renderers,
			new DataSource(),
			{
				identityProvider: new IdentityProvider(),
				horizontalScrolling: false,
				setRowLineHeight: false,
				transformOptimization: false,
				accessibilityProvider: new ListAccessibilityProvider()
			}) as WorkbenchAsyncDataTree<TreeModel, TreeElement>);

		this.tree.onMouseDblClick(e => this._onDblClick.fire(e));
		this.tree.onMouseClick(e => this._onSelect.fire(e));

		this.tree.setInput(this.model);

		this._register(this.connectionTreeService.onDidAddProvider(() => this.tree.updateChildren(this.model)));
	}

	async refresh(items?: ITreeItem[]): Promise<void> {
		if (this.tree) {
			if (items) {
				for (const item of items) {
					await this.tree.updateChildren({ element: item });
				}
			} else {
				return this.tree.updateChildren();
			}
		}
	}

	layout(dimension: DOM.Dimension): void {
		this.tree.layout(dimension.height, dimension.width);
	}

	focus(): void {
		this.tree.domFocus();
	}
}

export interface ITreeItemFromProvider {
	readonly element: ITreeItem;
	getChildren?(): Promise<ITreeItemFromProvider[]>
}

class ConnectionProviderElement {
	public readonly id = this.descriptor.id;
	public readonly name = this.descriptor.name;

	constructor(private readonly provider: ITreeViewDataProvider, private readonly descriptor: IConnectionTreeDescriptor) {
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItemFromProvider[]> {
		const children = await this.provider.getChildren(element);
		return children.map(v => ({
			element: v,
			getChildren: () => this.getChildren(v)
		}));
	}
}

class ListDelegate implements IListVirtualDelegate<TreeElement> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(element: TreeElement): string {
		if (element instanceof ConnectionProviderElement) {
			return ProviderElementRenderer.TEMPLATE_ID;
		} else if (element instanceof ConnectionProfile) {
			return ServerTreeRenderer.CONNECTION_TEMPLATE_ID;
		} else if (element instanceof ConnectionProfileGroup) {
			return ServerTreeRenderer.CONNECTION_GROUP_TEMPLATE_ID;
		} else if (element instanceof TreeNode) {
			return ServerTreeRenderer.OBJECTEXPLORER_TEMPLATE_ID;
		} else if (element instanceof SavedConnectionNode) {
			return SavedConnectionsNodeRenderer.TEMPLATE_ID;
		} else {
			return TreeItemRenderer.TREE_TEMPLATE_ID;
		}
	}
}

interface ProviderElementTemplate {
	readonly icon: HTMLElement;
	readonly name: HTMLElement;
}

class ProviderElementRenderer implements ITreeRenderer<ConnectionProviderElement, void, ProviderElementTemplate> {
	public static readonly TEMPLATE_ID = 'ProviderElementTemplate';
	public readonly templateId = ProviderElementRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ProviderElementTemplate {
		const icon = DOM.append(container, DOM.$('.icon'));
		const name = DOM.append(container, DOM.$('.name'));
		return { name, icon };
	}

	renderElement(element: ITreeNode<ConnectionProviderElement, void>, index: number, templateData: ProviderElementTemplate, height: number): void {
		templateData.name.innerText = element.element.name;
	}

	disposeTemplate(templateData: ProviderElementTemplate): void {
	}
}

interface SavedConnectionNodeElementTemplate {
	readonly icon: HTMLElement;
	readonly name: HTMLElement;
}

class SavedConnectionsNodeRenderer implements ITreeRenderer<ConnectionProviderElement, void, SavedConnectionNodeElementTemplate> {
	public static readonly TEMPLATE_ID = 'savedConnectionNode';
	public readonly templateId = SavedConnectionsNodeRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): SavedConnectionNodeElementTemplate {
		const icon = DOM.append(container, DOM.$('.icon'));
		const name = DOM.append(container, DOM.$('.name'));
		return { name, icon };
	}

	renderElement(element: ITreeNode<ConnectionProviderElement, void>, index: number, templateData: SavedConnectionNodeElementTemplate, height: number): void {
		templateData.name.innerText = localize('savedConnections', "Saved Connections");
	}

	disposeTemplate(templateData: SavedConnectionNodeElementTemplate): void {
	}
}

class IdentityProvider implements IIdentityProvider<TreeElement> {
	getId(element: TreeElement): string {
		if (element instanceof ConnectionProviderElement) {
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

	constructor(
		@IConnectionTreeService private readonly connectionTreeService: IConnectionTreeService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) { }

	getChildren(): TreeElement[] {
		const descriptors = Array.from(this.connectionTreeService.descriptors);
		return [this.instantiationService.createInstance(SavedConnectionNode), ...Iterable.map(this.connectionTreeService.providers, ([id, provider]) => new ConnectionProviderElement(provider, descriptors.find(i => i.id === id)))];
	}
}

class ListAccessibilityProvider implements IListAccessibilityProvider<TreeElement> {
	getAriaLabel(element: TreeElement): string {
		if (element instanceof ConnectionProviderElement) {
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
			return element.element.handle;
		}
	}

	getWidgetAriaLabel(): string {
		return localize('connectionBrowserTree', "Connection Browser Tree");
	}
}

class DataSource implements IAsyncDataSource<TreeModel, TreeElement> {
	hasChildren(element: TreeModel | TreeElement): boolean {
		if (element instanceof TreeModel) {
			return true;
		} else if (element instanceof ConnectionProviderElement) {
			return true;
		} else if (element instanceof ConnectionProfile) {
			return false;
		} else if (element instanceof ConnectionProfileGroup) {
			return element.hasChildren();
		} else if (element instanceof TreeNode) {
			return element.children.length > 0;
		} else if (element instanceof SavedConnectionNode) {
			return true;
		} else {
			return element.element.collapsibleState !== TreeItemCollapsibleState.None;
		}
	}

	getChildren(element: TreeModel | TreeElement): Iterable<TreeElement> | Promise<Iterable<TreeElement>> {
		if (!(element instanceof ConnectionProfile)) {
			return element.getChildren();
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
	// actionBar: ActionBar;
}

class TreeItemRenderer extends Disposable implements ITreeRenderer<ITreeItemFromProvider, void, ITreeExplorerTemplateData> {
	static readonly ITEM_HEIGHT = 22;
	static readonly TREE_TEMPLATE_ID = 'treeExplorer';

	// private _actionRunner: MultipleSelectionActionRunner | undefined;

	constructor(
		// private treeViewId: string,
		// private menus: TreeMenus,
		private labels: ResourceLabels,
		// private actionViewItemProvider: IActionViewItemProvider,
		// private aligner: Aligner,
		@IThemeService private readonly themeService: IThemeService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILabelService private readonly labelService: ILabelService
	) {
		super();
	}

	get templateId(): string {
		return TreeItemRenderer.TREE_TEMPLATE_ID;
	}

	// set actionRunner(actionRunner: MultipleSelectionActionRunner) {
	// 	this._actionRunner = actionRunner;
	// }

	renderTemplate(container: HTMLElement): ITreeExplorerTemplateData {
		DOM.addClass(container, 'custom-view-tree-node-item');

		const icon = DOM.append(container, DOM.$('.custom-view-tree-node-item-icon'));

		const resourceLabel = this.labels.create(container, { supportHighlights: true });
		// const actionsContainer = DOM.append(resourceLabel.element, DOM.$('.actions'));
		// const actionBar = new ActionBar(actionsContainer, {
		// 	actionViewItemProvider: this.actionViewItemProvider
		// });

		return { resourceLabel, icon, container, elementDisposable: Disposable.None };
	}

	renderElement(element: ITreeNode<ITreeItemFromProvider, void>, index: number, templateData: ITreeExplorerTemplateData): void {
		templateData.elementDisposable.dispose();
		const node = element.element.element;
		const resource = node.resourceUri ? URI.revive(node.resourceUri) : null;
		const treeItemLabel: ITreeItemLabel | undefined = node.label ? node.label : resource ? { label: basename(resource) } : undefined;
		const description = isString(node.description) ? node.description : resource && node.description === true ? this.labelService.getUriLabel(dirname(resource), { relative: true }) : undefined;
		const label = treeItemLabel ? treeItemLabel.label : undefined;
		const icon = this.themeService.getColorTheme().type === LIGHT ? node.icon : node.iconDark;
		const iconUrl = icon ? URI.revive(icon) : null;
		const title = node.tooltip ? isString(node.tooltip) ? node.tooltip : undefined : resource ? undefined : label;
		const sqlIcon = node.sqlIcon;

		// reset
		// templateData.actionBar.clear();

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

		// templateData.actionBar.context = <TreeViewItemHandleArg>{ $treeViewId: this.treeViewId, $treeItemHandle: node.handle };
		// templateData.actionBar.push(this.menus.getResourceActions(node), { icon: true, label: false });
		// if (this._actionRunner) {
		// 	templateData.actionBar.actionRunner = this._actionRunner;
		// }
		this.setAlignment(templateData.container, node);
		templateData.elementDisposable = (this.themeService.onDidFileIconThemeChange(() => this.setAlignment(templateData.container, node)));
	}

	private setAlignment(container: HTMLElement, treeItem: ITreeItem) {
		// DOM.toggleClass(container.parentElement!, 'align-icon-with-twisty', this.aligner.alignIconWithTwisty(treeItem));
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
		// templateData.resourceLabel.dispose();
		// templateData.actionBar.dispose();
		templateData.elementDisposable.dispose();
	}
}
