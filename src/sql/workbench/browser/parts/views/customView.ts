/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDataSource, ITree, IRenderer, ContextMenuEvent } from 'vs/base/parts/tree/browser/tree';
import { ViewContainer, TreeItemCollapsibleState, ITreeView, ITreeViewDataProvider, TreeViewItemHandleArg, ITreeItem as vsITreeItem } from 'vs/workbench/common/views';
import { TPromise } from 'vs/base/common/winjs.base';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { FileIconThemableWorkbenchTree } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { Emitter, Event } from 'vs/base/common/event';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import * as DOM from 'vs/base/browser/dom';
import * as errors from 'vs/base/common/errors';
import { IAction, ActionRunner } from 'vs/base/common/actions';
import { MenuItemAction, IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { ContextAwareMenuItemActionItem, fillInContextMenuActions } from 'vs/platform/actions/browser/menuItemActionItem';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IActionItemProvider, ActionBar, ActionItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { URI } from 'vs/base/common/uri';
import { LIGHT, FileThemeIcon, FolderThemeIcon } from 'vs/platform/theme/common/themeService';
import { basename } from 'vs/base/common/paths';
import { ResourceLabel } from 'vs/workbench/browser/labels';
import { FileKind } from 'vs/platform/files/common/files';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { WorkbenchTreeController } from 'vs/platform/list/browser/listService';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { deepClone } from 'vs/base/common/objects';
import { equalsIgnoreCase } from 'vs/base/common/strings';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IProgressService2 } from 'vs/platform/progress/common/progress';

import { IOEShimService } from 'sql/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { ITreeItem } from 'sql/workbench/common/views';

class Root implements ITreeItem {
	constructor(public readonly childProvider: string) { }
	label = {
		label: 'root'
	};
	handle = '0';
	parentHandle = null;
	collapsibleState = TreeItemCollapsibleState.Expanded;
	children = void 0;
}

export class CustomTreeView extends Disposable implements ITreeView {

	private isVisible: boolean = false;
	private activated: boolean = false;
	private _hasIconForParentNode = false;
	private _hasIconForLeafNode = false;

	private treeContainer: HTMLElement;
	private tree: FileIconThemableWorkbenchTree;
	private root: ITreeItem;
	private elementsToRefresh: ITreeItem[] = [];

	private _dataProvider: ITreeViewDataProvider;

	private _onDidExpandItem: Emitter<ITreeItem> = this._register(new Emitter<ITreeItem>());
	readonly onDidExpandItem: Event<ITreeItem> = this._onDidExpandItem.event;

	private _onDidCollapseItem: Emitter<ITreeItem> = this._register(new Emitter<ITreeItem>());
	readonly onDidCollapseItem: Event<ITreeItem> = this._onDidCollapseItem.event;

	private _onDidChangeSelection: Emitter<ITreeItem[]> = this._register(new Emitter<ITreeItem[]>());
	readonly onDidChangeSelection: Event<ITreeItem[]> = this._onDidChangeSelection.event;

	private _onDidChangeVisibility: Emitter<boolean> = this._register(new Emitter<boolean>());
	readonly onDidChangeVisibility: Event<boolean> = this._onDidChangeVisibility.event;

	private _onDidChangeActions: Emitter<void> = this._register(new Emitter<void>());
	readonly onDidChangeActions: Event<void> = this._onDidChangeActions.event;

	public showCollapseAllAction: boolean = false;
	public message = undefined;

	constructor(
		private id: string,
		private container: ViewContainer,
		@IExtensionService private extensionService: IExtensionService,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IWorkbenchThemeService private themeService: IWorkbenchThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@ICommandService private commandService: ICommandService,
		@IConfigurationService private configurationService: IConfigurationService
	) {
		super();
		this.root = new Root(id);
		this._register(this.themeService.onDidFileIconThemeChange(() => this.doRefresh([this.root]) /** soft refresh **/));
		this._register(this.themeService.onThemeChange(() => this.doRefresh([this.root]) /** soft refresh **/));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('explorer.decorations')) {
				this.doRefresh([this.root]); /** soft refresh **/
			}
		}));
	}

	get dataProvider(): ITreeViewDataProvider {
		return this._dataProvider;
	}

	set dataProvider(dataProvider: ITreeViewDataProvider) {
	}

	get hasIconForParentNode(): boolean {
		return this._hasIconForParentNode;
	}

	get hasIconForLeafNode(): boolean {
		return this._hasIconForLeafNode;
	}

	get visible(): boolean {
		return this.isVisible;
	}

	expand(itemOrItems: ITreeItem | ITreeItem[]): Thenable<void> {
		if (this.tree) {
			itemOrItems = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
			return this.tree.expandAll(itemOrItems);
		}
		return Promise.arguments(null);
	}

	setSelection(items: ITreeItem[]): void {
		if (this.tree) {
			this.tree.setSelection(items, { source: 'api' });
		}
	}

	setFocus(item: ITreeItem): void {
		if (this.tree) {
			this.focus();
			this.tree.setFocus(item);
		}
	}

	getPrimaryActions(): IAction[] {
		return [];
	}

	getSecondaryActions(): IAction[] {
		return [];
	}

	setVisibility(isVisible: boolean): void {
		isVisible = !!isVisible;
		if (this.isVisible === isVisible) {
			return;
		}

		this.isVisible = isVisible;
		if (this.isVisible) {
			this.activate();
		}

		if (this.tree) {
			if (this.isVisible) {
				DOM.show(this.tree.getHTMLElement());
			} else {
				DOM.hide(this.tree.getHTMLElement()); // make sure the tree goes out of the tabindex world by hiding it
			}

			if (this.isVisible) {
				this.tree.onVisible();
			} else {
				this.tree.onHidden();
			}

			if (this.isVisible && this.elementsToRefresh.length) {
				this.doRefresh(this.elementsToRefresh);
				this.elementsToRefresh = [];
			}
		}

		this._onDidChangeVisibility.fire(this.isVisible);
	}

	focus(): void {
		if (this.tree) {
			// Make sure the current selected element is revealed
			const selectedElement = this.tree.getSelection()[0];
			if (selectedElement) {
				this.tree.reveal(selectedElement, 0.5).then(null, errors.onUnexpectedError);
			}

			// Pass Focus to Viewer
			this.tree.domFocus();
		}
	}

	show(container: HTMLElement): void {
		if (!this.tree) {
			this.createTree();
		}
		DOM.append(container, this.treeContainer);
	}

	private createTree() {
		this.treeContainer = DOM.$('.tree-explorer-viewlet-tree-view');
		const actionItemProvider = (action: IAction) => action instanceof MenuItemAction ? this.instantiationService.createInstance(ContextAwareMenuItemActionItem, action) : undefined;

		const servicesCollection: ServiceCollection = new ServiceCollection();
		const scopedContext = this.contextKeyService.createScoped();
		scopedContext.createKey('viewlet', 'dataExplorer');
		servicesCollection.set(IContextKeyService, scopedContext);
		const menuinstant = this.instantiationService.createChild(servicesCollection);

		const menus = menuinstant.createInstance(TreeMenus, this.id);
		const dataSource = this.instantiationService.createInstance(TreeDataSource, this.container);
		const renderer = this.instantiationService.createInstance(TreeRenderer, this.id, menus, actionItemProvider);
		const controller = this.instantiationService.createInstance(TreeController, this.id, menus);
		this.tree = this.instantiationService.createInstance(FileIconThemableWorkbenchTree, this.treeContainer, { dataSource, renderer, controller }, {});
		this.tree.contextKeyService.createKey<boolean>(this.id, true);
		this._register(this.tree);
		this._register(this.tree.onDidChangeSelection(e => this.onSelection(e)));
		this._register(this.tree.onDidExpandItem(e => this._onDidExpandItem.fire(e.item.getElement())));
		this._register(this.tree.onDidCollapseItem(e => this._onDidCollapseItem.fire(e.item.getElement())));
		this._register(this.tree.onDidChangeSelection(e => this._onDidChangeSelection.fire(e.selection)));
		this.tree.setInput(this.root);
	}

	layout(size: number) {
		if (this.tree) {
			this.treeContainer.style.height = size + 'px';
			this.tree.layout(size);
		}
	}

	getOptimalWidth(): number {
		if (this.tree) {
			const parentNode = this.tree.getHTMLElement();
			const childNodes = [].slice.call(parentNode.querySelectorAll('.outline-item-label > a'));
			return DOM.getLargestChildWidth(parentNode, childNodes);
		}
		return 0;
	}

	refresh(elements?: ITreeItem[]): Promise<void> {
		if (this.tree) {
			elements = elements || [this.root];
			for (const element of elements) {
				element.children = null; // reset children
			}
			if (this.isVisible) {
				return this.doRefresh(elements);
			} else {
				this.elementsToRefresh.push(...elements);
			}
		}
		return Promise.resolve(null);
	}

	reveal(item: ITreeItem, parentChain?: ITreeItem[], options?: { select?: boolean, focus?: boolean }): Thenable<void> {
		if (this.tree && this.isVisible) {
			options = options ? options : { select: false, focus: false };
			const select = isUndefinedOrNull(options.select) ? false : options.select;
			const focus = isUndefinedOrNull(options.focus) ? false : options.focus;

			const root: Root = this.tree.getInput();
			const promise = root.children ? Promise.resolve(null) : this.refresh(); // Refresh if root is not populated
			return promise.then(() => {
				var result = TPromise.as(null);
				if (parentChain) {
					parentChain.forEach((e) => {
						result = result.then(() => this.tree.expand(e));
					});
				}
				return result.then(() => this.tree.reveal(item))
					.then(() => {
						if (select) {
							this.tree.setSelection([item], { source: 'api' });
						}
						if (focus) {
							this.focus();
							this.tree.setFocus(item);
						}
					});
			});
		}
		return Promise.resolve(null);
	}

	private activate() {
		if (!this.activated) {
			this.extensionService.activateByEvent(`onView:${this.id}`);
			this.activated = true;
		}
	}

	private doRefresh(elements: ITreeItem[]): Promise<void> {
		if (this.tree) {
			return Promise.all(elements.map(e => this.tree.refresh(e))).then(() => null);
		}
		return Promise.resolve(null);
	}

	private onSelection({ payload }: any): void {
		if (payload && (!!payload.didClickOnTwistie || payload.source === 'api')) {
			return;
		}
		const selection: ITreeItem = this.tree.getSelection()[0];
		if (selection) {
			if (selection.command) {
				const originalEvent: KeyboardEvent | MouseEvent = payload && payload.originalEvent;
				const isMouseEvent = payload && payload.origin === 'mouse';
				const isDoubleClick = isMouseEvent && originalEvent && originalEvent.detail === 2;

				if (!isMouseEvent || this.tree.openOnSingleClick || isDoubleClick) {
					this.commandService.executeCommand(selection.command.id, ...(selection.command.arguments || []));
				}
			}
		}
	}
}

class TreeDataSource implements IDataSource {

	constructor(
		private container: ViewContainer,
		@IProgressService2 private progressService: IProgressService2,
		@IOEShimService private objectExplorerService: IOEShimService
	) {
	}

	getId(tree: ITree, node: ITreeItem): string {
		return node.handle;
	}

	hasChildren(tree: ITree, node: ITreeItem): boolean {
		return this.objectExplorerService.providerExists(node.childProvider) && node.collapsibleState !== TreeItemCollapsibleState.None;
	}

	getChildren(tree: ITree, node: ITreeItem): TPromise<any[]> {
		if (this.objectExplorerService.providerExists(node.childProvider)) {
			return TPromise.wrap(this.progressService.withProgress({ location: this.container.id }, () => {
				// this is replicating what vscode does when calling initial children
				if (node instanceof Root) {
					node = deepClone(node);
					node.handle = undefined;
				}
				// we need to pass this as a parameter mainly to maintain sessions
				// hopefully we don't need anything like this when we remove the shim
				return this.objectExplorerService.getChildren(node, this);
			}));
		}
		return TPromise.as([]);
	}

	shouldAutoexpand(tree: ITree, node: ITreeItem): boolean {
		return node.collapsibleState === TreeItemCollapsibleState.Expanded;
	}

	getParent(tree: ITree, node: any): TPromise<any> {
		return TPromise.as(null);
	}
}

interface ITreeExplorerTemplateData {
	resourceLabel: ResourceLabel;
	icon: HTMLElement;
	actionBar: ActionBar;
	aligner: Aligner;
}

class TreeRenderer implements IRenderer {

	private static readonly ITEM_HEIGHT = 22;
	private static readonly TREE_TEMPLATE_ID = 'treeExplorer';
	private static readonly MSSQL_TREE_TEMPLATE_ID = 'mssqltreeExplorer';

	constructor(
		private treeViewId: string,
		private menus: TreeMenus,
		private actionItemProvider: IActionItemProvider,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IWorkbenchThemeService private themeService: IWorkbenchThemeService,
		@IConfigurationService private configurationService: IConfigurationService,
	) {
	}

	getHeight(tree: ITree, element: any): number {
		return TreeRenderer.ITEM_HEIGHT;
	}

	getTemplateId(tree: ITree, element: ITreeItem): string {
		return equalsIgnoreCase(element.providerHandle, 'mssql') ? TreeRenderer.MSSQL_TREE_TEMPLATE_ID : TreeRenderer.TREE_TEMPLATE_ID;
	}

	renderTemplate(tree: ITree, templateId: string, container: HTMLElement): ITreeExplorerTemplateData {
		DOM.addClass(container, 'custom-view-tree-node-item');

		const icon = DOM.append(container, DOM.$('.custom-view-tree-node-item-icon'));
		const resourceLabel = this.instantiationService.createInstance(ResourceLabel, container, {});
		DOM.addClass(resourceLabel.element, 'custom-view-tree-node-item-resourceLabel');
		const actionsContainer = DOM.append(resourceLabel.element, DOM.$('.actions'));
		const actionBar = new ActionBar(actionsContainer, {
			actionItemProvider: this.actionItemProvider,
			actionRunner: new MultipleSelectionActionRunner(() => tree.getSelection())
		});

		return { resourceLabel, icon, actionBar, aligner: new Aligner(container, tree, this.themeService) };
	}

	renderElement(tree: ITree, node: ITreeItem, templateId: string, templateData: ITreeExplorerTemplateData): void {
		const resource = node.resourceUri ? URI.revive(node.resourceUri) : null;
		const label = node.label ? node.label.label : resource ? basename(resource.path) : '';
		let icon = this.themeService.getTheme().type === LIGHT ? node.icon.path : node.iconDark.path;
		const title = node.tooltip ? node.tooltip : resource ? void 0 : label;

		// reset
		templateData.resourceLabel.clear();
		templateData.actionBar.clear();

		if ((resource || node.themeIcon) && !icon) {
			const fileDecorations = this.configurationService.getValue<{ colors: boolean, badges: boolean }>('explorer.decorations');
			templateData.resourceLabel.setLabel({ name: label, resource: resource ? resource : URI.parse('_icon_resource') }, { fileKind: this.getFileKind(node), title, fileDecorations: fileDecorations, extraClasses: ['custom-view-tree-node-item-resourceLabel'] });
		} else {
			templateData.resourceLabel.setLabel({ name: label }, { title, hideIcon: true, extraClasses: ['custom-view-tree-node-item-resourceLabel'] });
		}

		if (templateId === TreeRenderer.TREE_TEMPLATE_ID) {
			templateData.icon.style.backgroundImage = icon ? `url('${icon}')` : '';
		} else {
			DOM.addClass(templateData.icon, 'icon');
			DOM.addClass(templateData.icon, icon);
		}
		DOM.toggleClass(templateData.icon, 'custom-view-tree-node-item-icon', !!icon);
		templateData.actionBar.context = (<TreeViewItemHandleArg>{ $treeViewId: this.treeViewId, $treeItemHandle: node.handle });
		templateData.actionBar.push(this.menus.getResourceActions(node), { icon: true, label: false });

		templateData.aligner.treeItem = node;
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

	disposeTemplate(tree: ITree, templateId: string, templateData: ITreeExplorerTemplateData): void {
		templateData.resourceLabel.dispose();
		templateData.actionBar.dispose();
		templateData.aligner.dispose();
	}
}

class Aligner extends Disposable {

	private _treeItem: ITreeItem;

	constructor(
		private container: HTMLElement,
		private tree: ITree,
		private themeService: IWorkbenchThemeService
	) {
		super();
		this._register(this.themeService.onDidFileIconThemeChange(() => this.render()));
	}

	set treeItem(treeItem: ITreeItem) {
		this._treeItem = treeItem;
		this.render();
	}

	private render(): void {
		if (this._treeItem) {
			DOM.toggleClass(this.container, 'align-icon-with-twisty', this.hasToAlignIconWithTwisty());
		}
	}

	private hasToAlignIconWithTwisty(): boolean {
		if (this._treeItem.collapsibleState !== TreeItemCollapsibleState.None) {
			return false;
		}
		if (!this.hasIcon(this._treeItem)) {
			return false;

		}
		const parent: ITreeItem = this.tree.getNavigator(this._treeItem).parent() || this.tree.getInput();
		if (this.hasIcon(parent)) {
			return false;
		}
		return parent.children && parent.children.every(c => c.collapsibleState === TreeItemCollapsibleState.None || !this.hasIcon(c));
	}

	private hasIcon(node: vsITreeItem): boolean {
		const icon = this.themeService.getTheme().type === LIGHT ? node.icon : node.iconDark;
		if (icon) {
			return true;
		}
		if (node.resourceUri || node.themeIcon) {
			const fileIconTheme = this.themeService.getFileIconTheme();
			const isFolder = node.themeIcon ? node.themeIcon.id === FolderThemeIcon.id : node.collapsibleState !== TreeItemCollapsibleState.None;
			if (isFolder) {
				return fileIconTheme.hasFileIcons && fileIconTheme.hasFolderIcons;
			}
			return fileIconTheme.hasFileIcons;
		}
		return false;
	}
}

class TreeController extends WorkbenchTreeController {

	constructor(
		private treeViewId: string,
		private menus: TreeMenus,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super({}, configurationService);
	}

	protected shouldToggleExpansion(element: ITreeItem, event: IMouseEvent, origin: string): boolean {
		return element.command ? this.isClickOnTwistie(event) : super.shouldToggleExpansion(element, event, origin);
	}

	onContextMenu(tree: ITree, node: ITreeItem, event: ContextMenuEvent): boolean {
		event.preventDefault();
		event.stopPropagation();

		tree.setFocus(node);
		const actions = this.menus.getResourceContextActions(node);
		if (!actions.length) {
			return true;
		}
		const anchor = { x: event.posx, y: event.posy };
		this.contextMenuService.showContextMenu({
			getAnchor: () => anchor,

			getActions: () => actions,

			getActionItem: (action) => {
				const keybinding = this._keybindingService.lookupKeybinding(action.id);
				if (keybinding) {
					return new ActionItem(action, action, { label: true, keybinding: keybinding.getLabel() });
				}
				return null;
			},

			onHide: (wasCancelled?: boolean) => {
				if (wasCancelled) {
					tree.domFocus();
				}
			},

			getActionsContext: () => (<TreeViewItemHandleArg>{ $treeViewId: this.treeViewId, $treeItemHandle: node.handle }),

			actionRunner: new MultipleSelectionActionRunner(() => tree.getSelection())
		});

		return true;
	}
}

class MultipleSelectionActionRunner extends ActionRunner {

	constructor(private getSelectedResources: () => any[]) {
		super();
	}

	runAction(action: IAction, context: any): TPromise<any> {
		if (action instanceof MenuItemAction) {
			const selection = this.getSelectedResources();
			const filteredSelection = selection.filter(s => s !== context);

			if (selection.length === filteredSelection.length || selection.length === 1) {
				return action.run(context);
			}

			return action.run(context, ...filteredSelection);
		}

		return super.runAction(action, context);
	}
}

class TreeMenus extends Disposable implements IDisposable {

	constructor(
		private id: string,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IMenuService private menuService: IMenuService,
		@IContextMenuService private contextMenuService: IContextMenuService
	) {
		super();
	}

	getResourceActions(element: ITreeItem): IAction[] {
		return this.getActions(MenuId.ViewItemContext, { key: 'viewItem', value: element.contextValue }).primary;
	}

	getResourceContextActions(element: ITreeItem): IAction[] {
		return this.getActions(MenuId.ViewItemContext, { key: 'viewItem', value: element.contextValue }).secondary;
	}

	private getActions(menuId: MenuId, context: { key: string, value: string }): { primary: IAction[]; secondary: IAction[]; } {
		const contextKeyService = this.contextKeyService.createScoped();
		contextKeyService.createKey('view', this.id);
		contextKeyService.createKey(context.key, context.value);

		const menu = this.menuService.createMenu(menuId, contextKeyService);
		const primary: IAction[] = [];
		const secondary: IAction[] = [];
		const result = { primary, secondary };
		fillInContextMenuActions(menu, { shouldForwardArgs: true }, result, this.contextMenuService, g => /^inline/.test(g));

		menu.dispose();
		contextKeyService.dispose();

		return result;
	}
}
