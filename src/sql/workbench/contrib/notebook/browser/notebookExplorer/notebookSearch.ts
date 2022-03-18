/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SearchLinkButton, SearchView } from 'vs/workbench/contrib/search/browser/searchView';
import { ViewPane, IViewPaneOptions } from 'vs/workbench/browser/parts/views/viewPane';
import { IFileService } from 'vs/platform/files/common/files';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IViewDescriptorService, IViewsService } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { ISearchWorkbenchService, Match, FileMatch, SearchModel, IChangeEvent, searchMatchComparer, RenderableMatch, FolderMatch, SearchResult } from 'vs/workbench/contrib/search/common/searchModel';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IReplaceService } from 'vs/workbench/contrib/search/common/replace';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IPreferencesService } from 'vs/workbench/services/preferences/common/preferences';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { ISearchHistoryService } from 'vs/workbench/contrib/search/common/searchHistoryService';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import * as dom from 'vs/base/browser/dom';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import * as nls from 'vs/nls';
import { ISearchComplete, SearchCompletionExitCode, ITextQuery, SearchSortOrder, ISearchConfigurationProperties } from 'vs/workbench/services/search/common/search';
import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import * as aria from 'vs/base/browser/ui/aria/aria';
import * as errors from 'vs/base/common/errors';
import { NotebookSearchWidget } from 'sql/workbench/contrib/notebook/browser/notebookExplorer/notebookSearchWidget';
import { ITreeElement, ITreeContextMenuEvent } from 'vs/base/browser/ui/tree/tree';
import { Iterable } from 'vs/base/common/iterator';
import { searchClearIcon, searchCollapseAllIcon, searchExpandAllIcon, searchStopIcon } from 'vs/workbench/contrib/search/browser/searchIcons';
import { Action, IAction } from 'vs/base/common/actions';
import { createAndFillInContextMenuActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { Memento } from 'vs/workbench/common/memento';
import { SearchUIState } from 'vs/workbench/contrib/search/common/search';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';

const $ = dom.$;

export class NotebookSearchView extends SearchView {
	static readonly ID = 'notebookExplorer.searchResults';

	private treeSelectionChangeListener: IDisposable;

	private viewActions: Array<CollapseDeepestExpandedLevelAction | ClearSearchResultsAction> = [];
	private cancelSearchAction: CancelSearchAction;
	private toggleExpandAction: ToggleCollapseAndExpandAction;

	constructor(
		options: IViewPaneOptions,
		@IFileService fileService: IFileService,
		@IEditorService editorService: IEditorService,
		@ICodeEditorService codeEditorService: ICodeEditorService,
		@IProgressService progressService: IProgressService,
		@INotificationService notificationService: INotificationService,
		@IDialogService dialogService: IDialogService,
		@IContextViewService contextViewService: IContextViewService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@ISearchWorkbenchService searchWorkbenchService: ISearchWorkbenchService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IReplaceService replaceService: IReplaceService,
		@ITextFileService textFileService: ITextFileService,
		@IPreferencesService preferencesService: IPreferencesService,
		@IThemeService themeService: IThemeService,
		@ISearchHistoryService searchHistoryService: ISearchHistoryService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IMenuService menuService: IMenuService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IStorageService storageService: IStorageService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@ICommandService commandService: ICommandService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService,
	) {

		super(options, fileService, editorService, codeEditorService, progressService, notificationService, dialogService, commandService, contextViewService, instantiationService, viewDescriptorService, configurationService, contextService, searchWorkbenchService, contextKeyService, replaceService, textFileService, preferencesService, themeService, searchHistoryService, contextMenuService, menuService, accessibilityService, keybindingService, storageService, openerService, telemetryService);

		this.memento = new Memento(this.id, storageService);
		this.viewletState = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
		this.viewActions = [
			this._register(this.instantiationService.createInstance(ClearSearchResultsAction, ClearSearchResultsAction.ID, ClearSearchResultsAction.LABEL)),
		];

		const collapseDeepestExpandedLevelAction = this.instantiationService.createInstance(CollapseDeepestExpandedLevelAction, CollapseDeepestExpandedLevelAction.ID, CollapseDeepestExpandedLevelAction.LABEL);
		const expandAllAction = this.instantiationService.createInstance(ExpandAllAction, ExpandAllAction.ID, ExpandAllAction.LABEL);

		this.cancelSearchAction = this._register(this.instantiationService.createInstance(CancelSearchAction, CancelSearchAction.ID, CancelSearchAction.LABEL));
		this.toggleExpandAction = this._register(this.instantiationService.createInstance(ToggleCollapseAndExpandAction, ToggleCollapseAndExpandAction.ID, ToggleCollapseAndExpandAction.LABEL, collapseDeepestExpandedLevelAction, expandAllAction));
	}

	protected override get searchConfig(): ISearchConfigurationProperties {
		return this.configurationService.getValue<ISearchConfigurationProperties>('notebookExplorerSearch');
	}

	get searchViewModel(): SearchModel {
		return this.viewModel;
	}

	hasSearchPattern(): boolean {
		return this.viewModel.searchResult.query?.contentPattern?.pattern.length > 0;
	}

	isSlowSearch(): boolean {
		return this.state !== SearchUIState.Idle;
	}

	public override updateActions(): void {
		for (const action of this.viewActions) {
			action.update();
		}

		this.cancelSearchAction.update();
		this.toggleExpandAction.update();
	}

	getActions(): IAction[] {
		return this.state !== SearchUIState.Idle ? [
			this.cancelSearchAction,
			...this.viewActions,
			this.toggleExpandAction
		] : [...this.viewActions,
		this.toggleExpandAction];
	}

	protected override onContextMenu(e: ITreeContextMenuEvent<RenderableMatch | null>): void {
		if (!this.contextMenu) {
			this.contextMenu = this._register(this.menuService.createMenu(MenuId.SearchContext, this.contextKeyService));
		}

		e.browserEvent.preventDefault();
		e.browserEvent.stopPropagation();

		const actions: IAction[] = [];
		const actionsDisposable = createAndFillInContextMenuActions(this.contextMenu, { shouldForwardArgs: true }, actions);

		this.contextMenuService.showContextMenu({
			getAnchor: () => e.anchor,
			getActions: () => actions,
			getActionsContext: () => e.element,
			onHide: () => dispose(actionsDisposable)
		});
	}

	public override reLayout(): void {
		if (this.isDisposed) {
			return;
		}

		const actionsPosition = this.searchConfig.actionsPosition;
		this.getContainer().classList.toggle(SearchView.ACTIONS_RIGHT_CLASS_NAME, actionsPosition === 'right');

		const messagesSize = this.messagesElement.style.display === 'none' ?
			0 :
			dom.getTotalHeight(this.messagesElement);

		const searchResultContainerHeight = this.size.height -
			messagesSize;

		this.resultsElement.style.height = searchResultContainerHeight + 'px';

		this.tree.layout(searchResultContainerHeight, this.size.width);
	}

	public onDidNotebooksOpenState(): void {
		if (this.contextKeyService.getContextKeyValue('bookOpened') && this.searchWithoutFolderMessageElement) {
			dom.hide(this.searchWithoutFolderMessageElement);
		}
	}

	override renderBody(parent: HTMLElement): void {
		super.callRenderBody(parent);

		this.container = dom.append(parent, dom.$('.search-view'));

		this.messagesElement = dom.append(this.container, $('.result-messages'));
		if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
			this.showSearchWithoutFolderMessage();
		}

		this.createSearchResultsView(this.container);

		this._register(this.viewModel.searchResult.onChange((event) => this.onSearchResultsChanged(event)));
		this._register(this.onDidChangeBodyVisibility(visible => this.onVisibilityChanged(visible)));

		// initialize as collapsed viewpane
		this.setExpanded(false);
	}

	protected override showSearchWithoutFolderMessage(): void {
		this.searchWithoutFolderMessageElement = this.clearMessage();

		const textEl = dom.append(this.searchWithoutFolderMessageElement,
			$('p', undefined, nls.localize('searchWithoutFolder', "You have not opened any folder that contains notebooks/books. ")));

		const openFolderLink = dom.append(textEl,
			$('a.pointer.prominent', { tabindex: 0 }, nls.localize('openNotebookFolder', "Open Notebooks")));

		this.messageDisposables.add(dom.addDisposableListener(openFolderLink, dom.EventType.CLICK, async (e: MouseEvent) => {
			dom.EventHelper.stop(e, false);
			this.commandService.executeCommand('notebook.command.openNotebookFolder');
			this.setExpanded(false);
		}));
	}

	protected override createSearchResultsView(container: HTMLElement): void {
		super.createSearchResultsView(container);

		this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));
		this._register(this.tree.onDidChangeCollapseState(() =>
			this.toggleCollapseStateDelayer.trigger(() => this.toggleExpandAction.onTreeCollapseStateChange())
		));
		this.treeSelectionChangeListener = this._register(this.tree.onDidChangeSelection(async (e) => {
			if (this.tree.getSelection().length && this.tree.getSelection()[0] instanceof FileMatch) {
				let element = this.tree.getSelection()[0] as Match;
				const resource = element instanceof Match ? element.parent().resource : (<FileMatch>element).resource;
				if (resource.fsPath.endsWith('.md')) {
					await this.commandService.executeCommand('markdown.showPreview', resource);
				} else {
					await this.commandService.executeCommand('bookTreeView.openNotebook', resource.fsPath);
				}
				await this.commandService.executeCommand('notebook.action.launchFindInNotebook', this.viewModel.searchResult.query?.contentPattern?.pattern);
			}
		}));
	}

	public startSearch(query: ITextQuery, excludePatternText: string, includePatternText: string, triggeredOnType: boolean, searchWidget: NotebookSearchWidget): Thenable<void> {
		let start = new Date().getTime();
		let progressComplete: () => void;
		this.progressService.withProgress({ location: this.getProgressLocation(), delay: triggeredOnType ? 300 : 0 }, _progress => {
			return new Promise<void>(resolve => progressComplete = resolve);
		});

		this.state = SearchUIState.Searching;
		this.showEmptyStage();

		const slowTimer = setTimeout(() => {
			this.state = SearchUIState.SlowSearch;
			this.updateActions();
		}, 2000);

		const onComplete = async (completed?: ISearchComplete) => {
			let end = new Date().getTime();
			this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Notebook, TelemetryKeys.TelemetryAction.SearchCompleted)
				.withAdditionalProperties({ resultsReturned: completed?.results.length })
				.withAdditionalMeasurements({ timeTakenMs: end - start })
				.send();

			clearTimeout(slowTimer);
			this.state = SearchUIState.Idle;

			// Complete up to 100% as needed
			progressComplete();

			// Do final render, then expand if just 1 file with less than 50 matches
			this.onSearchResultsChanged();

			const collapseResults = this.searchConfig.collapseResults;
			if (collapseResults !== 'alwaysCollapse' && this.viewModel.searchResult.matches().length === 1) {
				const onlyMatch = this.viewModel.searchResult.matches()[0];
				if (onlyMatch.count() < 50) {
					this.tree.expand(onlyMatch);
				}
			}

			this.updateActions();
			const hasResults = !this.viewModel.searchResult.isEmpty();

			if (completed?.exit === SearchCompletionExitCode.NewSearchStarted) {
				return;
			}

			if (completed && completed.limitHit) {
				searchWidget.searchInput.showMessage({
					content: nls.localize('searchMaxResultsWarning', "The result set only contains a subset of all matches. Please be more specific in your search to narrow down the results."),
					type: MessageType.WARNING
				});
			}

			if (!hasResults) {
				const hasExcludes = !!excludePatternText;
				const hasIncludes = !!includePatternText;
				let message: string;

				if (!completed) {
					message = nls.localize('searchInProgress', "Search in progress... - ");
				} else if (hasIncludes && hasExcludes) {
					message = nls.localize('noResultsIncludesExcludes', "No results found in '{0}' excluding '{1}' - ", includePatternText, excludePatternText);
				} else if (hasIncludes) {
					message = nls.localize('noResultsIncludes', "No results found in '{0}' - ", includePatternText);
				} else if (hasExcludes) {
					message = nls.localize('noResultsExcludes', "No results found excluding '{0}' - ", excludePatternText);
				} else {
					message = nls.localize('noResultsFound', "No results found. Review your settings for configured exclusions and check your gitignore files - ");
				}

				// Indicate as status to ARIA
				aria.status(message);

				const messageEl = this.clearMessage();
				const p = dom.append(messageEl, $('p', undefined, message));

				if (!completed) {
					const searchAgainButton = this.messageDisposables.add(new SearchLinkButton(
						nls.localize('rerunSearch.message', "Search again"),
						() => this.triggerQueryChange({ preserveFocus: false })));
					dom.append(p, searchAgainButton.element);
				} else if (hasIncludes || hasExcludes) {
					const searchAgainButton = this.messageDisposables.add(new SearchLinkButton(nls.localize('rerunSearchInAll.message', "Search again in all files"), this.onSearchAgain.bind(this)));
					dom.append(p, searchAgainButton.element);
				} else {
					const openSettingsButton = this.messageDisposables.add(new SearchLinkButton(nls.localize('openSettings.message', "Open Settings"), this.onOpenSettings.bind(this)));
					dom.append(p, openSettingsButton.element);
				}

				if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY && !this.contextKeyService.getContextKeyValue('bookOpened')) {
					this.showSearchWithoutFolderMessage();
				}
				this.reLayout();
			} else {
				this.viewModel.searchResult.toggleHighlights(this.isVisible()); // show highlights

				// Indicate final search result count for ARIA
				aria.status(nls.localize('ariaSearchResultsStatus', "Search returned {0} results in {1} files", this.viewModel.searchResult.count(), this.viewModel.searchResult.fileCount()));
			}
		};

		const onError = (e: any) => {
			clearTimeout(slowTimer);
			this.state = SearchUIState.Idle;
			if (errors.isPromiseCanceledError(e)) {
				return onComplete(undefined);
			} else {
				this.updateActions();
				progressComplete();
				this.viewModel.searchResult.clear();

				return Promise.resolve();
			}
		};

		let visibleMatches = 0;

		let updatedActionsForFileCount = false;

		// Handle UI updates in an interval to show frequent progress and results
		const uiRefreshHandle: any = setInterval(() => {
			if (this.state === SearchUIState.Idle) {
				window.clearInterval(uiRefreshHandle);
				return;
			}

			// Search result tree update
			const fileCount = this.viewModel.searchResult.fileCount();
			if (visibleMatches !== fileCount) {
				visibleMatches = fileCount;
				this.refreshAndUpdateCount().catch(errors.onUnexpectedError);
			}

			if (fileCount > 0 && !updatedActionsForFileCount) {
				updatedActionsForFileCount = true;
				this.updateActions();
			}
		}, 100);

		return this.viewModel.search(query)
			.then(onComplete, onError);
	}

	protected override async refreshAndUpdateCount(event?: IChangeEvent): Promise<void> {
		this.updateSearchResultCount(this.viewModel.searchResult.query!.userDisabledExcludesAndIgnoreFiles, false);
		return this.refreshTree(event);
	}

	override async refreshTree(event?: IChangeEvent): Promise<void> {
		const collapseResults = this.searchConfig.collapseResults;
		if (!event || event.added || event.removed) {
			// Refresh whole tree
			if (this.searchConfig.sortOrder === SearchSortOrder.Modified) {
				// Ensure all matches have retrieved their file stat
				await this.retrieveFileStats()
					.then(() => this.tree.setChildren(null, this.createSearchResultIterator(collapseResults)));
			} else {
				this.tree.setChildren(null, this.createSearchResultIterator(collapseResults));
			}
		} else {
			// If updated counts affect our search order, re-sort the view.
			if (this.searchConfig.sortOrder === SearchSortOrder.CountAscending ||
				this.searchConfig.sortOrder === SearchSortOrder.CountDescending) {
				this.tree.setChildren(null, this.createSearchResultIterator(collapseResults));
			} else {
				// FileMatch modified, refresh those elements
				event.elements.forEach(element => {
					this.tree.setChildren(element, this.createSearchIterator(element, collapseResults));
					this.tree.rerender(element);
				});
			}
		}
	}

	override cancelSearch(focus: boolean = true): boolean {
		if (this.viewModel.cancelSearch(false)) {
			return true;
		}
		return false;
	}

	private createSearchResultIterator(collapseResults: ISearchConfigurationProperties['collapseResults']): Iterable<ITreeElement<RenderableMatch>> {
		const folderMatches = this.searchResult.folderMatches()
			.filter(fm => !fm.isEmpty())
			.sort(searchMatchComparer);

		if (folderMatches.length === 1) {
			return this.createSearchFolderIterator(folderMatches[0], collapseResults);
		}

		return Iterable.map(folderMatches, folderMatch => {
			const children = this.createSearchFolderIterator(folderMatch, collapseResults);
			return <ITreeElement<RenderableMatch>>{ element: folderMatch, children };
		});
	}

	private createSearchFolderIterator(folderMatch: FolderMatch, collapseResults: ISearchConfigurationProperties['collapseResults']): Iterable<ITreeElement<RenderableMatch>> {
		const sortOrder = this.searchConfig.sortOrder;
		const matches = folderMatch.matches().sort((a, b) => searchMatchComparer(a, b, sortOrder));

		return Iterable.map(matches, fileMatch => {
			//const children = this.createFileIterator(fileMatch);
			let nodeExists = true;
			try { this.tree.getNode(fileMatch); } catch (e) { nodeExists = false; }

			const collapsed = nodeExists ? undefined :
				(collapseResults === 'alwaysCollapse' || (fileMatch.matches().length > 10 && collapseResults !== 'alwaysExpand'));

			return <ITreeElement<RenderableMatch>>{ element: fileMatch, undefined, collapsed, collapsible: false };
		});
	}

	private createSearchFileIterator(fileMatch: FileMatch): Iterable<ITreeElement<RenderableMatch>> {
		const matches = fileMatch.matches().sort(searchMatchComparer);
		return Iterable.map(matches, r => (<ITreeElement<RenderableMatch>>{ element: r }));
	}

	private createSearchIterator(match: FolderMatch | FileMatch | SearchResult, collapseResults: ISearchConfigurationProperties['collapseResults']): Iterable<ITreeElement<RenderableMatch>> {
		return match instanceof SearchResult ? this.createSearchResultIterator(collapseResults) :
			match instanceof FolderMatch ? this.createSearchFolderIterator(match, collapseResults) :
				this.createSearchFileIterator(match);
	}

	triggerSearchQueryChange(query: ITextQuery, excludePatternText: string, includePatternText: string, triggeredOnType: boolean, searchWidget: NotebookSearchWidget) {
		this.viewModel.cancelSearch(true);

		this.currentSearchQ = this.currentSearchQ
			.then(() => this.startSearch(query, excludePatternText, includePatternText, triggeredOnType, searchWidget))
			.then(() => undefined, () => undefined);
	}

	public override saveState(): void {
		const preserveCase = this.viewModel.preserveCase;
		this.viewletState['query.preserveCase'] = preserveCase;

		this.memento.saveMemento();

		ViewPane.prototype.saveState.call(this);
	}

	override dispose(): void {
		this.isDisposed = true;
		this.saveState();
		this.treeSelectionChangeListener.dispose();
		ViewPane.prototype.dispose.call(this);
	}
}

class ToggleCollapseAndExpandAction extends Action {
	static readonly ID: string = 'notebookSearch.action.collapseOrExpandSearchResults';
	static LABEL: string = nls.localize('ToggleCollapseAndExpandAction.label', "Toggle Collapse and Expand");

	// Cache to keep from crawling the tree too often.
	private action: CollapseDeepestExpandedLevelAction | ExpandAllAction | undefined;

	constructor(id: string, label: string,
		private collapseAction: CollapseDeepestExpandedLevelAction,
		private expandAction: ExpandAllAction,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, collapseAction.class);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.hasSearchResults();
		this.onTreeCollapseStateChange();
	}

	onTreeCollapseStateChange() {
		this.action = undefined;
		this.determineAction();
	}

	private determineAction(): CollapseDeepestExpandedLevelAction | ExpandAllAction {
		if (this.action !== undefined) { return this.action; }
		this.action = this.isSomeCollapsible() ? this.collapseAction : this.expandAction;
		this.class = this.action.class;
		return this.action;
	}

	private isSomeCollapsible(): boolean {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			const viewer = searchView.getControl();
			const navigator = viewer.navigate();
			let node = navigator.first();
			do {
				if (!viewer.isCollapsed(node)) {
					return true;
				}
			} while (node = navigator.next()); // eslint-disable-line no-cond-assign
		}
		return false;
	}


	override async run(): Promise<void> {
		await this.determineAction().run();
	}
}

class CancelSearchAction extends Action {

	static readonly ID: string = 'notebookSearch.action.cancelSearch';
	static LABEL: string = nls.localize('CancelSearchAction.label', "Cancel Search");

	constructor(id: string, label: string,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, 'search-action ' + searchStopIcon.id);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.isSlowSearch();
	}

	override run(): Promise<void> {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			searchView.cancelSearch();
		}

		return Promise.resolve(undefined);
	}
}

class ExpandAllAction extends Action {

	static readonly ID: string = 'notebookSearch.action.expandSearchResults';
	static LABEL: string = nls.localize('ExpandAllAction.label', "Expand All");

	constructor(id: string, label: string,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, 'search-action ' + searchExpandAllIcon.id);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.hasSearchResults();
	}

	override run(): Promise<void> {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			const viewer = searchView.getControl();
			viewer.expandAll();
			viewer.domFocus();
			viewer.focusFirst();
		}
		return Promise.resolve(undefined);
	}
}

class CollapseDeepestExpandedLevelAction extends Action {

	static readonly ID: string = 'notebookSearch.action.collapseSearchResults';
	static LABEL: string = nls.localize('CollapseDeepestExpandedLevelAction.label', "Collapse All");

	constructor(id: string, label: string,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, 'search-action ' + searchCollapseAllIcon.id);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.hasSearchResults();
	}

	override run(): Promise<void> {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			const viewer = searchView.getControl();

			/**
			 * one level to collapse so collapse everything. If FolderMatch, check if there are visible grandchildren,
			 * i.e. if Matches are returned by the navigator, and if so, collapse to them, otherwise collapse all levels.
			 */
			const navigator = viewer.navigate();
			let node = navigator.first();
			let collapseFileMatchLevel = false;
			if (node instanceof FolderMatch) {
				while (node = navigator.next()) { // eslint-disable-line no-cond-assign
					if (node instanceof Match) {
						collapseFileMatchLevel = true;
						break;
					}
				}
			}

			if (collapseFileMatchLevel) {
				node = navigator.first();
				do {
					if (node instanceof FileMatch) {
						viewer.collapse(node);
					}
				} while (node = navigator.next()); // eslint-disable-line no-cond-assign
			} else {
				viewer.collapseAll();
			}

			viewer.domFocus();
			viewer.focusFirst();
		}
		return Promise.resolve(undefined);
	}
}

class ClearSearchResultsAction extends Action {

	static readonly ID: string = 'notebookSearch.action.clearSearchResults';
	static LABEL: string = nls.localize('ClearSearchResultsAction.label', "Clear Search Results");

	constructor(id: string, label: string,
		@IViewsService private readonly viewsService: IViewsService
	) {
		super(id, label, 'search-action ' + searchClearIcon.id);
		this.update();
	}

	update(): void {
		const searchView = getSearchView(this.viewsService);
		this.enabled = !!searchView && searchView.hasSearchResults();
	}

	override run(): Promise<void> {
		const searchView = getSearchView(this.viewsService);
		if (searchView) {
			searchView.clearSearchResults();
		}
		return Promise.resolve();
	}
}

function getSearchView(viewsService: IViewsService): NotebookSearchView | undefined {
	return viewsService.getActiveViewWithId(NotebookSearchView.ID) as NotebookSearchView ?? undefined;
}
