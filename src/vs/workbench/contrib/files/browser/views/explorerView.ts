/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import * as perf from 'vs/base/common/performance';
import { WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification } from 'vs/base/common/actions';
import { memoize } from 'vs/base/common/decorators';
import { IFilesConfiguration, ExplorerFolderContext, FilesExplorerFocusedContext, ExplorerFocusedContext, ExplorerRootContext, ExplorerResourceReadonlyContext, ExplorerResourceCut, ExplorerResourceMoveableToTrash, ExplorerCompressedFocusContext, ExplorerCompressedFirstFocusContext, ExplorerCompressedLastFocusContext, ExplorerResourceAvailableEditorIdsContext, VIEW_ID, VIEWLET_ID, ExplorerResourceNotReadonlyContext, ViewHasSomeCollapsibleRootItemContext, FoldersViewVisibleContext } from 'vs/workbench/contrib/files/common/files';
import { FileCopiedContext, NEW_FILE_COMMAND_ID, NEW_FOLDER_COMMAND_ID } from 'vs/workbench/contrib/files/browser/fileActions';
import * as DOM from 'vs/base/browser/dom';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { ExplorerDecorationsProvider } from 'vs/workbench/contrib/files/browser/views/explorerDecorationsProvider';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IConfigurationService, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IProgressService, ProgressLocation } from 'vs/platform/progress/common/progress';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IContextKeyService, IContextKey, ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ResourceContextKey } from 'vs/workbench/common/contextkeys';
import { IDecorationsService } from 'vs/workbench/services/decorations/common/decorations';
import { WorkbenchCompressibleAsyncDataTree } from 'vs/platform/list/browser/listService';
import { DelayedDragHandler } from 'vs/base/browser/dnd';
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IViewPaneOptions, ViewPane } from 'vs/workbench/browser/parts/views/viewPane';
import { ILabelService } from 'vs/platform/label/common/label';
import { ExplorerDelegate, ExplorerDataSource, FilesRenderer, ICompressedNavigationController, FilesFilter, FileSorter, FileDragAndDrop, ExplorerCompressionDelegate, isCompressedFolderName } from 'vs/workbench/contrib/files/browser/views/explorerViewer';
import { IThemeService, IFileIconTheme } from 'vs/platform/theme/common/themeService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { ITreeContextMenuEvent, TreeVisibility } from 'vs/base/browser/ui/tree/tree';
import { MenuId, Action2, registerAction2 } from 'vs/platform/actions/common/actions';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { ExplorerItem, NewExplorerItem } from 'vs/workbench/contrib/files/common/explorerModel';
import { ResourceLabels } from 'vs/workbench/browser/labels';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IAsyncDataTreeViewState } from 'vs/base/browser/ui/tree/asyncDataTree';
import { FuzzyScore } from 'vs/base/common/filters';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IFileService, FileSystemProviderCapabilities } from 'vs/platform/files/common/files';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IViewDescriptorService, IViewsService, ViewContainerLocation } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { EditorResourceAccessor, SideBySideEditor } from 'vs/workbench/common/editor';
import { IExplorerService, IExplorerView } from 'vs/workbench/contrib/files/browser/files';
import { Codicon } from 'vs/base/common/codicons';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IEditorResolverService } from 'vs/workbench/services/editor/common/editorResolverService';
import { IPaneCompositePartService } from 'vs/workbench/services/panecomposite/browser/panecomposite';
import { EditorOpenSource } from 'vs/platform/editor/common/editor';
import { ResourceMap } from 'vs/base/common/map';
import { isInputElement } from 'vs/base/browser/ui/list/listWidget';


function hasExpandedRootChild(tree: WorkbenchCompressibleAsyncDataTree<ExplorerItem | ExplorerItem[], ExplorerItem, FuzzyScore>, treeInput: ExplorerItem[]): boolean {
	for (const folder of treeInput) {
		if (tree.hasNode(folder) && !tree.isCollapsed(folder)) {
			for (const [, child] of folder.children.entries()) {
				if (tree.hasNode(child) && tree.isCollapsible(child) && !tree.isCollapsed(child)) {
					return true;
				}
			}
		}
	}
	return false;
}

/**
 * Whether or not any of the nodes in the tree are expanded
 */
function hasExpandedNode(tree: WorkbenchCompressibleAsyncDataTree<ExplorerItem | ExplorerItem[], ExplorerItem, FuzzyScore>, treeInput: ExplorerItem[]): boolean {
	for (const folder of treeInput) {
		if (tree.hasNode(folder) && !tree.isCollapsed(folder)) {
			return true;
		}
	}
	return false;
}

const identityProvider = {
	getId: (stat: ExplorerItem) => {
		if (stat instanceof NewExplorerItem) {
			return `new:${stat.getId()}`;
		}

		return stat.getId();
	}
};

export function getContext(focus: ExplorerItem[], selection: ExplorerItem[], respectMultiSelection: boolean,
	compressedNavigationControllerProvider: { getCompressedNavigationController(stat: ExplorerItem): ICompressedNavigationController | undefined }): ExplorerItem[] {

	let focusedStat: ExplorerItem | undefined;
	focusedStat = focus.length ? focus[0] : undefined;

	// If we are respecting multi-select and we have a multi-selection we ignore focus as we want to act on the selection
	if (respectMultiSelection && selection.length > 1) {
		focusedStat = undefined;
	}

	const compressedNavigationController = focusedStat && compressedNavigationControllerProvider.getCompressedNavigationController(focusedStat);
	focusedStat = compressedNavigationController ? compressedNavigationController.current : focusedStat;

	const selectedStats: ExplorerItem[] = [];

	for (const stat of selection) {
		const controller = compressedNavigationControllerProvider.getCompressedNavigationController(stat);
		if (controller && focusedStat && controller === compressedNavigationController) {
			if (stat === focusedStat) {
				selectedStats.push(stat);
			}
			// Ignore stats which are selected but are part of the same compact node as the focused stat
			continue;
		}

		if (controller) {
			selectedStats.push(...controller.items);
		} else {
			selectedStats.push(stat);
		}
	}
	if (!focusedStat) {
		if (respectMultiSelection) {
			return selectedStats;
		} else {
			return [];
		}
	}

	if (respectMultiSelection && selectedStats.indexOf(focusedStat) >= 0) {
		return selectedStats;
	}

	return [focusedStat];
}

export interface IExplorerViewContainerDelegate {
	willOpenElement(event?: UIEvent): void;
	didOpenElement(event?: UIEvent): void;
}

export interface IExplorerViewPaneOptions extends IViewPaneOptions {
	delegate: IExplorerViewContainerDelegate;
}

export class ExplorerView extends ViewPane implements IExplorerView {
	static readonly TREE_VIEW_STATE_STORAGE_KEY: string = 'workbench.explorer.treeViewState';

	private tree!: WorkbenchCompressibleAsyncDataTree<ExplorerItem | ExplorerItem[], ExplorerItem, FuzzyScore>;
	private filter!: FilesFilter;

	private resourceContext: ResourceContextKey;
	private folderContext: IContextKey<boolean>;
	private readonlyContext: IContextKey<boolean>;
	private availableEditorIdsContext: IContextKey<string>;

	private rootContext: IContextKey<boolean>;
	private resourceMoveableToTrash: IContextKey<boolean>;

	private renderer!: FilesRenderer;

	private treeContainer!: HTMLElement;
	private container!: HTMLElement;
	private compressedFocusContext: IContextKey<boolean>;
	private compressedFocusFirstContext: IContextKey<boolean>;
	private compressedFocusLastContext: IContextKey<boolean>;

	private viewHasSomeCollapsibleRootItem: IContextKey<boolean>;
	private viewVisibleContextKey: IContextKey<boolean>;

	private setTreeInputPromise: Promise<void> | undefined;
	private horizontalScrolling: boolean | undefined;

	private dragHandler!: DelayedDragHandler;
	private autoReveal: boolean | 'force' | 'focusNoScroll' = false;
	private decorationsProvider: ExplorerDecorationsProvider | undefined;
	private readonly delegate: IExplorerViewContainerDelegate | undefined;

	constructor(
		options: IExplorerViewPaneOptions,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IProgressService private readonly progressService: IProgressService,
		@IEditorService private readonly editorService: IEditorService,
		@IEditorResolverService private readonly editorResolverService: IEditorResolverService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService configurationService: IConfigurationService,
		@IDecorationsService private readonly decorationService: IDecorationsService,
		@ILabelService private readonly labelService: ILabelService,
		@IThemeService themeService: IWorkbenchThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IExplorerService private readonly explorerService: IExplorerService,
		@IStorageService private readonly storageService: IStorageService,
		@IClipboardService private clipboardService: IClipboardService,
		@IFileService private readonly fileService: IFileService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
		@ICommandService private readonly commandService: ICommandService,
		@IOpenerService openerService: IOpenerService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this.delegate = options.delegate;
		this.resourceContext = instantiationService.createInstance(ResourceContextKey);
		this._register(this.resourceContext);

		this.folderContext = ExplorerFolderContext.bindTo(contextKeyService);
		this.readonlyContext = ExplorerResourceReadonlyContext.bindTo(contextKeyService);
		this.availableEditorIdsContext = ExplorerResourceAvailableEditorIdsContext.bindTo(contextKeyService);
		this.rootContext = ExplorerRootContext.bindTo(contextKeyService);
		this.resourceMoveableToTrash = ExplorerResourceMoveableToTrash.bindTo(contextKeyService);
		this.compressedFocusContext = ExplorerCompressedFocusContext.bindTo(contextKeyService);
		this.compressedFocusFirstContext = ExplorerCompressedFirstFocusContext.bindTo(contextKeyService);
		this.compressedFocusLastContext = ExplorerCompressedLastFocusContext.bindTo(contextKeyService);
		this.viewHasSomeCollapsibleRootItem = ViewHasSomeCollapsibleRootItemContext.bindTo(contextKeyService);
		this.viewVisibleContextKey = FoldersViewVisibleContext.bindTo(contextKeyService);


		this.explorerService.registerView(this);
	}

	get name(): string {
		return this.labelService.getWorkspaceLabel(this.contextService.getWorkspace());
	}

	override get title(): string {
		return this.name;
	}

	override set title(_: string) {
		// noop
	}

	override setVisible(visible: boolean): void {
		this.viewVisibleContextKey.set(visible);
		super.setVisible(visible);
	}

	@memoize private get fileCopiedContextKey(): IContextKey<boolean> {
		return FileCopiedContext.bindTo(this.contextKeyService);
	}

	@memoize private get resourceCutContextKey(): IContextKey<boolean> {
		return ExplorerResourceCut.bindTo(this.contextKeyService);
	}

	// Split view methods

	protected override renderHeader(container: HTMLElement): void {
		super.renderHeader(container);

		// Expand on drag over
		this.dragHandler = new DelayedDragHandler(container, () => this.setExpanded(true));

		const titleElement = container.querySelector('.title') as HTMLElement;
		const setHeader = () => {
			const workspace = this.contextService.getWorkspace();
			const title = workspace.folders.map(folder => folder.name).join();
			titleElement.textContent = this.name;
			titleElement.title = title;
			this.ariaHeaderLabel = nls.localize('explorerSection', "Explorer Section: {0}", this.name);
			titleElement.setAttribute('aria-label', this.ariaHeaderLabel);
		};

		this._register(this.contextService.onDidChangeWorkspaceName(setHeader));
		this._register(this.labelService.onDidChangeFormatters(setHeader));
		setHeader();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.container = container;
		this.treeContainer = DOM.append(container, DOM.$('.explorer-folders-view'));

		this.createTree(this.treeContainer);

		this._register(this.labelService.onDidChangeFormatters(() => {
			this._onDidChangeTitleArea.fire();
		}));

		// Update configuration
		this.onConfigurationUpdated(undefined);

		// When the explorer viewer is loaded, listen to changes to the editor input
		this._register(this.editorService.onDidActiveEditorChange(() => {
			this.selectActiveFile();
		}));

		// Also handle configuration updates
		this._register(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationUpdated(e)));

		this._register(this.onDidChangeBodyVisibility(async visible => {
			if (visible) {
				// Always refresh explorer when it becomes visible to compensate for missing file events #126817
				await this.setTreeInput();
				// Update the collapse / expand  button state
				this.updateAnyCollapsedContext();
				// Find resource to focus from active editor input if set
				this.selectActiveFile(true);
			}
		}));
	}

	override focus(): void {
		this.tree.domFocus();

		const focused = this.tree.getFocus();
		if (focused.length === 1 && this.autoReveal) {
			this.tree.reveal(focused[0], 0.5);
		}
	}

	hasFocus(): boolean {
		return DOM.isAncestor(document.activeElement, this.container);
	}

	getContext(respectMultiSelection: boolean): ExplorerItem[] {
		return getContext(this.tree.getFocus(), this.tree.getSelection(), respectMultiSelection, this.renderer);
	}

	isItemVisible(item: ExplorerItem): boolean {
		// If filter is undefined it means the tree hasn't been rendered yet, so nothing is visible
		if (!this.filter) {
			return false;
		}
		return this.filter.filter(item, TreeVisibility.Visible);
	}

	isItemCollapsed(item: ExplorerItem): boolean {
		return this.tree.isCollapsed(item);
	}

	async setEditable(stat: ExplorerItem, isEditing: boolean): Promise<void> {
		if (isEditing) {
			this.horizontalScrolling = this.tree.options.horizontalScrolling;

			if (this.horizontalScrolling) {
				this.tree.updateOptions({ horizontalScrolling: false });
			}

			await this.tree.expand(stat.parent!);
		} else {
			if (this.horizontalScrolling !== undefined) {
				this.tree.updateOptions({ horizontalScrolling: this.horizontalScrolling });
			}

			this.horizontalScrolling = undefined;
			this.treeContainer.classList.remove('highlight');
		}

		await this.refresh(false, stat.parent, false);

		if (isEditing) {
			this.treeContainer.classList.add('highlight');
			this.tree.reveal(stat);
		} else {
			this.tree.domFocus();
		}
	}

	private selectActiveFile(reveal = this.autoReveal): void {
		if (this.autoReveal) {
			const activeFile = EditorResourceAccessor.getCanonicalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });

			if (activeFile) {
				const focus = this.tree.getFocus();
				const selection = this.tree.getSelection();
				if (focus.length === 1 && this.uriIdentityService.extUri.isEqual(focus[0].resource, activeFile) && selection.length === 1 && this.uriIdentityService.extUri.isEqual(selection[0].resource, activeFile)) {
					// No action needed, active file is already focused and selected
					return;
				}
				this.explorerService.select(activeFile, reveal);
			}
		}
	}

	private createTree(container: HTMLElement): void {
		this.filter = this.instantiationService.createInstance(FilesFilter);
		this._register(this.filter);
		this._register(this.filter.onDidChange(() => this.refresh(true)));
		const explorerLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
		this._register(explorerLabels);

		const updateWidth = (stat: ExplorerItem) => this.tree.updateWidth(stat);
		this.renderer = this.instantiationService.createInstance(FilesRenderer, container, explorerLabels, updateWidth);
		this._register(this.renderer);

		this._register(createFileIconThemableTreeContainerScope(container, this.themeService));

		const isCompressionEnabled = () => this.configurationService.getValue<boolean>('explorer.compactFolders');

		const getFileNestingSettings = (item?: ExplorerItem) => this.configurationService.getValue<IFilesConfiguration>({ resource: item?.root.resource }).explorer.fileNesting;

		this.tree = <WorkbenchCompressibleAsyncDataTree<ExplorerItem | ExplorerItem[], ExplorerItem, FuzzyScore>>this.instantiationService.createInstance(WorkbenchCompressibleAsyncDataTree, 'FileExplorer', container, new ExplorerDelegate(), new ExplorerCompressionDelegate(), [this.renderer],
			this.instantiationService.createInstance(ExplorerDataSource, this.filter), {
			compressionEnabled: isCompressionEnabled(),
			accessibilityProvider: this.renderer,
			identityProvider,
			keyboardNavigationLabelProvider: {
				getKeyboardNavigationLabel: (stat: ExplorerItem) => {
					if (this.explorerService.isEditable(stat)) {
						return undefined;
					}

					return stat.name;
				},
				getCompressedNodeKeyboardNavigationLabel: (stats: ExplorerItem[]) => {
					if (stats.some(stat => this.explorerService.isEditable(stat))) {
						return undefined;
					}

					return stats.map(stat => stat.name).join('/');
				}
			},
			multipleSelectionSupport: true,
			filter: this.filter,
			sorter: this.instantiationService.createInstance(FileSorter),
			dnd: this.instantiationService.createInstance(FileDragAndDrop, (item) => this.isItemCollapsed(item)),
			collapseByDefault: (e) => {
				if (e instanceof ExplorerItem) {
					if (e.hasNests && getFileNestingSettings(e).expand) {
						return false;
					}
				}
				return true;
			},
			autoExpandSingleChildren: true,
			expandOnlyOnTwistieClick: (e: unknown) => {
				if (e instanceof ExplorerItem) {
					if (e.hasNests) {
						return true;
					}
					else if (this.configurationService.getValue<'singleClick' | 'doubleClick'>('workbench.tree.expandMode') === 'doubleClick') {
						return true;
					}
				}
				return false;
			},
			paddingBottom: ExplorerDelegate.ITEM_HEIGHT,
			overrideStyles: {
				listBackground: SIDE_BAR_BACKGROUND
			}
		});
		this._register(this.tree);
		this._register(this.themeService.onDidColorThemeChange(() => this.tree.rerender()));

		// Bind configuration
		const onDidChangeCompressionConfiguration = Event.filter(this.configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('explorer.compactFolders'));
		this._register(onDidChangeCompressionConfiguration(_ => this.tree.updateOptions({ compressionEnabled: isCompressionEnabled() })));

		// Bind context keys
		FilesExplorerFocusedContext.bindTo(this.tree.contextKeyService);
		ExplorerFocusedContext.bindTo(this.tree.contextKeyService);

		// Update resource context based on focused element
		this._register(this.tree.onDidChangeFocus(e => this.onFocusChanged(e.elements)));
		this.onFocusChanged([]);
		// Open when selecting via keyboard
		this._register(this.tree.onDidOpen(async e => {
			const element = e.element;
			if (!element) {
				return;
			}
			// Do not react if the user is expanding selection via keyboard.
			// Check if the item was previously also selected, if yes the user is simply expanding / collapsing current selection #66589.
			const shiftDown = e.browserEvent instanceof KeyboardEvent && e.browserEvent.shiftKey;
			if (!shiftDown) {
				if (element.isDirectory || this.explorerService.isEditable(undefined)) {
					// Do not react if user is clicking on explorer items while some are being edited #70276
					// Do not react if clicking on directories
					return;
				}
				this.telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: 'workbench.files.openFile', from: 'explorer' });
				try {
					this.delegate?.willOpenElement(e.browserEvent);
					await this.editorService.openEditor({ resource: element.resource, options: { preserveFocus: e.editorOptions.preserveFocus, pinned: e.editorOptions.pinned, source: EditorOpenSource.USER } }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
				} finally {
					this.delegate?.didOpenElement();
				}
			}
		}));

		this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));

		this._register(this.tree.onDidScroll(async e => {
			const editable = this.explorerService.getEditable();
			if (e.scrollTopChanged && editable && this.tree.getRelativeTop(editable.stat) === null) {
				await editable.data.onFinish('', false);
			}
		}));

		this._register(this.tree.onDidChangeCollapseState(e => {
			const element = e.node.element?.element;
			if (element) {
				const navigationController = this.renderer.getCompressedNavigationController(element instanceof Array ? element[0] : element);
				navigationController?.updateCollapsed(e.node.collapsed);
			}
			// Update showing expand / collapse button
			this.updateAnyCollapsedContext();
		}));

		this.updateAnyCollapsedContext();

		this._register(this.tree.onMouseDblClick(e => {
			// If empty space is clicked, and not scrolling by page enabled #173261
			const scrollingByPage = this.configurationService.getValue<boolean>('workbench.list.scrollByPage');
			if (e.element === null && !scrollingByPage) {
				// click in empty area -> create a new file #116676
				this.commandService.executeCommand(NEW_FILE_COMMAND_ID);
			}
		}));

		// save view state
		this._register(this.storageService.onWillSaveState(() => {
			this.storeTreeViewState();
		}));
	}

	// React on events

	private onConfigurationUpdated(event: IConfigurationChangeEvent | undefined): void {
		if (!event || event.affectsConfiguration('explorer.autoReveal')) {
			const configuration = this.configurationService.getValue<IFilesConfiguration>();
			this.autoReveal = configuration?.explorer?.autoReveal;
		}

		// Push down config updates to components of viewer
		if (event && (event.affectsConfiguration('explorer.decorations.colors') || event.affectsConfiguration('explorer.decorations.badges'))) {
			this.refresh(true);
		}
	}

	private storeTreeViewState() {
		this.storageService.store(ExplorerView.TREE_VIEW_STATE_STORAGE_KEY, JSON.stringify(this.tree.getViewState()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	private setContextKeys(stat: ExplorerItem | null | undefined): void {
		const folders = this.contextService.getWorkspace().folders;
		const resource = stat ? stat.resource : folders[folders.length - 1].uri;
		stat = stat || this.explorerService.findClosest(resource);
		this.resourceContext.set(resource);
		this.folderContext.set(!!stat && stat.isDirectory);
		this.readonlyContext.set(!!stat && !!stat.isReadonly);
		this.rootContext.set(!!stat && stat.isRoot);

		if (resource) {
			const overrides = resource ? this.editorResolverService.getEditors(resource).map(editor => editor.id) : [];
			this.availableEditorIdsContext.set(overrides.join(','));
		} else {
			this.availableEditorIdsContext.reset();
		}
	}

	private async onContextMenu(e: ITreeContextMenuEvent<ExplorerItem>): Promise<void> {
		if (isInputElement(e.browserEvent.target as HTMLElement)) {
			return;
		}

		const stat = e.element;
		let anchor = e.anchor;

		// Adjust for compressed folders (except when mouse is used)
		if (DOM.isHTMLElement(anchor)) {
			if (stat) {
				const controller = this.renderer.getCompressedNavigationController(stat);

				if (controller) {
					if (e.browserEvent instanceof KeyboardEvent || isCompressedFolderName(e.browserEvent.target)) {
						anchor = controller.labels[controller.index];
					} else {
						controller.last();
					}
				}
			}
		}

		// update dynamic contexts
		this.fileCopiedContextKey.set(await this.clipboardService.hasResources());
		this.setContextKeys(stat);

		const selection = this.tree.getSelection();

		const roots = this.explorerService.roots; // If the click is outside of the elements pass the root resource if there is only one root. If there are multiple roots pass empty object.
		let arg: URI | {};
		if (stat instanceof ExplorerItem) {
			const compressedController = this.renderer.getCompressedNavigationController(stat);
			arg = compressedController ? compressedController.current.resource : stat.resource;
		} else {
			arg = roots.length === 1 ? roots[0].resource : {};
		}

		this.contextMenuService.showContextMenu({
			menuId: MenuId.ExplorerContext,
			menuActionOptions: { arg, shouldForwardArgs: true },
			contextKeyService: this.tree.contextKeyService,
			getAnchor: () => anchor,
			onHide: (wasCancelled?: boolean) => {
				if (wasCancelled) {
					this.tree.domFocus();
				}
			},
			getActionsContext: () => stat && selection && selection.indexOf(stat) >= 0
				? selection.map((fs: ExplorerItem) => fs.resource)
				: stat instanceof ExplorerItem ? [stat.resource] : []
		});
	}

	private onFocusChanged(elements: readonly ExplorerItem[]): void {
		const stat = elements && elements.length ? elements[0] : undefined;
		this.setContextKeys(stat);

		if (stat) {
			const enableTrash = this.configurationService.getValue<IFilesConfiguration>().files.enableTrash;
			const hasCapability = this.fileService.hasCapability(stat.resource, FileSystemProviderCapabilities.Trash);
			this.resourceMoveableToTrash.set(enableTrash && hasCapability);
		} else {
			this.resourceMoveableToTrash.reset();
		}

		const compressedNavigationController = stat && this.renderer.getCompressedNavigationController(stat);

		if (!compressedNavigationController) {
			this.compressedFocusContext.set(false);
			return;
		}

		this.compressedFocusContext.set(true);
		this.updateCompressedNavigationContextKeys(compressedNavigationController);
	}

	// General methods

	/**
	 * Refresh the contents of the explorer to get up to date data from the disk about the file structure.
	 * If the item is passed we refresh only that level of the tree, otherwise we do a full refresh.
	 */
	refresh(recursive: boolean, item?: ExplorerItem, cancelEditing: boolean = true): Promise<void> {
		if (!this.tree || !this.isBodyVisible() || (item && !this.tree.hasNode(item))) {
			// Tree node doesn't exist yet, when it becomes visible we will refresh
			return Promise.resolve(undefined);
		}

		if (cancelEditing && this.explorerService.isEditable(undefined)) {
			this.tree.domFocus();
		}

		const toRefresh = item || this.tree.getInput();
		return this.tree.updateChildren(toRefresh, recursive, !!item, {
			diffIdentityProvider: identityProvider
		});
	}

	override getOptimalWidth(): number {
		const parentNode = this.tree.getHTMLElement();
		const childNodes = ([] as HTMLElement[]).slice.call(parentNode.querySelectorAll('.explorer-item .label-name')); // select all file labels

		return DOM.getLargestChildWidth(parentNode, childNodes);
	}

	async setTreeInput(): Promise<void> {
		if (!this.isBodyVisible()) {
			return Promise.resolve(undefined);
		}

		// Wait for the last execution to complete before executing
		if (this.setTreeInputPromise) {
			await this.setTreeInputPromise;
		}

		const initialInputSetup = !this.tree.getInput();
		if (initialInputSetup) {
			perf.mark('code/willResolveExplorer');
		}
		const roots = this.explorerService.roots;
		let input: ExplorerItem | ExplorerItem[] = roots[0];
		if (this.contextService.getWorkbenchState() !== WorkbenchState.FOLDER || roots[0].error) {
			// Display roots only when multi folder workspace
			input = roots;
		}

		let viewState: IAsyncDataTreeViewState | undefined;
		if (this.tree && this.tree.getInput()) {
			viewState = this.tree.getViewState();
		} else {
			const rawViewState = this.storageService.get(ExplorerView.TREE_VIEW_STATE_STORAGE_KEY, StorageScope.WORKSPACE);
			if (rawViewState) {
				viewState = JSON.parse(rawViewState);
			}
		}

		const previousInput = this.tree.getInput();
		const promise = this.setTreeInputPromise = this.tree.setInput(input, viewState).then(async () => {
			if (Array.isArray(input)) {
				if (!viewState || previousInput instanceof ExplorerItem) {
					// There is no view state for this workspace (we transitioned from a folder workspace?), expand up to five roots.
					// If there are many roots in a workspace, expanding them all would can cause performance issues #176226
					for (let i = 0; i < Math.min(input.length, 5); i++) {
						try {
							await this.tree.expand(input[i]);
						} catch (e) { }
					}
				}
				// Reloaded or transitioned from an empty workspace, but only have a single folder in the workspace.
				if (!previousInput && input.length === 1 && this.configurationService.getValue<IFilesConfiguration>().explorer.expandSingleFolderWorkspaces) {
					await this.tree.expand(input[0]).catch(() => { });
				}
				if (Array.isArray(previousInput)) {
					const previousRoots = new ResourceMap<true>();
					previousInput.forEach(previousRoot => previousRoots.set(previousRoot.resource, true));

					// Roots added to the explorer -> expand them.
					await Promise.all(input.map(async item => {
						if (!previousRoots.has(item.resource)) {
							try {
								await this.tree.expand(item);
							} catch (e) { }
						}
					}));
				}
			}
			if (initialInputSetup) {
				perf.mark('code/didResolveExplorer');
			}
		});

		this.progressService.withProgress({
			location: ProgressLocation.Explorer,
			delay: this.layoutService.isRestored() ? 800 : 1500 // reduce progress visibility when still restoring
		}, _progress => promise);

		await promise;
		if (!this.decorationsProvider) {
			this.decorationsProvider = new ExplorerDecorationsProvider(this.explorerService, this.contextService);
			this._register(this.decorationService.registerDecorationsProvider(this.decorationsProvider));
		}
	}

	public async selectResource(resource: URI | undefined, reveal = this.autoReveal, retry = 0): Promise<void> {
		// do no retry more than once to prevent infinite loops in cases of inconsistent model
		if (retry === 2) {
			return;
		}

		if (!resource || !this.isBodyVisible()) {
			return;
		}

		// Expand all stats in the parent chain.
		let item: ExplorerItem | null = this.explorerService.findClosestRoot(resource);

		while (item && item.resource.toString() !== resource.toString()) {
			try {
				await this.tree.expand(item);
			} catch (e) {
				return this.selectResource(resource, reveal, retry + 1);
			}

			for (const child of item.children.values()) {
				if (this.uriIdentityService.extUri.isEqualOrParent(resource, child.resource)) {
					item = child;
					break;
				}
				item = null;
			}
		}

		if (item) {
			if (item === this.tree.getInput()) {
				this.tree.setFocus([]);
				this.tree.setSelection([]);
				return;
			}

			try {
				// We must expand the nest to have it be populated in the tree
				if (item.nestedParent) {
					await this.tree.expand(item.nestedParent);
				}

				if ((reveal === true || reveal === 'force') && this.tree.getRelativeTop(item) === null) {
					// Don't scroll to the item if it's already visible, or if set not to.
					this.tree.reveal(item, 0.5);
				}

				this.tree.setFocus([item]);
				this.tree.setSelection([item]);
			} catch (e) {
				// Element might not be in the tree, try again and silently fail
				return this.selectResource(resource, reveal, retry + 1);
			}
		}
	}

	itemsCopied(stats: ExplorerItem[], cut: boolean, previousCut: ExplorerItem[] | undefined): void {
		this.fileCopiedContextKey.set(stats.length > 0);
		this.resourceCutContextKey.set(cut && stats.length > 0);
		previousCut?.forEach(item => this.tree.rerender(item));
		if (cut) {
			stats.forEach(s => this.tree.rerender(s));
		}
	}

	expandAll(): void {
		if (this.explorerService.isEditable(undefined)) {
			this.tree.domFocus();
		}

		this.tree.expandAll();
	}

	collapseAll(): void {
		if (this.explorerService.isEditable(undefined)) {
			this.tree.domFocus();
		}

		const treeInput = this.tree.getInput();
		if (Array.isArray(treeInput)) {
			if (hasExpandedRootChild(this.tree, treeInput)) {
				treeInput.forEach(folder => {
					folder.children.forEach(child => this.tree.hasNode(child) && this.tree.collapse(child, true));
				});

				return;
			}
		}

		this.tree.collapseAll();
	}

	previousCompressedStat(): void {
		const focused = this.tree.getFocus();
		if (!focused.length) {
			return;
		}

		const compressedNavigationController = this.renderer.getCompressedNavigationController(focused[0])!;
		compressedNavigationController.previous();
		this.updateCompressedNavigationContextKeys(compressedNavigationController);
	}

	nextCompressedStat(): void {
		const focused = this.tree.getFocus();
		if (!focused.length) {
			return;
		}

		const compressedNavigationController = this.renderer.getCompressedNavigationController(focused[0])!;
		compressedNavigationController.next();
		this.updateCompressedNavigationContextKeys(compressedNavigationController);
	}

	firstCompressedStat(): void {
		const focused = this.tree.getFocus();
		if (!focused.length) {
			return;
		}

		const compressedNavigationController = this.renderer.getCompressedNavigationController(focused[0])!;
		compressedNavigationController.first();
		this.updateCompressedNavigationContextKeys(compressedNavigationController);
	}

	lastCompressedStat(): void {
		const focused = this.tree.getFocus();
		if (!focused.length) {
			return;
		}

		const compressedNavigationController = this.renderer.getCompressedNavigationController(focused[0])!;
		compressedNavigationController.last();
		this.updateCompressedNavigationContextKeys(compressedNavigationController);
	}

	private updateCompressedNavigationContextKeys(controller: ICompressedNavigationController): void {
		this.compressedFocusFirstContext.set(controller.index === 0);
		this.compressedFocusLastContext.set(controller.index === controller.count - 1);
	}

	private updateAnyCollapsedContext(): void {
		const treeInput = this.tree.getInput();
		if (treeInput === undefined) {
			return;
		}
		const treeInputArray = Array.isArray(treeInput) ? treeInput : Array.from(treeInput.children.values());
		// Has collapsible root when anything is expanded
		this.viewHasSomeCollapsibleRootItem.set(hasExpandedNode(this.tree, treeInputArray));
		// synchronize state to cache
		this.storeTreeViewState();
	}

	override dispose(): void {
		this.dragHandler?.dispose();
		super.dispose();
	}
}

export function createFileIconThemableTreeContainerScope(container: HTMLElement, themeService: IThemeService): IDisposable {
	container.classList.add('file-icon-themable-tree');
	container.classList.add('show-file-icons');

	const onDidChangeFileIconTheme = (theme: IFileIconTheme) => {
		container.classList.toggle('align-icons-and-twisties', theme.hasFileIcons && !theme.hasFolderIcons);
		container.classList.toggle('hide-arrows', theme.hidesExplorerArrows === true);
	};

	onDidChangeFileIconTheme(themeService.getFileIconTheme());
	return themeService.onDidFileIconThemeChange(onDidChangeFileIconTheme);
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.files.action.createFileFromExplorer',
			title: nls.localize('createNewFile', "New File..."),
			f1: false,
			icon: Codicon.newFile,
			precondition: ExplorerResourceNotReadonlyContext,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', VIEW_ID),
				order: 10
			}
		});
	}

	run(accessor: ServicesAccessor): void {
		const commandService = accessor.get(ICommandService);
		commandService.executeCommand(NEW_FILE_COMMAND_ID);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.files.action.createFolderFromExplorer',
			title: nls.localize('createNewFolder', "New Folder..."),
			f1: false,
			icon: Codicon.newFolder,
			precondition: ExplorerResourceNotReadonlyContext,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', VIEW_ID),
				order: 20
			}
		});
	}

	run(accessor: ServicesAccessor): void {
		const commandService = accessor.get(ICommandService);
		commandService.executeCommand(NEW_FOLDER_COMMAND_ID);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.files.action.refreshFilesExplorer',
			title: { value: nls.localize('refreshExplorer', "Refresh Explorer"), original: 'Refresh Explorer' },
			f1: true,
			icon: Codicon.refresh,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', VIEW_ID),
				order: 30
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const paneCompositeService = accessor.get(IPaneCompositePartService);
		const explorerService = accessor.get(IExplorerService);
		await paneCompositeService.openPaneComposite(VIEWLET_ID, ViewContainerLocation.Sidebar);
		await explorerService.refresh();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.files.action.collapseExplorerFolders',
			title: { value: nls.localize('collapseExplorerFolders', "Collapse Folders in Explorer"), original: 'Collapse Folders in Explorer' },
			f1: true,
			icon: Codicon.collapseAll,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', VIEW_ID),
				order: 40
			}
		});
	}

	run(accessor: ServicesAccessor) {
		const viewsService = accessor.get(IViewsService);
		const view = viewsService.getViewWithId(VIEW_ID);
		if (view !== null) {
			const explorerView = view as ExplorerView;
			explorerView.collapseAll();
		}
	}
});
