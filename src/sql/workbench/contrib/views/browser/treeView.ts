/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { IDisposable, Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IAction, ActionRunner } from 'vs/base/common/actions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IMenuService, MenuId, MenuItemAction, registerAction2, Action2, SubmenuItemAction, MenuRegistry, IMenu } from 'vs/platform/actions/common/actions';
import { MenuEntryActionViewItem, createAndFillInContextMenuActions, SubmenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IContextKeyService, ContextKeyExpr, ContextKeyEqualsExpr, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { TreeItemCollapsibleState, ITreeViewDataProvider, TreeViewItemHandleArg, ITreeItemLabel, IViewDescriptorService, ViewContainer, ViewContainerLocation, IViewBadge, ResolvableTreeItem, TreeCommand } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import * as DOM from 'vs/base/browser/dom';
import { ResourceLabels, IResourceLabel } from 'vs/workbench/browser/labels';
import { ActionBar, IActionViewItemProvider } from 'vs/base/browser/ui/actionbar/actionbar';
import { URI } from 'vs/base/common/uri';
import { dirname, basename } from 'vs/base/common/resources';
import { FileThemeIcon, FolderThemeIcon, registerThemingParticipant, IThemeService } from 'vs/platform/theme/common/themeService';
import { FileKind } from 'vs/platform/files/common/files';
import { WorkbenchAsyncDataTree } from 'vs/platform/list/browser/listService';
import { localize } from 'vs/nls';
import { timeout } from 'vs/base/common/async';
import { textLinkForeground, textCodeBlockBackground, focusBorder, listFilterMatchHighlight, listFilterMatchHighlightBorder } from 'vs/platform/theme/common/colorRegistry';
import { isString } from 'vs/base/common/types';
import { ILabelService } from 'vs/platform/label/common/label';
import { IListVirtualDelegate, IIdentityProvider } from 'vs/base/browser/ui/list/list';
import { ITreeRenderer, ITreeNode, IAsyncDataSource, ITreeContextMenuEvent } from 'vs/base/browser/ui/tree/tree';
import { FuzzyScore, createMatches } from 'vs/base/common/filters';
import { CollapseAllAction } from 'vs/base/browser/ui/tree/treeDefaults';
import { isFalsyOrWhitespace } from 'vs/base/common/strings';
import { SIDE_BAR_BACKGROUND, PANEL_BACKGROUND } from 'vs/workbench/common/theme';
import { ITreeItem, ITreeView } from 'sql/workbench/common/views';
import { UserCancelledConnectionError } from 'sql/base/common/errors';
import { IOEShimService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerViewTreeShim';
import { NodeContextKey } from 'sql/workbench/contrib/views/browser/nodeContext';
import { ActionViewItem } from 'vs/base/browser/ui/actionbar/actionViewItems';
import { ColorScheme } from 'vs/platform/theme/common/theme';
import { ThemeIcon } from 'vs/base/common/themables';
import { IHoverDelegate, IHoverDelegateOptions } from 'vs/base/browser/ui/iconLabel/iconHoverDelegate';
import { CheckboxStateHandler, TreeItemCheckbox } from 'vs/workbench/browser/parts/views/checkbox';
import { renderMarkdownAsPlaintext } from 'vs/base/browser/markdownRenderer';
import { ITooltipMarkdownString } from 'vs/base/browser/ui/iconLabel/iconLabelHover';
import { IMarkdownString } from 'vs/base/common/htmlContent';
import { IHoverService } from 'vs/workbench/services/hover/browser/hover';
import { CancellationToken } from 'vscode';
import { ITreeViewsService } from 'vs/workbench/services/views/browser/treeViewsService';

class Root implements ITreeItem {
	label = { label: 'root' };
	handle = '0';
	parentHandle: string | undefined = undefined;
	collapsibleState = TreeItemCollapsibleState.Expanded;
	children: ITreeItem[] | undefined = undefined;
}

function isTreeCommandEnabled(treeCommand: TreeCommand, contextKeyService: IContextKeyService): boolean {
	const command = CommandsRegistry.getCommand(treeCommand.originalId ? treeCommand.originalId : treeCommand.id);
	if (command) {
		const commandAction = MenuRegistry.getCommand(command.id);
		const precondition = commandAction && commandAction.precondition;
		if (precondition) {
			return contextKeyService.contextMatchesRules(precondition);
		}
	}
	return true;
}

const noDataProviderMessage = localize('no-dataprovider', "There is no data provider registered that can provide view data.");

class Tree extends WorkbenchAsyncDataTree<ITreeItem, ITreeItem, FuzzyScore> { }

export class TreeView extends Disposable implements ITreeView {

	private isVisible: boolean = false;
	private _hasIconForParentNode = false;
	private _hasIconForLeafNode = false;

	private readonly collapseAllContextKey: RawContextKey<boolean>;
	private readonly collapseAllContext: IContextKey<boolean>;
	private readonly refreshContextKey: RawContextKey<boolean>;
	private readonly refreshContext: IContextKey<boolean>;

	private focused: boolean = false;
	private domNode!: HTMLElement;
	private treeContainer!: HTMLElement;
	private _messageValue: string | undefined;
	private _canSelectMany: boolean = false;
	private messageElement!: HTMLDivElement;
	private tree: Tree | undefined;
	private treeLabels: ResourceLabels | undefined;
	readonly badge: IViewBadge | undefined = undefined;
	readonly container: any | undefined = undefined;
	private _manuallyManageCheckboxes: boolean = false;

	public readonly root: ITreeItem;
	private elementsToRefresh: ITreeItem[] = [];

	private readonly _onDidExpandItem: Emitter<ITreeItem> = this._register(new Emitter<ITreeItem>());
	readonly onDidExpandItem: Event<ITreeItem> = this._onDidExpandItem.event;

	private readonly _onDidCollapseItem: Emitter<ITreeItem> = this._register(new Emitter<ITreeItem>());
	readonly onDidCollapseItem: Event<ITreeItem> = this._onDidCollapseItem.event;

	private _onDidChangeSelection: Emitter<ITreeItem[]> = this._register(new Emitter<ITreeItem[]>());
	readonly onDidChangeSelection: Event<ITreeItem[]> = this._onDidChangeSelection.event;

	private readonly _onDidChangeVisibility: Emitter<boolean> = this._register(new Emitter<boolean>());
	readonly onDidChangeVisibility: Event<boolean> = this._onDidChangeVisibility.event;

	private readonly _onDidChangeActions: Emitter<void> = this._register(new Emitter<void>());
	readonly onDidChangeActions: Event<void> = this._onDidChangeActions.event;

	private readonly _onDidChangeWelcomeState: Emitter<void> = this._register(new Emitter<void>());
	readonly onDidChangeWelcomeState: Event<void> = this._onDidChangeWelcomeState.event;

	private readonly _onDidChangeTitle: Emitter<string> = this._register(new Emitter<string>());
	readonly onDidChangeTitle: Event<string> = this._onDidChangeTitle.event;

	private readonly _onDidChangeDescription: Emitter<string | undefined> = this._register(new Emitter<string | undefined>());
	readonly onDidChangeDescription: Event<string | undefined> = this._onDidChangeDescription.event;

	private readonly _onDidChangeCheckboxState: Emitter<readonly ITreeItem[]> = this._register(new Emitter<readonly ITreeItem[]>());
	readonly onDidChangeCheckboxState: Event<readonly ITreeItem[]> = this._onDidChangeCheckboxState.event;

	private _onDidChangeFocus: Emitter<ITreeItem> = this._register(new Emitter<ITreeItem>());
	readonly onDidChangeFocus: Event<ITreeItem> = this._onDidChangeFocus.event;

	private readonly _onDidCompleteRefresh: Emitter<void> = this._register(new Emitter<void>());

	private nodeContext: NodeContextKey;

	constructor(
		protected readonly id: string,
		private _title: string,
		@IThemeService private readonly themeService: IThemeService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IProgressService protected readonly progressService: IProgressService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@INotificationService private readonly notificationService: INotificationService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super();
		this.root = new Root();
		this.collapseAllContextKey = new RawContextKey<boolean>(`treeView.${this.id}.enableCollapseAll`, false);
		this.collapseAllContext = this.collapseAllContextKey.bindTo(contextKeyService);
		this.refreshContextKey = new RawContextKey<boolean>(`treeView.${this.id}.enableRefresh`, false);
		this.refreshContext = this.refreshContextKey.bindTo(contextKeyService);

		this._register(this.themeService.onDidFileIconThemeChange(() => this.doRefresh([this.root]) /** soft refresh **/));
		this._register(this.themeService.onDidColorThemeChange(() => this.doRefresh([this.root]) /** soft refresh **/));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('explorer.decorations')) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				this.doRefresh([this.root]); /** soft refresh **/
			}
		}));
		this._register(this.viewDescriptorService.onDidChangeLocation(({ views, from, to }) => {
			if (views.some(v => v.id === this.id)) {
				this.tree?.updateOptions({ overrideStyles: { listBackground: this.viewLocation === ViewContainerLocation.Sidebar ? SIDE_BAR_BACKGROUND : PANEL_BACKGROUND } });
			}
		}));
		this.registerActions();

		this.nodeContext = this._register(instantiationService.createInstance(NodeContextKey)); // tracked change
		this.create();
	}

	collapse(element: ITreeItem): boolean {
		if (this.tree) {
			return this.tree.collapse(element);
		}
		return false;
	}

	get viewContainer(): ViewContainer {
		return this.viewDescriptorService.getViewContainerByViewId(this.id)!;
	}

	get viewLocation(): ViewContainerLocation {
		return this.viewDescriptorService.getViewLocationById(this.id)!;
	}

	private _dataProvider: ITreeViewDataProvider | undefined;
	get dataProvider(): ITreeViewDataProvider | undefined {
		return this._dataProvider;
	}

	set dataProvider(dataProvider: ITreeViewDataProvider | undefined) {
		if (this.tree === undefined) {
			this.createTree();
		}

		if (dataProvider) {
			this._dataProvider = new class implements ITreeViewDataProvider {
				private _isEmpty: boolean = true;
				private _onDidChangeEmpty: Emitter<void> = new Emitter();
				public onDidChangeEmpty: Event<void> = this._onDidChangeEmpty.event;

				get isTreeEmpty(): boolean {
					return this._isEmpty;
				}

				async getChildren(node: ITreeItem): Promise<ITreeItem[]> {
					let children: ITreeItem[] | undefined = undefined;
					if (node && node.children) {
						children = node.children;
					} else {
						children = await (node instanceof Root ? dataProvider.getChildren() : dataProvider.getChildren(node));
						node.children = children;
					}
					if (node instanceof Root) {
						const oldEmpty = this._isEmpty;
						this._isEmpty = !children || children.length === 0;
						if (oldEmpty !== this._isEmpty) {
							this._onDidChangeEmpty.fire();
						}
					}
					return children ?? [];
				}
			};
			if (this._dataProvider.onDidChangeEmpty) {
				this._register(this._dataProvider.onDidChangeEmpty(() => this._onDidChangeWelcomeState.fire()));
			}
			this.updateMessage();
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.refresh();
		} else {
			this._dataProvider = undefined;
			this.updateMessage();
		}

		this._onDidChangeWelcomeState.fire();
	}

	private _description: string | undefined;
	get description(): string | undefined {
		return this._description;
	}

	set description(_description: string | undefined) {
		this._description = _description;
		this._onDidChangeDescription.fire(this._description);
	}

	private _message: string | undefined;
	get message(): string | undefined {
		return this._message;
	}

	set message(message: string | undefined) {
		this._message = message;
		this.updateMessage();
		this._onDidChangeWelcomeState.fire();
	}

	get title(): string {
		return this._title;
	}

	set title(name: string) {
		this._title = name;
		this._onDidChangeTitle.fire(this._title);
	}

	get canSelectMany(): boolean {
		return this._canSelectMany;
	}

	set canSelectMany(canSelectMany: boolean) {
		this._canSelectMany = canSelectMany;
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

	get showCollapseAllAction(): boolean {
		return !!this.collapseAllContext.get();
	}

	set showCollapseAllAction(showCollapseAllAction: boolean) {
		this.collapseAllContext.set(showCollapseAllAction);
	}

	get showRefreshAction(): boolean {
		return !!this.refreshContext.get();
	}

	set showRefreshAction(showRefreshAction: boolean) {
		this.refreshContext.set(showRefreshAction);
	}

	get manuallyManageCheckboxes(): boolean {
		return this._manuallyManageCheckboxes;
	}

	set manuallyManageCheckboxes(manuallyManageCheckboxes: boolean) {
		this._manuallyManageCheckboxes = manuallyManageCheckboxes;
	}

	private registerActions() {
		const that = this;
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: `workbench.actions.treeView.${that.id}.refresh`,
					title: localize('refresh', "Refresh"),
					menu: {
						id: MenuId.ViewTitle,
						when: ContextKeyExpr.and(ContextKeyEqualsExpr.create('view', that.id), that.refreshContextKey),
						group: 'navigation',
						order: Number.MAX_SAFE_INTEGER - 1,
					},
					icon: { id: 'codicon/refresh' }
				});
			}
			async run(): Promise<void> {
				return that.refresh();
			}
		}));
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: `workbench.actions.treeView.${that.id}.collapseAll`,
					title: localize('collapseAll', "Collapse All"),
					menu: {
						id: MenuId.ViewTitle,
						when: ContextKeyExpr.and(ContextKeyEqualsExpr.create('view', that.id), that.collapseAllContextKey),
						group: 'navigation',
						order: Number.MAX_SAFE_INTEGER,
					},
					icon: { id: 'codicon/collapse-all' }
				});
			}
			async run(): Promise<void> {
				if (that.tree) {
					return new CollapseAllAction<ITreeItem, ITreeItem, FuzzyScore>(that.tree, true).run();
				}
			}
		}));
	}

	setVisibility(isVisible: boolean): void {
		isVisible = !!isVisible;
		if (this.isVisible === isVisible) {
			return;
		}

		this.isVisible = isVisible;

		if (this.tree) {
			if (this.isVisible) {
				DOM.show(this.tree.getHTMLElement());
			} else {
				DOM.hide(this.tree.getHTMLElement()); // make sure the tree goes out of the tabindex world by hiding it
			}

			if (this.isVisible && this.elementsToRefresh.length) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				this.doRefresh(this.elementsToRefresh);
				this.elementsToRefresh = [];
			}
		}

		this._onDidChangeVisibility.fire(this.isVisible);
	}

	focus(reveal: boolean = true): void {
		if (this.tree && this.root.children && this.root.children.length > 0) {
			// Make sure the current selected element is revealed
			const selectedElement = this.tree.getSelection()[0];
			if (selectedElement && reveal) {
				this.tree.reveal(selectedElement, 0.5);
			}

			// Pass Focus to Viewer
			this.tree.domFocus();
		} else if (this.tree) {
			this.tree.domFocus();
		} else {
			this.domNode.focus();
		}
	}

	show(container: HTMLElement): void {
		DOM.append(container, this.domNode);
	}

	private create() {
		this.domNode = DOM.$('.tree-explorer-viewlet-tree-view');
		this.messageElement = DOM.append(this.domNode, DOM.$('.message'));
		this.treeContainer = DOM.append(this.domNode, DOM.$('.customview-tree'));
		this.treeContainer.classList.add('file-icon-themable-tree');
		this.treeContainer.classList.add('show-file-icons');
		const focusTracker = this._register(DOM.trackFocus(this.domNode));
		this._register(focusTracker.onDidFocus(() => this.focused = true));
		this._register(focusTracker.onDidBlur(() => this.focused = false));
	}

	private updateCheckboxes(items: ITreeItem[]) {
		const additionalItems: ITreeItem[] = [];

		if (!this.manuallyManageCheckboxes) {
			for (const item of items) {
				if (item.checkbox !== undefined) {

					function checkChildren(currentItem: ITreeItem) {
						for (const child of (currentItem.children ?? [])) {
							if (child.checkbox !== undefined && currentItem.checkbox !== undefined) {
								child.checkbox.isChecked = currentItem.checkbox.isChecked;
								additionalItems.push(child);
								checkChildren(child);
							}
						}
					}
					checkChildren(item);

					const visitedParents: Set<ITreeItem> = new Set();
					function checkParents(currentItem: ITreeItem) {
						if (currentItem.parent && (currentItem.parent.checkbox !== undefined) && currentItem.parent.children) {
							if (visitedParents.has(currentItem.parent)) {
								return;
							} else {
								visitedParents.add(currentItem.parent);
							}

							let someUnchecked = false;
							let someChecked = false;
							for (const child of currentItem.parent.children) {
								if (someUnchecked && someChecked) {
									break;
								}
								if (child.checkbox !== undefined) {
									if (child.checkbox.isChecked) {
										someChecked = true;
									} else {
										someUnchecked = true;
									}
								}
							}
							if (someChecked && !someUnchecked) {
								currentItem.parent.checkbox.isChecked = true;
								additionalItems.push(currentItem.parent);
								checkParents(currentItem.parent);
							} else if (someUnchecked && !someChecked) {
								currentItem.parent.checkbox.isChecked = false;
								additionalItems.push(currentItem.parent);
								checkParents(currentItem.parent);
							}
						}
					}
					checkParents(item);
				}
			}
		}
		items = items.concat(additionalItems);
		items.forEach(item => this.tree?.rerender(item));
		this._onDidChangeCheckboxState.fire(items);
	}

	private createTree() {
		const actionViewItemProvider = (action: IAction) => {
			if (action instanceof MenuItemAction) {
				return this.instantiationService.createInstance(MenuEntryActionViewItem, action, undefined);
			} else if (action instanceof SubmenuItemAction) {
				return this.instantiationService.createInstance(SubmenuEntryActionViewItem, action, undefined);
			}

			return undefined;
		};
		const treeMenus = this._register(this.instantiationService.createInstance(TreeMenus, this.id));
		this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, this));
		const dataSource = this.instantiationService.createInstance(TreeDataSource, this, this.id, <T>(task: Promise<T>) => this.progressService.withProgress({ location: this.id }, () => task));
		const aligner = new Aligner(this.themeService);
		const checkboxStateHandler = this._register(new CheckboxStateHandler());
		this._register(checkboxStateHandler.onDidChangeCheckboxState(items => {
			this.updateCheckboxes(items);
		}));
		const renderer = this.instantiationService.createInstance(TreeRenderer, this.id, treeMenus, this.treeLabels, actionViewItemProvider, aligner, checkboxStateHandler);
		const widgetAriaLabel = this._title;

		this.tree = this._register(this.instantiationService.createInstance(Tree, this.id, this.treeContainer, new TreeViewDelegate(), [renderer],
			dataSource, {
			identityProvider: new TreeViewIdentityProvider(),
			accessibilityProvider: {
				getAriaLabel(element: ITreeItem): string {
					if (element.accessibilityInformation) {
						return element.accessibilityInformation.label;
					}

					return isString(element.tooltip) ? element.tooltip : element.label ? element.label.label : '';
				},
				getRole(element: ITreeItem): string | undefined {
					return element.accessibilityInformation?.role ?? 'treeitem';
				},
				getWidgetAriaLabel(): string {
					return widgetAriaLabel;
				}
			},
			keyboardNavigationLabelProvider: {
				getKeyboardNavigationLabel: (item: ITreeItem) => {
					return item.label ? item.label.label : (item.resourceUri ? basename(URI.revive(item.resourceUri)) : undefined);
				}
			},
			expandOnlyOnTwistieClick: (e: ITreeItem) => !!e.command,
			collapseByDefault: (e: ITreeItem): boolean => {
				return e.collapsibleState !== TreeItemCollapsibleState.Expanded;
			},
			multipleSelectionSupport: this.canSelectMany,
			overrideStyles: {
				listBackground: this.viewLocation === ViewContainerLocation.Sidebar ? SIDE_BAR_BACKGROUND : PANEL_BACKGROUND
			}
		}) as WorkbenchAsyncDataTree<ITreeItem, ITreeItem, FuzzyScore>);
		aligner.tree = this.tree;
		const actionRunner = new MultipleSelectionActionRunner(this.notificationService, () => this.tree!.getSelection());
		renderer.actionRunner = actionRunner;

		this.tree.contextKeyService.createKey<boolean>(this.id, true);
		this._register(this.tree.onContextMenu(e => this.onContextMenu(treeMenus, e, actionRunner)));
		this._register(this.tree.onDidChangeSelection(e => this._onDidChangeSelection.fire(<any>e.elements)));
		this._register(this.tree.onDidChangeCollapseState(e => {
			if (!e.node.element) {
				return;
			}

			const element: ITreeItem = Array.isArray(e.node.element.element) ? e.node.element.element[0] : e.node.element.element;
			if (e.node.collapsed) {
				this._onDidCollapseItem.fire(element);
			} else {
				this._onDidExpandItem.fire(element);
			}
		}));
		// Update resource context based on focused element
		this._register(this.tree.onDidChangeFocus(e => {  // tracked change
			this.nodeContext.set({ node: e.elements[0], viewId: this.id });
		}));
		this.tree.setInput(this.root).then(() => this.updateContentAreas());

		this._register(this.tree.onDidOpen(e => {
			if (!e.browserEvent) {
				return;
			}
			const selection = this.tree!.getSelection();
			if ((selection.length === 1) && selection[0].command) {
				this.commandService.executeCommand(selection[0].command.id, ...(selection[0].command.arguments || []));
			}
		}));
	}

	private onContextMenu(treeMenus: TreeMenus, treeEvent: ITreeContextMenuEvent<ITreeItem>, actionRunner: MultipleSelectionActionRunner): void {
		const node: ITreeItem | null = treeEvent.element;
		if (node === null) {
			return;
		}
		const event: UIEvent = treeEvent.browserEvent;

		event.preventDefault();
		event.stopPropagation();

		this.tree!.setFocus([node]);
		const actions = treeMenus.getResourceContextActions(node);
		if (!actions.length) {
			return;
		}
		this.contextMenuService.showContextMenu({
			getAnchor: () => treeEvent.anchor,

			getActions: () => actions,

			getActionViewItem: (action) => {
				const keybinding = this.keybindingService.lookupKeybinding(action.id);
				if (keybinding) {
					return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
				}
				return undefined;
			},

			onHide: (wasCancelled?: boolean) => {
				if (wasCancelled) {
					this.tree!.domFocus();
				}
			},

			getActionsContext: () => (<TreeViewItemHandleArg>{ $treeViewId: this.id, $treeItemHandle: node.handle, $treeItem: node }),

			actionRunner
		});
	}

	protected updateMessage(): void {
		if (this._message) {
			this.showMessage(this._message);
		} else if (!this.dataProvider) {
			this.showMessage(noDataProviderMessage);
		} else {
			this.hideMessage();
		}
		this.updateContentAreas();
	}

	private showMessage(message: string): void {
		this.messageElement.classList.remove('hide');
		this.resetMessageElement();
		this._messageValue = message;
		if (!isFalsyOrWhitespace(this._message)) {
			this.messageElement.textContent = this._messageValue;
		}
		this.layout(this._height, this._width);
	}

	private hideMessage(): void {
		this.resetMessageElement();
		this.messageElement.classList.add('hide');
		this.layout(this._height, this._width);
	}

	private resetMessageElement(): void {
		DOM.clearNode(this.messageElement);
	}

	private _height: number = 0;
	private _width: number = 0;
	layout(height: number, width: number) {
		if (height && width) {
			this._height = height;
			this._width = width;
			const treeHeight = height - DOM.getTotalHeight(this.messageElement);
			this.treeContainer.style.height = treeHeight + 'px';
			if (this.tree) {
				this.tree.layout(treeHeight, width);
			}
		}
	}

	getOptimalWidth(): number {
		if (this.tree) {
			const parentNode = this.tree.getHTMLElement();
			const childNodes = ([] as HTMLElement[]).slice.call(parentNode.querySelectorAll('.outline-item-label > a'));
			return DOM.getLargestChildWidth(parentNode, childNodes);
		}
		return 0;
	}

	isCollapsed(item: ITreeItem): boolean {
		return !!this.tree?.isCollapsed(item);
	}

	async refresh(elements?: ITreeItem[]): Promise<void> {
		if (this.dataProvider && this.tree) {
			if (this.refreshing) {
				await Event.toPromise(this._onDidCompleteRefresh.event);
			}
			if (!elements) {
				elements = [this.root];
				// remove all waiting elements to refresh if root is asked to refresh
				this.elementsToRefresh = [];
			}
			for (const element of elements) {
				element.children = undefined; // reset children
			}
			if (this.isVisible) {
				return this.doRefresh(elements);
			} else {
				if (this.elementsToRefresh.length) {
					const seen: Set<string> = new Set<string>();
					this.elementsToRefresh.forEach(element => seen.add(element.handle));
					for (const element of elements) {
						if (!seen.has(element.handle)) {
							this.elementsToRefresh.push(element);
						}
					}
				} else {
					this.elementsToRefresh.push(...elements);
				}
			}
		}
		return undefined;
	}

	async expand(itemOrItems: ITreeItem | ITreeItem[]): Promise<void> {
		const tree = this.tree;
		if (tree) {
			itemOrItems = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
			await Promise.all(itemOrItems.map(element => {
				return tree.expand(element, false);
			}));
		}
	}

	setSelection(items: ITreeItem[]): void {
		if (this.tree) {
			this.tree.setSelection(items);
		}
	}

	getSelection(): ITreeItem[] {
		return this.tree?.getSelection() ?? [];
	}

	setFocus(item: ITreeItem): void {
		if (this.tree) {
			this.focus();
			this.tree.setFocus([item]);
		}
	}

	async reveal(item: ITreeItem): Promise<void> {
		if (this.tree) {
			return this.tree.reveal(item);
		}
	}

	private refreshing: boolean = false;
	private async doRefresh(elements: ITreeItem[]): Promise<void> {
		const tree = this.tree;
		if (tree && this.visible) {
			this.refreshing = true;
			await Promise.all(elements.map(element => tree.updateChildren(element, true, true)));
			this.refreshing = false;
			this._onDidCompleteRefresh.fire();
			this.updateContentAreas();
			if (this.focused) {
				this.focus(false);
			}
		}
	}

	private updateContentAreas(): void {
		const isTreeEmpty = !this.root.children || this.root.children.length === 0;
		// Hide tree container only when there is a message and tree is empty and not refreshing
		if (this._messageValue && isTreeEmpty && !this.refreshing) {
			this.treeContainer.classList.add('hide');
			this.domNode.setAttribute('tabindex', '0');
		} else {
			this.treeContainer.classList.remove('hide');
			this.domNode.removeAttribute('tabindex');
		}
	}
}

class TreeViewIdentityProvider implements IIdentityProvider<ITreeItem> {
	getId(element: ITreeItem): { toString(): string; } {
		return element.handle;
	}
}

class TreeViewDelegate implements IListVirtualDelegate<ITreeItem> {

	getHeight(element: ITreeItem): number {
		return TreeRenderer.ITEM_HEIGHT;
	}

	getTemplateId(element: ITreeItem): string {
		return TreeRenderer.TREE_TEMPLATE_ID;
	}
}

class TreeDataSource implements IAsyncDataSource<ITreeItem, ITreeItem> {

	constructor(
		private treeView: ITreeView,
		private id: string,
		private withProgress: <T>(task: Promise<T>) => Promise<T>,
		@IOEShimService private objectExplorerService: IOEShimService
	) {
	}

	hasChildren(node: ITreeItem): boolean {
		if (node.childProvider) {
			return this.objectExplorerService.providerExists(node.childProvider) && node.collapsibleState !== TreeItemCollapsibleState.None;
		}
		return !!this.treeView.dataProvider && node.collapsibleState !== TreeItemCollapsibleState.None;
	}

	async getChildren(node: ITreeItem): Promise<any[]> {
		if (node.childProvider) {  // tracked change
			try {
				return await this.withProgress(this.objectExplorerService.getChildren(node, this.id));
			} catch (err) {
				// if some error is caused we assume something tangently happened
				// i.e the user could retry if they wanted.
				// So in order to enable this we need to tell the tree to refresh this node so it will ask us for the data again
				setTimeout(() => {
					this.treeView.collapse(node);
					if (err instanceof UserCancelledConnectionError) {
						return;
					}
					this.treeView.refresh([node]);
				});
				return [];
			}
		}
		if (this.treeView.dataProvider) {
			return await this.withProgress(this.treeView.dataProvider.getChildren(node));
		}
		return [];
	}
}

// todo@joh,sandy make this proper and contributable from extensions
registerThemingParticipant((theme, collector) => {

	const matchBackgroundColor = theme.getColor(listFilterMatchHighlight);
	if (matchBackgroundColor) {
		collector.addRule(`.file-icon-themable-tree .monaco-list-row .content .monaco-highlighted-label .highlight { color: unset !important; background-color: ${matchBackgroundColor}; }`);
		collector.addRule(`.monaco-tl-contents .monaco-highlighted-label .highlight { color: unset !important; background-color: ${matchBackgroundColor}; }`);
	}
	const matchBorderColor = theme.getColor(listFilterMatchHighlightBorder);
	if (matchBorderColor) {
		collector.addRule(`.file-icon-themable-tree .monaco-list-row .content .monaco-highlighted-label .highlight { color: unset !important; border: 1px dotted ${matchBorderColor}; box-sizing: border-box; }`);
		collector.addRule(`.monaco-tl-contents .monaco-highlighted-label .highlight { color: unset !important; border: 1px dotted ${matchBorderColor}; box-sizing: border-box; }`);
	}
	const link = theme.getColor(textLinkForeground);
	if (link) {
		collector.addRule(`.tree-explorer-viewlet-tree-view > .message a { color: ${link}; }`);
	}
	const focusBorderColor = theme.getColor(focusBorder);
	if (focusBorderColor) {
		collector.addRule(`.tree-explorer-viewlet-tree-view > .message a:focus { outline: 1px solid ${focusBorderColor}; outline-offset: -1px; }`);
	}
	const codeBackground = theme.getColor(textCodeBlockBackground);
	if (codeBackground) {
		collector.addRule(`.tree-explorer-viewlet-tree-view > .message code { background-color: ${codeBackground}; }`);
	}
});

interface ITreeExplorerTemplateData {
	readonly elementDisposable: DisposableStore;
	readonly container: HTMLElement;
	readonly resourceLabel: IResourceLabel;
	readonly icon: HTMLElement;
	readonly checkboxContainer: HTMLElement;
	checkbox?: TreeItemCheckbox;
	readonly actionBar: ActionBar;
}

class TreeRenderer extends Disposable implements ITreeRenderer<ITreeItem, FuzzyScore, ITreeExplorerTemplateData> {
	static readonly ITEM_HEIGHT = 22;
	static readonly TREE_TEMPLATE_ID = 'treeExplorer';

	private _actionRunner: MultipleSelectionActionRunner | undefined;
	private _hoverDelegate: IHoverDelegate;
	private _hasCheckbox: boolean = false;
	private _renderedElements = new Map<ITreeNode<ITreeItem, FuzzyScore>, ITreeExplorerTemplateData>();


	constructor(
		private treeViewId: string,
		private menus: TreeMenus,
		private labels: ResourceLabels,
		private actionViewItemProvider: IActionViewItemProvider,
		private aligner: Aligner,
		private checkboxStateHandler: CheckboxStateHandler,
		@IThemeService private readonly themeService: IThemeService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILabelService private readonly labelService: ILabelService,
		@IHoverService private readonly hoverService: IHoverService,
		@ITreeViewsService private readonly treeViewsService: ITreeViewsService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
	) {
		super();
		this._hoverDelegate = {
			showHover: (options: IHoverDelegateOptions) => this.hoverService.showHover(options),
			delay: <number>this.configurationService.getValue('workbench.hover.delay')
		};
		this._register(this.themeService.onDidFileIconThemeChange(() => this.rerender()));
		this._register(this.themeService.onDidColorThemeChange(() => this.rerender()));
	}

	get templateId(): string {
		return TreeRenderer.TREE_TEMPLATE_ID;
	}

	set actionRunner(actionRunner: MultipleSelectionActionRunner) {
		this._actionRunner = actionRunner;
	}

	renderTemplate(container: HTMLElement): ITreeExplorerTemplateData {
		container.classList.add('custom-view-tree-node-item');

		const checkboxContainer = DOM.append(container, DOM.$(''));
		const resourceLabel = this.labels.create(container, { supportHighlights: true, hoverDelegate: this._hoverDelegate });
		const icon = DOM.prepend(resourceLabel.element, DOM.$('.custom-view-tree-node-item-icon'));
		const actionsContainer = DOM.append(resourceLabel.element, DOM.$('.actions'));
		const actionBar = new ActionBar(actionsContainer, {
			actionViewItemProvider: this.actionViewItemProvider
		});

		return { resourceLabel, icon, checkboxContainer, actionBar, container, elementDisposable: new DisposableStore() };
	}

	private getHover(label: string | undefined, resource: URI | null, node: ITreeItem): string | ITooltipMarkdownString | undefined {
		if (!(node instanceof ResolvableTreeItem) || !node.hasResolve) {
			if (resource && !node.tooltip) {
				return undefined;
			} else if (node.tooltip === undefined) {
				return label;
			} else if (!isString(node.tooltip)) {
				return { markdown: node.tooltip, markdownNotSupportedFallback: resource ? undefined : renderMarkdownAsPlaintext(node.tooltip) }; // Passing undefined as the fallback for a resource falls back to the old native hover
			} else if (node.tooltip !== '') {
				return node.tooltip;
			} else {
				return undefined;
			}
		}

		return {
			markdown: typeof node.tooltip === 'string' ? node.tooltip :
				(token: CancellationToken): Promise<IMarkdownString | string | undefined> => {
					return new Promise<IMarkdownString | string | undefined>((resolve) => {
						node.resolve(token).then(() => resolve(node.tooltip));
					});
				},
			markdownNotSupportedFallback: resource ? undefined : (label ?? '') // Passing undefined as the fallback for a resource falls back to the old native hover
		};
	}

	renderElement(element: ITreeNode<ITreeItem, FuzzyScore>, index: number, templateData: ITreeExplorerTemplateData): void {
		const node = element.element;
		const resource = node.resourceUri ? URI.revive(node.resourceUri) : null;
		const treeItemLabel: ITreeItemLabel | undefined = node.label ? node.label : (resource ? { label: basename(resource) } : undefined);
		const description = isString(node.description) ? node.description : resource && node.description === true ? this.labelService.getUriLabel(dirname(resource), { relative: true }) : undefined;
		const label = treeItemLabel ? treeItemLabel.label : undefined;
		const matches = (treeItemLabel && treeItemLabel.highlights && label) ? treeItemLabel.highlights.map(([start, end]) => {
			if (start < 0) {
				start = label.length + start;
			}
			if (end < 0) {
				end = label.length + end;
			}
			if ((start >= label.length) || (end > label.length)) {
				return ({ start: 0, end: 0 });
			}
			if (start > end) {
				const swap = start;
				start = end;
				end = swap;
			}
			return ({ start, end });
		}) : undefined;
		const icon = this.themeService.getColorTheme().type === ColorScheme.LIGHT ? node.icon : node.iconDark;
		const iconUrl = icon ? URI.revive(icon) : undefined;
		const title = this.getHover(label, resource, node);

		// reset
		templateData.actionBar.clear();
		templateData.icon.style.color = '';

		let commandEnabled = true;
		if (node.command) {
			commandEnabled = isTreeCommandEnabled(node.command, this.contextKeyService);
		}

		this.renderCheckbox(node, templateData);

		if (resource) {
			const fileDecorations = this.configurationService.getValue<{ colors: boolean; badges: boolean }>('explorer.decorations');
			const labelResource = resource ? resource : URI.parse('missing:_icon_resource');
			templateData.resourceLabel.setResource({ name: label, description, resource: labelResource }, {
				fileKind: this.getFileKind(node),
				title,
				hideIcon: this.shouldHideResourceLabelIcon(iconUrl, node.themeIcon),
				fileDecorations,
				extraClasses: ['custom-view-tree-node-item-resourceLabel'],
				matches: matches ? matches : createMatches(element.filterData),
				strikethrough: treeItemLabel?.strikethrough,
				disabledCommand: !commandEnabled,
				labelEscapeNewLines: true
			});
		} else {
			templateData.resourceLabel.setResource({ name: label, description }, {
				title,
				hideIcon: true,
				extraClasses: ['custom-view-tree-node-item-resourceLabel'],
				matches: matches ? matches : createMatches(element.filterData),
				strikethrough: treeItemLabel?.strikethrough,
				disabledCommand: !commandEnabled,
				labelEscapeNewLines: true
			});
		}

		if (iconUrl) {
			templateData.icon.className = 'custom-view-tree-node-item-icon';
			templateData.icon.style.backgroundImage = DOM.asCSSUrl(iconUrl);
		} else {
			let iconClass: string | undefined;
			if (this.shouldShowThemeIcon(!!resource, node.themeIcon)) {
				iconClass = ThemeIcon.asClassName(node.themeIcon);
				if (node.themeIcon.color) {
					templateData.icon.style.color = this.themeService.getColorTheme().getColor(node.themeIcon.color.id)?.toString() ?? '';
				}
			}
			templateData.icon.className = iconClass ? `custom-view-tree-node-item-icon ${iconClass}` : '';
			templateData.icon.style.backgroundImage = '';
		}

		if (!commandEnabled) {
			templateData.icon.className = templateData.icon.className + ' disabled';
			if (templateData.container.parentElement) {
				templateData.container.parentElement.className = templateData.container.parentElement.className + ' disabled';
			}
		}

		templateData.actionBar.context = <TreeViewItemHandleArg>{ $treeViewId: this.treeViewId, $treeItemHandle: node.handle };

		const menuActions = this.menus.getResourceActions(node);
		if (menuActions.menu) {
			templateData.elementDisposable.add(menuActions.menu);
		}
		templateData.actionBar.push(menuActions.actions, { icon: true, label: false });

		if (this._actionRunner) {
			templateData.actionBar.actionRunner = this._actionRunner;
		}
		this.setAlignment(templateData.container, node);
		this.treeViewsService.addRenderedTreeItemElement(node, templateData.container);

		// remember rendered element
		this._renderedElements.set(element, templateData);
	}

	private rerender() {
		// As we add items to the map during this call we can't directly use the map in the for loop
		// but have to create a copy of the keys first
		const keys = new Set(this._renderedElements.keys());
		for (const key of keys) {
			const value = this._renderedElements.get(key);
			if (value) {
				this.disposeElement(key, 0, value);
				this.renderElement(key, 0, value);
			}
		}
	}

	private renderCheckbox(node: ITreeItem, templateData: ITreeExplorerTemplateData) {
		if (node.checkbox) {
			// The first time we find a checkbox we want to rerender the visible tree to adapt the alignment
			if (!this._hasCheckbox) {
				this._hasCheckbox = true;
				this.rerender();
			}
			if (!templateData.checkbox) {
				const checkbox = new TreeItemCheckbox(templateData.checkboxContainer, this.checkboxStateHandler);
				templateData.checkbox = checkbox;
			}
			templateData.checkbox.render(node);
		}
		else if (templateData.checkbox) {
			templateData.checkbox.dispose();
			templateData.checkbox = undefined;
		}
	}

	private setAlignment(container: HTMLElement, treeItem: ITreeItem) {
		container.parentElement!.classList.toggle('align-icon-with-twisty', !this._hasCheckbox && this.aligner.alignIconWithTwisty(treeItem));
	}

	private shouldHideResourceLabelIcon(iconUrl: URI | undefined, icon: ThemeIcon | undefined): boolean {
		// We always hide the resource label in favor of the iconUrl when it's provided.
		// When `ThemeIcon` is provided, we hide the resource label icon in favor of it only if it's a not a file icon.
		return (!!iconUrl || (!!icon && !this.isFileKindThemeIcon(icon)));
	}

	private shouldShowThemeIcon(hasResource: boolean, icon: ThemeIcon | undefined): icon is ThemeIcon {
		if (!icon) {
			return false;
		}

		// If there's a resource and the icon is a file icon, then the icon (or lack thereof) will already be coming from the
		// icon theme and should use whatever the icon theme has provided.
		return !(hasResource && this.isFileKindThemeIcon(icon));
	}

	private isFolderThemeIcon(icon: ThemeIcon | undefined): boolean {
		return icon?.id === FolderThemeIcon.id;
	}

	private isFileKindThemeIcon(icon: ThemeIcon | undefined): boolean {
		if (icon) {
			return icon.id === FileThemeIcon.id || this.isFolderThemeIcon(icon);
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

	disposeElement(resource: ITreeNode<ITreeItem, FuzzyScore>, index: number, templateData: ITreeExplorerTemplateData): void {
		templateData.elementDisposable.clear();

		this._renderedElements.delete(resource);
		this.treeViewsService.removeRenderedTreeItemElement(resource.element);

		templateData.checkbox?.dispose();
		templateData.checkbox = undefined;
	}

	disposeTemplate(templateData: ITreeExplorerTemplateData): void {
		templateData.resourceLabel.dispose();
		templateData.actionBar.dispose();
		templateData.elementDisposable.dispose();
	}
}

class Aligner extends Disposable {
	private _tree: WorkbenchAsyncDataTree<ITreeItem, ITreeItem, FuzzyScore> | undefined;

	constructor(private themeService: IThemeService) {
		super();
	}

	set tree(tree: WorkbenchAsyncDataTree<ITreeItem, ITreeItem, FuzzyScore>) {
		this._tree = tree;
	}

	public alignIconWithTwisty(treeItem: ITreeItem): boolean {
		if (treeItem.collapsibleState !== TreeItemCollapsibleState.None) {
			return false;
		}
		if (!this.hasIcon(treeItem)) {
			return false;
		}

		if (this._tree) {
			const parent: ITreeItem = this._tree.getParentElement(treeItem) || this._tree.getInput();
			if (this.hasIcon(parent)) {
				return false;
			}
			return !!parent.children && parent.children.every(c => c.collapsibleState === TreeItemCollapsibleState.None || !this.hasIcon(c));
		} else {
			return false;
		}
	}

	private hasIcon(node: ITreeItem): boolean {
		const isLightTheme = [ColorScheme.LIGHT, ColorScheme.HIGH_CONTRAST_LIGHT].includes(this.themeService.getColorTheme().type);
		const icon = isLightTheme ? node.icon : node.iconDark;
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

class MultipleSelectionActionRunner extends ActionRunner {

	constructor(notificationService: INotificationService, private getSelectedResources: (() => ITreeItem[])) {
		super();
		this._register(this.onDidRun(e => {
			if (e.error) {
				notificationService.error(localize('command-error', 'Error running command {1}: {0}. This is likely caused by the extension that contributes {1}.', e.error.message, e.action.id));
			}
		}));
	}

	protected override async runAction(action: IAction, context: TreeViewItemHandleArg): Promise<void> {
		const selection = this.getSelectedResources();
		let selectionHandleArgs: TreeViewItemHandleArg[] | undefined = undefined;
		let actionInSelected: boolean = false;
		if (selection.length > 1) {
			selectionHandleArgs = selection.map(selected => {
				if (selected.handle === context.$treeItemHandle) {
					actionInSelected = true;
				}
				return { $treeViewId: context.$treeViewId, $treeItemHandle: selected.handle };
			});
		}

		if (!actionInSelected) {
			selectionHandleArgs = undefined;
		}

		await action.run(...[context, selectionHandleArgs]);
	}
}

class TreeMenus extends Disposable implements IDisposable {
	private contextKeyService: IContextKeyService | undefined;
	private _onDidChange = new Emitter<ITreeItem>();
	public readonly onDidChange = this._onDidChange.event;

	constructor(
		private id: string,
		@IMenuService private readonly menuService: IMenuService
	) {
		super();
	}

	/**
	 * Caller is now responsible for disposing of the menu!
	 */
	getResourceActions(element: ITreeItem): { menu?: IMenu; actions: IAction[] } {
		const actions = this.getActions(MenuId.ViewItemContext, element, true);
		return { menu: actions.menu, actions: actions.primary };
	}

	getResourceContextActions(element: ITreeItem): IAction[] {
		return this.getActions(MenuId.ViewItemContext, element).secondary;
	}

	public setContextKeyService(service: IContextKeyService) {
		this.contextKeyService = service;
	}

	private getActions(menuId: MenuId, element: ITreeItem, listen: boolean = false): { menu?: IMenu; primary: IAction[]; secondary: IAction[] } {
		if (!this.contextKeyService) {
			return { primary: [], secondary: [] };
		}

		const contextKeyService = this.contextKeyService.createOverlay([
			['view', this.id],
			['viewItem', element.contextValue]
		]);

		const menu = this.menuService.createMenu(menuId, contextKeyService);
		const primary: IAction[] = [];
		const secondary: IAction[] = [];
		const result = { primary, secondary, menu };
		createAndFillInContextMenuActions(menu, { shouldForwardArgs: true }, result, 'inline');
		if (listen) {
			this._register(menu.onDidChange(() => this._onDidChange.fire(element)));
		} else {
			menu.dispose();
		}
		return result;
	}

	override dispose() {
		this.contextKeyService = undefined;
		super.dispose();
	}
}

export class CustomTreeView extends TreeView {

	private activated: boolean = false;

	constructor(
		id: string,
		title: string,
		@IThemeService themeService: IThemeService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService commandService: ICommandService,
		@IConfigurationService configurationService: IConfigurationService,
		@IProgressService progressService: IProgressService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IExtensionService private readonly extensionService: IExtensionService,
	) {
		super(id, title, themeService, instantiationService, commandService, configurationService, progressService, contextMenuService, keybindingService, notificationService, viewDescriptorService, contextKeyService);
	}

	override setVisibility(isVisible: boolean): void {
		super.setVisibility(isVisible);
		if (this.visible) {
			this.activate();
		}
	}

	private activate() {
		if (!this.activated) {
			this.progressService.withProgress({ location: this.id }, () => this.extensionService.activateByEvent(`onView:${this.id}`))
				.then(() => timeout(2000))
				.then(() => {
					this.updateMessage();
				});
			this.activated = true;
		}
	}
}
