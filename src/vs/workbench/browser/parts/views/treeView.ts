/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/views';
import { toDisposable, IDisposable, Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { MenuId, IMenuService, registerAction2, Action2, IMenu } from 'vs/platform/actions/common/actions';
import { IContextKeyService, ContextKeyExpr, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ITreeView, ITreeViewDescriptor, IViewsRegistry, Extensions, IViewDescriptorService, ITreeItem, TreeItemCollapsibleState, ITreeViewDataProvider, TreeViewItemHandleArg, ITreeItemLabel, ViewContainer, ViewContainerLocation, ResolvableTreeItem, ITreeViewDragAndDropController, IViewBadge } from 'vs/workbench/common/views';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IThemeService, FileThemeIcon, FolderThemeIcon, registerThemingParticipant, ThemeIcon } from 'vs/platform/theme/common/themeService';
import { ViewPane, IViewPaneOptions } from 'vs/workbench/browser/parts/views/viewPane';
import { Registry } from 'vs/platform/registry/common/platform';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Event, Emitter } from 'vs/base/common/event';
import { IAction, ActionRunner } from 'vs/base/common/actions';
import { createAndFillInContextMenuActions, createActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import * as DOM from 'vs/base/browser/dom';
import { ResourceLabels, IResourceLabel } from 'vs/workbench/browser/labels';
import { ActionBar, IActionViewItemProvider } from 'vs/base/browser/ui/actionbar/actionbar';
import { URI } from 'vs/base/common/uri';
import { dirname, basename } from 'vs/base/common/resources';
import { FileKind } from 'vs/platform/files/common/files';
import { WorkbenchAsyncDataTree } from 'vs/platform/list/browser/listService';
import { localize } from 'vs/nls';
import { timeout } from 'vs/base/common/async';
import { textLinkForeground, textCodeBlockBackground, focusBorder, listFilterMatchHighlight, listFilterMatchHighlightBorder } from 'vs/platform/theme/common/colorRegistry';
import { isString } from 'vs/base/common/types';
import { ILabelService } from 'vs/platform/label/common/label';
import { IListVirtualDelegate, IIdentityProvider } from 'vs/base/browser/ui/list/list';
import { ITreeRenderer, ITreeNode, IAsyncDataSource, ITreeContextMenuEvent, ITreeDragAndDrop, ITreeDragOverReaction, TreeDragOverBubble } from 'vs/base/browser/ui/tree/tree';
import { DataTransfers, IDragAndDropData } from 'vs/base/browser/dnd';
import { FuzzyScore, createMatches } from 'vs/base/common/filters';
import { CollapseAllAction } from 'vs/base/browser/ui/tree/treeDefaults';
import { isFalsyOrWhitespace } from 'vs/base/common/strings';
import { SIDE_BAR_BACKGROUND, PANEL_BACKGROUND } from 'vs/workbench/common/theme';
import { IHoverService } from 'vs/workbench/services/hover/browser/hover';
import { ActionViewItem } from 'vs/base/browser/ui/actionbar/actionViewItems';
import { ColorScheme } from 'vs/platform/theme/common/theme';
import { IHoverDelegate, IHoverDelegateOptions } from 'vs/base/browser/ui/iconLabel/iconHoverDelegate';
import { IMarkdownString } from 'vs/base/common/htmlContent';
import { ITooltipMarkdownString } from 'vs/base/browser/ui/iconLabel/iconLabelHover';
import { renderMarkdownAsPlaintext } from 'vs/base/browser/markdownRenderer';
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from 'vs/workbench/browser/parts/editor/editorCommands';
import { Codicon } from 'vs/base/common/codicons';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { Command } from 'vs/editor/common/languages';
import { isCancellationError } from 'vs/base/common/errors';
import { ElementsDragAndDropData } from 'vs/base/browser/ui/list/listView';
import { CodeDataTransfers, convertResourceUrlsToUriList, DraggedTreeItemsIdentifier, fillEditorsDragData, LocalSelectionTransfer } from 'vs/workbench/browser/dnd';
import { Schemas } from 'vs/base/common/network';
import { ITreeViewsService } from 'vs/workbench/services/views/browser/treeViewsService';
import { generateUuid } from 'vs/base/common/uuid';
import { ILogService } from 'vs/platform/log/common/log';
import { Mimes } from 'vs/base/common/mime';
import { IActivityService, NumberBadge } from 'vs/workbench/services/activity/common/activity';
import { IDataTransfer } from 'vs/workbench/common/dnd';
import { ThemeSettings } from 'vs/workbench/services/themes/common/workbenchThemeService';

export class TreeViewPane extends ViewPane {

	protected readonly treeView: ITreeView;
	private _container: HTMLElement | undefined;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		super({ ...(options as IViewPaneOptions), titleMenuId: MenuId.ViewTitle, donotForwardArgs: true }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
		const { treeView } = (<ITreeViewDescriptor>Registry.as<IViewsRegistry>(Extensions.ViewsRegistry).getView(options.id));
		this.treeView = treeView;
		this._register(this.treeView.onDidChangeActions(() => this.updateActions(), this));
		this._register(this.treeView.onDidChangeTitle((newTitle) => this.updateTitle(newTitle)));
		this._register(this.treeView.onDidChangeDescription((newDescription) => this.updateTitleDescription(newDescription)));
		this._register(toDisposable(() => {
			if (this._container && this.treeView.container && (this._container === this.treeView.container)) {
				this.treeView.setVisibility(false);
			}
		}));
		this._register(this.onDidChangeBodyVisibility(() => this.updateTreeVisibility()));
		this._register(this.treeView.onDidChangeWelcomeState(() => this._onDidChangeViewWelcomeState.fire()));
		if (options.title !== this.treeView.title) {
			this.updateTitle(this.treeView.title);
		}
		if (options.titleDescription !== this.treeView.description) {
			this.updateTitleDescription(this.treeView.description);
		}

		this.updateTreeVisibility();
	}

	override focus(): void {
		super.focus();
		this.treeView.focus();
	}

	override renderBody(container: HTMLElement): void {
		this._container = container;
		super.renderBody(container);
		this.renderTreeView(container);
	}

	override shouldShowWelcome(): boolean {
		return ((this.treeView.dataProvider === undefined) || !!this.treeView.dataProvider.isTreeEmpty) && (this.treeView.message === undefined);
	}

	override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.layoutTreeView(height, width);
	}

	override getOptimalWidth(): number {
		return this.treeView.getOptimalWidth();
	}

	protected renderTreeView(container: HTMLElement): void {
		this.treeView.show(container);
	}

	protected layoutTreeView(height: number, width: number): void {
		this.treeView.layout(height, width);
	}

	private updateTreeVisibility(): void {
		this.treeView.setVisibility(this.isBodyVisible());
	}
}

class Root implements ITreeItem {
	label = { label: 'root' };
	handle = '0';
	parentHandle: string | undefined = undefined;
	collapsibleState = TreeItemCollapsibleState.Expanded;
	children: ITreeItem[] | undefined = undefined;
}

const noDataProviderMessage = localize('no-dataprovider', "There is no data provider registered that can provide view data.");

export const RawCustomTreeViewContextKey = new RawContextKey<boolean>('customTreeView', false);

class Tree extends WorkbenchAsyncDataTree<ITreeItem, ITreeItem, FuzzyScore> { }

abstract class AbstractTreeView extends Disposable implements ITreeView {

	private isVisible: boolean = false;
	private _hasIconForParentNode = false;
	private _hasIconForLeafNode = false;

	private readonly collapseAllContextKey: RawContextKey<boolean>;
	private readonly collapseAllContext: IContextKey<boolean>;
	private readonly collapseAllToggleContextKey: RawContextKey<boolean>;
	private readonly collapseAllToggleContext: IContextKey<boolean>;
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
	private treeViewDnd: CustomTreeViewDragAndDrop;
	private _container: HTMLElement | undefined;

	public root: ITreeItem;	// {{SQL CARBON EDIT}}
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

	private readonly _onDidCompleteRefresh: Emitter<void> = this._register(new Emitter<void>());

	constructor(
		readonly id: string,
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
		@IHoverService private readonly hoverService: IHoverService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IActivityService private readonly activityService: IActivityService
	) {
		super();
		this.root = new Root();
		this.collapseAllContextKey = new RawContextKey<boolean>(`treeView.${this.id}.enableCollapseAll`, false, localize('treeView.enableCollapseAll', "Whether the the tree view with id {0} enables collapse all.", this.id));
		this.collapseAllContext = this.collapseAllContextKey.bindTo(contextKeyService);
		this.collapseAllToggleContextKey = new RawContextKey<boolean>(`treeView.${this.id}.toggleCollapseAll`, false, localize('treeView.toggleCollapseAll', "Whether collapse all is toggled for the tree view with id {0}.", this.id));
		this.collapseAllToggleContext = this.collapseAllToggleContextKey.bindTo(contextKeyService);
		this.refreshContextKey = new RawContextKey<boolean>(`treeView.${this.id}.enableRefresh`, false, localize('treeView.enableRefresh', "Whether the tree view with id {0} enables refresh.", this.id));
		this.refreshContext = this.refreshContextKey.bindTo(contextKeyService);
		this.treeViewDnd = this.instantiationService.createInstance(CustomTreeViewDragAndDrop, this.id);

		this._register(this.themeService.onDidFileIconThemeChange(() => this.doRefresh([this.root]) /** soft refresh **/));
		this._register(this.themeService.onDidColorThemeChange(() => this.doRefresh([this.root]) /** soft refresh **/));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('explorer.decorations')) {
				this.doRefresh([this.root]); /** soft refresh **/
			}
		}));
		this._register(this.viewDescriptorService.onDidChangeLocation(({ views, from, to }) => {
			if (views.some(v => v.id === this.id)) {
				this.tree?.updateOptions({ overrideStyles: { listBackground: this.viewLocation === ViewContainerLocation.Panel ? PANEL_BACKGROUND : SIDE_BAR_BACKGROUND } });
			}
		}));
		this.registerActions();

		this.create();
	}

	get viewContainer(): ViewContainer {
		return this.viewDescriptorService.getViewContainerByViewId(this.id)!;
	}

	get viewLocation(): ViewContainerLocation {
		return this.viewDescriptorService.getViewLocationById(this.id)!;
	}
	private _dragAndDropController: ITreeViewDragAndDropController | undefined;
	get dragAndDropController(): ITreeViewDragAndDropController | undefined {
		return this._dragAndDropController;
	}
	set dragAndDropController(dnd: ITreeViewDragAndDropController | undefined) {
		this._dragAndDropController = dnd;
		this.treeViewDnd.controller = dnd;
	}

	private _dataProvider: ITreeViewDataProvider | undefined;
	get dataProvider(): ITreeViewDataProvider | undefined {
		return this._dataProvider;
	}

	set dataProvider(dataProvider: ITreeViewDataProvider | undefined) {
		if (dataProvider) {
			const self = this;
			this._dataProvider = new class implements ITreeViewDataProvider {
				private _isEmpty: boolean = true;
				private _onDidChangeEmpty: Emitter<void> = new Emitter();
				public onDidChangeEmpty: Event<void> = this._onDidChangeEmpty.event;

				get isTreeEmpty(): boolean {
					return this._isEmpty;
				}

				async getChildren(node?: ITreeItem): Promise<ITreeItem[]> {
					let children: ITreeItem[];
					if (node && node.children) {
						children = node.children;
					} else {
						node = node ?? self.root;
						node.children = await (node instanceof Root ? dataProvider.getChildren() : dataProvider.getChildren(node));
						children = node.children ?? [];
					}
					if (node instanceof Root) {
						const oldEmpty = this._isEmpty;
						this._isEmpty = children.length === 0;
						if (oldEmpty !== this._isEmpty) {
							this._onDidChangeEmpty.fire();
						}
					}
					return children;
				}
			};
			if (this._dataProvider.onDidChangeEmpty) {
				this._register(this._dataProvider.onDidChangeEmpty(() => {
					this.updateCollapseAllToggle();
					this._onDidChangeWelcomeState.fire();
				}));
			}
			this.updateMessage();
			this.refresh();
		} else {
			this._dataProvider = undefined;
			this.updateMessage();
		}

		this._onDidChangeWelcomeState.fire();
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

	private _description: string | undefined;
	get description(): string | undefined {
		return this._description;
	}

	set description(description: string | undefined) {
		this._description = description;
		this._onDidChangeDescription.fire(this._description);
	}

	private _badge: IViewBadge | undefined;
	private _badgeActivity: IDisposable | undefined;
	get badge(): IViewBadge | undefined {
		return this._badge;
	}

	set badge(badge: IViewBadge | undefined) {

		if (this._badge?.value === badge?.value &&
			this._badge?.tooltip === badge?.tooltip) {
			return;
		}

		if (this._badgeActivity) {
			this._badgeActivity.dispose();
			this._badgeActivity = undefined;
		}

		this._badge = badge;

		if (badge) {
			const activity = {
				badge: new NumberBadge(badge.value, () => badge.tooltip),
				priority: 150
			};
			this._badgeActivity = this.activityService.showViewActivity(this.id, activity);
		}
	}

	get canSelectMany(): boolean {
		return this._canSelectMany;
	}

	set canSelectMany(canSelectMany: boolean) {
		const oldCanSelectMany = this._canSelectMany;
		this._canSelectMany = canSelectMany;
		if (this._canSelectMany !== oldCanSelectMany) {
			this.tree?.updateOptions({ multipleSelectionSupport: this.canSelectMany });
		}
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

	private registerActions() {
		const that = this;
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: `workbench.actions.treeView.${that.id}.refresh`,
					title: localize('refresh', "Refresh"),
					menu: {
						id: MenuId.ViewTitle,
						when: ContextKeyExpr.and(ContextKeyExpr.equals('view', that.id), that.refreshContextKey),
						group: 'navigation',
						order: Number.MAX_SAFE_INTEGER - 1,
					},
					icon: Codicon.refresh
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
						when: ContextKeyExpr.and(ContextKeyExpr.equals('view', that.id), that.collapseAllContextKey),
						group: 'navigation',
						order: Number.MAX_SAFE_INTEGER,
					},
					precondition: that.collapseAllToggleContextKey,
					icon: Codicon.collapseAll
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
				this.doRefresh(this.elementsToRefresh);
				this.elementsToRefresh = [];
			}
		}

		this._onDidChangeVisibility.fire(this.isVisible);

		if (this.visible) {
			this.activate();
		}
	}

	protected abstract activate(): void;

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
		this._container = container;
		DOM.append(container, this.domNode);
	}

	private create() {
		this.domNode = DOM.$('.tree-explorer-viewlet-tree-view');
		this.messageElement = DOM.append(this.domNode, DOM.$('.message'));
		this.treeContainer = DOM.append(this.domNode, DOM.$('.customview-tree'));
		this.treeContainer.classList.add('file-icon-themable-tree', 'show-file-icons');
		const focusTracker = this._register(DOM.trackFocus(this.domNode));
		this._register(focusTracker.onDidFocus(() => this.focused = true));
		this._register(focusTracker.onDidBlur(() => this.focused = false));
	}

	protected createTree() {
		const actionViewItemProvider = createActionViewItem.bind(undefined, this.instantiationService);
		const treeMenus = this._register(this.instantiationService.createInstance(TreeMenus, this.id));
		this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, this));
		const dataSource = this.instantiationService.createInstance(TreeDataSource, this, <T>(task: Promise<T>) => this.progressService.withProgress({ location: this.id }, () => task));
		const aligner = new Aligner(this.themeService);
		const renderer = this.instantiationService.createInstance(TreeRenderer, this.id, treeMenus, this.treeLabels, actionViewItemProvider, aligner);
		const widgetAriaLabel = this._title;

		this.tree = this._register(this.instantiationService.createInstance(Tree, this.id, this.treeContainer, new TreeViewDelegate(), [renderer],
			dataSource, {
			identityProvider: new TreeViewIdentityProvider(),
			accessibilityProvider: {
				getAriaLabel(element: ITreeItem): string | null {
					if (element.accessibilityInformation) {
						return element.accessibilityInformation.label;
					}

					if (isString(element.tooltip)) {
						return element.tooltip;
					} else {
						if (element.resourceUri && !element.label) {
							// The custom tree has no good information on what should be used for the aria label.
							// Allow the tree widget's default aria label to be used.
							return null;
						}
						let buildAriaLabel: string = '';
						if (element.label) {
							buildAriaLabel += element.label.label + ' ';
						}
						if (element.description) {
							buildAriaLabel += element.description;
						}
						return buildAriaLabel;
					}
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
			dnd: this.treeViewDnd,
			overrideStyles: {
				listBackground: this.viewLocation === ViewContainerLocation.Panel ? PANEL_BACKGROUND : SIDE_BAR_BACKGROUND
			}
		}) as WorkbenchAsyncDataTree<ITreeItem, ITreeItem, FuzzyScore>);
		treeMenus.setContextKeyService(this.tree.contextKeyService);
		aligner.tree = this.tree;
		const actionRunner = new MultipleSelectionActionRunner(this.notificationService, () => this.tree!.getSelection());
		renderer.actionRunner = actionRunner;

		this.tree.contextKeyService.createKey<boolean>(this.id, true);
		const customTreeKey = RawCustomTreeViewContextKey.bindTo(this.tree.contextKeyService);
		customTreeKey.set(true);
		this._register(this.tree.onContextMenu(e => this.onContextMenu(treeMenus, e, actionRunner)));
		this._register(this.tree.onDidChangeSelection(e => this._onDidChangeSelection.fire(e.elements)));
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
		this.tree.setInput(this.root).then(() => this.updateContentAreas());

		this._register(this.tree.onDidOpen(async (e) => {
			if (!e.browserEvent) {
				return;
			}
			const selection = this.tree!.getSelection();
			const command = await this.resolveCommand(selection.length === 1 ? selection[0] : undefined);

			if (command) {
				let args = command.arguments || [];
				if (command.id === API_OPEN_EDITOR_COMMAND_ID || command.id === API_OPEN_DIFF_EDITOR_COMMAND_ID) {
					// Some commands owned by us should receive the
					// `IOpenEvent` as context to open properly
					args = [...args, e];
				}

				this.commandService.executeCommand(command.id, ...args);
			}
		}));

		this._register(treeMenus.onDidChange((changed) => this.tree?.rerender(changed)));
	}

	private async resolveCommand(element: ITreeItem | undefined): Promise<Command | undefined> {
		let command = element?.command;
		if (element && !command) {
			if ((element instanceof ResolvableTreeItem) && element.hasResolve) {
				await element.resolve(new CancellationTokenSource().token);
				command = element.command;
			}
		}
		return command;
	}

	private onContextMenu(treeMenus: TreeMenus, treeEvent: ITreeContextMenuEvent<ITreeItem>, actionRunner: MultipleSelectionActionRunner): void {
		this.hoverService.hideHover();
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

			getActionsContext: () => (<TreeViewItemHandleArg>{ $treeViewId: this.id, $treeItemHandle: node.handle }),

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
			this.updateCollapseAllToggle();
		}
	}

	private updateCollapseAllToggle() {
		if (this.showCollapseAllAction) {
			this.collapseAllToggleContext.set(!!this.root.children && (this.root.children.length > 0) &&
				this.root.children.some(value => value.collapsibleState !== TreeItemCollapsibleState.None));
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

	get container(): HTMLElement | undefined {
		return this._container;
	}
}

class TreeViewIdentityProvider implements IIdentityProvider<ITreeItem> {
	getId(element: ITreeItem): { toString(): string } {
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
		private withProgress: <T>(task: Promise<T>) => Promise<T>
	) {
	}

	hasChildren(element: ITreeItem): boolean {
		return !!this.treeView.dataProvider && (element.collapsibleState !== TreeItemCollapsibleState.None);
	}

	async getChildren(element: ITreeItem): Promise<ITreeItem[]> {
		let result: ITreeItem[] = [];
		if (this.treeView.dataProvider) {
			try {
				result = (await this.withProgress(this.treeView.dataProvider.getChildren(element))) ?? [];
			} catch (e) {
				if (!(<string>e.message).startsWith('Bad progress location:')) {
					throw e;
				}
			}
		}
		return result;
	}
}

// todo@jrieken,sandy make this proper and contributable from extensions
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
	elementDisposable: IDisposable;
	container: HTMLElement;
	resourceLabel: IResourceLabel;
	icon: HTMLElement;
	actionBar: ActionBar;
}

class TreeRenderer extends Disposable implements ITreeRenderer<ITreeItem, FuzzyScore, ITreeExplorerTemplateData> {
	static readonly ITEM_HEIGHT = 22;
	static readonly TREE_TEMPLATE_ID = 'treeExplorer';

	private _actionRunner: MultipleSelectionActionRunner | undefined;
	private _hoverDelegate: IHoverDelegate;

	constructor(
		private treeViewId: string,
		private menus: TreeMenus,
		private labels: ResourceLabels,
		private actionViewItemProvider: IActionViewItemProvider,
		private aligner: Aligner,
		@IThemeService private readonly themeService: IThemeService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ILabelService private readonly labelService: ILabelService,
		@IHoverService private readonly hoverService: IHoverService,
		@ITreeViewsService private readonly treeViewsService: ITreeViewsService
	) {
		super();
		this._hoverDelegate = {
			showHover: (options: IHoverDelegateOptions) => this.hoverService.showHover(options),
			delay: <number>this.configurationService.getValue('workbench.hover.delay')
		};
	}

	get templateId(): string {
		return TreeRenderer.TREE_TEMPLATE_ID;
	}

	set actionRunner(actionRunner: MultipleSelectionActionRunner) {
		this._actionRunner = actionRunner;
	}

	renderTemplate(container: HTMLElement): ITreeExplorerTemplateData {
		container.classList.add('custom-view-tree-node-item');

		const icon = DOM.append(container, DOM.$('.custom-view-tree-node-item-icon'));

		const resourceLabel = this.labels.create(container, { supportHighlights: true, hoverDelegate: this._hoverDelegate });
		const actionsContainer = DOM.append(resourceLabel.element, DOM.$('.actions'));
		const actionBar = new ActionBar(actionsContainer, {
			actionViewItemProvider: this.actionViewItemProvider
		});

		return { resourceLabel, icon, actionBar, container, elementDisposable: Disposable.None };
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
			markdown: (token: CancellationToken): Promise<IMarkdownString | string | undefined> => {
				return new Promise<IMarkdownString | string | undefined>((resolve) => {
					node.resolve(token).then(() => resolve(node.tooltip));
				});
			},
			markdownNotSupportedFallback: resource ? undefined : (label ?? '') // Passing undefined as the fallback for a resource falls back to the old native hover
		};
	}

	renderElement(element: ITreeNode<ITreeItem, FuzzyScore>, index: number, templateData: ITreeExplorerTemplateData): void {
		templateData.elementDisposable.dispose();
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
		const iconUrl = icon ? URI.revive(icon) : null;
		const title = this.getHover(label, resource, node);

		// reset
		templateData.actionBar.clear();
		templateData.icon.style.color = '';

		if (resource) {
			const fileDecorations = this.configurationService.getValue<{ colors: boolean; badges: boolean }>('explorer.decorations');
			const labelResource = resource ? resource : URI.parse('missing:_icon_resource');
			templateData.resourceLabel.setResource({ name: label, description, resource: labelResource }, {
				fileKind: this.getFileKind(node),
				title,
				hideIcon: !!iconUrl || this.shouldShowThemeIcon(!!resource, node.themeIcon),
				fileDecorations,
				extraClasses: ['custom-view-tree-node-item-resourceLabel'],
				matches: matches ? matches : createMatches(element.filterData),
				strikethrough: treeItemLabel?.strikethrough
			});
		} else {
			templateData.resourceLabel.setResource({ name: label, description }, {
				title,
				hideIcon: true,
				extraClasses: ['custom-view-tree-node-item-resourceLabel'],
				matches: matches ? matches : createMatches(element.filterData),
				strikethrough: treeItemLabel?.strikethrough
			});
		}

		if (iconUrl) {
			templateData.icon.className = 'custom-view-tree-node-item-icon';
			templateData.icon.style.backgroundImage = DOM.asCSSUrl(iconUrl);
		} else {
			let iconClass: string | undefined;
			// If there is a resource for this tree item then we should respect the file icon theme's choice about
			// whether to show a folder icon.
			if (this.shouldShowThemeIcon(!!resource, node.themeIcon)) {
				iconClass = ThemeIcon.asClassName(node.themeIcon);
				if (node.themeIcon.color) {
					templateData.icon.style.color = this.themeService.getColorTheme().getColor(node.themeIcon.color.id)?.toString() ?? '';
				}
			}
			templateData.icon.className = iconClass ? `custom-view-tree-node-item-icon ${iconClass}` : '';
			templateData.icon.style.backgroundImage = '';
		}

		templateData.actionBar.context = <TreeViewItemHandleArg>{ $treeViewId: this.treeViewId, $treeItemHandle: node.handle };

		const disposableStore = new DisposableStore();
		templateData.elementDisposable = disposableStore;
		const menuActions = this.menus.getResourceActions(node);
		if (menuActions.menu) {
			disposableStore.add(menuActions.menu);
		}
		templateData.actionBar.push(menuActions.actions, { icon: true, label: false });

		if (this._actionRunner) {
			templateData.actionBar.actionRunner = this._actionRunner;
		}
		this.setAlignment(templateData.container, node);
		disposableStore.add(this.themeService.onDidFileIconThemeChange(() => this.setAlignment(templateData.container, node)));
		this.treeViewsService.addRenderedTreeItemElement(node, templateData.container);
		disposableStore.add(toDisposable(() => this.treeViewsService.removeRenderedTreeItemElement(node)));
	}

	private setAlignment(container: HTMLElement, treeItem: ITreeItem) {
		container.parentElement!.classList.toggle('align-icon-with-twisty', this.aligner.alignIconWithTwisty(treeItem));
	}

	private shouldShowThemeIcon(hasResource: boolean, icon: ThemeIcon | undefined): icon is ThemeIcon {
		if (!icon) {
			return false;
		}

		if (hasResource && (this.isFileKindThemeIcon(icon) || !this.shouldShowFileIcons())) {
			return false;
		} else if (hasResource && (this.isFolderThemeIcon(icon) || !this.shouldShowFolderIcons())) {
			return false;
		}
		return true;
	}

	private shouldShowFileIcons(): boolean {
		return this.configurationService.getValue(ThemeSettings.FILE_ICON_THEME);
	}

	private shouldShowFolderIcons(): boolean {
		return this.themeService.getFileIconTheme().hasFolderIcons && this.shouldShowFileIcons();
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
		templateData.elementDisposable.dispose();
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
				return !!parent.children && parent.children.some(c => c.collapsibleState !== TreeItemCollapsibleState.None && !this.hasIcon(c));
			}
			return !!parent.children && parent.children.every(c => c.collapsibleState === TreeItemCollapsibleState.None || !this.hasIcon(c));
		} else {
			return false;
		}
	}

	private hasIcon(node: ITreeItem): boolean {
		const icon = this.themeService.getColorTheme().type === ColorScheme.LIGHT ? node.icon : node.iconDark;
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
			if (e.error && !isCancellationError(e.error)) {
				notificationService.error(localize('command-error', 'Error running command {1}: {0}. This is likely caused by the extension that contributes {1}.', e.error.message, e.action.id));
			}
		}));
	}

	override async runAction(action: IAction, context: TreeViewItemHandleArg): Promise<void> {
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
}

export class CustomTreeView extends AbstractTreeView {

	private activated: boolean = false;

	constructor(
		id: string,
		title: string,
		private readonly extensionId: string,
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
		@IHoverService hoverService: IHoverService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IActivityService activityService: IActivityService,
		@ITelemetryService private readonly telemetryService: ITelemetryService
	) {
		super(id, title, themeService, instantiationService, commandService, configurationService, progressService, contextMenuService, keybindingService, notificationService, viewDescriptorService, hoverService, contextKeyService, activityService);
	}

	protected activate() {
		if (!this.activated) {
			type ExtensionViewTelemetry = {
				extensionId: string;
				id: string;
			};
			type ExtensionViewTelemetryMeta = {
				extensionId: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Id of the extension' };
				id: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Id of the view' };
				owner: 'digitarald';
				comment: 'Helps to gain insights on what extension contributed views are most popular';
			};
			this.telemetryService.publicLog2<ExtensionViewTelemetry, ExtensionViewTelemetryMeta>('Extension:ViewActivate', {
				extensionId: this.extensionId,
				id: this.id,
			});
			this.createTree();
			this.progressService.withProgress({ location: this.id }, () => this.extensionService.activateByEvent(`onView:${this.id}`))
				.then(() => timeout(2000))
				.then(() => {
					this.updateMessage();
				});
			this.activated = true;
		}
	}
}

export class TreeView extends AbstractTreeView {

	private activated: boolean = false;

	protected activate() {
		if (!this.activated) {
			this.createTree();
			this.activated = true;
		}
	}
}

interface TreeDragSourceInfo {
	id: string;
	itemHandles: string[];
}

const INTERNAL_MIME_TYPES = [CodeDataTransfers.EDITORS.toLowerCase(), CodeDataTransfers.FILES.toLowerCase()];

export class CustomTreeViewDragAndDrop implements ITreeDragAndDrop<ITreeItem> {
	private readonly treeMimeType: string;
	private readonly treeItemsTransfer = LocalSelectionTransfer.getInstance<DraggedTreeItemsIdentifier>();
	private dragCancellationToken: CancellationTokenSource | undefined;

	constructor(
		private readonly treeId: string,
		@ILabelService private readonly labelService: ILabelService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ITreeViewsService private readonly treeViewsDragAndDropService: ITreeViewsService,
		@ILogService private readonly logService: ILogService) {
		this.treeMimeType = `application/vnd.code.tree.${treeId.toLowerCase()}`;
	}

	private dndController: ITreeViewDragAndDropController | undefined;
	set controller(controller: ITreeViewDragAndDropController | undefined) {
		this.dndController = controller;
	}

	private handleDragAndLog(dndController: ITreeViewDragAndDropController, itemHandles: string[], uuid: string, dragCancellationToken: CancellationToken): Promise<IDataTransfer | undefined> {
		return dndController.handleDrag(itemHandles, uuid, dragCancellationToken).then(additionalDataTransfer => {
			if (additionalDataTransfer) {
				const unlistedTypes: string[] = [];
				for (const item of additionalDataTransfer.entries()) {
					if ((item[0] !== this.treeMimeType) && (dndController.dragMimeTypes.findIndex(value => value === item[0]) < 0)) {
						unlistedTypes.push(item[0]);
					}
				}
				if (unlistedTypes.length) {
					this.logService.warn(`Drag and drop controller for tree ${this.treeId} adds the following data transfer types but does not declare them in dragMimeTypes: ${unlistedTypes.join(', ')}`);
				}
			}
			return additionalDataTransfer;
		});
	}

	private addExtensionProvidedTransferTypes(originalEvent: DragEvent, itemHandles: string[]) {
		if (!originalEvent.dataTransfer || !this.dndController) {
			return;
		}
		const uuid = generateUuid();

		this.dragCancellationToken = new CancellationTokenSource();
		this.treeViewsDragAndDropService.addDragOperationTransfer(uuid, this.handleDragAndLog(this.dndController, itemHandles, uuid, this.dragCancellationToken.token));
		this.treeItemsTransfer.setData([new DraggedTreeItemsIdentifier(uuid)], DraggedTreeItemsIdentifier.prototype);
		if (this.dndController.dragMimeTypes.find((element) => element === Mimes.uriList)) {
			// Add the type that the editor knows
			originalEvent.dataTransfer?.setData(DataTransfers.RESOURCES, '');
		}
		this.dndController.dragMimeTypes.forEach(supportedType => {
			originalEvent.dataTransfer?.setData(supportedType, '');
		});
	}

	private addResourceInfoToTransfer(originalEvent: DragEvent, resources: URI[]) {
		if (resources.length && originalEvent.dataTransfer) {
			// Apply some datatransfer types to allow for dragging the element outside of the application
			this.instantiationService.invokeFunction(accessor => fillEditorsDragData(accessor, resources, originalEvent));

			// The only custom data transfer we set from the explorer is a file transfer
			// to be able to DND between multiple code file explorers across windows
			const fileResources = resources.filter(s => s.scheme === Schemas.file).map(r => r.fsPath);
			if (fileResources.length) {
				originalEvent.dataTransfer.setData(CodeDataTransfers.FILES, JSON.stringify(fileResources));
			}
		}
	}

	onDragStart(data: IDragAndDropData, originalEvent: DragEvent): void {
		if (originalEvent.dataTransfer) {
			const treeItemsData = (data as ElementsDragAndDropData<ITreeItem, ITreeItem[]>).getData();
			const resources: URI[] = [];
			const sourceInfo: TreeDragSourceInfo = {
				id: this.treeId,
				itemHandles: []
			};
			treeItemsData.forEach(item => {
				sourceInfo.itemHandles.push(item.handle);
				if (item.resourceUri) {
					resources.push(URI.revive(item.resourceUri));
				}
			});
			this.addResourceInfoToTransfer(originalEvent, resources);
			this.addExtensionProvidedTransferTypes(originalEvent, sourceInfo.itemHandles);
			originalEvent.dataTransfer.setData(this.treeMimeType,
				JSON.stringify(sourceInfo));
		}
	}

	private debugLog(types: Set<string>) {
		if (types.size) {
			this.logService.debug(`TreeView dragged mime types: ${Array.from(types).join(', ')}`);
		} else {
			this.logService.debug(`TreeView dragged with no supported mime types.`);
		}
	}

	onDragOver(data: IDragAndDropData, targetElement: ITreeItem, targetIndex: number, originalEvent: DragEvent): boolean | ITreeDragOverReaction {
		const types: Set<string> = new Set();
		originalEvent.dataTransfer?.types.forEach((value, index) => {
			if (INTERNAL_MIME_TYPES.indexOf(value) < 0) {
				types.add(this.convertKnownMimes(value).type);
			}
		});

		this.debugLog(types);
		const dndController = this.dndController;
		if (!dndController || !originalEvent.dataTransfer || (dndController.dropMimeTypes.length === 0)) {
			return false;
		}
		const dragContainersSupportedType = Array.from(types).some((value, index) => {
			if (value === this.treeMimeType) {
				return true;
			} else {
				return dndController.dropMimeTypes.indexOf(value) >= 0;
			}
		});
		if (dragContainersSupportedType) {
			return { accept: true, bubble: TreeDragOverBubble.Down, autoExpand: true };
		}
		return false;
	}

	getDragURI(element: ITreeItem): string | null {
		if (!this.dndController) {
			return null;
		}
		return element.resourceUri ? URI.revive(element.resourceUri).toString() : element.handle;
	}

	getDragLabel?(elements: ITreeItem[]): string | undefined {
		if (!this.dndController) {
			return undefined;
		}
		if (elements.length > 1) {
			return String(elements.length);
		}
		const element = elements[0];
		return element.label ? element.label.label : (element.resourceUri ? this.labelService.getUriLabel(URI.revive(element.resourceUri)) : undefined);
	}

	private convertKnownMimes(type: string, kind?: string, value?: string | FileSystemHandle): { type: string; value?: string } {
		let convertedValue = undefined;
		let convertedType = type;
		if (type === DataTransfers.RESOURCES.toLowerCase()) {
			convertedValue = value ? convertResourceUrlsToUriList(value as string) : undefined;
			convertedType = Mimes.uriList;
		} else if ((type === 'Files') || (kind === 'file')) {
			convertedType = Mimes.uriList;
			convertedValue = value ? (value as FileSystemHandle).name : undefined;
		}
		return { type: convertedType, value: convertedValue };
	}

	async drop(data: IDragAndDropData, targetNode: ITreeItem | undefined, targetIndex: number | undefined, originalEvent: DragEvent): Promise<void> {
		const dndController = this.dndController;
		if (!originalEvent.dataTransfer || !dndController) {
			return;
		}
		const treeDataTransfer: IDataTransfer = new Map();
		const uris: URI[] = [];
		let itemsCount = Array.from(originalEvent.dataTransfer.items).reduce((previous, current) => {
			if ((current.kind === 'string') || (current.kind === 'file')) {
				return previous + 1;
			}
			return previous;
		}, 0);

		let treeSourceInfo: TreeDragSourceInfo | undefined;
		let willDropUuid: string | undefined;
		if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
			willDropUuid = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype)![0].identifier;
		}
		await new Promise<void>(resolve => {
			function decrementStringCount() {
				itemsCount--;
				if (itemsCount === 0) {
					// Check if there are uris to add and add them
					if (uris.length) {
						treeDataTransfer.set(Mimes.uriList, {
							asString: () => Promise.resolve(uris.map(uri => uri.toString()).join('\n')),
							value: undefined
						});
					}
					resolve();
				}
			}

			if (!originalEvent.dataTransfer) {
				return;
			}
			for (const dataItem of originalEvent.dataTransfer.items) {
				const type = dataItem.type;
				const kind = dataItem.kind;
				const convertedType = this.convertKnownMimes(type, kind).type;
				if ((INTERNAL_MIME_TYPES.indexOf(convertedType) < 0)
					&& (convertedType === this.treeMimeType) || (dndController.dropMimeTypes.indexOf(convertedType) >= 0)) {
					if (dataItem.kind === 'string') {
						dataItem.getAsString(dataValue => {
							if (convertedType === this.treeMimeType) {
								treeSourceInfo = JSON.parse(dataValue);
							}
							if (dataValue) {
								const converted = this.convertKnownMimes(type, kind, dataValue);
								treeDataTransfer.set(converted.type, {
									asString: () => Promise.resolve(converted.value!),
									value: undefined
								});
							}
							decrementStringCount();
						});
					} else if (dataItem.kind === 'file') {
						const dataValue = dataItem.getAsFile();
						if (dataValue) {
							uris.push(URI.file(dataValue.path));
						}
						decrementStringCount();
					}
				} else if (dataItem.kind === 'string' || dataItem.kind === 'file') {
					decrementStringCount();
				}
			}
		});

		const additionalWillDropPromise = this.treeViewsDragAndDropService.removeDragOperationTransfer(willDropUuid);
		if (!additionalWillDropPromise) {
			return dndController.handleDrop(treeDataTransfer, targetNode, new CancellationTokenSource().token, willDropUuid, treeSourceInfo?.id, treeSourceInfo?.itemHandles);
		}
		return additionalWillDropPromise.then(additionalDataTransfer => {
			if (additionalDataTransfer) {
				for (const item of additionalDataTransfer.entries()) {
					treeDataTransfer.set(item[0], item[1]);
				}
			}
			return dndController.handleDrop(treeDataTransfer, targetNode, new CancellationTokenSource().token, willDropUuid, treeSourceInfo?.id, treeSourceInfo?.itemHandles);
		});

	}

	onDragEnd(originalEvent: DragEvent): void {
		// Check if the drag was cancelled.
		if (originalEvent.dataTransfer?.dropEffect === 'none') {
			this.dragCancellationToken?.cancel();
		}
	}
}
