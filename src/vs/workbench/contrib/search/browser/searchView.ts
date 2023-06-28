/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import * as aria from 'vs/base/browser/ui/aria/aria';
import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { IIdentityProvider } from 'vs/base/browser/ui/list/list';
import { ICompressedTreeElement } from 'vs/base/browser/ui/tree/compressedObjectTreeModel';
import { ITreeContextMenuEvent, ObjectTreeElementCollapseState } from 'vs/base/browser/ui/tree/tree';
import { Delayer, RunOnceScheduler } from 'vs/base/common/async';
import * as errors from 'vs/base/common/errors';
import { Event } from 'vs/base/common/event';
import { Iterable } from 'vs/base/common/iterator';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import * as env from 'vs/base/common/platform';
import * as strings from 'vs/base/common/strings';
import { withNullAsUndefined } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import * as network from 'vs/base/common/network';
import 'vs/css!./media/searchview';
import { getCodeEditor, isCodeEditor, isDiffEditor } from 'vs/editor/browser/editorBrowser';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { EmbeddedCodeEditorWidget } from 'vs/editor/browser/widget/embeddedCodeEditorWidget';
import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import { Selection } from 'vs/editor/common/core/selection';
import { IEditor } from 'vs/editor/common/editorCommon';
import { CommonFindController } from 'vs/editor/contrib/find/browser/findController';
import { MultiCursorSelectionController } from 'vs/editor/contrib/multicursor/browser/multicursor';
import * as nls from 'vs/nls';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IMenu, IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationChangeEvent, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IConfirmation, IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { FileChangesEvent, FileChangeType, IFileService } from 'vs/platform/files/common/files';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { getSelectionKeyboardEvent, WorkbenchCompressibleObjectTree } from 'vs/platform/list/browser/listService'; // {{SQL CARBON EDIT}} - remove unused
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IOpenerService, withSelection } from 'vs/platform/opener/common/opener';
import { IProgress, IProgressService, IProgressStep } from 'vs/platform/progress/common/progress';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { defaultInputBoxStyles, defaultToggleStyles } from 'vs/platform/theme/browser/defaultStyles';
import { IFileIconTheme, IThemeService } from 'vs/platform/theme/common/themeService';
import { ThemeIcon } from 'vs/base/common/themables';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { OpenFileFolderAction, OpenFolderAction } from 'vs/workbench/browser/actions/workspaceActions';
import { ResourceListDnDHandler } from 'vs/workbench/browser/dnd';
import { ResourceLabels } from 'vs/workbench/browser/labels';
import { IViewPaneOptions, ViewPane } from 'vs/workbench/browser/parts/views/viewPane';
import { IEditorPane } from 'vs/workbench/common/editor';
import { Memento, MementoObject } from 'vs/workbench/common/memento';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { NotebookEditor } from 'vs/workbench/contrib/notebook/browser/notebookEditor';
import { ExcludePatternInputWidget, IncludePatternInputWidget } from 'vs/workbench/contrib/search/browser/patternInputWidget';
import { appendKeyBindingLabel } from 'vs/workbench/contrib/search/browser/searchActionsBase';
import { IFindInFilesArgs } from 'vs/workbench/contrib/search/browser/searchActionsFind';
import { searchDetailsIcon } from 'vs/workbench/contrib/search/browser/searchIcons';
import { renderSearchMessage } from 'vs/workbench/contrib/search/browser/searchMessage';
import { FileMatchRenderer, FolderMatchRenderer, MatchRenderer, SearchAccessibilityProvider, SearchDelegate } from 'vs/workbench/contrib/search/browser/searchResultsView';
import { SearchWidget } from 'vs/workbench/contrib/search/browser/searchWidget';
import * as Constants from 'vs/workbench/contrib/search/common/constants';
import { IReplaceService } from 'vs/workbench/contrib/search/browser/replace';
import { getOutOfWorkspaceEditorResources, SearchStateKey, SearchUIState } from 'vs/workbench/contrib/search/common/search';
import { ISearchHistoryService, ISearchHistoryValues } from 'vs/workbench/contrib/search/common/searchHistoryService';
import { FileMatch, FileMatchOrMatch, FolderMatch, FolderMatchWithResource, IChangeEvent, ISearchWorkbenchService, Match, MatchInNotebook, RenderableMatch, searchMatchComparer, SearchModel, SearchResult } from 'vs/workbench/contrib/search/browser/searchModel';
import { createEditorFromSearchResult } from 'vs/workbench/contrib/searchEditor/browser/searchEditorActions';
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IPreferencesService, ISettingsEditorOptions } from 'vs/workbench/services/preferences/common/preferences';
import { ITextQueryBuilderOptions, QueryBuilder } from 'vs/workbench/services/search/common/queryBuilder';
import { IPatternInfo, ISearchComplete, ISearchConfiguration, ISearchConfigurationProperties, ITextQuery, SearchCompletionExitCode, SearchSortOrder, TextSearchCompleteMessageType, ViewMode } from 'vs/workbench/services/search/common/search';
import { TextSearchCompleteMessage } from 'vs/workbench/services/search/common/searchExtTypes';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { INotebookService } from 'vs/workbench/contrib/notebook/common/notebookService';
import { ILogService } from 'vs/platform/log/common/log';

const $ = dom.$;

export enum SearchViewPosition {
	SideBar,
	Panel
}

const SEARCH_CANCELLED_MESSAGE = nls.localize('searchCanceled', "Search was canceled before any results could be found - ");
const DEBOUNCE_DELAY = 75;
export class SearchView extends ViewPane {

	protected static readonly ACTIONS_RIGHT_CLASS_NAME = 'actions-right'; // {{SQL CARBON EDIT}}

	protected isDisposed = false; // {{SQL CARBON EDIT}}

	protected container!: HTMLElement; // {{SQL CARBON EDIT}}
	private queryBuilder: QueryBuilder;
	protected viewModel: SearchModel; // {{SQL CARBON EDIT}}
	protected memento: Memento; // {{SQL CARBON EDIT}}

	private viewletVisible: IContextKey<boolean>;
	private inputBoxFocused: IContextKey<boolean>;
	private inputPatternIncludesFocused: IContextKey<boolean>;
	private inputPatternExclusionsFocused: IContextKey<boolean>;
	private firstMatchFocused: IContextKey<boolean>;
	private fileMatchOrMatchFocused: IContextKey<boolean>;
	private fileMatchOrFolderMatchFocus: IContextKey<boolean>;
	private fileMatchOrFolderMatchWithResourceFocus: IContextKey<boolean>;
	private fileMatchFocused: IContextKey<boolean>;
	private folderMatchFocused: IContextKey<boolean>;
	private folderMatchWithResourceFocused: IContextKey<boolean>;
	private matchFocused: IContextKey<boolean>;
	private isEditableItem: IContextKey<boolean>;
	protected hasSearchResultsKey: IContextKey<boolean>; // {{SQL CARBON EDIT}}
	private lastFocusState: 'input' | 'tree' = 'input';

	// {{SQL CARBON EDIT}}
	protected searchStateKey: IContextKey<SearchUIState>;
	protected hasSearchPatternKey: IContextKey<boolean>;
	protected hasReplacePatternKey: IContextKey<boolean>;
	protected hasFilePatternKey: IContextKey<boolean>;
	protected hasSomeCollapsibleResultKey: IContextKey<boolean>;

	protected contextMenu: IMenu | null = null; // {{SQL CARBON EDIT}}

	protected tree!: WorkbenchCompressibleObjectTree<RenderableMatch>; // {{SQL CARBON EDIT}} Increase visibility
	protected treeLabels!: ResourceLabels; // {{SQL CARBON EDIT}}
	protected viewletState: MementoObject; // {{SQL CARBON EDIT}}
	protected messagesElement!: HTMLElement; // {{SQL CARBON EDIT}}
	protected readonly messageDisposables: DisposableStore = new DisposableStore(); // {{SQL CARBON EDIT}}
	private searchWidgetsContainerElement!: HTMLElement;
	private searchWidget!: SearchWidget;
	protected size!: dom.Dimension; // {{SQL CARBON EDIT}}
	private queryDetails!: HTMLElement;
	private toggleQueryDetailsButton!: HTMLElement;
	private inputPatternExcludes!: ExcludePatternInputWidget;
	private inputPatternIncludes!: IncludePatternInputWidget;
	protected resultsElement!: HTMLElement; // {{SQL CARBON EDIT}}

	private currentSelectedFileMatch: FileMatch | undefined;

	private delayedRefresh: Delayer<void>;
	private changedWhileHidden: boolean = false;

	protected searchWithoutFolderMessageElement: HTMLElement | undefined; // {{SQL CARBON EDIT}}

	protected currentSearchQ = Promise.resolve(); // {{SQL CARBON EDIT}}
	private addToSearchHistoryDelayer: Delayer<void>;

	protected toggleCollapseStateDelayer: Delayer<void>; // {{SQL CARBON EDIT}}

	private triggerQueryDelayer: Delayer<void>;
	private pauseSearching = false;

	protected treeAccessibilityProvider: SearchAccessibilityProvider; // {{SQL CARBON EDIT}}

	private treeViewKey: IContextKey<boolean>;

	private _visibleMatches: number = 0;

	private _refreshResultsScheduler: RunOnceScheduler;

	constructor(
		options: IViewPaneOptions,
		@IFileService protected readonly fileService: IFileService, // {{SQL CARBON EDIT}}
		@IEditorService protected readonly editorService: IEditorService, // {{SQL CARBON EDIT}}
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
		@IProgressService protected readonly progressService: IProgressService, // {{SQL CARBON EDIT}}
		@INotificationService protected readonly notificationService: INotificationService, // {{SQL CARBON EDIT}}
		@IDialogService protected readonly dialogService: IDialogService, // {{SQL CARBON EDIT}}
		@ICommandService protected readonly commandService: ICommandService, // {{SQL CARBON EDIT}}
		@IContextViewService protected readonly contextViewService: IContextViewService, // {{SQL CARBON EDIT}}
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IWorkspaceContextService protected readonly contextService: IWorkspaceContextService, // {{SQL CARBON EDIT}}
		@ISearchWorkbenchService protected readonly searchWorkbenchService: ISearchWorkbenchService, // {{SQL CARBON EDIT}}
		@IContextKeyService contextKeyService: IContextKeyService,
		@IReplaceService protected readonly replaceService: IReplaceService, // {{SQL CARBON EDIT}}
		@ITextFileService protected readonly textFileService: ITextFileService, // {{SQL CARBON EDIT}}
		@IPreferencesService protected readonly preferencesService: IPreferencesService, // {{SQL CARBON EDIT}}
		@IThemeService themeService: IThemeService,
		@ISearchHistoryService protected readonly searchHistoryService: ISearchHistoryService, // {{SQL CARBON EDIT}}
		@IContextMenuService contextMenuService: IContextMenuService,
		@IMenuService protected readonly menuService: IMenuService,
		@IAccessibilityService protected readonly accessibilityService: IAccessibilityService, // {{SQL CARBON EDIT}}
		@IKeybindingService keybindingService: IKeybindingService,
		@IStorageService storageService: IStorageService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@INotebookService private readonly notebookService: INotebookService,
		@ILogService private readonly logService: ILogService,
	) {

		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this.container = dom.$('.search-view');

		// globals
		this.viewletVisible = Constants.SearchViewVisibleKey.bindTo(this.contextKeyService);
		this.firstMatchFocused = Constants.FirstMatchFocusKey.bindTo(this.contextKeyService);
		this.fileMatchOrMatchFocused = Constants.FileMatchOrMatchFocusKey.bindTo(this.contextKeyService);
		this.fileMatchOrFolderMatchFocus = Constants.FileMatchOrFolderMatchFocusKey.bindTo(this.contextKeyService);
		this.fileMatchOrFolderMatchWithResourceFocus = Constants.FileMatchOrFolderMatchWithResourceFocusKey.bindTo(this.contextKeyService);
		this.fileMatchFocused = Constants.FileFocusKey.bindTo(this.contextKeyService);
		this.folderMatchFocused = Constants.FolderFocusKey.bindTo(this.contextKeyService);
		this.folderMatchWithResourceFocused = Constants.ResourceFolderFocusKey.bindTo(this.contextKeyService);
		this.hasSearchResultsKey = Constants.HasSearchResults.bindTo(this.contextKeyService);
		this.matchFocused = Constants.MatchFocusKey.bindTo(this.contextKeyService);
		this.searchStateKey = SearchStateKey.bindTo(this.contextKeyService);
		this.hasSearchPatternKey = Constants.ViewHasSearchPatternKey.bindTo(this.contextKeyService);
		this.hasReplacePatternKey = Constants.ViewHasReplacePatternKey.bindTo(this.contextKeyService);
		this.hasFilePatternKey = Constants.ViewHasFilePatternKey.bindTo(this.contextKeyService);
		this.hasSomeCollapsibleResultKey = Constants.ViewHasSomeCollapsibleKey.bindTo(this.contextKeyService);
		this.treeViewKey = Constants.InTreeViewKey.bindTo(this.contextKeyService);

		// scoped
		this.contextKeyService = this._register(this.contextKeyService.createScoped(this.container));
		Constants.SearchViewFocusedKey.bindTo(this.contextKeyService).set(true);
		this.inputBoxFocused = Constants.InputBoxFocusedKey.bindTo(this.contextKeyService);
		this.inputPatternIncludesFocused = Constants.PatternIncludesFocusedKey.bindTo(this.contextKeyService);
		this.inputPatternExclusionsFocused = Constants.PatternExcludesFocusedKey.bindTo(this.contextKeyService);
		this.isEditableItem = Constants.IsEditableItemKey.bindTo(this.contextKeyService);

		this.instantiationService = this.instantiationService.createChild(
			new ServiceCollection([IContextKeyService, this.contextKeyService]));

		this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('search.sortOrder')) {
				if (this.searchConfig.sortOrder === SearchSortOrder.Modified) {
					// If changing away from modified, remove all fileStats
					// so that updated files are re-retrieved next time.
					this.removeFileStats();
				}
				this.refreshTree();
			}
		});

		this.viewModel = this._register(this.searchWorkbenchService.searchModel);
		this.queryBuilder = this.instantiationService.createInstance(QueryBuilder);
		this.memento = new Memento(this.id, storageService);
		this.viewletState = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);

		this._register(this.fileService.onDidFilesChange(e => this.onFilesChanged(e)));
		this._register(this.textFileService.untitled.onWillDispose(model => this.onUntitledDidDispose(model.resource)));
		this._register(this.contextService.onDidChangeWorkbenchState(() => this.onDidChangeWorkbenchState()));
		this._register(this.searchHistoryService.onDidClearHistory(() => this.clearHistory()));
		this._register(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationUpdated(e)));

		this.delayedRefresh = this._register(new Delayer<void>(250));

		this.addToSearchHistoryDelayer = this._register(new Delayer<void>(2000));
		this.toggleCollapseStateDelayer = this._register(new Delayer<void>(100));
		this.triggerQueryDelayer = this._register(new Delayer<void>(0));

		this.treeAccessibilityProvider = this.instantiationService.createInstance(SearchAccessibilityProvider, this.viewModel);
		this.isTreeLayoutViewVisible = this.viewletState['view.treeLayout'] ?? (this.searchConfig.defaultViewMode === ViewMode.Tree);

		this._refreshResultsScheduler = this._register(new RunOnceScheduler(this._updateResults.bind(this), 80));
	}

	get isTreeLayoutViewVisible(): boolean {
		return this.treeViewKey.get() ?? false;
	}

	private set isTreeLayoutViewVisible(visible: boolean) {
		this.treeViewKey.set(visible);
	}

	setTreeView(visible: boolean): void {
		if (visible === this.isTreeLayoutViewVisible) {
			return;
		}
		this.isTreeLayoutViewVisible = visible;
		this.updateIndentStyles(this.themeService.getFileIconTheme());
		this.refreshTree();
	}

	// {{SQL CARBON EDIT}}
	protected get state(): SearchUIState {
		return this.searchStateKey.get() ?? SearchUIState.Idle;
	}

	// {{SQL CARBON EDIT}}
	protected set state(v: SearchUIState) {
		this.searchStateKey.set(v);
	}

	getContainer(): HTMLElement {
		return this.container;
	}

	get searchResult(): SearchResult {
		return this.viewModel && this.viewModel.searchResult;
	}

	private onDidChangeWorkbenchState(): void {
		if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY && this.searchWithoutFolderMessageElement) {
			dom.hide(this.searchWithoutFolderMessageElement);
		}
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		this.container = dom.append(parent, dom.$('.search-view'));

		this.searchWidgetsContainerElement = dom.append(this.container, $('.search-widgets-container'));
		this.createSearchWidget(this.searchWidgetsContainerElement);

		const history = this.searchHistoryService.load();
		const filePatterns = this.viewletState['query.filePatterns'] || '';
		const patternExclusions = this.viewletState['query.folderExclusions'] || '';
		const patternExclusionsHistory: string[] = history.exclude || [];
		const patternIncludes = this.viewletState['query.folderIncludes'] || '';
		const patternIncludesHistory: string[] = history.include || [];
		const onlyOpenEditors = this.viewletState['query.onlyOpenEditors'] || false;

		const queryDetailsExpanded = this.viewletState['query.queryDetailsExpanded'] || '';
		const useExcludesAndIgnoreFiles = typeof this.viewletState['query.useExcludesAndIgnoreFiles'] === 'boolean' ?
			this.viewletState['query.useExcludesAndIgnoreFiles'] : true;

		this.queryDetails = dom.append(this.searchWidgetsContainerElement, $('.query-details'));

		// Toggle query details button
		this.toggleQueryDetailsButton = dom.append(this.queryDetails,
			$('.more' + ThemeIcon.asCSSSelector(searchDetailsIcon), { tabindex: 0, role: 'button', title: nls.localize('moreSearch', "Toggle Search Details") }));

		this._register(dom.addDisposableListener(this.toggleQueryDetailsButton, dom.EventType.CLICK, e => {
			dom.EventHelper.stop(e);
			this.toggleQueryDetails(!this.accessibilityService.isScreenReaderOptimized());
		}));
		this._register(dom.addDisposableListener(this.toggleQueryDetailsButton, dom.EventType.KEY_UP, (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);

			if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
				dom.EventHelper.stop(e);
				this.toggleQueryDetails(false);
			}
		}));
		this._register(dom.addDisposableListener(this.toggleQueryDetailsButton, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);

			if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
				if (this.searchWidget.isReplaceActive()) {
					this.searchWidget.focusReplaceAllAction();
				} else {
					this.searchWidget.isReplaceShown() ? this.searchWidget.replaceInput?.focusOnPreserve() : this.searchWidget.focusRegexAction();
				}
				dom.EventHelper.stop(e);
			}
		}));

		// folder includes list
		const folderIncludesList = dom.append(this.queryDetails, $('.file-types.includes'));
		const filesToIncludeTitle = nls.localize('searchScope.includes', "files to include");
		dom.append(folderIncludesList, $('h4', undefined, filesToIncludeTitle));

		this.inputPatternIncludes = this._register(this.instantiationService.createInstance(IncludePatternInputWidget, folderIncludesList, this.contextViewService, {
			ariaLabel: filesToIncludeTitle,
			placeholder: nls.localize('placeholder.includes', "e.g. *.ts, src/**/include"),
			showPlaceholderOnFocus: true,
			history: patternIncludesHistory,
			inputBoxStyles: defaultInputBoxStyles
		}));

		this.inputPatternIncludes.setValue(patternIncludes);
		this.inputPatternIncludes.setOnlySearchInOpenEditors(onlyOpenEditors);

		this._register(this.inputPatternIncludes.onCancel(() => this.cancelSearch(false)));
		this._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerQueryChange()));

		this.trackInputBox(this.inputPatternIncludes.inputFocusTracker, this.inputPatternIncludesFocused);

		// excludes list
		const excludesList = dom.append(this.queryDetails, $('.file-types.excludes'));
		const excludesTitle = nls.localize('searchScope.excludes', "files to exclude");
		dom.append(excludesList, $('h4', undefined, excludesTitle));
		this.inputPatternExcludes = this._register(this.instantiationService.createInstance(ExcludePatternInputWidget, excludesList, this.contextViewService, {
			ariaLabel: excludesTitle,
			placeholder: nls.localize('placeholder.excludes', "e.g. *.ts, src/**/exclude"),
			showPlaceholderOnFocus: true,
			history: patternExclusionsHistory,
			inputBoxStyles: defaultInputBoxStyles
		}));

		this.inputPatternExcludes.setValue(patternExclusions);
		this.inputPatternExcludes.setUseExcludesAndIgnoreFiles(useExcludesAndIgnoreFiles);

		this._register(this.inputPatternExcludes.onCancel(() => this.cancelSearch(false)));
		this._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerQueryChange()));
		this.trackInputBox(this.inputPatternExcludes.inputFocusTracker, this.inputPatternExclusionsFocused);

		const updateHasFilePatternKey = () => this.hasFilePatternKey.set(this.inputPatternIncludes.getValue().length > 0 || this.inputPatternExcludes.getValue().length > 0);
		updateHasFilePatternKey();
		const onFilePatternSubmit = (triggeredOnType: boolean) => {
			this.triggerQueryChange({ triggeredOnType, delay: this.searchConfig.searchOnTypeDebouncePeriod });
			if (triggeredOnType) {
				updateHasFilePatternKey();
			}
		};
		this._register(this.inputPatternIncludes.onSubmit(onFilePatternSubmit));
		this._register(this.inputPatternExcludes.onSubmit(onFilePatternSubmit));

		this.messagesElement = dom.append(this.container, $('.messages.text-search-provider-messages'));
		if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
			this.showSearchWithoutFolderMessage();
		}

		this.createSearchResultsView(this.container);

		if (filePatterns !== '' || patternExclusions !== '' || patternIncludes !== '' || queryDetailsExpanded !== '' || !useExcludesAndIgnoreFiles) {
			this.toggleQueryDetails(true, true, true);
		}

		this._register(this.viewModel.searchResult.onChange((event) => this.onSearchResultsChanged(event)));

		this._register(this.onDidChangeBodyVisibility(visible => this.onVisibilityChanged(visible)));

		this.updateIndentStyles(this.themeService.getFileIconTheme());
		this._register(this.themeService.onDidFileIconThemeChange(this.updateIndentStyles, this));
	}

	private updateIndentStyles(theme: IFileIconTheme): void {
		this.resultsElement.classList.toggle('hide-arrows', this.isTreeLayoutViewVisible && theme.hidesExplorerArrows);
	}

	protected callRenderBody(parent: HTMLElement): void { // {{SQL CARBON EDIT}}
		super.renderBody(parent); // {{SQL CARBON EDIT}}
	} // {{SQL CARBON EDIT}}

	protected onVisibilityChanged(visible: boolean): void { // {{SQL CARBON EDIT}}
		this.viewletVisible.set(visible);
		if (visible) {
			if (this.changedWhileHidden) {
				// Render if results changed while viewlet was hidden - #37818
				this.refreshAndUpdateCount();
				this.changedWhileHidden = false;
			}
		} else {
			// Reset last focus to input to preserve opening the viewlet always focusing the query editor.
			this.lastFocusState = 'input';
		}

		// Enable highlights if there are searchresults
		this.viewModel?.searchResult.toggleHighlights(visible);
	}

	get searchAndReplaceWidget(): SearchWidget {
		return this.searchWidget;
	}

	get searchIncludePattern(): IncludePatternInputWidget {
		return this.inputPatternIncludes;
	}

	get searchExcludePattern(): ExcludePatternInputWidget {
		return this.inputPatternExcludes;
	}

	private createSearchWidget(container: HTMLElement): void {
		const contentPattern = this.viewletState['query.contentPattern'] || '';
		const replaceText = this.viewletState['query.replaceText'] || '';
		const isRegex = this.viewletState['query.regex'] === true;
		const isWholeWords = this.viewletState['query.wholeWords'] === true;
		const isCaseSensitive = this.viewletState['query.caseSensitive'] === true;
		const history = this.searchHistoryService.load();
		const searchHistory = history.search || this.viewletState['query.searchHistory'] || [];
		const replaceHistory = history.replace || this.viewletState['query.replaceHistory'] || [];
		const showReplace = typeof this.viewletState['view.showReplace'] === 'boolean' ? this.viewletState['view.showReplace'] : true;
		const preserveCase = this.viewletState['query.preserveCase'] === true;

		const isInNotebookMarkdownInput = this.viewletState['query.isInNotebookMarkdownInput'] ?? true;
		const isInNotebookMarkdownPreview = this.viewletState['query.isInNotebookMarkdownPreview'] ?? true;
		const isInNotebookCellInput = this.viewletState['query.isInNotebookCellInput'] ?? true;
		const isInNotebookCellOutput = this.viewletState['query.isInNotebookCellOutput'] ?? true;


		this.searchWidget = this._register(this.instantiationService.createInstance(SearchWidget, container, {
			value: contentPattern,
			replaceValue: replaceText,
			isRegex: isRegex,
			isCaseSensitive: isCaseSensitive,
			isWholeWords: isWholeWords,
			searchHistory: searchHistory,
			replaceHistory: replaceHistory,
			preserveCase: preserveCase,
			inputBoxStyles: defaultInputBoxStyles,
			toggleStyles: defaultToggleStyles,
			notebookOptions: {
				isInNotebookMarkdownInput,
				isInNotebookMarkdownPreview,
				isInNotebookCellInput,
				isInNotebookCellOutput,
			}
		}));

		if (!this.searchWidget.searchInput || !this.searchWidget.replaceInput) {
			this.logService.warn(`Cannot fully create search widget. Search or replace input undefined. SearchInput: ${this.searchWidget.searchInput}, ReplaceInput: ${this.searchWidget.replaceInput}`);
			return;
		}

		if (showReplace) {
			this.searchWidget.toggleReplace(true);
		}

		this._register(this.searchWidget.onSearchSubmit(options => this.triggerQueryChange(options)));
		this._register(this.searchWidget.onSearchCancel(({ focus }) => this.cancelSearch(focus)));
		this._register(this.searchWidget.searchInput.onDidOptionChange(() => this.triggerQueryChange()));
		this._register(this.searchWidget.getNotebookFilters().onDidChange(() => this.triggerQueryChange()));

		const updateHasPatternKey = () => this.hasSearchPatternKey.set(this.searchWidget.searchInput ? (this.searchWidget.searchInput.getValue().length > 0) : false);
		updateHasPatternKey();
		this._register(this.searchWidget.searchInput.onDidChange(() => updateHasPatternKey()));

		const updateHasReplacePatternKey = () => this.hasReplacePatternKey.set(this.searchWidget.getReplaceValue().length > 0);
		updateHasReplacePatternKey();
		this._register(this.searchWidget.replaceInput.inputBox.onDidChange(() => updateHasReplacePatternKey()));

		this._register(this.searchWidget.onDidHeightChange(() => this.reLayout()));

		this._register(this.searchWidget.onReplaceToggled(() => this.reLayout()));
		this._register(this.searchWidget.onReplaceStateChange((state) => {
			this.viewModel.replaceActive = state;
			this.refreshTree();
		}));

		this._register(this.searchWidget.onPreserveCaseChange((state) => {
			this.viewModel.preserveCase = state;
			this.refreshTree();
		}));

		this._register(this.searchWidget.onReplaceValueChanged(() => {
			this.viewModel.replaceString = this.searchWidget.getReplaceValue();
			this.delayedRefresh.trigger(() => this.refreshTree());
		}));

		this._register(this.searchWidget.onBlur(() => {
			this.toggleQueryDetailsButton.focus();
		}));

		this._register(this.searchWidget.onReplaceAll(() => this.replaceAll()));

		this.trackInputBox(this.searchWidget.searchInputFocusTracker);
		this.trackInputBox(this.searchWidget.replaceInputFocusTracker);
	}


	private onConfigurationUpdated(event?: IConfigurationChangeEvent): void {
		if (event && (event.affectsConfiguration('search.decorations.colors') || event.affectsConfiguration('search.decorations.badges'))) {
			this.refreshTree();
		}
	}

	private trackInputBox(inputFocusTracker: dom.IFocusTracker | undefined, contextKey?: IContextKey<boolean>): void {
		if (!inputFocusTracker) {
			return;
		}

		this._register(inputFocusTracker.onDidFocus(() => {
			this.lastFocusState = 'input';
			this.inputBoxFocused.set(true);
			contextKey?.set(true);
		}));
		this._register(inputFocusTracker.onDidBlur(() => {
			this.inputBoxFocused.set(this.searchWidget.searchInputHasFocus()
				|| this.searchWidget.replaceInputHasFocus()
				|| this.inputPatternIncludes.inputHasFocus()
				|| this.inputPatternExcludes.inputHasFocus());
			contextKey?.set(false);
		}));
	}

	protected onSearchResultsChanged(event?: IChangeEvent): void { // {{SQL CARBON EDIT}}
		if (this.isVisible()) {
			return this.refreshAndUpdateCount(event);
		} else {
			this.changedWhileHidden = true;
		}
	}

	protected refreshAndUpdateCount(event?: IChangeEvent): void { // {{SQL CARBON EDIT}}
		this.searchWidget.setReplaceAllActionState(!this.viewModel.searchResult.isEmpty());
		this.updateSearchResultCount(this.viewModel.searchResult.query!.userDisabledExcludesAndIgnoreFiles, this.viewModel.searchResult.query?.onlyOpenEditors, event?.clearingAll);
		return this.refreshTree(event);
	}

	refreshTree(event?: IChangeEvent): void {
		const collapseResults = this.searchConfig.collapseResults;
		if (!event || event.added || event.removed) {
			// Refresh whole tree
			if (this.searchConfig.sortOrder === SearchSortOrder.Modified) {
				// Ensure all matches have retrieved their file stat
				this.retrieveFileStats()
					.then(() => this.tree.setChildren(null, this.createResultIterator(collapseResults)));
			} else {
				this.tree.setChildren(null, this.createResultIterator(collapseResults));
			}
		} else {
			// If updated counts affect our search order, re-sort the view.
			if (this.searchConfig.sortOrder === SearchSortOrder.CountAscending ||
				this.searchConfig.sortOrder === SearchSortOrder.CountDescending) {
				this.tree.setChildren(null, this.createResultIterator(collapseResults));
			} else {
				// FileMatch modified, refresh those elements
				event.elements.forEach(element => {
					this.tree.setChildren(element, this.createIterator(element, collapseResults));
					this.tree.rerender(element);
				});
			}
		}
	}

	private createResultIterator(collapseResults: ISearchConfigurationProperties['collapseResults']): Iterable<ICompressedTreeElement<RenderableMatch>> {
		const folderMatches = this.searchResult.folderMatches()
			.filter(fm => !fm.isEmpty())
			.sort(searchMatchComparer);

		if (folderMatches.length === 1) {
			return this.createFolderIterator(folderMatches[0], collapseResults, true);
		}

		return Iterable.map(folderMatches, folderMatch => {
			const children = this.createFolderIterator(folderMatch, collapseResults, true);
			return <ICompressedTreeElement<RenderableMatch>>{ element: folderMatch, children, incompressible: true }; // roots should always be incompressible
		});
	}

	private createFolderIterator(folderMatch: FolderMatch, collapseResults: ISearchConfigurationProperties['collapseResults'], childFolderIncompressible: boolean): Iterable<ICompressedTreeElement<RenderableMatch>> {
		const sortOrder = this.searchConfig.sortOrder;

		const matchArray = this.isTreeLayoutViewVisible ? folderMatch.matches() : folderMatch.allDownstreamFileMatches();
		const matches = matchArray.sort((a, b) => searchMatchComparer(a, b, sortOrder));

		return Iterable.map(matches, match => {
			let children;
			if (match instanceof FileMatch) {
				children = this.createFileIterator(match);
			} else {
				children = this.createFolderIterator(match, collapseResults, false);
			}

			const collapsed = (collapseResults === 'alwaysCollapse' || (match.count() > 10 && collapseResults !== 'alwaysExpand')) ? ObjectTreeElementCollapseState.PreserveOrCollapsed : ObjectTreeElementCollapseState.PreserveOrExpanded;

			return <ICompressedTreeElement<RenderableMatch>>{ element: match, children, collapsed, incompressible: (match instanceof FileMatch) ? true : childFolderIncompressible };
		});
	}

	private createFileIterator(fileMatch: FileMatch): Iterable<ICompressedTreeElement<RenderableMatch>> {
		const matches = fileMatch.matches().sort(searchMatchComparer);
		return Iterable.map(matches, r => (<ICompressedTreeElement<RenderableMatch>>{ element: r, incompressible: true }));
	}

	private createIterator(match: FolderMatch | FileMatch | SearchResult, collapseResults: ISearchConfigurationProperties['collapseResults']): Iterable<ICompressedTreeElement<RenderableMatch>> {
		return match instanceof SearchResult ? this.createResultIterator(collapseResults) :
			match instanceof FolderMatch ? this.createFolderIterator(match, collapseResults, false) :
				this.createFileIterator(match);
	}

	private replaceAll(): void {
		if (this.viewModel.searchResult.count() === 0) {
			return;
		}

		const occurrences = this.viewModel.searchResult.count();
		const fileCount = this.viewModel.searchResult.fileCount();
		const replaceValue = this.searchWidget.getReplaceValue() || '';
		const afterReplaceAllMessage = this.buildAfterReplaceAllMessage(occurrences, fileCount, replaceValue);

		let progressComplete: () => void;
		let progressReporter: IProgress<IProgressStep>;

		this.progressService.withProgress({ location: this.getProgressLocation(), delay: 100, total: occurrences }, p => {
			progressReporter = p;

			return new Promise<void>(resolve => progressComplete = resolve);
		});

		const confirmation: IConfirmation = {
			title: nls.localize('replaceAll.confirmation.title', "Replace All"),
			message: this.buildReplaceAllConfirmationMessage(occurrences, fileCount, replaceValue),
			primaryButton: nls.localize({ key: 'replaceAll.confirm.button', comment: ['&& denotes a mnemonic'] }, "&&Replace")
		};

		this.dialogService.confirm(confirmation).then(res => {
			if (res.confirmed) {
				this.searchWidget.setReplaceAllActionState(false);
				this.viewModel.searchResult.replaceAll(progressReporter).then(() => {
					progressComplete();
					const messageEl = this.clearMessage();
					dom.append(messageEl, afterReplaceAllMessage);
					this.reLayout();
				}, (error) => {
					progressComplete();
					errors.isCancellationError(error);
					this.notificationService.error(error);
				});
			} else {
				progressComplete();
			}
		});
	}

	private buildAfterReplaceAllMessage(occurrences: number, fileCount: number, replaceValue?: string) {
		if (occurrences === 1) {
			if (fileCount === 1) {
				if (replaceValue) {
					return nls.localize('replaceAll.occurrence.file.message', "Replaced {0} occurrence across {1} file with '{2}'.", occurrences, fileCount, replaceValue);
				}

				return nls.localize('removeAll.occurrence.file.message', "Replaced {0} occurrence across {1} file.", occurrences, fileCount);
			}

			if (replaceValue) {
				return nls.localize('replaceAll.occurrence.files.message', "Replaced {0} occurrence across {1} files with '{2}'.", occurrences, fileCount, replaceValue);
			}

			return nls.localize('removeAll.occurrence.files.message', "Replaced {0} occurrence across {1} files.", occurrences, fileCount);
		}

		if (fileCount === 1) {
			if (replaceValue) {
				return nls.localize('replaceAll.occurrences.file.message', "Replaced {0} occurrences across {1} file with '{2}'.", occurrences, fileCount, replaceValue);
			}

			return nls.localize('removeAll.occurrences.file.message', "Replaced {0} occurrences across {1} file.", occurrences, fileCount);
		}

		if (replaceValue) {
			return nls.localize('replaceAll.occurrences.files.message', "Replaced {0} occurrences across {1} files with '{2}'.", occurrences, fileCount, replaceValue);
		}

		return nls.localize('removeAll.occurrences.files.message', "Replaced {0} occurrences across {1} files.", occurrences, fileCount);
	}

	private buildReplaceAllConfirmationMessage(occurrences: number, fileCount: number, replaceValue?: string) {
		if (occurrences === 1) {
			if (fileCount === 1) {
				if (replaceValue) {
					return nls.localize('removeAll.occurrence.file.confirmation.message', "Replace {0} occurrence across {1} file with '{2}'?", occurrences, fileCount, replaceValue);
				}

				return nls.localize('replaceAll.occurrence.file.confirmation.message', "Replace {0} occurrence across {1} file?", occurrences, fileCount);
			}

			if (replaceValue) {
				return nls.localize('removeAll.occurrence.files.confirmation.message', "Replace {0} occurrence across {1} files with '{2}'?", occurrences, fileCount, replaceValue);
			}

			return nls.localize('replaceAll.occurrence.files.confirmation.message', "Replace {0} occurrence across {1} files?", occurrences, fileCount);
		}

		if (fileCount === 1) {
			if (replaceValue) {
				return nls.localize('removeAll.occurrences.file.confirmation.message', "Replace {0} occurrences across {1} file with '{2}'?", occurrences, fileCount, replaceValue);
			}

			return nls.localize('replaceAll.occurrences.file.confirmation.message', "Replace {0} occurrences across {1} file?", occurrences, fileCount);
		}

		if (replaceValue) {
			return nls.localize('removeAll.occurrences.files.confirmation.message', "Replace {0} occurrences across {1} files with '{2}'?", occurrences, fileCount, replaceValue);
		}

		return nls.localize('replaceAll.occurrences.files.confirmation.message', "Replace {0} occurrences across {1} files?", occurrences, fileCount);
	}

	protected clearMessage(): HTMLElement { // {{SQL CARBON EDIT}}
		this.searchWithoutFolderMessageElement = undefined;

		const wasHidden = this.messagesElement.style.display === 'none';
		dom.clearNode(this.messagesElement);
		dom.show(this.messagesElement);
		this.messageDisposables.clear();

		const newMessage = dom.append(this.messagesElement, $('.message'));
		if (wasHidden) {
			this.reLayout();
		}

		return newMessage;
	}

	protected createSearchResultsView(container: HTMLElement): void { // {{SQL CARBON EDIT}}
		this.resultsElement = dom.append(container, $('.results.show-file-icons.file-icon-themable-tree'));
		const delegate = this.instantiationService.createInstance(SearchDelegate);

		const identityProvider: IIdentityProvider<RenderableMatch> = {
			getId(element: RenderableMatch) {
				return element.id();
			}
		};

		this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility }));
		this.tree = this._register(<WorkbenchCompressibleObjectTree<RenderableMatch>>this.instantiationService.createInstance(WorkbenchCompressibleObjectTree,
			'SearchView',
			this.resultsElement,
			delegate,
			[
				this._register(this.instantiationService.createInstance(FolderMatchRenderer, this, this.treeLabels)),
				this._register(this.instantiationService.createInstance(FileMatchRenderer, this, this.treeLabels)),
				this._register(this.instantiationService.createInstance(MatchRenderer, this.viewModel, this)),
			],
			{
				identityProvider,
				accessibilityProvider: this.treeAccessibilityProvider,
				dnd: this.instantiationService.createInstance(ResourceListDnDHandler, element => {
					if (element instanceof FileMatch) {
						return element.resource;
					}
					if (element instanceof Match) {
						return withSelection(element.parent().resource, element.range());
					}
					return null;
				}),
				multipleSelectionSupport: true,
				selectionNavigation: true,
				overrideStyles: {
					listBackground: this.getBackgroundColor()
				},
				additionalScrollHeight: SearchDelegate.ITEM_HEIGHT
			}));
		this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));
		const updateHasSomeCollapsible = () => this.toggleCollapseStateDelayer.trigger(() => this.hasSomeCollapsibleResultKey.set(this.hasSomeCollapsible()));
		updateHasSomeCollapsible();
		this._register(this.viewModel.searchResult.onChange(() => updateHasSomeCollapsible()));
		this._register(this.tree.onDidChangeCollapseState(() => updateHasSomeCollapsible()));

		this._register(Event.debounce(this.tree.onDidOpen, (last, event) => event, DEBOUNCE_DELAY, true)(options => {
			if (options.element instanceof Match) {
				const selectedMatch: Match = options.element;
				this.currentSelectedFileMatch?.setSelectedMatch(null);
				this.currentSelectedFileMatch = selectedMatch.parent();
				this.currentSelectedFileMatch.setSelectedMatch(selectedMatch);

				this.onFocus(selectedMatch, options.editorOptions.preserveFocus, options.sideBySide, options.editorOptions.pinned);
			}
		}));

		this._register(Event.debounce(this.tree.onDidChangeFocus, (last, event) => event, DEBOUNCE_DELAY, true)(() => {
			const selection = this.tree.getSelection();
			const focus = this.tree.getFocus()[0];
			if (selection.length > 1 && focus instanceof Match) {
				this.onFocus(focus, true);
			}
		}));

		this._register(Event.any<any>(this.tree.onDidFocus, this.tree.onDidChangeFocus)(() => {
			const focus = this.tree.getFocus()[0];

			if (this.tree.isDOMFocused()) {
				this.firstMatchFocused.set(this.tree.navigate().first() === focus);
				this.fileMatchOrMatchFocused.set(!!focus);
				this.fileMatchFocused.set(focus instanceof FileMatch);
				this.folderMatchFocused.set(focus instanceof FolderMatch);
				this.matchFocused.set(focus instanceof Match);
				this.fileMatchOrFolderMatchFocus.set(focus instanceof FileMatch || focus instanceof FolderMatch);
				this.fileMatchOrFolderMatchWithResourceFocus.set(focus instanceof FileMatch || focus instanceof FolderMatchWithResource);
				this.folderMatchWithResourceFocused.set(focus instanceof FolderMatchWithResource);
				this.lastFocusState = 'tree';
			}

			let editable = false;
			if (focus instanceof MatchInNotebook) {
				editable = !focus.isWebviewMatch();
			} else if (focus instanceof FileMatch) {
				editable = !focus.hasOnlyReadOnlyMatches();
			} else if (focus instanceof FolderMatch) {
				editable = !focus.hasOnlyReadOnlyMatches();
			}
			this.isEditableItem.set(editable);
		}));

		this._register(this.tree.onDidBlur(() => {
			this.firstMatchFocused.reset();
			this.fileMatchOrMatchFocused.reset();
			this.fileMatchFocused.reset();
			this.folderMatchFocused.reset();
			this.matchFocused.reset();
			this.fileMatchOrFolderMatchFocus.reset();
			this.fileMatchOrFolderMatchWithResourceFocus.reset();
			this.folderMatchWithResourceFocused.reset();
			this.isEditableItem.reset();
		}));
	}

	protected onContextMenu(e: ITreeContextMenuEvent<RenderableMatch | null>): void { // {{SQL CARBON EDIT}}

		e.browserEvent.preventDefault();
		e.browserEvent.stopPropagation();

		this.contextMenuService.showContextMenu({
			menuId: MenuId.SearchContext,
			menuActionOptions: { shouldForwardArgs: true },
			contextKeyService: this.contextKeyService,
			getAnchor: () => e.anchor,
			getActionsContext: () => e.element,
		});
	}

	private hasSomeCollapsible(): boolean {
		const viewer = this.getControl();
		const navigator = viewer.navigate();
		let node = navigator.first();
		do {
			if (!viewer.isCollapsed(node)) {
				return true;
			}
		} while (node = navigator.next());

		return false;
	}

	selectNextMatch(): void {
		if (!this.hasSearchResults()) {
			return;
		}

		const [selected] = this.tree.getSelection();

		// Expand the initial selected node, if needed
		if (selected && !(selected instanceof Match)) {
			if (this.tree.isCollapsed(selected)) {
				this.tree.expand(selected);
			}
		}

		const navigator = this.tree.navigate(selected);

		let next = navigator.next();
		if (!next) {
			next = navigator.first();
		}

		// Expand until first child is a Match
		while (next && !(next instanceof Match)) {
			if (this.tree.isCollapsed(next)) {
				this.tree.expand(next);
			}

			// Select the first child
			next = navigator.next();
		}

		// Reveal the newly selected element
		if (next) {
			if (next === selected) {
				this.tree.setFocus([]);
			}
			const event = getSelectionKeyboardEvent(undefined, false, false);
			this.tree.setFocus([next], event);
			this.tree.setSelection([next], event);
			this.tree.reveal(next);
			const ariaLabel = this.treeAccessibilityProvider.getAriaLabel(next);
			if (ariaLabel) { aria.alert(ariaLabel); }
		}
	}

	selectPreviousMatch(): void {
		if (!this.hasSearchResults()) {
			return;
		}

		const [selected] = this.tree.getSelection();
		let navigator = this.tree.navigate(selected);

		let prev = navigator.previous();

		// Select previous until find a Match or a collapsed item
		while (!prev || (!(prev instanceof Match) && !this.tree.isCollapsed(prev))) {
			const nextPrev = prev ? navigator.previous() : navigator.last();

			if (!prev && !nextPrev) {
				return;
			}

			prev = nextPrev;
		}

		// Expand until last child is a Match
		while (!(prev instanceof Match)) {
			const nextItem = navigator.next();
			this.tree.expand(prev);
			navigator = this.tree.navigate(nextItem); // recreate navigator because modifying the tree can invalidate it
			prev = nextItem ? navigator.previous() : navigator.last(); // select last child
		}

		// Reveal the newly selected element
		if (prev) {
			if (prev === selected) {
				this.tree.setFocus([]);
			}
			const event = getSelectionKeyboardEvent(undefined, false, false);
			this.tree.setFocus([prev], event);
			this.tree.setSelection([prev], event);
			this.tree.reveal(prev);
			const ariaLabel = this.treeAccessibilityProvider.getAriaLabel(prev);
			if (ariaLabel) { aria.alert(ariaLabel); }
		}
	}

	moveFocusToResults(): void {
		this.tree.domFocus();
	}

	override focus(): void {
		super.focus();
		if (!env.isIOS && (this.lastFocusState === 'input' || !this.hasSearchResults())) {
			const updatedText = this.searchConfig.seedOnFocus ? this.updateTextFromSelection({ allowSearchOnType: false }) : false;
			this.searchWidget.focus(undefined, undefined, updatedText);
		} else {
			this.tree.domFocus();
		}
	}

	updateTextFromFindWidgetOrSelection({ allowUnselectedWord = true, allowSearchOnType = true }): boolean {
		let activeEditor = this.editorService.activeTextEditorControl;
		if (isCodeEditor(activeEditor) && !activeEditor?.hasTextFocus()) {
			const controller = CommonFindController.get(activeEditor);
			if (controller && controller.isFindInputFocused()) {
				return this.updateTextFromFindWidget(controller, { allowSearchOnType });
			}

			const editors = this.codeEditorService.listCodeEditors();
			activeEditor = editors.find(editor => editor instanceof EmbeddedCodeEditorWidget && editor.getParentEditor() === activeEditor && editor.hasTextFocus())
				?? activeEditor;
		}

		return this.updateTextFromSelection({ allowUnselectedWord, allowSearchOnType }, activeEditor);
	}

	private updateTextFromFindWidget(controller: CommonFindController, { allowSearchOnType = true }): boolean {
		if (!this.searchConfig.seedWithNearestWord && (window.getSelection()?.toString() ?? '') === '') {
			return false;
		}

		const searchString = controller.getState().searchString;
		if (searchString === '') {
			return false;
		}

		this.searchWidget.searchInput?.setCaseSensitive(controller.getState().matchCase);
		this.searchWidget.searchInput?.setWholeWords(controller.getState().wholeWord);
		this.searchWidget.searchInput?.setRegex(controller.getState().isRegex);
		this.updateText(searchString, allowSearchOnType);

		return true;
	}

	private updateTextFromSelection({ allowUnselectedWord = true, allowSearchOnType = true }, editor?: IEditor): boolean {
		const seedSearchStringFromSelection = this.configurationService.getValue<IEditorOptions>('editor').find!.seedSearchStringFromSelection;
		if (!seedSearchStringFromSelection) {
			return false;
		}

		let selectedText = this.getSearchTextFromEditor(allowUnselectedWord, editor);
		if (selectedText === null) {
			return false;
		}

		if (this.searchWidget.searchInput?.getRegex()) {
			selectedText = strings.escapeRegExpCharacters(selectedText);
		}

		this.updateText(selectedText, allowSearchOnType);
		return true;
	}

	private updateText(text: string, allowSearchOnType: boolean = true) {
		if (allowSearchOnType && !this.viewModel.searchResult.isDirty) {
			this.searchWidget.setValue(text);
		} else {
			this.pauseSearching = true;
			this.searchWidget.setValue(text);
			this.pauseSearching = false;
		}
	}

	focusNextInputBox(): void {
		if (this.searchWidget.searchInputHasFocus()) {
			if (this.searchWidget.isReplaceShown()) {
				this.searchWidget.focus(true, true);
			} else {
				this.moveFocusFromSearchOrReplace();
			}
			return;
		}

		if (this.searchWidget.replaceInputHasFocus()) {
			this.moveFocusFromSearchOrReplace();
			return;
		}

		if (this.inputPatternIncludes.inputHasFocus()) {
			this.inputPatternExcludes.focus();
			this.inputPatternExcludes.select();
			return;
		}

		if (this.inputPatternExcludes.inputHasFocus()) {
			this.selectTreeIfNotSelected();
			return;
		}
	}

	private moveFocusFromSearchOrReplace() {
		if (this.showsFileTypes()) {
			this.toggleQueryDetails(true, this.showsFileTypes());
		} else {
			this.selectTreeIfNotSelected();
		}
	}

	focusPreviousInputBox(): void {
		if (this.searchWidget.searchInputHasFocus()) {
			return;
		}

		if (this.searchWidget.replaceInputHasFocus()) {
			this.searchWidget.focus(true);
			return;
		}

		if (this.inputPatternIncludes.inputHasFocus()) {
			this.searchWidget.focus(true, true);
			return;
		}

		if (this.inputPatternExcludes.inputHasFocus()) {
			this.inputPatternIncludes.focus();
			this.inputPatternIncludes.select();
			return;
		}

		if (this.tree.isDOMFocused()) {
			this.moveFocusFromResults();
			return;
		}
	}

	private moveFocusFromResults(): void {
		if (this.showsFileTypes()) {
			this.toggleQueryDetails(true, true, false, true);
		} else {
			this.searchWidget.focus(true, true);
		}
	}

	public reLayout(): void { // {{SQL CARBON EDIT}} - make public
		if (this.isDisposed || !this.size) {
			return;
		}

		const actionsPosition = this.searchConfig.actionsPosition;
		this.getContainer().classList.toggle(SearchView.ACTIONS_RIGHT_CLASS_NAME, actionsPosition === 'right');

		this.searchWidget.setWidth(this.size.width - 28 /* container margin */);

		this.inputPatternExcludes.setWidth(this.size.width - 28 /* container margin */);
		this.inputPatternIncludes.setWidth(this.size.width - 28 /* container margin */);

		const widgetHeight = dom.getTotalHeight(this.searchWidgetsContainerElement);
		const messagesHeight = dom.getTotalHeight(this.messagesElement);
		this.tree.layout(this.size.height - widgetHeight - messagesHeight, this.size.width - 28);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.size = new dom.Dimension(width, height);
		this.reLayout();
	}

	getControl() {
		return this.tree;
	}

	allSearchFieldsClear(): boolean {
		return this.searchWidget.getReplaceValue() === '' &&
			(!this.searchWidget.searchInput || this.searchWidget.searchInput.getValue() === '');
	}

	allFilePatternFieldsClear(): boolean {
		return this.searchExcludePattern.getValue() === '' &&
			this.searchIncludePattern.getValue() === '';
	}

	hasSearchResults(): boolean {
		return !this.viewModel.searchResult.isEmpty();
	}

	clearSearchResults(clearInput = true): void {
		this.viewModel.searchResult.clear();
		this.showEmptyStage(true);
		if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
			this.showSearchWithoutFolderMessage();
		}
		if (clearInput) {
			if (this.allSearchFieldsClear()) {
				this.clearFilePatternFields();
			}
			this.searchWidget.clear();
		}
		this.viewModel.cancelSearch();
		this.tree.ariaLabel = nls.localize('emptySearch', "Empty Search");

		aria.status(nls.localize('ariaSearchResultsClearStatus', "The search results have been cleared"));
		this.reLayout();
	}

	clearFilePatternFields(): void {
		this.searchExcludePattern.clear();
		this.searchIncludePattern.clear();
	}

	cancelSearch(focus: boolean = true): boolean {
		if (this.viewModel.cancelSearch()) {
			if (focus) { this.searchWidget.focus(); }
			return true;
		}
		return false;
	}

	private selectTreeIfNotSelected(): void {
		if (this.tree.getNode(null)) {
			this.tree.domFocus();
			const selection = this.tree.getSelection();
			if (selection.length === 0) {
				const event = getSelectionKeyboardEvent();
				this.tree.focusNext(undefined, undefined, event);
				this.tree.setSelection(this.tree.getFocus(), event);
			}
		}
	}

	private getSearchTextFromEditor(allowUnselectedWord: boolean, editor?: IEditor): string | null {
		if (dom.isAncestor(document.activeElement, this.getContainer())) {
			return null;
		}

		editor = editor ?? this.editorService.activeTextEditorControl;
		if (isDiffEditor(editor)) {
			if (editor.getOriginalEditor().hasTextFocus()) {
				editor = editor.getOriginalEditor();
			} else {
				editor = editor.getModifiedEditor();
			}
		}

		if (!isCodeEditor(editor) || !editor.hasModel()) {
			return null;
		}

		const range = editor.getSelection();
		if (!range) {
			return null;
		}

		if (range.isEmpty() && this.searchConfig.seedWithNearestWord && allowUnselectedWord) {
			const wordAtPosition = editor.getModel().getWordAtPosition(range.getStartPosition());
			if (wordAtPosition) {
				return wordAtPosition.word;
			}
		}

		if (!range.isEmpty()) {
			let searchText = '';
			for (let i = range.startLineNumber; i <= range.endLineNumber; i++) {
				let lineText = editor.getModel().getLineContent(i);
				if (i === range.endLineNumber) {
					lineText = lineText.substring(0, range.endColumn - 1);
				}

				if (i === range.startLineNumber) {
					lineText = lineText.substring(range.startColumn - 1);
				}

				if (i !== range.startLineNumber) {
					lineText = '\n' + lineText;
				}

				searchText += lineText;
			}

			return searchText;
		}

		return null;
	}

	private showsFileTypes(): boolean {
		return this.queryDetails.classList.contains('more');
	}

	toggleCaseSensitive(): void {
		this.searchWidget.searchInput?.setCaseSensitive(!this.searchWidget.searchInput.getCaseSensitive());
		this.triggerQueryChange();
	}

	toggleWholeWords(): void {
		this.searchWidget.searchInput?.setWholeWords(!this.searchWidget.searchInput.getWholeWords());
		this.triggerQueryChange();
	}

	toggleRegex(): void {
		this.searchWidget.searchInput?.setRegex(!this.searchWidget.searchInput.getRegex());
		this.triggerQueryChange();
	}

	togglePreserveCase(): void {
		this.searchWidget.replaceInput?.setPreserveCase(!this.searchWidget.replaceInput.getPreserveCase());
		this.triggerQueryChange();
	}

	setSearchParameters(args: IFindInFilesArgs = {}): void {
		if (typeof args.isCaseSensitive === 'boolean') {
			this.searchWidget.searchInput?.setCaseSensitive(args.isCaseSensitive);
		}
		if (typeof args.matchWholeWord === 'boolean') {
			this.searchWidget.searchInput?.setWholeWords(args.matchWholeWord);
		}
		if (typeof args.isRegex === 'boolean') {
			this.searchWidget.searchInput?.setRegex(args.isRegex);
		}
		if (typeof args.filesToInclude === 'string') {
			this.searchIncludePattern.setValue(String(args.filesToInclude));
		}
		if (typeof args.filesToExclude === 'string') {
			this.searchExcludePattern.setValue(String(args.filesToExclude));
		}
		if (typeof args.query === 'string') {
			this.searchWidget.searchInput?.setValue(args.query);
		}
		if (typeof args.replace === 'string') {
			this.searchWidget.replaceInput?.setValue(args.replace);
		} else {
			if (this.searchWidget.replaceInput && this.searchWidget.replaceInput.getValue() !== '') {
				this.searchWidget.replaceInput.setValue('');
			}
		}
		if (typeof args.triggerSearch === 'boolean' && args.triggerSearch) {
			this.triggerQueryChange();
		}
		if (typeof args.preserveCase === 'boolean') {
			this.searchWidget.replaceInput?.setPreserveCase(args.preserveCase);
		}
		if (typeof args.useExcludeSettingsAndIgnoreFiles === 'boolean') {
			this.inputPatternExcludes.setUseExcludesAndIgnoreFiles(args.useExcludeSettingsAndIgnoreFiles);
		}
		if (typeof args.onlyOpenEditors === 'boolean') {
			this.searchIncludePattern.setOnlySearchInOpenEditors(args.onlyOpenEditors);
		}
	}

	toggleQueryDetails(moveFocus = true, show?: boolean, skipLayout?: boolean, reverse?: boolean): void {
		const cls = 'more';
		show = typeof show === 'undefined' ? !this.queryDetails.classList.contains(cls) : Boolean(show);
		this.viewletState['query.queryDetailsExpanded'] = show;
		skipLayout = Boolean(skipLayout);

		if (show) {
			this.toggleQueryDetailsButton.setAttribute('aria-expanded', 'true');
			this.queryDetails.classList.add(cls);
			if (moveFocus) {
				if (reverse) {
					this.inputPatternExcludes.focus();
					this.inputPatternExcludes.select();
				} else {
					this.inputPatternIncludes.focus();
					this.inputPatternIncludes.select();
				}
			}
		} else {
			this.toggleQueryDetailsButton.setAttribute('aria-expanded', 'false');
			this.queryDetails.classList.remove(cls);
			if (moveFocus) {
				this.searchWidget.focus();
			}
		}

		if (!skipLayout && this.size) {
			this.reLayout();
		}
	}

	searchInFolders(folderPaths: string[] = []): void {
		this._searchWithIncludeOrExclude(true, folderPaths);
	}

	searchOutsideOfFolders(folderPaths: string[] = []): void {
		this._searchWithIncludeOrExclude(false, folderPaths);
	}

	private _searchWithIncludeOrExclude(include: boolean, folderPaths: string[]) {
		if (!folderPaths.length || folderPaths.some(folderPath => folderPath === '.')) {
			this.inputPatternIncludes.setValue('');
			this.searchWidget.focus();
			return;
		}

		// Show 'files to include' box
		if (!this.showsFileTypes()) {
			this.toggleQueryDetails(true, true);
		}

		(include ? this.inputPatternIncludes : this.inputPatternExcludes).setValue(folderPaths.join(', '));
		this.searchWidget.focus(false);
	}

	triggerQueryChange(_options?: { preserveFocus?: boolean; triggeredOnType?: boolean; delay?: number }) {
		const options = { preserveFocus: true, triggeredOnType: false, delay: 0, ..._options };

		if (options.triggeredOnType && !this.searchConfig.searchOnType) { return; }

		if (!this.pauseSearching) {
			this.triggerQueryDelayer.trigger(() => {
				this._onQueryChanged(options.preserveFocus, options.triggeredOnType);
			}, options.delay);
		}
	}

	private _onQueryChanged(preserveFocus: boolean, triggeredOnType = false): void {
		if (!(this.searchWidget.searchInput?.inputBox.isInputValid())) {
			return;
		}

		const isRegex = this.searchWidget.searchInput.getRegex();
		const isInNotebookMarkdownInput = this.searchWidget.getNotebookFilters().markupInput;
		const isInNotebookMarkdownPreview = this.searchWidget.getNotebookFilters().markupPreview;
		const isInNotebookCellInput = this.searchWidget.getNotebookFilters().codeInput;
		const isInNotebookCellOutput = this.searchWidget.getNotebookFilters().codeOutput;

		const isWholeWords = this.searchWidget.searchInput.getWholeWords();
		const isCaseSensitive = this.searchWidget.searchInput.getCaseSensitive();
		const contentPattern = this.searchWidget.searchInput.getValue();
		const excludePatternText = this.inputPatternExcludes.getValue().trim();
		const includePatternText = this.inputPatternIncludes.getValue().trim();
		const useExcludesAndIgnoreFiles = this.inputPatternExcludes.useExcludesAndIgnoreFiles();
		const onlySearchInOpenEditors = this.inputPatternIncludes.onlySearchInOpenEditors();

		if (contentPattern.length === 0) {
			this.clearSearchResults(false);
			this.clearMessage();
			return;
		}

		const content: IPatternInfo = {
			pattern: contentPattern,
			isRegExp: isRegex,
			isCaseSensitive: isCaseSensitive,
			isWordMatch: isWholeWords,
			notebookInfo: {
				isInNotebookMarkdownInput,
				isInNotebookMarkdownPreview,
				isInNotebookCellInput,
				isInNotebookCellOutput
			}
		};

		const excludePattern = this.inputPatternExcludes.getValue();
		const includePattern = this.inputPatternIncludes.getValue();

		// Need the full match line to correctly calculate replace text, if this is a search/replace with regex group references ($1, $2, ...).
		// 10000 chars is enough to avoid sending huge amounts of text around, if you do a replace with a longer match, it may or may not resolve the group refs correctly.
		// https://github.com/microsoft/vscode/issues/58374
		const charsPerLine = content.isRegExp ? 10000 : 1000;

		const options: ITextQueryBuilderOptions = {
			_reason: 'searchView',
			extraFileResources: this.instantiationService.invokeFunction(getOutOfWorkspaceEditorResources),
			maxResults: withNullAsUndefined(this.searchConfig.maxResults),
			disregardIgnoreFiles: !useExcludesAndIgnoreFiles || undefined,
			disregardExcludeSettings: !useExcludesAndIgnoreFiles || undefined,
			onlyOpenEditors: onlySearchInOpenEditors,
			excludePattern,
			includePattern,
			previewOptions: {
				matchLines: 1,
				charsPerLine
			},
			isSmartCase: this.searchConfig.smartCase,
			expandPatterns: true
		};
		const folderResources = this.contextService.getWorkspace().folders;

		const onQueryValidationError = (err: Error) => {
			this.searchWidget.searchInput?.showMessage({ content: err.message, type: MessageType.ERROR });
			this.viewModel.searchResult.clear();
		};

		let query: ITextQuery;
		try {
			query = this.queryBuilder.text(content, folderResources.map(folder => folder.uri), options);
		} catch (err) {
			onQueryValidationError(err);
			return;
		}

		this.validateQuery(query).then(() => {
			this.onQueryTriggered(query, options, excludePatternText, includePatternText, triggeredOnType);

			if (!preserveFocus) {
				this.searchWidget.focus(false, undefined, true); // focus back to input field
			}
		}, onQueryValidationError);
	}

	private validateQuery(query: ITextQuery): Promise<void> {
		// Validate folderQueries
		const folderQueriesExistP =
			query.folderQueries.map(fq => {
				return this.fileService.exists(fq.folder).catch(() => false);
			});

		return Promise.all(folderQueriesExistP).then(existResults => {
			// If no folders exist, show an error message about the first one
			const existingFolderQueries = query.folderQueries.filter((folderQuery, i) => existResults[i]);
			if (!query.folderQueries.length || existingFolderQueries.length) {
				query.folderQueries = existingFolderQueries;
			} else {
				const nonExistantPath = query.folderQueries[0].folder.fsPath;
				const searchPathNotFoundError = nls.localize('searchPathNotFoundError', "Search path not found: {0}", nonExistantPath);
				return Promise.reject(new Error(searchPathNotFoundError));
			}

			return undefined;
		});
	}

	private onQueryTriggered(query: ITextQuery, options: ITextQueryBuilderOptions, excludePatternText: string, includePatternText: string, triggeredOnType: boolean): void {
		this.addToSearchHistoryDelayer.trigger(() => {
			this.searchWidget.searchInput?.onSearchSubmit();
			this.inputPatternExcludes.onSearchSubmit();
			this.inputPatternIncludes.onSearchSubmit();
		});

		this.viewModel.cancelSearch(true);

		this.currentSearchQ = this.currentSearchQ
			.then(() => this.doSearch(query, excludePatternText, includePatternText, triggeredOnType))
			.then(() => undefined, () => undefined);
	}


	private _updateResults() {
		try {
			if (this.state === SearchUIState.Idle) {
				return;
			}

			// Search result tree update
			const fileCount = this.viewModel.searchResult.fileCount();
			if (this._visibleMatches !== fileCount) {
				this._visibleMatches = fileCount;
				this.refreshAndUpdateCount();
			}
		} finally {
			// show frequent progress and results by scheduling updates 80 ms after the last one
			this._refreshResultsScheduler.schedule();
		}
	}

	private doSearch(query: ITextQuery, excludePatternText: string, includePatternText: string, triggeredOnType: boolean): Thenable<void> {
		let progressComplete: () => void;
		this.progressService.withProgress({ location: this.getProgressLocation(), delay: triggeredOnType ? 300 : 0 }, _progress => {
			return new Promise<void>(resolve => progressComplete = resolve);
		});

		this.searchWidget.searchInput?.clearMessage();
		this.state = SearchUIState.Searching;
		this.showEmptyStage();

		const slowTimer = setTimeout(() => {
			this.state = SearchUIState.SlowSearch;
		}, 2000);

		const onComplete = (completed?: ISearchComplete) => {
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

			this.viewModel.replaceString = this.searchWidget.getReplaceValue();

			const hasResults = !this.viewModel.searchResult.isEmpty();
			if (completed?.exit === SearchCompletionExitCode.NewSearchStarted) {
				return;
			}

			if (!hasResults) {
				const hasExcludes = !!excludePatternText;
				const hasIncludes = !!includePatternText;
				let message: string;

				if (!completed) {
					message = SEARCH_CANCELLED_MESSAGE;
				} else if (this.inputPatternIncludes.onlySearchInOpenEditors()) {
					if (hasIncludes && hasExcludes) {
						message = nls.localize('noOpenEditorResultsIncludesExcludes', "No results found in open editors matching '{0}' excluding '{1}' - ", includePatternText, excludePatternText);
					} else if (hasIncludes) {
						message = nls.localize('noOpenEditorResultsIncludes', "No results found in open editors matching '{0}' - ", includePatternText);
					} else if (hasExcludes) {
						message = nls.localize('noOpenEditorResultsExcludes', "No results found in open editors excluding '{0}' - ", excludePatternText);
					} else {
						message = nls.localize('noOpenEditorResultsFound', "No results found in open editors. Review your settings for configured exclusions and check your gitignore files - ");
					}
				} else {
					if (hasIncludes && hasExcludes) {
						message = nls.localize('noResultsIncludesExcludes', "No results found in '{0}' excluding '{1}' - ", includePatternText, excludePatternText);
					} else if (hasIncludes) {
						message = nls.localize('noResultsIncludes', "No results found in '{0}' - ", includePatternText);
					} else if (hasExcludes) {
						message = nls.localize('noResultsExcludes', "No results found excluding '{0}' - ", excludePatternText);
					} else {
						message = nls.localize('noResultsFound', "No results found. Review your settings for configured exclusions and check your gitignore files - ");
					}
				}

				// Indicate as status to ARIA
				aria.status(message);

				const messageEl = this.clearMessage();
				dom.append(messageEl, message);

				if (!completed) {
					const searchAgainButton = this.messageDisposables.add(new SearchLinkButton(
						nls.localize('rerunSearch.message', "Search again"),
						() => this.triggerQueryChange({ preserveFocus: false })));
					dom.append(messageEl, searchAgainButton.element);
				} else if (hasIncludes || hasExcludes) {
					const searchAgainButton = this.messageDisposables.add(new SearchLinkButton(nls.localize('rerunSearchInAll.message', "Search again in all files"), this.onSearchAgain.bind(this)));
					dom.append(messageEl, searchAgainButton.element);
				} else {
					const openSettingsButton = this.messageDisposables.add(new SearchLinkButton(nls.localize('openSettings.message', "Open Settings"), this.onOpenSettings.bind(this)));
					dom.append(messageEl, openSettingsButton.element);
				}

				if (completed) {
					dom.append(messageEl, $('span', undefined, ' - '));

					const learnMoreButton = this.messageDisposables.add(new SearchLinkButton(nls.localize('openSettings.learnMore', "Learn More"), this.onLearnMore.bind(this)));
					dom.append(messageEl, learnMoreButton.element);
				}

				if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
					this.showSearchWithoutFolderMessage();
				}
				this.reLayout();
			} else {
				this.viewModel.searchResult.toggleHighlights(this.isVisible()); // show highlights

				// Indicate final search result count for ARIA
				aria.status(nls.localize('ariaSearchResultsStatus', "Search returned {0} results in {1} files", this.viewModel.searchResult.count(), this.viewModel.searchResult.fileCount()));
			}


			if (completed && completed.limitHit) {
				completed.messages.push({ type: TextSearchCompleteMessageType.Warning, text: nls.localize('searchMaxResultsWarning', "The result set only contains a subset of all matches. Be more specific in your search to narrow down the results.") });
			}

			if (completed && completed.messages) {
				for (const message of completed.messages) {
					this.addMessage(message);
				}
			}

			this.reLayout();
		};

		const onError = (e: any) => {
			clearTimeout(slowTimer);
			this.state = SearchUIState.Idle;
			if (errors.isCancellationError(e)) {
				return onComplete(undefined);
			} else {
				progressComplete();
				this.searchWidget.searchInput?.showMessage({ content: e.message, type: MessageType.ERROR });
				this.viewModel.searchResult.clear();

				return Promise.resolve();
			}
		};

		this._visibleMatches = 0;

		this._refreshResultsScheduler.schedule();

		this.searchWidget.setReplaceAllActionState(false);

		this.tree.setSelection([]);
		this.tree.setFocus([]);
		return this.viewModel.search(query)
			.then(onComplete, onError);
	}

	protected onOpenSettings(e: dom.EventLike): void { // {{SQL CARBON EDIT}} Increase visibility for overriding in Notebook search
		dom.EventHelper.stop(e, false);
		this.openSettings('@id:files.exclude,search.exclude,search.useParentIgnoreFiles,search.useGlobalIgnoreFiles,search.useIgnoreFiles');
	}

	private openSettings(query: string): Promise<IEditorPane | undefined> {
		const options: ISettingsEditorOptions = { query };
		return this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY ?
			this.preferencesService.openWorkspaceSettings(options) :
			this.preferencesService.openUserSettings(options);
	}

	protected onLearnMore(): void { // {{SQL CARBON EDIT}}
		this.openerService.open(URI.parse('https://go.microsoft.com/fwlink/?linkid=853977'));
	}

	protected onSearchAgain(): void { // {{SQL CARBON EDIT}} Increase visibility for overriding in Notebook search
		this.inputPatternExcludes.setValue('');
		this.inputPatternIncludes.setValue('');
		this.inputPatternIncludes.setOnlySearchInOpenEditors(false);

		this.triggerQueryChange({ preserveFocus: false });
	}

	private onEnableExcludes(): void {
		this.toggleQueryDetails(false, true);
		this.searchExcludePattern.setUseExcludesAndIgnoreFiles(true);
	}

	private onDisableSearchInOpenEditors(): void {
		this.toggleQueryDetails(false, true);
		this.inputPatternIncludes.setOnlySearchInOpenEditors(false);
	}

	protected updateSearchResultCount(disregardExcludesAndIgnores?: boolean, onlyOpenEditors: boolean = false, clear: boolean = false, showOpenInEditor: boolean = true): void { // {{SQL CARBON EDIT}} - Hide Open in Editor in Notebooks viewlet
		const fileCount = this.viewModel.searchResult.fileCount();
		this.hasSearchResultsKey.set(fileCount > 0);

		const msgWasHidden = this.messagesElement.style.display === 'none';

		const messageEl = this.clearMessage();
		const resultMsg = clear ? '' : this.buildResultCountMessage(this.viewModel.searchResult.count(), fileCount);
		this.tree.ariaLabel = resultMsg + nls.localize('forTerm', " - Search: {0}", this.searchResult.query?.contentPattern.pattern ?? '');
		dom.append(messageEl, resultMsg);

		if (fileCount > 0) {
			if (disregardExcludesAndIgnores) {
				const excludesDisabledMessage = ' - ' + nls.localize('useIgnoresAndExcludesDisabled', "exclude settings and ignore files are disabled") + ' ';
				const enableExcludesButton = this.messageDisposables.add(new SearchLinkButton(nls.localize('excludes.enable', "enable"), this.onEnableExcludes.bind(this), nls.localize('useExcludesAndIgnoreFilesDescription', "Use Exclude Settings and Ignore Files")));
				dom.append(messageEl, $('span', undefined, excludesDisabledMessage, '(', enableExcludesButton.element, ')'));
			}

			if (onlyOpenEditors) {
				const searchingInOpenMessage = ' - ' + nls.localize('onlyOpenEditors', "searching only in open files") + ' ';
				const disableOpenEditorsButton = this.messageDisposables.add(new SearchLinkButton(nls.localize('openEditors.disable', "disable"), this.onDisableSearchInOpenEditors.bind(this), nls.localize('disableOpenEditors', "Search in entire workspace")));
				dom.append(messageEl, $('span', undefined, searchingInOpenMessage, '(', disableOpenEditorsButton.element, ')'));
			}

			if (showOpenInEditor) { // {{SQL CARBON EDIT}} - Hide Open in Editor in Notebooks viewlet
				dom.append(messageEl, ' - ');
			} else {
				dom.append(messageEl);
			}

			if (showOpenInEditor) { // {{SQL CARBON EDIT}} - Hide Open in Editor in Notebooks viewlet
				const openInEditorTooltip = appendKeyBindingLabel(
					nls.localize('openInEditor.tooltip', "Copy current search results to an editor"),
					this.keybindingService.lookupKeybinding(Constants.OpenInEditorCommandId));
				const openInEditorButton = this.messageDisposables.add(new SearchLinkButton(
					nls.localize('openInEditor.message', "Open in editor"),
					() => this.instantiationService.invokeFunction(createEditorFromSearchResult, this.searchResult, this.searchIncludePattern.getValue(), this.searchExcludePattern.getValue(), this.searchIncludePattern.onlySearchInOpenEditors()),
					openInEditorTooltip));
				dom.append(messageEl, openInEditorButton.element);
			}

			this.reLayout();
		} else if (!msgWasHidden) {
			dom.hide(this.messagesElement);
		}
	}

	private addMessage(message: TextSearchCompleteMessage) {
		const messageBox = this.messagesElement.firstChild as HTMLDivElement;
		if (!messageBox) { return; }
		dom.append(messageBox, renderSearchMessage(message, this.instantiationService, this.notificationService, this.openerService, this.commandService, this.messageDisposables, () => this.triggerQueryChange()));
	}

	private buildResultCountMessage(resultCount: number, fileCount: number): string {
		if (resultCount === 1 && fileCount === 1) {
			return nls.localize('search.file.result', "{0} result in {1} file", resultCount, fileCount);
		} else if (resultCount === 1) {
			return nls.localize('search.files.result', "{0} result in {1} files", resultCount, fileCount);
		} else if (fileCount === 1) {
			return nls.localize('search.file.results', "{0} results in {1} file", resultCount, fileCount);
		} else {
			return nls.localize('search.files.results', "{0} results in {1} files", resultCount, fileCount);
		}
	}

	protected showSearchWithoutFolderMessage(): void { // {{SQL CARBON EDIT}}
		this.searchWithoutFolderMessageElement = this.clearMessage();

		const textEl = dom.append(this.searchWithoutFolderMessageElement,
			$('p', undefined, nls.localize('searchWithoutFolder', "You have not opened or specified a folder. Only open files are currently searched - ")));

		const openFolderButton = this.messageDisposables.add(new SearchLinkButton(
			nls.localize('openFolder', "Open Folder"),
			() => {
				this.commandService.executeCommand(env.isMacintosh && env.isNative ? OpenFileFolderAction.ID : OpenFolderAction.ID).catch(err => errors.onUnexpectedError(err));
			}));
		dom.append(textEl, openFolderButton.element);
	}

	protected showEmptyStage(forceHideMessages = false): void { // {{SQL CARBON EDIT}}
		const showingCancelled = (this.messagesElement.firstChild?.textContent?.indexOf(SEARCH_CANCELLED_MESSAGE) ?? -1) > -1;

		// clean up ui
		// this.replaceService.disposeAllReplacePreviews();
		if (showingCancelled || forceHideMessages || !this.configurationService.getValue<ISearchConfiguration>().search.searchOnType) {
			// when in search to type, don't preemptively hide, as it causes flickering and shifting of the live results
			dom.hide(this.messagesElement);
		}

		dom.show(this.resultsElement);
		this.currentSelectedFileMatch = undefined;
	}

	private shouldOpenInNotebookEditor(match: Match, uri: URI): boolean {
		// Untitled files will return a false positive for getContributedNotebookTypes.
		// Since untitled files are already open, then untitled notebooks should return NotebookMatch results.
		return match instanceof MatchInNotebook || (uri.scheme !== network.Schemas.untitled && this.notebookService.getContributedNotebookTypes(uri).length > 0);
	}

	private onFocus(lineMatch: Match, preserveFocus?: boolean, sideBySide?: boolean, pinned?: boolean): Promise<any> {
		const useReplacePreview = this.configurationService.getValue<ISearchConfiguration>().search.useReplacePreview;

		const resource = lineMatch instanceof Match ? lineMatch.parent().resource : (<FileMatch>lineMatch).resource;
		return (useReplacePreview && this.viewModel.isReplaceActive() && !!this.viewModel.replaceString && !(this.shouldOpenInNotebookEditor(lineMatch, resource))) ?
			this.replaceService.openReplacePreview(lineMatch, preserveFocus, sideBySide, pinned) :
			this.open(lineMatch, preserveFocus, sideBySide, pinned, resource);
	}

	async open(element: FileMatchOrMatch, preserveFocus?: boolean, sideBySide?: boolean, pinned?: boolean, resourceInput?: URI): Promise<void> {
		const selection = this.getSelectionFrom(element);
		const oldParentMatches = element instanceof Match ? element.parent().matches() : [];
		const resource = resourceInput ?? (element instanceof Match ? element.parent().resource : (<FileMatch>element).resource);
		let editor: IEditorPane | undefined;
		try {
			editor = await this.editorService.openEditor({
				resource: resource,
				options: {
					preserveFocus,
					pinned,
					selection,
					revealIfVisible: true
				}
			}, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);

			const editorControl = editor?.getControl();
			if (element instanceof Match && preserveFocus && isCodeEditor(editorControl)) {
				this.viewModel.searchResult.rangeHighlightDecorations.highlightRange(
					editorControl.getModel()!,
					element.range()
				);
			} else {
				this.viewModel.searchResult.rangeHighlightDecorations.removeHighlightRange();
			}
		} catch (err) {
			errors.onUnexpectedError(err);
			return;
		}

		if (editor instanceof NotebookEditor) {
			const elemParent = element.parent() as FileMatch;
			if (element instanceof Match) {
				if (element instanceof MatchInNotebook) {
					element.parent().showMatch(element);
				} else {
					const editorWidget = editor.getControl();
					if (editorWidget) {
						// Ensure that the editor widget is binded. If if is, then this should return immediately.
						// Otherwise, it will bind the widget.
						elemParent.bindNotebookEditorWidget(editorWidget);
						await elemParent.updateMatchesForEditorWidget();

						const matchIndex = oldParentMatches.findIndex(e => e.id() === element.id());
						const matches = element.parent().matches();
						const match = matchIndex >= matches.length ? matches[matches.length - 1] : matches[matchIndex];

						if (match instanceof MatchInNotebook) {
							elemParent.showMatch(match);
						}

						if (!this.tree.getFocus().includes(match) || !this.tree.getSelection().includes(match)) {
							this.tree.setSelection([match], getSelectionKeyboardEvent());
							this.tree.setFocus([match]);
						}
					}
				}
			}
		}
	}

	openEditorWithMultiCursor(element: FileMatchOrMatch): Promise<void> {
		const resource = element instanceof Match ? element.parent().resource : (<FileMatch>element).resource;
		return this.editorService.openEditor({
			resource: resource,
			options: {
				preserveFocus: false,
				pinned: true,
				revealIfVisible: true
			}
		}).then(editor => {
			if (editor) {
				let fileMatch = null;
				if (element instanceof FileMatch) {
					fileMatch = element;
				}
				else if (element instanceof Match) {
					fileMatch = element.parent();
				}

				if (fileMatch) {
					const selections = fileMatch.matches().map(m => new Selection(m.range().startLineNumber, m.range().startColumn, m.range().endLineNumber, m.range().endColumn));
					const codeEditor = getCodeEditor(editor.getControl());
					if (codeEditor) {
						const multiCursorController = MultiCursorSelectionController.get(codeEditor);
						multiCursorController?.selectAllUsingSelections(selections);
					}
				}
			}
			this.viewModel.searchResult.rangeHighlightDecorations.removeHighlightRange();
		}, errors.onUnexpectedError);
	}

	private getSelectionFrom(element: FileMatchOrMatch): any {
		let match: Match | null = null;
		if (element instanceof Match) {
			match = element;
		}
		if (element instanceof FileMatch && element.count() > 0) {
			match = element.matches()[element.matches().length - 1];
		}
		if (match) {
			const range = match.range();
			if (this.viewModel.isReplaceActive() && !!this.viewModel.replaceString) {
				const replaceString = match.replaceString;
				return {
					startLineNumber: range.startLineNumber,
					startColumn: range.startColumn,
					endLineNumber: range.startLineNumber,
					endColumn: range.startColumn + replaceString.length
				};
			}
			return range;
		}
		return undefined;
	}

	private onUntitledDidDispose(resource: URI): void {
		if (!this.viewModel) {
			return;
		}

		// remove search results from this resource as it got disposed
		const matches = this.viewModel.searchResult.matches();
		for (let i = 0, len = matches.length; i < len; i++) {
			if (resource.toString() === matches[i].resource.toString()) {
				this.viewModel.searchResult.remove(matches[i]);
			}
		}
	}

	private onFilesChanged(e: FileChangesEvent): void {
		if (!this.viewModel || (this.searchConfig.sortOrder !== SearchSortOrder.Modified && !e.gotDeleted())) {
			return;
		}

		const matches = this.viewModel.searchResult.matches();
		if (e.gotDeleted()) {
			const deletedMatches = matches.filter(m => e.contains(m.resource, FileChangeType.DELETED));

			this.viewModel.searchResult.remove(deletedMatches);
		} else {
			// Check if the changed file contained matches
			const changedMatches = matches.filter(m => e.contains(m.resource));
			if (changedMatches.length && this.searchConfig.sortOrder === SearchSortOrder.Modified) {
				// No matches need to be removed, but modified files need to have their file stat updated.
				this.updateFileStats(changedMatches).then(() => this.refreshTree());
			}
		}
	}

	protected get searchConfig(): ISearchConfigurationProperties { // {{SQL CARBON EDIT}}
		return this.configurationService.getValue<ISearchConfigurationProperties>('search');
	}

	private clearHistory(): void {
		this.searchWidget.clearHistory();
		this.inputPatternExcludes.clearHistory();
		this.inputPatternIncludes.clearHistory();
	}

	public override saveState(): void {
		// This can be called before renderBody() method gets called for the first time
		// if we move the searchView inside another viewPaneContainer
		if (!this.searchWidget) {
			return;
		}

		const patternExcludes = this.inputPatternExcludes?.getValue().trim() ?? '';
		const patternIncludes = this.inputPatternIncludes?.getValue().trim() ?? '';
		const onlyOpenEditors = this.inputPatternIncludes?.onlySearchInOpenEditors() ?? false;
		const useExcludesAndIgnoreFiles = this.inputPatternExcludes?.useExcludesAndIgnoreFiles() ?? true;
		const preserveCase = this.viewModel.preserveCase;

		if (this.searchWidget.searchInput) {
			const isRegex = this.searchWidget.searchInput.getRegex();
			const isWholeWords = this.searchWidget.searchInput.getWholeWords();
			const isCaseSensitive = this.searchWidget.searchInput.getCaseSensitive();
			const contentPattern = this.searchWidget.searchInput.getValue();

			const isInNotebookCellInput = this.searchWidget.getNotebookFilters().codeInput;
			const isInNotebookCellOutput = this.searchWidget.getNotebookFilters().codeOutput;
			const isInNotebookMarkdownInput = this.searchWidget.getNotebookFilters().markupInput;
			const isInNotebookMarkdownPreview = this.searchWidget.getNotebookFilters().markupPreview;

			this.viewletState['query.contentPattern'] = contentPattern;
			this.viewletState['query.regex'] = isRegex;
			this.viewletState['query.wholeWords'] = isWholeWords;
			this.viewletState['query.caseSensitive'] = isCaseSensitive;

			this.viewletState['query.isInNotebookMarkdownInput'] = isInNotebookMarkdownInput;
			this.viewletState['query.isInNotebookMarkdownPreview'] = isInNotebookMarkdownPreview;
			this.viewletState['query.isInNotebookCellInput'] = isInNotebookCellInput;
			this.viewletState['query.isInNotebookCellOutput'] = isInNotebookCellOutput;
		}

		this.viewletState['query.folderExclusions'] = patternExcludes;
		this.viewletState['query.folderIncludes'] = patternIncludes;
		this.viewletState['query.useExcludesAndIgnoreFiles'] = useExcludesAndIgnoreFiles;
		this.viewletState['query.preserveCase'] = preserveCase;
		this.viewletState['query.onlyOpenEditors'] = onlyOpenEditors;

		const isReplaceShown = this.searchAndReplaceWidget.isReplaceShown();
		this.viewletState['view.showReplace'] = isReplaceShown;
		this.viewletState['view.treeLayout'] = this.isTreeLayoutViewVisible;
		this.viewletState['query.replaceText'] = isReplaceShown && this.searchWidget.getReplaceValue();

		const history: ISearchHistoryValues = Object.create(null);

		const searchHistory = this.searchWidget.getSearchHistory();
		if (searchHistory && searchHistory.length) {
			history.search = searchHistory;
		}

		const replaceHistory = this.searchWidget.getReplaceHistory();
		if (replaceHistory && replaceHistory.length) {
			history.replace = replaceHistory;
		}

		const patternExcludesHistory = this.inputPatternExcludes.getHistory();
		if (patternExcludesHistory && patternExcludesHistory.length) {
			history.exclude = patternExcludesHistory;
		}

		const patternIncludesHistory = this.inputPatternIncludes.getHistory();
		if (patternIncludesHistory && patternIncludesHistory.length) {
			history.include = patternIncludesHistory;
		}

		this.searchHistoryService.save(history);

		this.memento.saveMemento();

		super.saveState();
	}

	protected async retrieveFileStats(): Promise<void> { // {{SQL CARBON EDIT}}
		const files = this.searchResult.matches().filter(f => !f.fileStat).map(f => f.resolveFileStat(this.fileService));
		await Promise.all(files);
	}

	private async updateFileStats(elements: FileMatch[]): Promise<void> {
		const files = elements.map(f => f.resolveFileStat(this.fileService));
		await Promise.all(files);
	}

	private removeFileStats(): void {
		for (const fileMatch of this.searchResult.matches()) {
			fileMatch.fileStat = undefined;
		}
	}

	override dispose(): void {
		this.isDisposed = true;
		this.saveState();
		super.dispose();
	}
}


export class SearchLinkButton extends Disposable { // {{SQL CARBON EDIT}} - export class
	public readonly element: HTMLElement;

	constructor(label: string, handler: (e: dom.EventLike) => unknown, tooltip?: string) {
		super();
		this.element = $('a.pointer', { tabindex: 0, title: tooltip }, label);
		this.addEventHandlers(handler);
	}

	private addEventHandlers(handler: (e: dom.EventLike) => unknown): void {
		const wrappedHandler = (e: dom.EventLike) => {
			dom.EventHelper.stop(e, false);
			handler(e);
		};

		this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, wrappedHandler));
		this._register(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Space) || event.equals(KeyCode.Enter)) {
				wrappedHandler(e);
				event.preventDefault();
				event.stopPropagation();
			}
		}));
	}
}
